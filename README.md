# Register Source GitHub Action

This GitHub Action registers sources to the meshStack Building Block pipeline workflow. It integrates with the meshStack API to update the status of a Building Block Run with the specified steps.

### Overview

The meshStack Building Block pipeline allows you to automate and manage complex workflows by defining a series of steps that need to be executed. Each Building Block Run represents an instance of such a workflow. This GitHub Action helps you register the source of the run and update its status with the specified steps.

In order to return updates for a run to meshStack, you first need to register one or multiple steps and their resources of your run execution. It is up to you how many or how you organize your steps. You can, however, also just send step results back and the registration takes place on the fly. But in order to have a consistent display and ordering of steps, it is highly advised to pre-register steps and sources.

For more details on the meshBuildingBlockRun API, refer to the [meshcloud API documentation](https://docs.meshcloud.io/api/index.html#mesh_buildingblockrun).

For more information on integrating with the meshStack Building Block pipeline, refer to the [meshStack Building Block pipeline integration documentation](https://docs.meshcloud.io/docs/meshstack.building-pipeline-integration.html#building-block-run-and-steps).


### Inputs

- `base_url` (required): The base URL for the API.
- `bb_run_uuid` (required): The Building Block Run UUID.
- `steps` (required): The steps to register.
- `token` (required): The API token for authentication.

### Outputs

- `response`: The response from the API.

### Example Usage

```yaml
name: Register Source Example
on:
  push:
    branches:
      - main

jobs:
  register-source:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Register Source
        uses: meshcloud/register-source@v0.0.10
        with:
          base_url: 'https://api.example.com'
          bb_run_uuid: 'your-bb-run-uuid'
          token: ${{ secrets.API_TOKEN }}
          steps: |
            [
              { "id": "terraform-validate", "displayName": "terraform validate" },
              { "id": "terraform-plan", "displayName": "terraform plan" },
              { "id": "terraform-apply", "displayName": "terraform apply" }
            ] 
```
