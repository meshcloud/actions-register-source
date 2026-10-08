import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { AddressInfo } from 'node:net';
import { CoreAdapter, runRegisterSource } from '../src/index';

const buildingBlockRun = {
  metadata: { uuid: 'run-uuid' },
  spec: { buildingBlock: { spec: { inputs: [] } } },
  _links: { meshstackBaseUrl: { href: '' }, self: { href: '' } }
};

describe('runRegisterSource while meshStack is unavailable', () => {
  let server: http.Server;
  let runUrl: string;
  let responses: Record<string, number[]>;
  let requests: string[];
  let failures: string[];
  let runnerTemp: string;

  const coreAdapter: CoreAdapter = {
    getInput: () => '[{ "id": "deploy", "displayName": "Deploy" }]',
    setOutput: () => {},
    setFailed: message => failures.push(message),
    debug: () => {},
    info: () => {},
    warning: () => {},
    error: () => {}
  };

  const register = () => runRegisterSource(
    coreAdapter,
    { context: { runId: 1, repo: { owner: 'o', repo: 'r' }, payload: { inputs: { buildingBlockRunUrl: runUrl } } } },
    { sleep: async () => {} }
  );

  before(async () => {
    server = http.createServer((req, res) => {
      requests.push(req.method!);
      const status = responses[req.method!].shift() ?? 200;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(req.method === 'GET' && status === 200 ? JSON.stringify(buildingBlockRun) : '');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    runUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/runs/run-uuid`;

    runnerTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'register-source-'));
    fs.writeFileSync(path.join(runnerTemp, 'meshstack_token.json'), JSON.stringify({ token: 't' }));
    process.env.RUNNER_TEMP = runnerTemp;
  });

  after(() => {
    server.close();
    fs.rmSync(runnerTemp, { recursive: true });
    delete process.env.RUNNER_TEMP;
  });

  beforeEach(() => {
    requests = [];
    failures = [];
  });

  it('retries loading the run and registering the source', async () => {
    responses = { GET: [503, 200], POST: [502, 200] };

    await register();

    assert.deepStrictEqual(failures, []);
    assert.deepStrictEqual(requests, ['GET', 'GET', 'POST', 'POST']);
  });

  it('succeeds when a retried registration finds the source an earlier attempt registered', async () => {
    responses = { GET: [200], POST: [504, 409] };

    await register();

    assert.deepStrictEqual(failures, []);
  });

  it('fails when the first registration attempt finds the source already registered', async () => {
    responses = { GET: [200], POST: [409] };

    await register();

    assert.strictEqual(failures.length, 1);
    assert.deepStrictEqual(requests, ['GET', 'POST']);
  });
});
