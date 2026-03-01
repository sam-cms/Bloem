// --- Legacy research types (used by existing /groundwork/research endpoints) ---

export interface CompetitorInfo {
  name: string;
  website?: string;
  description: string;
  funding?: string;
  pricing?: string;
  strengths: string[];
  weaknesses: string[];
}

export interface MarketResearchResult {
  id: string;
  createdAt: string;
  query: string;
  summary: string;
  marketSize?: string;
  trends: string[];
  directCompetitors: CompetitorInfo[];
  indirectCompetitors: CompetitorInfo[];
  gaps: string[];
  opportunities: string[];
  threats: string[];
  recommendations: string[];
  sources: string[];
  researchType: "quick" | "deep";
}

export interface ResearchRequest {
  idea: string;
  industry?: string;
  researchType: "quick" | "deep";
}

// --- Groundwork V1 types ---

export interface CouncilContext {
  intake: string;
  catalyst: string;
  fire: string;
  synthesis: string;
  ideaText?: string;
}

export interface GroundworkAgentOutput {
  agent: string;
  analysis: string;
  metrics: {
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    searches: number;
  };
}

export interface GroundworkResult {
  id: string;
  evaluationId: string;
  createdAt: string;
  status: "running" | "completed" | "failed";

  // Phase A: Intelligence
  competitorIntelligence?: GroundworkAgentOutput;
  marketSizing?: GroundworkAgentOutput;
  gapAnalysis?: GroundworkAgentOutput;

  // Phase B: Blueprint
  customerPersonas?: GroundworkAgentOutput;
  gtmPlaybook?: GroundworkAgentOutput;
  mvpScope?: GroundworkAgentOutput;

  // Metrics
  metrics?: GroundworkMetrics;
  error?: string;
}

export interface GroundworkMetrics {
  totalDurationMs: number;
  phaseADurationMs: number;
  phaseBDurationMs: number;
  agents: Record<string, GroundworkAgentOutput["metrics"]>;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalSearches: number;
}

// SSE event types for streaming Groundwork progress
export type GroundworkSSEEvent =
  | { type: "stage"; agent: string; status: "running" | "complete"; label?: string }
  | { type: "headline"; agent: string; text: string }
  | { type: "complete"; groundworkId: string; evaluationId: string };

export type GroundworkEventCallback = (event: GroundworkSSEEvent) => void;
