export interface Signal {
  category: string;
  emoji: string;
  severity: number;
  description: string;
}

export interface Risk {
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

export interface BlastRadius {
  items: number;
  edges: number;
}

export interface ParsedComment {
  signals: Signal[];
  risks: Risk[];
  blastRadius: BlastRadius;
  changeUrl: string;
}

export type Decision = 'approve' | 'block' | 'skipped';

export interface DecisionResult {
  decision: Decision;
  reason: string;
  risksSummary: {
    high: number;
    medium: number;
    low: number;
  };
  changeUrl: string;
}

export interface Config {
  blockOnHighRisks: boolean;
  maxMediumRisks: number;
  maxLowRisks: number;
  policySignalThreshold: number;
  costSignalThreshold: number;
  minRoutineScore: number;
  autoApprove: boolean;
  waitTimeout: number;
}

