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

    core.debug(`Base URL: ${baseUrl}`);
    core.debug(`BB Run UUID: ${bbRunUuid}`);
    core.debug(`Steps Input: ${stepsInput}`);
    core.debug(`Client ID: ${clientId}`);
    core.debug(`Key Secret: ${keySecret}`);

    // Decode and parse the steps input
    const decodedStepsInput = decodeURIComponent(stepsInput);
    const steps = JSON.parse(decodedStepsInput);
    core.debug(`Parsed Steps: ${JSON.stringify(steps)}`);

    // Define the path to the token file
    const tempDir = process.env.RUNNER_TEMP || os.tmpdir();
    core.debug(`Temporary directory: ${tempDir}`);
    const tokenFilePath = path.join(tempDir, 'meshstack_token.json');

    let token: string;

    // Check if the token file exists
    if (fs.existsSync(tokenFilePath)) {
      // Read the token from the file
      const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
      token = tokenData.token;
      core.info('Token read from file.');
    } else {
      // Authenticate and get the token
      try {
        const authResponse = await axios.post(
          `${baseUrl}/api/login`,
          `grant_type=client_credentials&client_id=${clientId}&client_secret=${keySecret}`,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            maxRedirects: 5 // Follow redirects
          }
        );

        token = authResponse.data.access_token;
        core.debug(`Token: ${token}`);

        // Write token to a temporary file
        fs.writeFileSync(tokenFilePath, JSON.stringify({ token }));
        core.debug(`Token file path: ${tokenFilePath}`);

        // Indicate successful login
        core.info('Login was successful.');
      } catch (authError) {
        if (axios.isAxiosError(authError)) {
          if (authError.response) {
            core.error(`Authentication error response: ${JSON.stringify(authError.response.data)}`);
            core.error(`Status code: ${authError.response.status}`);
          } else {
            core.error(`Authentication error message: ${authError.message}`);
          }
        } else {
          core.error(`Unexpected error: ${authError}`);
        }
        throw authError;
      }
    }

    // Register the source
    try {
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
    } catch (registerError) {
      if (axios.isAxiosError(registerError)) {
        if (registerError.response) {
          core.error(`Register source error response: ${JSON.stringify(registerError.response.data)}`);
          core.error(`Status code: ${registerError.response.status}`);
        } else {
          core.error(`Register source error message: ${registerError.message}`);
        }
      } else {
        core.error(`Unexpected error: ${registerError}`);
      }
      throw registerError;
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();

