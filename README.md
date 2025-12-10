# meshStack Register Source Action

This GitHub Action registers building block sources and steps with meshStack. It integrates with the meshStack API to set up the structure of a building block run with the specified steps. This allows platform teams
to provide additional feedback about building block execution to application teams.

## Overview

A meshStack building block run allows you to automate and manage complex workflows by defining a series of steps that need to be executed. This GitHub Action helps you register the source of the run and define its steps.

It is up to you how many or how you organize your steps. You can, however, also just send step results back and the registration takes place on the fly. But in order to have a consistent display and ordering of steps, it is highly advised to pre-register all steps that you plan to execute.

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

- `steps` (required): JSON array of steps to register. Each step should have an `id` and `displayName`.

## Outputs

- `token_file`: Path to the file containing the authentication token
- Dynamic outputs based on building block inputs (e.g., custom parameters defined in your building block)

## Required GitHub Context Parameters

This action requires the meshStack workflow trigger parameters to be present in the GitHub event payload:

- `buildingBlockRunUrl` (required): URL to fetch the building block run object from the meshStack API
- `buildingBlockRun` (optional, legacy): Base64-encoded building block run object (alternative to `buildingBlockRunUrl`)

These parameters are automatically provided by meshStack when it triggers your workflow via `workflow_dispatch`.

## Example Usage

```yaml
name: Deploy Building Block

on:
  workflow_dispatch:
    inputs:
      buildingBlockRunUrl:
        description: "URL to fetch the Building Block Run Object from"
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup meshStack auth
        id: setup-meshstack-auth
        uses: meshcloud/actions-meshstack-auth@v2
        with:
          base_url: ${{ vars.MESHSTACK_BASE_URL }}
          client_id: ${{ vars.BUILDINGBLOCK_API_CLIENT_ID }}
          key_secret: ${{ secrets.BUILDINGBLOCK_API_KEY_SECRET }}

      - name: Register building block source
        id: register-source
        uses: meshcloud/actions-register-source@v2
        with:
          steps: |
            [
              { "id": "terraform-plan", "displayName": "Terraform Plan" },
              { "id": "terraform-apply", "displayName": "Terraform Apply" }
            ]

      - name: Terraform plan
        id: terraform-plan
        run: terraform plan -var="resource_group_name=${{ steps.register-source.outputs.resource_group_name }}" -out=tfplan

      - name: Send status on plan
        uses: meshcloud/actions-send-status@v2
        with:
          step_id: terraform-plan
          step_status: SUCCEEDED

      - name: Terraform apply
        id: terraform-apply
        run: terraform apply tfplan

      - name: Send status on apply
        uses: meshcloud/actions-send-status@v2
        with:
          step_id: terraform-apply
          step_status: SUCCEEDED

```
