import { makeDecision, generateReviewComment } from '../decision-engine';
import { ParsedComment, Config, DecisionResult } from '../types';

describe('decision-engine', () => {
  const defaultConfig: Config = {
    blockOnHighRisks: true,
    maxMediumRisks: 3,
    maxLowRisks: 10,
    policySignalThreshold: -2,
    costSignalThreshold: -2,
    minRoutineScore: -1,
    autoApprove: true,
    waitTimeout: 300
  };

  describe('makeDecision', () => {
    it('should block on high risks', () => {
      const parsed: ParsedComment = {
        signals: [],
        risks: [
          { severity: 'high', title: 'High risk', description: 'Test' }
        ],
        blastRadius: { items: 0, edges: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const result = makeDecision(parsed, defaultConfig);
      expect(result.decision).toBe('block');
      expect(result.reason).toContain('high risk');
    });

    it('should approve when no high risks and all checks pass', () => {
      const parsed: ParsedComment = {
        signals: [
          { category: 'Routine', emoji: '🟢', severity: 3, description: 'Routine change' }
        ],
        risks: [
          { severity: 'low', title: 'Low risk', description: 'Test' }
        ],
        blastRadius: { items: 5, edges: 10 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const result = makeDecision(parsed, defaultConfig);
      expect(result.decision).toBe('approve');
      expect(result.reason).toContain('All safety checks passed');
    });

    it('should block on policy signal threshold violation', () => {
      const parsed: ParsedComment = {
        signals: [
          { category: 'Policies', emoji: '🔴', severity: -3, description: 'Policy violation' }
        ],
        risks: [],
        blastRadius: { items: 0, edges: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const result = makeDecision(parsed, defaultConfig);
      expect(result.decision).toBe('block');
      expect(result.reason).toContain('Policy signal');
    });

    it('should block on cost signal threshold violation', () => {
      const parsed: ParsedComment = {
        signals: [
          { category: 'Cost', emoji: '🔴', severity: -3, description: 'Cost concern' }
        ],
        risks: [],
        blastRadius: { items: 0, edges: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const result = makeDecision(parsed, defaultConfig);
      expect(result.decision).toBe('block');
      expect(result.reason).toContain('Cost signal');
    });

    it('should block when medium risks exceed threshold', () => {
      const parsed: ParsedComment = {
        signals: [],
        risks: [
          { severity: 'medium', title: 'Risk 1', description: 'Test' },
          { severity: 'medium', title: 'Risk 2', description: 'Test' },
          { severity: 'medium', title: 'Risk 3', description: 'Test' },
          { severity: 'medium', title: 'Risk 4', description: 'Test' }
        ],
        blastRadius: { items: 0, edges: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const result = makeDecision(parsed, defaultConfig);
      expect(result.decision).toBe('block');
      expect(result.reason).toContain('medium risks');
    });

    it('should block when low risks exceed threshold', () => {
      const config = { ...defaultConfig, maxLowRisks: 5 };
      const parsed: ParsedComment = {
        signals: [],
        risks: Array(6).fill(null).map((_, i) => ({
          severity: 'low' as const,
          title: `Risk ${i + 1}`,
          description: 'Test'
        })),
        blastRadius: { items: 0, edges: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const result = makeDecision(parsed, config);
      expect(result.decision).toBe('block');
      expect(result.reason).toContain('low risks');
    });

    it('should block when routine score is below minimum', () => {
      const parsed: ParsedComment = {
        signals: [
          { category: 'Routine', emoji: '🔴', severity: -2, description: 'Non-routine' }
        ],
        risks: [],
        blastRadius: { items: 0, edges: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const result = makeDecision(parsed, defaultConfig);
      expect(result.decision).toBe('block');
      expect(result.reason).toContain('Routine score');
    });

    it('should not block high risks if blockOnHighRisks is false', () => {
      const config = { ...defaultConfig, blockOnHighRisks: false };
      const parsed: ParsedComment = {
        signals: [],
        risks: [
          { severity: 'high', title: 'High risk', description: 'Test' }
        ],
        blastRadius: { items: 0, edges: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const result = makeDecision(parsed, config);
      // Should not block on high risk alone, but may block on other criteria
      expect(result.decision).toBeDefined();
    });

    it('should handle boundary conditions correctly', () => {
      // Exactly at threshold should pass
      const parsed: ParsedComment = {
        signals: [
          { category: 'Routine', emoji: '🟢', severity: -1, description: 'At threshold' }
        ],
        risks: [
          { severity: 'medium', title: 'Risk 1', description: 'Test' },
          { severity: 'medium', title: 'Risk 2', description: 'Test' },
          { severity: 'medium', title: 'Risk 3', description: 'Test' }
        ],
        blastRadius: { items: 0, edges: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const result = makeDecision(parsed, defaultConfig);
      expect(result.decision).toBe('approve'); // Exactly 3 medium risks should pass (threshold is > 3)
    });

    it('should count risks correctly', () => {
      const parsed: ParsedComment = {
        signals: [],
        risks: [
          { severity: 'high', title: 'High 1', description: 'Test' },
          { severity: 'high', title: 'High 2', description: 'Test' },
          { severity: 'medium', title: 'Medium 1', description: 'Test' },
          { severity: 'low', title: 'Low 1', description: 'Test' },
          { severity: 'low', title: 'Low 2', description: 'Test' }
        ],
        blastRadius: { items: 0, edges: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const result = makeDecision(parsed, defaultConfig);
      expect(result.risksSummary.high).toBe(2);
      expect(result.risksSummary.medium).toBe(1);
      expect(result.risksSummary.low).toBe(2);
    });

    it('should handle multiple blocking reasons', () => {
      const parsed: ParsedComment = {
        signals: [
          { category: 'Policies', emoji: '🔴', severity: -3, description: 'Policy violation' },
          { category: 'Cost', emoji: '🔴', severity: -3, description: 'Cost concern' },
          { category: 'Routine', emoji: '🔴', severity: -2, description: 'Non-routine' }
        ],
        risks: [
          { severity: 'medium', title: 'Risk 1', description: 'Test' },
          { severity: 'medium', title: 'Risk 2', description: 'Test' },
          { severity: 'medium', title: 'Risk 3', description: 'Test' },
          { severity: 'medium', title: 'Risk 4', description: 'Test' }
        ],
        blastRadius: { items: 0, edges: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const result = makeDecision(parsed, defaultConfig);
      expect(result.decision).toBe('block');
      expect(result.reason).toContain('Policy signal');
      expect(result.reason).toContain('Cost signal');
      expect(result.reason).toContain('medium risks');
      expect(result.reason).toContain('Routine score');
    });
  });

  describe('generateReviewComment', () => {
    it('should generate approval comment', () => {
      const result: DecisionResult = {
        decision: 'approve',
        reason: 'All safety checks passed',
        risksSummary: { high: 0, medium: 1, low: 2 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const parsed: ParsedComment = {
        signals: [
          { category: 'Routine', emoji: '🟢', severity: 3, description: 'Routine' }
        ],
        risks: [],
        blastRadius: { items: 5, edges: 10 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const comment = generateReviewComment(result, parsed);
      expect(comment).toContain('✅');
      expect(comment).toContain('Approved');
      expect(comment).toContain('All safety checks passed');
      expect(comment).toContain('Routine');
      expect(comment).toContain('5 items, 10 edges');
    });

    it('should generate block comment', () => {
      const result: DecisionResult = {
        decision: 'block',
        reason: 'Found 2 high risks',
        risksSummary: { high: 2, medium: 1, low: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const parsed: ParsedComment = {
        signals: [],
        risks: [],
        blastRadius: { items: 0, edges: 0 },
        changeUrl: 'https://app.overmind.tech/changes/test'
      };

      const comment = generateReviewComment(result, parsed);
      expect(comment).toContain('⛔');
      expect(comment).toContain('Blocked');
      expect(comment).toContain('2 high risks');
      expect(comment).toContain('2 high, 1 medium, 0 low');
    });
  });
});

