import * as core from '@actions/core';
import * as github from '@actions/github';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function run() {
  try {
    const stepsInput = core.getInput('steps');
    const clientId = core.getInput('client_id');
    const keySecret = core.getInput('key_secret');

    core.debug(`Steps Input: ${stepsInput}`);
    core.debug(`Client ID: ${clientId}`);
    core.debug(`Key Secret: ${keySecret}`);

    // Extract buildingBlockRun from the GitHub event payload
    const buildingBlockRun = github.context.payload.inputs.buildingBlockRun;
    core.debug(`Building Block Run: ${buildingBlockRun}`);

    // Decode and parse the buildingBlockRun input
    const decodedBuildingBlockRun = Buffer.from(buildingBlockRun, 'base64').toString('utf-8');
    const buildingBlockRunJson = JSON.parse(decodedBuildingBlockRun);
    const bbRunUuid = buildingBlockRunJson.metadata.uuid;
    const baseUrl = buildingBlockRunJson._links.meshstackBaseUrl.href;
    const inputs = buildingBlockRunJson.spec.buildingBlock.spec.inputs;

    core.debug(`Base URL: ${baseUrl}`);
    core.debug(`BB Run UUID: ${bbRunUuid}`);

    // Extract additional inputs
    const extractedInputs: { [key: string]: string } = {};
    inputs.forEach((input: { key: string }) => {
      const value = buildingBlockRunJson.spec.buildingBlock.spec.inputs.find((i: { key: string }) => i.key === input.key)?.value;
      if (value) {
        extractedInputs[input.key] = value;
      }
    });

    core.debug(`Extracted Inputs: ${JSON.stringify(extractedInputs)}`);

    // Write each extracted input to GITHUB_OUTPUT
    for (const [key, value] of Object.entries(extractedInputs)) {
      core.setOutput(key, value);
    }

    // Convert the YAML steps input to JSON format
    const steps = stepsInput.split('\n').reduce((acc: any[], line: string) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('-')) {
        acc.push({});
      } else if (trimmedLine.includes(':')) {
        const [key, value] = trimmedLine.split(':').map((str) => str.trim());
        acc[acc.length - 1][key] = value;
      }
      return acc;
    }, []);
    core.debug(`Parsed Steps: ${JSON.stringify(steps)}`);

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

      const token = authResponse.data.access_token;
      core.debug(`Token: ${token}`);

      // Write token and other variables to a temporary file
      const tempDir = process.env.RUNNER_TEMP || os.tmpdir();
      const tokenFilePath = path.join(tempDir, 'meshstack_token.json');
      const tokenData = {
        token,
        bbRunUuid,
        baseUrl,
        ...extractedInputs
      };
      fs.writeFileSync(tokenFilePath, JSON.stringify(tokenData));
      core.debug(`Token file path: ${tokenFilePath}`);

      // Indicate successful login
      core.info('Login was successful.');

      // Read token from the file
      const fileTokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
      const fileToken = fileTokenData.token;

      // Prepare the request payload and headers
      const requestPayload = {
        source: {
          id: 'github',
          externalRunId: github.context.runId,
          externalRunUrl: `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`
        },
        steps: steps
      };
      const requestHeaders = {
        'Content-Type': 'application/vnd.meshcloud.api.meshbuildingblockrun.v1.hal+json',
        'Accept': 'application/vnd.meshcloud.api.meshbuildingblockrun.v1.hal+json',
        'Authorization': `Bearer ${fileToken}`
      };

      // Log the request payload and headers
      core.debug(`Request Payload: ${JSON.stringify(requestPayload)}`);
      core.debug(`Request Headers: ${JSON.stringify(requestHeaders)}`);

      // Register the source
      try {
        const response = await axios.post(
          `${baseUrl}/api/meshobjects/meshbuildingblockruns/${bbRunUuid}/status/source`,
          requestPayload,
          {
            headers: requestHeaders
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
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();

