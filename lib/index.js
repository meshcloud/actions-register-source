"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const axios_1 = __importDefault(require("axios"));
async function run() {
    try {
        const baseUrl = core.getInput('base_url');
        const bbRunUuid = core.getInput('bb_run_uuid');
        const steps = core.getInput('steps');
        const token = core.getInput('token');
        const response = await axios_1.default.post(`${baseUrl}/api/meshobjects/meshbuildingblockruns/${bbRunUuid}/status/source`, {
            source: {
                id: 'github',
                externalRunId: github.context.runId,
                externalRunUrl: `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`
            },
            steps: JSON.parse(steps)
        }, {
            headers: {
                'Content-Type': 'application/vnd.meshcloud.api.meshbuildingblockrun.v1.hal+json',
                'Accept': 'application/vnd.meshcloud.api.meshbuildingblockrun.v1.hal+json',
                'Authorization': `Bearer ${token}`
            }
        });
        core.setOutput('response', response.data);
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed('An unknown error occurred');
        }
    }
}
run();
