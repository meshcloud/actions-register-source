import * as core from '@actions/core';
import * as github from '@actions/github';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logAxiosError, isAxiosError } from './error-utils';

// allows stubbing @actions/core in tests
export interface CoreAdapter {
  getInput: (name: string) => string;
  setOutput: (name: string, value: any) => void;
  setFailed: (message: string) => void;
  debug: (message: string) => void;
  info: (message: string) => void;
  error: (message: string) => void;
}

export interface GithubContextAdapter {
  context: {
    runId: number;
    repo: {
      owner: string;
      repo: string;
    };
    payload: any;
  };
}

export interface RegisterSourceInputs {
  steps: string;
  buildingBlockRunUrl?: string;
  buildingBlockRun?: string;
}

interface TokenData {
  token: string;
}

interface BuildingBlockInput {
  key: string;
  value: string;
  type: string;
  isSensitive: boolean;
  isEnvironment: boolean;
}

interface BuildingBlockRun {
  metadata: {
    uuid: string;
  };
  spec: {
    buildingBlock: {
      spec: {
        inputs: BuildingBlockInput[];
      };
    };
  };
  _links: {
    meshstackBaseUrl: {
      href: string;
    };
    self: {
      href: string;
    };
  };
}

interface RequestSource {
  id: string;
  externalRunId: number;
  externalRunUrl: string;
}

interface RequestPayload {
  source: RequestSource;
  steps: any[];
}

interface RequestHeaders {
  [key: string]: string;
  'Content-Type': string;
  'Accept': string;
  'Authorization': string;
}

interface ExtractedInputs {
  [key: string]: string;
}

function loadTokenFromFile(coreAdapter: CoreAdapter): { token: string; tokenFilePath: string } {
  const tempDir = process.env.RUNNER_TEMP || os.tmpdir();
  const tokenFilePath = path.join(tempDir, 'meshstack_token.json');

  coreAdapter.debug(`Using token file path: ${tokenFilePath}`);

  if (!fs.existsSync(tokenFilePath)) {
    throw new Error(`Token file does not exist at ${tokenFilePath}`);
  }

  const tokenData: TokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
  const token = tokenData.token;

  if (!token) {
    throw new Error('Token not found in token file');
  }

  coreAdapter.debug(`Token: ${token}`);

  return { token, tokenFilePath };
}

function loadBuildingBlockRunFromBase64(encodedRun: string, coreAdapter: CoreAdapter): BuildingBlockRun {
  coreAdapter.debug('Using buildingBlockRun from GitHub event payload');

  if (!encodedRun) {
    throw new Error('Neither buildingBlockRunUrl input nor buildingBlockRun payload provided');
  }

  const decodedBuildingBlockRun = Buffer.from(encodedRun, 'base64').toString('utf-8');
  const buildingBlockRunJson = JSON.parse(decodedBuildingBlockRun);

  coreAdapter.debug(`Decoded Building Block Run: ${JSON.stringify(buildingBlockRunJson)}`);

  return buildingBlockRunJson;
}

async function loadBuildingBlockRunFromUrl(
  url: string,
  token: string,
  coreAdapter: CoreAdapter
): Promise<BuildingBlockRun> {
  coreAdapter.debug('Using buildingBlockRunUrl input');

  const headers = {
    'Accept': 'application/vnd.meshcloud.api.meshbuildingblockrun.v1.hal+json',
    'Authorization': `Bearer ${token}`
  };

  try {
    const response = await axios.get(url, { headers });
    const buildingBlockRunJson = response.data;
    coreAdapter.debug(`Fetched Building Block Run: ${JSON.stringify(buildingBlockRunJson)}`);
    return buildingBlockRunJson;
  } catch (fetchError) {
    if (isAxiosError(fetchError)) {
      logAxiosError(fetchError, coreAdapter, 'Failed to fetch building block run');
    } else {
      coreAdapter.error(`Unexpected error during fetch: ${fetchError}`);
    }
    throw fetchError;
  }
}

function extractInputs(buildingBlockRun: BuildingBlockRun, coreAdapter: CoreAdapter): ExtractedInputs {
  coreAdapter.debug('Extracting inputs from building block run');

  const inputs = buildingBlockRun.spec.buildingBlock.spec.inputs;
  const extractedInputs: ExtractedInputs = {};

  inputs.forEach((input: BuildingBlockInput) => {
    const value = inputs.find((i: BuildingBlockInput) => i.key === input.key)?.value;
    if (value) {
      extractedInputs[input.key] = value;
    }
  });

  coreAdapter.debug(`Extracted Inputs: ${JSON.stringify(extractedInputs)}`);

  // Write each extracted input to GITHUB_OUTPUT
  for (const [key, value] of Object.entries(extractedInputs)) {
    coreAdapter.setOutput(key, value);
  }

  return extractedInputs;
}

function buildRequestHeaders(token: string): RequestHeaders {
  return {
    'Content-Type': 'application/vnd.meshcloud.api.meshbuildingblockrun.v1.hal+json',
    'Accept': 'application/vnd.meshcloud.api.meshbuildingblockrun.v1.hal+json',
    'Authorization': `Bearer ${token}`
  };
}

function buildRequestPayload(steps: any[], githubContext: GithubContextAdapter): RequestPayload {
  return {
    source: {
      id: 'github',
      externalRunId: githubContext.context.runId,
      externalRunUrl: `https://github.com/${githubContext.context.repo.owner}/${githubContext.context.repo.repo}/actions/runs/${githubContext.context.runId}`
    },
    steps: steps
  };
}

async function registerSource(
  buildingBlockRunUrl: string,
  requestPayload: RequestPayload,
  requestHeaders: RequestHeaders,
  tokenFilePath: string,
  coreAdapter: CoreAdapter
): Promise<void> {
  coreAdapter.debug(`Request Payload: ${JSON.stringify(requestPayload)}`);
  coreAdapter.debug(`Request Headers: ${JSON.stringify(requestHeaders)}`);

  try {
    const response = await axios.post(
      `${buildingBlockRunUrl}/status/source`,
      requestPayload,
      {
        headers: requestHeaders
      }
    );

    coreAdapter.setOutput('response', response.data);
    coreAdapter.setOutput('token_file', tokenFilePath);
  } catch (registerError) {
    if (isAxiosError(registerError)) {
      logAxiosError(registerError, coreAdapter, 'Failed to register source');
    } else {
      coreAdapter.error(`Unexpected error: ${registerError}`);
    }
    throw registerError;
  }
}

export async function runRegisterSource(
  coreAdapter: CoreAdapter = core,
  githubContext: GithubContextAdapter = github
): Promise<void> {
  try {
    const stepsInput = coreAdapter.getInput('steps');
    
    // Extract buildingBlockRunUrl and buildingBlockRun from GitHub event payload
    const buildingBlockRunUrl = githubContext.context.payload.inputs?.buildingBlockRunUrl;
    const buildingBlockRun = githubContext.context.payload.inputs?.buildingBlockRun;

    coreAdapter.debug(`Steps Input: ${stepsInput}`);
    coreAdapter.debug(`Building Block Run URL: ${buildingBlockRunUrl}`);
    coreAdapter.debug(`Building Block Run: ${buildingBlockRun}`);

    // Load token
    const { token, tokenFilePath } = loadTokenFromFile(coreAdapter);

    // Load building block run and determine the run URL
    let buildingBlockRunJson: BuildingBlockRun;
    let runUrl: string;

    if (buildingBlockRunUrl) {
      buildingBlockRunJson = await loadBuildingBlockRunFromUrl(buildingBlockRunUrl, token, coreAdapter);
      runUrl = buildingBlockRunUrl;
    } else {
      buildingBlockRunJson = loadBuildingBlockRunFromBase64(buildingBlockRun, coreAdapter);
      runUrl = buildingBlockRunJson._links.self.href;
    }

    coreAdapter.debug(`Building Block Run URL: ${runUrl}`);

    // Extract inputs and write to outputs
    extractInputs(buildingBlockRunJson, coreAdapter);

    // Parse the JSON steps input
    const steps = JSON.parse(stepsInput);
    coreAdapter.debug(`Parsed Steps: ${JSON.stringify(steps)}`);

    // Prepare the request payload and headers
    const requestPayload = buildRequestPayload(steps, githubContext);
    const requestHeaders = buildRequestHeaders(token);

    // Register the source
    await registerSource(runUrl, requestPayload, requestHeaders, tokenFilePath, coreAdapter);
  } catch (error) {
    // Exception handler of last resort
    if (error instanceof Error) {
      coreAdapter.setFailed(error.message);
    } else {
      coreAdapter.setFailed(`An unknown error occurred: ${error}`);
    }
    throw error;
  }
}

async function run() {
  try {
    await runRegisterSource(core, github);
  } catch (error) {
    // Last-resort exception handler: prevent unhandled rejections
    // The error has already been logged and setFailed has been called
    process.exit(1);
  }
}

// Only run if this file is executed directly (not imported)
if (require.main === module) {
  run();
}

