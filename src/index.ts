import * as core from '@actions/core';
import * as github from '@actions/github';
import axios from 'axios';

async function run() {
  try {
    const baseUrl = core.getInput('base_url');
    const bbRunUuid = core.getInput('bb_run_uuid');
    const steps = core.getInput('steps');
    const token = core.getInput('token');

    const response = await axios.post(
      `${baseUrl}/api/meshobjects/meshbuildingblockruns/${bbRunUuid}/status/source`,
      {
        source: {
          id: 'github',
          externalRunId: github.context.runId,
          externalRunUrl: `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`
        },
        steps: JSON.parse(steps)
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
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();

