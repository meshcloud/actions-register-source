import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import axios from 'axios';
import { withRetry } from '../src/retry';

const noSleep = async () => {};

describe('retry.ts - withRetry against a real server', () => {
  let server: http.Server;
  let baseUrl: string;
  let statuses: number[];
  let requestCount: number;

  before(async () => {
    server = http.createServer((req, res) => {
      const status = statuses[requestCount] ?? 200;
      requestCount++;
      if (status === 0) {
        return; // never answer
      }
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  beforeEach(() => {
    requestCount = 0;
  });

  for (const status of [502, 503, 504]) {
    it(`retries a ${status} until the request succeeds`, async () => {
      statuses = [status, status, 200];
      const warnings: string[] = [];

      const response = await withRetry(() => axios.get(baseUrl), { warning: m => warnings.push(m), sleep: noSleep });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(requestCount, 3);
      assert.strictEqual(warnings.length, 2);
      assert.match(warnings[0], /Attempt 1 failed .*Status: \d+.*Retrying in 2s/);
      assert.match(warnings[1], /Attempt 2 failed .*Retrying in 4s/);
    });
  }

  for (const status of [500, 400, 401, 404, 409]) {
    it(`does not retry a ${status}`, async () => {
      statuses = [status];

      await assert.rejects(
        withRetry(() => axios.get(baseUrl), { warning: () => {}, sleep: noSleep }),
        (error: any) => error.response?.status === status
      );
      assert.strictEqual(requestCount, 1);
    });
  }

  it('retries a request that runs into the per-attempt timeout', async () => {
    statuses = [0, 200];

    const response = await withRetry(() => axios.get(baseUrl, { timeout: 100 }), { warning: () => {}, sleep: noSleep });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(requestCount, 2);
  });

  it('retries a refused connection', async () => {
    const closedServer = http.createServer();
    await new Promise<void>(resolve => closedServer.listen(0, '127.0.0.1', resolve));
    const closedUrl = `http://127.0.0.1:${(closedServer.address() as AddressInfo).port}`;
    await new Promise(resolve => closedServer.close(resolve));
    let attempts = 0;

    await assert.rejects(
      withRetry(() => { attempts++; return axios.get(closedUrl); }, { warning: () => {}, sleep: noSleep, budgetMs: 10_000 }),
      (error: any) => error.code === 'ECONNREFUSED'
    );
    assert.ok(attempts > 1);
  });

  it('warns when a retried request ends in an error that is not retried', async () => {
    statuses = [504, 400];
    const warnings: string[] = [];

    await assert.rejects(withRetry(() => axios.get(baseUrl), { warning: m => warnings.push(m), sleep: noSleep }));
    assert.match(warnings[1], /An earlier attempt may have reached meshStack/);
  });
});

describe('retry.ts - withRetry backoff and budget', () => {
  const unavailable = () => Promise.reject(new axios.AxiosError('unavailable', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status: 503, statusText: 'Service Unavailable', headers: {}, config: {} as any, data: ''
  }));

  it('backs off exponentially up to 60s and gives up after 10 minutes', async () => {
    let clock = 0;
    const delays: number[] = [];
    const sleep = async (ms: number) => { delays.push(ms); clock += ms; };

    await assert.rejects(
      withRetry(unavailable, { warning: () => {}, sleep, now: () => clock }),
      (error: any) => error.response?.status === 503
    );

    assert.deepStrictEqual(delays.slice(0, 7), [2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000]);
    const total = delays.reduce((a, b) => a + b, 0);
    assert.ok(total < 600_000 && total > 540_000, `total backoff was ${total}ms`);
  });

  it('does not retry an error that is not an HTTP error', async () => {
    let attempts = 0;

    await assert.rejects(
      withRetry(() => { attempts++; return Promise.reject(new Error('boom')); }, { warning: () => {}, sleep: noSleep }),
      { message: 'boom' }
    );
    assert.strictEqual(attempts, 1);
  });
});
