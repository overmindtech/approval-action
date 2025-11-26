# Overmind Auto-Approval Action

Automatically approve or block PRs based on Overmind's risk analysis and change signals.

## What This Action Does

The action parses the Overmind markdown comment that already appears in PRs and makes approval/blocking decisions based on configurable thresholds.

### Input: Overmind's PR Comment

The action reads the markdown comment that Overmind posts containing:

- 🔴 **Signals** (Routine, Cost, Policies, Custom)
- 🔥 **Risks** (High, Medium, Low severity)
- 💥 **Blast Radius** (Items/Edges count)
- Expected Changes

### Output: Automated Decision

Based on the parsed analysis, the action:

- **Approves** the PR if all safety checks pass
- **Blocks** the PR (requests changes) if risks exceed thresholds
- **Comments** with explanation of the decision
- **Outputs** structured data for other workflow steps

## How It Works

1. **Parse the Markdown Comment** - Extracts signals, risks, and blast radius from Overmind's comment
2. **Apply Decision Logic** - Evaluates against configurable thresholds in priority order
3. **Take GitHub Action** - Creates PR review (approve or request changes) with explanation

### Decision Precedence

Rules are checked in order:

1. High risks → BLOCK (if `block-on-high-risks: true`)
2. Policy violations → BLOCK (if policy signals <= threshold)
3. Cost concerns → BLOCK (if cost signals <= threshold)
4. Too many medium risks → BLOCK (if count > `max-medium-risks`)
5. Too many low risks → BLOCK (if count > `max-low-risks`)
6. Non-routine changes → BLOCK (if routine score < `min-routine-score`)
7. All checks pass → APPROVE

## Usage

### Basic Setup (Auto-approve safe changes)

```yaml
name: Overmind Analysis

on: [pull_request]

jobs:
  terraform-plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      
      - name: Terraform Plan
        run: |
          terraform init
          terraform plan -out=tfplan
          terraform show -json tfplan > tfplan.json
      
      - uses: overmindtech/actions/submit-plan@main
        with:
          ovm-api-key: ${{ secrets.OVM_API_KEY }}
          plan-json: ./tfplan.json

  auto-approval:
    runs-on: ubuntu-latest
    needs: terraform-plan
    permissions:
      pull-requests: write
    steps:
      - uses: overmindtech/approval-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          block-on-high-risks: true
          max-medium-risks: 3
```

### Advanced Setup (Custom thresholds per environment)

```yaml
jobs:
  auto-approval-prod:
    if: github.base_ref == 'main'
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: overmindtech/approval-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          block-on-high-risks: true
          max-medium-risks: 1              # Stricter for prod
          min-routine-score: 0             # Only routine changes
          policy-signal-threshold: -1      # Any policy concern blocks

  auto-approval-dev:
    if: github.base_ref == 'develop'
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: overmindtech/approval-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          block-on-high-risks: true
          max-medium-risks: 5              # More permissive for dev
          min-routine-score: -2            # Allow some variation
```

## Configuration

### Inputs

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `github-token` | GitHub token for PR access | - | ✅ Yes |
| `block-on-high-risks` | Block if any high risks found | `true` | No |
| `max-medium-risks` | Maximum medium risks before blocking | `3` | No |
| `max-low-risks` | Maximum low risks before blocking | `10` | No |
| `policy-signal-threshold` | Block if policy signals <= value | `-2` | No |
| `cost-signal-threshold` | Block if cost signals <= value | `-2` | No |
| `min-routine-score` | Require routine score >= value | `-1` | No |
| `auto-approve` | Actually approve/block PRs (vs just comment) | `true` | No |
| `wait-timeout` | Seconds to wait for Overmind comment | `300` | No |

### Outputs

| Output | Description |
|-------|-------------|
| `decision` | The decision made: `approved`, `blocked`, or `skipped` |
| `reason` | Human-readable explanation of the decision |
| `risks-summary` | JSON object with risk counts: `{"high": 0, "medium": 1, "low": 2}` |
| `change-url` | Link to Overmind analysis |

### Example: Using Outputs

```yaml
- uses: overmindtech/approval-action@v1
  id: approval
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Check decision
  run: |
    echo "Decision: ${{ steps.approval.outputs.decision }}"
    echo "Reason: ${{ steps.approval.outputs.reason }}"
    echo "Risks: ${{ steps.approval.outputs.risks-summary }}"
```

## How Signal Severity Works

Signal severity is calculated from the emoji color and bar chart length in Overmind comments:

- **Emoji**: 🔴 = -1, 🟢 = +1, ⚪ = 0
- **Bar Chart**: Length determines magnitude (e.g., `▇▅▃▂▁` = 5)
- **Severity**: `emoji_sign × bar_length`

Examples:
- `🔴 ▇▅▃▂▁` = -1 × 5 = **-5**
- `🟢 ▇▇▇` = +1 × 3 = **+3**
- `⚪ ▇` = 0 × 1 = **0**

## Error Handling

- **Timeout waiting for comment** → Decision: `skipped` (doesn't block deployment)
- **Parse error** → Decision: `skipped` (fails safe, skips approval)
- **GitHub API error** → Retries 3x with exponential backoff, then fails the action

## Permissions

The action requires the following GitHub permissions:

```yaml
permissions:
  pull-requests: write  # To create reviews and comments
```

## Development

### Building

```bash
npm install
npm run build
```

### Testing

```bash
npm test
npm run test:coverage
```

### Local Testing

Use [`act`](https://github.com/nektos/act) to test the action locally:

```bash
act pull_request -e .github/workflows/test.yml
```

## License

Apache 2.0 - See [LICENSE](LICENSE) file for details.
