import * as core from '@actions/core';
import * as github from '@actions/github';
import { findOvermindComment, parseOvermindComment } from './comment-parser';
import { makeDecision, generateReviewComment } from './decision-engine';
import { Config, DecisionResult } from './types';

/**
 * Poll for Overmind comment with timeout
 */
async function waitForOvermindComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  timeoutSeconds: number
): Promise<string | null> {
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    try {
      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber
      });

      const overmindComment = findOvermindComment(comments);
      if (overmindComment) {
        return overmindComment;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      core.warning(`Error polling for comment: ${error instanceof Error ? error.message : String(error)}`);
      // Continue polling on error
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  return null;
}

/**
 * Parse configuration from action inputs
 */
function parseConfig(): Config {
  return {
    blockOnHighRisks: core.getBooleanInput('block-on-high-risks'),
    maxMediumRisks: parseInt(core.getInput('max-medium-risks'), 10),
    maxLowRisks: parseInt(core.getInput('max-low-risks'), 10),
    policySignalThreshold: parseInt(core.getInput('policy-signal-threshold'), 10),
    costSignalThreshold: parseInt(core.getInput('cost-signal-threshold'), 10),
    minRoutineScore: parseInt(core.getInput('min-routine-score'), 10),
    autoApprove: core.getBooleanInput('auto-approve'),
    waitTimeout: parseInt(core.getInput('wait-timeout'), 10)
  };
}

/**
 * Retry GitHub API call with exponential backoff
 */
async function retryApiCall<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        core.info(`API call failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('API call failed after retries');
}

/**
 * Main action entry point
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const githubToken = core.getInput('github-token', { required: true });
    const config = parseConfig();

    // Get PR context
    const context = github.context;
    if (!context.payload.pull_request) {
      core.setFailed('This action must be run on a pull_request event');
      return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = context.payload.pull_request.number;

    core.info(`Checking PR #${prNumber} for Overmind comment...`);

    // Initialize Octokit
    const octokit = github.getOctokit(githubToken);

    // Wait for Overmind comment
    const commentBody = await waitForOvermindComment(
      octokit,
      owner,
      repo,
      prNumber,
      config.waitTimeout
    );

    if (!commentBody) {
      core.info(`No Overmind comment found within ${config.waitTimeout}s timeout. Skipping.`);
      core.setOutput('decision', 'skipped');
      core.setOutput('reason', 'Overmind comment not found within timeout period');
      core.setOutput('risks-summary', JSON.stringify({ high: 0, medium: 0, low: 0 }));
      core.setOutput('change-url', '');
      return;
    }

    // Parse comment
    const parsed = parseOvermindComment(commentBody);
    if (!parsed) {
      core.warning('Failed to parse Overmind comment. Skipping.');
      core.setOutput('decision', 'skipped');
      core.setOutput('reason', 'Failed to parse Overmind comment');
      core.setOutput('risks-summary', JSON.stringify({ high: 0, medium: 0, low: 0 }));
      core.setOutput('change-url', '');
      return;
    }

    // Make decision
    const result: DecisionResult = makeDecision(parsed, config);

    core.info(`Decision: ${result.decision}`);
    core.info(`Reason: ${result.reason}`);

    // Set outputs
    core.setOutput('decision', result.decision);
    core.setOutput('reason', result.reason);
    core.setOutput('risks-summary', JSON.stringify(result.risksSummary));
    core.setOutput('change-url', result.changeUrl || parsed.changeUrl);

    // Take action if auto-approve is enabled
    if (config.autoApprove) {
      const reviewEvent = result.decision === 'approve' ? 'APPROVE' : 'REQUEST_CHANGES';
      const reviewBody = generateReviewComment(result, parsed);

      await retryApiCall(async () => {
        await octokit.rest.pulls.createReview({
          owner,
          repo,
          pull_number: prNumber,
          event: reviewEvent,
          body: reviewBody
        });
      });

      core.info(`PR review created: ${reviewEvent}`);
    } else {
      core.info('Auto-approve disabled. Decision logged but no review created.');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${errorMessage}`);
  }
}

// Run the action
run();

