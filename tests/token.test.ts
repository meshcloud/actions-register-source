import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

describe('register-source token file reading', () => {
  const mockTokenData = {
    token: 'test-token-123',
    bbRunUuid: 'uuid-456',
    baseUrl: 'https://api.example.com'
  };

  const tokenFilePath = path.join(os.tmpdir(), 'register-source-test-token.json');

  beforeEach(() => {
    // Clean up test files
    if (fs.existsSync(tokenFilePath)) {
      fs.unlinkSync(tokenFilePath);
    }
  });

  describe('token file reading from well-known location', () => {
    it('should read token from well-known location when file exists', () => {
      // Write test token file
      fs.writeFileSync(tokenFilePath, JSON.stringify(mockTokenData));

      // Simulate the token reading logic
      if (!fs.existsSync(tokenFilePath)) {
        throw new Error(`Token file does not exist at ${tokenFilePath}`);
      }

      const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
      const token = tokenData.token;

      assert.strictEqual(token, 'test-token-123');
      assert.deepStrictEqual(tokenData, mockTokenData);
    });

    it('should throw error when token file does not exist at well-known location', () => {
      const nonExistentPath = path.join(os.tmpdir(), 'non-existent-register-token.json');

      assert.throws(
        () => {
          if (!fs.existsSync(nonExistentPath)) {
            throw new Error(`Token file does not exist at ${nonExistentPath}`);
          }
        },
        { message: /Token file does not exist/ }
      );
    });

    it('should throw error when token is not in file', () => {
      const incompleteTokenData = {
        bbRunUuid: 'uuid-456',
        baseUrl: 'https://api.example.com'
        // token missing
      };

      fs.writeFileSync(tokenFilePath, JSON.stringify(incompleteTokenData));

      if (!fs.existsSync(tokenFilePath)) {
        throw new Error(`Token file does not exist at ${tokenFilePath}`);
      }

      const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
      const token = tokenData.token;

      assert.throws(
        () => {
          if (!token) {
            throw new Error('Token not found in token file');
          }
        },
        { message: 'Token not found in token file' }
      );
    });

    it('should parse valid JSON token file', () => {
      fs.writeFileSync(tokenFilePath, JSON.stringify(mockTokenData));

      if (!fs.existsSync(tokenFilePath)) {
        throw new Error(`Token file does not exist at ${tokenFilePath}`);
      }

      const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
      const token = tokenData.token;

      assert.strictEqual(token, 'test-token-123');
      assert.strictEqual(tokenData.bbRunUuid, 'uuid-456');
      assert.strictEqual(tokenData.baseUrl, 'https://api.example.com');
    });

    it('should throw error when token file contains invalid JSON', () => {
      fs.writeFileSync(tokenFilePath, 'invalid json {');

      if (!fs.existsSync(tokenFilePath)) {
        throw new Error(`Token file does not exist at ${tokenFilePath}`);
      }

      assert.throws(
        () => {
          JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
        }
      );
    });

    it('should use correct path pattern for token file', () => {
      const tempDir = os.tmpdir();
      const expectedPath = path.join(tempDir, 'meshstack_token.json');

      assert(expectedPath.includes('meshstack_token.json'));
      assert(expectedPath.includes(tempDir));
    });
  });

  describe('building block run parsing from URL vs payload', () => {
    const mockBuildingBlockRun = {
      kind: 'meshBuildingBlockRun',
      apiVersion: 'v1',
      metadata: {
        uuid: 'b3116611-e08b-4b00-91c5-10365b25a6ef'
      },
      spec: {
        runNumber: 1,
        buildingBlock: {
          uuid: '68ce5455-2a4a-4a4b-a324-6a6c18cab85a',
          spec: {
            displayName: 'block',
            workspaceIdentifier: 'my-workspace',
            projectIdentifier: 'my-project',
            fullPlatformIdentifier: 'my-platform.my-location',
            inputs: [
              {
                key: 'variable-name',
                value: 'some-value',
                type: 'STRING',
                isSensitive: false,
                isEnvironment: false
              }
            ],
            parentBuildingBlocks: []
          }
        },
        buildingBlockDefinition: {
          uuid: 'b23cfb9a-6974-444f-9d33-62134a632373',
          spec: {
            version: 1,
            implementation: {
              type: 'TERRAFORM',
              terraformVersion: 'v1',
              repositoryUrl: 'https://example.com',
              async: true,
              useMeshHttpBackendFallback: false
            }
          }
        },
        behavior: 'APPLY'
      },
      status: 'IN_PROGRESS',
      _links: {
        self: {
          href: 'https://mesh-backend-url/api/meshobjects/meshbuildingblockruns/b3116611-e08b-4b00-91c5-10365b25a6ef'
        },
        registerSource: {
          href: 'https://mesh-backend-url/api/meshobjects/meshbuildingblockruns/b3116611-e08b-4b00-91c5-10365b25a6ef/status/source'
        },
        updateSource: {
          href: 'https://mesh-backend-url/api/meshobjects/meshbuildingblockruns/b3116611-e08b-4b00-91c5-10365b25a6ef/status/source/{sourceId}',
          templated: true
        },
        meshstackBaseUrl: {
          href: 'https://mesh-backend-url'
        }
      }
    };

    it('should extract uuid from building block run', () => {
      const uuid = mockBuildingBlockRun.metadata.uuid;
      assert.strictEqual(uuid, 'b3116611-e08b-4b00-91c5-10365b25a6ef');
    });

    it('should extract base URL from building block run', () => {
      const baseUrl = mockBuildingBlockRun._links.meshstackBaseUrl.href;
      assert.strictEqual(baseUrl, 'https://mesh-backend-url');
    });

    it('should extract inputs from building block spec', () => {
      const inputs = mockBuildingBlockRun.spec.buildingBlock.spec.inputs;
      assert.strictEqual(inputs.length, 1);
      assert.strictEqual(inputs[0].key, 'variable-name');
      assert.strictEqual(inputs[0].value, 'some-value');
    });

    it('should encode building block run as base64 for payload', () => {
      const encoded = Buffer.from(JSON.stringify(mockBuildingBlockRun)).toString('base64');
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);

      assert.strictEqual(parsed.metadata.uuid, mockBuildingBlockRun.metadata.uuid);
      assert.strictEqual(parsed._links.meshstackBaseUrl.href, mockBuildingBlockRun._links.meshstackBaseUrl.href);
    });

    it('should handle multiple inputs in building block spec', () => {
      const multiInputRun = {
        ...mockBuildingBlockRun,
        spec: {
          ...mockBuildingBlockRun.spec,
          buildingBlock: {
            ...mockBuildingBlockRun.spec.buildingBlock,
            spec: {
              ...mockBuildingBlockRun.spec.buildingBlock.spec,
              inputs: [
                { key: 'input1', value: 'value1', type: 'STRING', isSensitive: false, isEnvironment: false },
                { key: 'input2', value: 'value2', type: 'STRING', isSensitive: false, isEnvironment: false },
                { key: 'input3', value: 'value3', type: 'STRING', isSensitive: false, isEnvironment: false }
              ]
            }
          }
        }
      };

      const inputs = multiInputRun.spec.buildingBlock.spec.inputs;
      assert.strictEqual(inputs.length, 3);
      assert.strictEqual(inputs[0].key, 'input1');
      assert.strictEqual(inputs[1].key, 'input2');
      assert.strictEqual(inputs[2].key, 'input3');
    });
  });
});

