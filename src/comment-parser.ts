import { ParsedComment, Signal, Risk, BlastRadius } from './types';

/**
 * Find Overmind comment in PR comments by signature
 */
export function findOvermindComment(comments: Array<{ body?: string | null }>): string | null {
  for (const comment of comments) {
    const body = comment.body || '';
    if (
      body.includes('Open in Overmind ↗') &&
      body.includes('🔥 Risks')
    ) {
      return body;
    }
  }
  return null;
}

/**
 * Extract change URL UUID from Overmind comment
 */
export function extractChangeUrl(commentBody: string): string {
  const urlMatch = commentBody.match(/https:\/\/app\.overmind\.tech\/changes\/([a-f0-9-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return `https://app.overmind.tech/changes/${urlMatch[1]}`;
  }
  return '';
}

/**
 * Parse signal severity from emoji and bar chart
 * Emoji: 🔴 = -1, 🟢 = +1, ⚪ = 0
 * Bar chart length determines magnitude
 */
function parseSignalSeverity(emoji: string, barChart: string): number {
  let sign = 0;
  if (emoji === '🔴') {
    sign = -1;
  } else if (emoji === '🟢') {
    sign = 1;
  } else if (emoji === '⚪') {
    sign = 0;
  }

  // Count bar chart characters (▇▅▃▂▁ etc.)
  const barLength = barChart.replace(/[^▇▅▃▂▁▉▊▋▌▍▎▏]/g, '').length;
  
  return sign * barLength;
}

/**
 * Parse signals section from markdown
 */
function parseSignals(commentBody: string): Signal[] {
  const signals: Signal[] = [];
  
  // Extract signals section (with or without header)
  let signalsSection = commentBody;
  // Match h3 tag with emoji (🔴, 🟢, or ⚪) followed by "Change Signals"
  // Use Unicode escapes: 🔴=\u{1F534}, 🟢=\u{1F7E2}, ⚪=\u{26AA}
  const signalsMatch = commentBody.match(/<h3>(?:[\u{1F534}\u{1F7E2}\u{26AA}])\s*Change Signals<\/h3>\s*\n([\s\S]*?)(?=---|<h3>|$)/u);
  if (signalsMatch) {
    signalsSection = signalsMatch[1];
  }
  
  // Match signal lines: **Category** emoji `bar chart` description
  // Pattern: **Category** emoji `bars` description (description ends at newline)
  // Use Unicode escapes for emojis: 🔴=\u{1F534}, 🟢=\u{1F7E2}, ⚪=\u{26AA}
  // Use [\u0060] for backtick to avoid template literal issues
  const signalRegex = /\*\*([^*]+)\*\*\s+([\u{1F534}\u{1F7E2}\u{26AA}])\s+[\u0060]([^\u0060]+)[\u0060]\s+([^\n]+)/gu;
  let match;
  
  while ((match = signalRegex.exec(signalsSection)) !== null) {
    const category = match[1].trim();
    const emoji = match[2];
    const barChart = match[3].trim();
    const description = match[4].trim();
    const severity = parseSignalSeverity(emoji, barChart);
    
    signals.push({
      category,
      emoji,
      severity,
      description
    });
  }
  
  return signals;
}

/**
 * Parse risks section from markdown
 */
function parseRisks(commentBody: string): Risk[] {
  const risks: Risk[] = [];
  
  // Extract risks section
  const risksMatch = commentBody.match(/<h3>🔥 Risks<\/h3>([\s\S]*?)(?=---|<h3>|$)/);
  if (!risksMatch) {
    return risks;
  }
  
  const risksSection = risksMatch[1];
  
  // Check for "No risks identified"
  if (risksSection.includes('No risks identified')) {
    return risks;
  }
  
  // Match risk entries: **Title** `severity` [link]
  // Risk description follows on next lines until next **Title** or end
  const riskTitleRegex = /\*\*([^*]+)\*\*\s+`([^`]+)`/g;
  let titleMatch;
  const riskPositions: Array<{ start: number; end: number; title: string; severity: 'high' | 'medium' | 'low' }> = [];
  
  while ((titleMatch = riskTitleRegex.exec(risksSection)) !== null) {
    const title = titleMatch[1].trim();
    const severityMarker = titleMatch[2].trim();
    const start = titleMatch.index;
    
    // Determine severity from marker
    let severity: 'high' | 'medium' | 'low' = 'low';
    if (severityMarker.includes('‼️') || severityMarker.includes('High')) {
      severity = 'high';
    } else if (severityMarker.includes('❗') || severityMarker.includes('Medium')) {
      severity = 'medium';
    } else if (severityMarker.includes('≈') || severityMarker.includes('Low')) {
      severity = 'low';
    }
    
    riskPositions.push({ start, end: 0, title, severity });
  }
  
  // Extract descriptions for each risk
  for (let i = 0; i < riskPositions.length; i++) {
    const currentRisk = riskPositions[i];
    const nextRiskStart = i < riskPositions.length - 1 
      ? riskPositions[i + 1].start 
      : risksSection.length;
    
    // Find the description after the title line
    const riskText = risksSection.substring(currentRisk.start, nextRiskStart);
    const descriptionMatch = riskText.match(/\*\*[^*]+\*\*\s+`[^`]+`\s+\[[^\]]+\]\([^)]+\)\s*\n\n(.+?)(?=\n\n\*\*|$)/s);
    const description = descriptionMatch 
      ? descriptionMatch[1].trim() 
      : riskText.split('\n').slice(1).join('\n').trim();
    
    risks.push({
      severity: currentRisk.severity,
      title: currentRisk.title,
      description: description || currentRisk.title
    });
  }
  
  return risks;
}

/**
 * Parse blast radius section from markdown
 */
function parseBlastRadius(commentBody: string): BlastRadius {
  const blastRadius: BlastRadius = { items: 0, edges: 0 };
  
  // Match Items and Edges: **Items** ` number ` or **Edges** ` number `
  const itemsMatch = commentBody.match(/\*\*Items\*\*\s+`\s*(\d+)\s*`/);
  const edgesMatch = commentBody.match(/\*\*Edges\*\*\s+`\s*(\d+)\s*`/);
  
  if (itemsMatch) {
    blastRadius.items = parseInt(itemsMatch[1], 10);
  }
  
  if (edgesMatch) {
    blastRadius.edges = parseInt(edgesMatch[1], 10);
  }
  
  return blastRadius;
}

/**
 * Parse Overmind markdown comment into structured data
 */
export function parseOvermindComment(commentBody: string): ParsedComment | null {
  if (!commentBody) {
    return null;
  }
  
  try {
    const signals = parseSignals(commentBody);
    const risks = parseRisks(commentBody);
    const blastRadius = parseBlastRadius(commentBody);
    const changeUrl = extractChangeUrl(commentBody);
    
    return {
      signals,
      risks,
      blastRadius,
      changeUrl
    };
  } catch (error) {
    // Fail gracefully - return null if parsing fails
    return null;
  }
}

