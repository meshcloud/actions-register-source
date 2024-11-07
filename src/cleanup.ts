import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function cleanup() {
  try {
    const tempDir = process.env.RUNNER_TEMP || os.tmpdir();
    const tokenFilePath = path.join(tempDir, 'meshstack_token.json');

    if (fs.existsSync(tokenFilePath)) {
      fs.unlinkSync(tokenFilePath);
      core.info(`Deleted token file: ${tokenFilePath}`);
    } else {
      core.info(`Token file does not exist: ${tokenFilePath}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred during cleanup');
    }
  }
}

cleanup();

