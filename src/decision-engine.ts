import { ParsedComment, DecisionResult, Config, Decision } from './types';

/**
 * Count risks by severity
 */
function countRisksBySeverity(risks: Array<{ severity: string }>): {
  high: number;
  medium: number;
  low: number;
} {
  return {
    high: risks.filter(r => r.severity === 'high').length,
    medium: risks.filter(r => r.severity === 'medium').length,
    low: risks.filter(r => r.severity === 'low').length
  };
}

/**
 * Get signal by category
 */
function getSignalByCategory(signals: Array<{ category: string; severity: number }>, category: string): number | null {
  const signal = signals.find(s => 
    s.category.toLowerCase().includes(category.toLowerCase())
  );
  return signal ? signal.severity : null;
}

/**
 * Make approval/block decision based on parsed comment and configuration
 * Decision precedence (checked in order):
 * 1. High risks → BLOCK (if block-on-high-risks: true)
 * 2. Policy violations → BLOCK (if policy signals <= threshold)
 * 3. Cost concerns → BLOCK (if cost signals <= threshold)
 * 4. Too many medium risks → BLOCK (if count > max-medium-risks)
 * 5. Too many low risks → BLOCK (if count > max-low-risks)
 * 6. Non-routine changes → BLOCK (if routine score < min-routine-score)
 * 7. All checks pass → APPROVE
 */
export function makeDecision(parsed: ParsedComment, config: Config): DecisionResult {
  const risksSummary = countRisksBySeverity(parsed.risks);
  const reasons: string[] = [];
  
  // 1. Check for high risks
  if (config.blockOnHighRisks && risksSummary.high > 0) {
    return {
      decision: 'block',
      reason: `Found ${risksSummary.high} high risk${risksSummary.high > 1 ? 's' : ''} requiring review`,
      risksSummary,
      changeUrl: parsed.changeUrl
    };
  }
  
  // 2. Check policy signal threshold
  const policySignal = getSignalByCategory(parsed.signals, 'Policies');
  if (policySignal !== null && policySignal <= config.policySignalThreshold) {
    reasons.push(`Policy signal (${policySignal}) is below threshold (${config.policySignalThreshold})`);
  }
  
  // 3. Check cost signal threshold
  const costSignal = getSignalByCategory(parsed.signals, 'Cost');
  if (costSignal !== null && costSignal <= config.costSignalThreshold) {
    reasons.push(`Cost signal (${costSignal}) is below threshold (${config.costSignalThreshold})`);
  }
  
  // 4. Check medium risk count
  if (risksSummary.medium > config.maxMediumRisks) {
    reasons.push(`Found ${risksSummary.medium} medium risks (threshold: ${config.maxMediumRisks})`);
  }
  
  // 5. Check low risk count
  if (risksSummary.low > config.maxLowRisks) {
    reasons.push(`Found ${risksSummary.low} low risks (threshold: ${config.maxLowRisks})`);
  }
  
  // 6. Check routine score
  const routineSignal = getSignalByCategory(parsed.signals, 'Routine');
  if (routineSignal !== null && routineSignal < config.minRoutineScore) {
    reasons.push(`Routine score (${routineSignal}) is below minimum (${config.minRoutineScore})`);
  }
  
  // If any blocking reasons found, block the PR
  if (reasons.length > 0) {
    return {
      decision: 'block',
      reason: `Auto-blocked: ${reasons.join('; ')}`,
      risksSummary,
      changeUrl: parsed.changeUrl
    };
  }
  
  // All checks passed - approve
  return {
    decision: 'approve',
    reason: 'Auto-approved: All safety checks passed',
    risksSummary,
    changeUrl: parsed.changeUrl
  };
}

/**
 * Generate detailed comment body for PR review
 */
export function generateReviewComment(result: DecisionResult, parsed: ParsedComment): string {
  const emoji = result.decision === 'approve' ? '✅' : '⛔';
  const status = result.decision === 'approve' ? 'Approved' : 'Blocked';
  
  let comment = `${emoji} **Overmind Auto-${status}**\n\n`;
  comment += `${result.reason}\n\n`;
  
  if (parsed.signals.length > 0) {
    comment += `**Signals:**\n`;
    for (const signal of parsed.signals) {
      comment += `- ${signal.category}: ${signal.severity} ${signal.emoji}\n`;
    }
    comment += `\n`;
  }
  
  comment += `**Risks:** ${result.risksSummary.high} high, ${result.risksSummary.medium} medium, ${result.risksSummary.low} low\n\n`;
  
  if (parsed.blastRadius.items > 0 || parsed.blastRadius.edges > 0) {
    comment += `**Blast Radius:** ${parsed.blastRadius.items} items, ${parsed.blastRadius.edges} edges\n\n`;
  }
  
  if (parsed.changeUrl) {
    comment += `[View in Overmind ↗](${parsed.changeUrl})\n`;
  }
  
  return comment;
}

