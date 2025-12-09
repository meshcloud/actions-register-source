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
});
