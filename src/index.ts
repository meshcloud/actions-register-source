import * as core from '@actions/core';
import * as github from '@actions/github';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function run() {
  try {
    const baseUrl = core.getInput('base_url');
    const bbRunUuid = core.getInput('bb_run_uuid');
    const stepsInput = core.getInput('steps');
    const clientId = core.getInput('client_id');
    const keySecret = core.getInput('key_secret');

    // Parse the steps input
    const steps = JSON.parse(`[${stepsInput}]`);

    // Authenticate and get the token
    const authResponse = await axios.post(
      `${baseUrl}/api/login`,
      `grant_type=client_credentials&client_id=${clientId}&client_secret=${keySecret}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const token = authResponse.data.access_token;

    // Write token to a temporary file
    const tempDir = process.env.RUNNER_TEMP || os.tmpdir();
    const tokenFilePath = path.join(tempDir, 'meshstack_token.json');
    fs.writeFileSync(tokenFilePath, JSON.stringify({ token }));
    core.info('meshStack auth successful.');


    // Register the source
    const response = await axios.post(
      `${baseUrl}/api/meshobjects/meshbuildingblockruns/${bbRunUuid}/status/source`,
      {
        source: {
          id: 'github',
          externalRunId: github.context.runId,
          externalRunUrl: `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`
        },
        steps: steps
      },
      {
        headers: {
          'Content-Type': 'application/vnd.meshcloud.api.meshbuildingblockrun.v1.hal+json',
          'Accept': 'application/vnd.meshcloud.api.meshbuildingblockrun.v1.hal+json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    core.setOutput('response', response.data);
    core.setOutput('token_file', tokenFilePath);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();

