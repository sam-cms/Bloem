import { z } from "zod";

// Input schema - what users submit
export const ideaInputSchema = z.object({
  problem: z.string().min(10, "Problem description required"),
  solution: z.string().min(10, "Solution description required"),
  targetMarket: z.string().min(5, "Target market required"),
  businessModel: z.string().min(5, "Business model required"),
  whyYou: z.string().optional(),
  email: z.string().email("Valid email required"),
});

export type IdeaInput = z.infer<typeof ideaInputSchema>;

// Structured output from each agent
export interface AgentMetrics {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  searches: number;
}

export interface AgentOutput {
  agent: string;
  analysis: string;
  score?: number;
  highlights?: string[];
  metrics?: AgentMetrics;
}

// Dimension scores for the scorecard
export interface DimensionScores {
  problemClarity: number; // 1-10: How clear/validated is the problem?
  marketSize: number; // 1-10: TAM/SAM opportunity
  competitionRisk: number; // 1-10: Defensibility (10 = low risk, moat exists)
  execution: number; // 1-10: Team/founder ability to execute
  businessModel: number; // 1-10: Revenue model clarity & viability
}

// Action item extracted from evaluation for iteration
export interface ActionItem {
  id: string;
  concern: string; // The weakness/risk to address
  category: "market" | "product" | "execution" | "business" | "timing";
  severity: "critical" | "major" | "minor";
  source: "synthesis" | "fire" | "dimension"; // Where this was identified
  addressed?: boolean; // Updated after re-evaluation
}

// User response to an action item during iteration
export interface ActionItemResponse {
  actionItemId: string;
  response: string;
}

// Market Fit Scan result structure
export interface Verdict {
  id: string;
  createdAt: string;
  input: IdeaInput;

  // Agent outputs
  intake: AgentOutput;
  catalyst: AgentOutput;
  fire: AgentOutput;
  synthesis: AgentOutput;

  // Market Fit Scan result
  decision: "STRONG_SIGNAL" | "CONDITIONAL_FIT" | "WEAK_SIGNAL" | "NO_MARKET_FIT";
  confidence: number; // 1-10

  // Dimension breakdown
  dimensions: DimensionScores;

  executiveSummary: string;
  keyStrengths: string[];
  keyRisks: string[];
  nextSteps: string[];
  killConditions: string[];
  straightTalk?: string; // V2: the most important paragraph — direct founder advice

  // Iteration tracking
  version: number; // 1, 2, 3...
  previousId?: string; // Link to previous version
  actionItems?: ActionItem[]; // Extracted concerns for next iteration
  userResponses?: ActionItemResponse[]; // What user submitted for this iteration
  // Pipeline metrics
  metrics?: {
    totalDurationMs: number;
    agents: Record<string, AgentMetrics | undefined>;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalSearches: number;
  };
}

// Evaluation job status
export interface EvaluationJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  input: IdeaInput;
  verdict?: Verdict;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// Iteration request schema
export const iterationRequestSchema = z.object({
  responses: z.array(
    z.object({
      actionItemId: z.string(),
      response: z.string().min(10, "Response must be at least 10 characters"),
    }),
  ),
  updatedPitch: z
    .object({
      problem: z.string().optional(),
      solution: z.string().optional(),
      targetMarket: z.string().optional(),
      businessModel: z.string().optional(),
      whyYou: z.string().optional(),
    })
    .optional(),
});

export type IterationRequest = z.infer<typeof iterationRequestSchema>;
