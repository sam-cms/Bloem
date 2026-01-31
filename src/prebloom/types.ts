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

// Final verdict structure
export interface Verdict {
  id: string;
  createdAt: string;
  input: IdeaInput;
  
  // Agent outputs
  intake: AgentOutput;
  catalyst: AgentOutput;
  fire: AgentOutput;
  synthesis: AgentOutput;
  
  // Final verdict
  decision: "PASS" | "FAIL" | "CONDITIONAL_PASS";
  confidence: number; // 1-10
  
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
