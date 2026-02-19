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
export interface AgentOutput {
  agent: string;
  analysis: string;
  score?: number;
  highlights?: string[];
}

// Dimension scores for the scorecard
export interface DimensionScores {
  problemClarity: number; // 1-10: How clear/validated is the problem?
  marketSize: number; // 1-10: TAM/SAM opportunity
  competitionRisk: number; // 1-10: Defensibility (10 = low risk, moat exists)
  execution: number; // 1-10: Team/founder ability to execute
  businessModel: number; // 1-10: Revenue model clarity & viability
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
