import * as core from '@actions/core';
import * as github from '@actions/github';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function run() {
  try {
    const stepsInput = core.getInput('steps');

    core.debug(`Steps Input: ${stepsInput}`);

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

    // Parse the JSON steps input
    const steps = JSON.parse(stepsInput);
    core.debug(`Parsed Steps: ${JSON.stringify(steps)}`);

    // Use the well-known token file location
    const tempDir = process.env.RUNNER_TEMP || os.tmpdir();
    const tokenFilePath = path.join(tempDir, 'meshstack_token.json');

    core.debug(`Using token file path: ${tokenFilePath}`);

    // Read token from file
    if (!fs.existsSync(tokenFilePath)) {
      throw new Error(`Token file does not exist at ${tokenFilePath}`);
    }

    const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
    const token = tokenData.token;

    if (!token) {
      throw new Error('Token not found in token file');
    }

    core.debug(`Token: ${token}`);

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
      'Authorization': `Bearer ${token}`
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
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();

