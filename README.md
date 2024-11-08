# Register Source GitHub Action

This GitHub Action registers sources to the meshStack Building Block pipeline workflow. It integrates with the meshStack API to update the status of a Building Block Run with the specified steps.

### Overview

The meshStack Building Block pipeline allows you to automate and manage complex workflows by defining a series of steps that need to be executed. Each Building Block Run represents an instance of such a workflow. This GitHub Action helps you register the source of the run and update its status with the specified steps.

In order to return updates for a run to meshStack, you first need to register one or multiple steps and their resources of your run execution. It is up to you how many or how you organize your steps. You can, however, also just send step results back and the registration takes place on the fly. But in order to have a consistent display and ordering of steps, it is highly advised to pre-register steps and sources.

For more details on the meshBuildingBlockRun API, refer to the [meshcloud API documentation](https://docs.meshcloud.io/api/index.html#mesh_buildingblockrun).

For more information on integrating with the meshStack Building Block pipeline, refer to the [meshStack Building Block pipeline integration documentation](https://docs.meshcloud.io/docs/meshstack.building-pipeline-integration.html#building-block-run-and-steps).

### Building Block Inputs:

When MeshStack triggers your pipeline, it sends a GitHub Actions event containing the URL, building block ID, and all the inputs your building block needs. These inputs are written to `GITHUB_OUTPUT`. You can use these inputs in your pipeline with the syntax `${{ steps.setup-meshstack-auth.outputs.your_input_from_meshstack_bb }}`.

For more information, refer to the [MeshStack documentation on building block inputs](https://docs.meshcloud.io/docs/administration.building-blocks.html#building-block-inputs).

### Inputs

- `` (required): The base URL for the API.
- `client_id` (required): The client ID for the API.
- `key_secret` (required): The key secret for the API.
- `steps` (required): The steps to register.

### Outputs

- `token_file`: Path to the file containing the authentication token


### Example Usage

```yaml
- name: Setup meshStack bbrun
  id: setup-meshstack-auth
  uses: meshcloud/actions-register-source@main
  with:
    client_id: ${{ vars.BUILDINGBLOCK_API_CLIENT_ID }}
    key_secret: ${{ secrets.BUILDINGBLOCK_API_KEY_SECRET }}
    steps: |
      [
        { "id": "terraform-plan", "displayName": "terraform plan" },
      ] 

- name: Terragrunt plan
  id: terraform-plan
  run: terraform plan -var="resource_group_name=${{ steps.setup-meshstack-auth.outputs.resource_group_name }}" -out=tfplan


- name: Send status on plan
  if: ${{ steps.terraform-plan.outcome == 'success' }}
  uses: meshcloud/actions-send-status@main
  with:
    step_id: "terraform-plan"
    status: ${{ steps.terraform-plan.outcome == 'success' && 'SUCCEEDED' || 'FAILED' }} 
    user_message: ${{ steps.terraform-plan.outcome == 'success' && 'Successful plan Terraform configuration.' || 'Failed to plan Terraform configuration.' }}
    system_message:  ${{ steps.terraform-plan.outcome == 'success' && 'Successful plan Terraform configuration.' || 'Failed to plan Terraform configuration.' }}```
