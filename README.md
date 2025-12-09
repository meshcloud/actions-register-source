# meshStack Register Source Action

This GitHub Action registers building block sources and steps with meshStack. It integrates with the meshStack API to set up the structure of a building block run with the specified steps.

## Overview

The meshStack building block pipeline allows you to automate and manage complex workflows by defining a series of steps that need to be executed. Each building block run represents an instance of such a workflow. This GitHub Action helps you register the source of the run and define its steps.

In order to return updates for a run to meshStack, you first need to register one or multiple steps and their resources of your run execution. It is up to you how many or how you organize your steps. You can, however, also just send step results back and the registration takes place on the fly. But in order to have a consistent display and ordering of steps, it is highly advised to pre-register steps and sources.

## Related Actions

This action is part of a suite of GitHub Actions for meshStack building block automation:

- **[actions-meshstack-auth](https://github.com/meshcloud/actions-meshstack-auth)** - Authenticates to the meshStack API (prerequisite for this action)
- **[actions-register-source](https://github.com/meshcloud/actions-register-source)** (this action) - Registers building block sources and steps with meshStack
- **[actions-send-status](https://github.com/meshcloud/actions-send-status)** - Sends building block step status updates to meshStack

## Documentation

For more information about meshStack building blocks and GitHub Actions integration, refer to:
- [meshStack GitHub Actions Integration](https://docs.meshcloud.io/integrations/github/github-actions/)
- [meshStack API Documentation](https://docs.meshcloud.io/api/index.html#mesh_buildingblockrun)

## Building Block Inputs

When meshStack triggers your pipeline, it sends a GitHub Actions event containing the URL, building block ID, and all the inputs your building block needs. These inputs are written to `GITHUB_OUTPUT`. You can use these inputs in your pipeline with the syntax `${{ steps.setup-meshstack-auth.outputs.your_input_from_meshstack_bb }}`.

For more information, refer to the [meshStack documentation on building block inputs](https://docs.meshcloud.io/docs/administration.building-blocks.html#building-block-inputs).

## Inputs

- `client_id` (required): The client ID for the API.
- `key_secret` (required): The key secret for the API.
- `steps` (required): The steps to register.

### Outputs

- `token_file`: Path to the file containing the authentication token

## Example Usage

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
