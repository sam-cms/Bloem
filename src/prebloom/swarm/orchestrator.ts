import crypto from "node:crypto";

import { loadConfig } from "../../config/config.js";
import { resolveApiKeyForProvider } from "../../agents/model-auth.js";
import type { IdeaInput, Verdict, AgentOutput } from "../types.js";
import { INTAKE_SYSTEM_PROMPT } from "./agents/intake.js";
import { CATALYST_SYSTEM_PROMPT } from "./agents/catalyst.js";
import { FIRE_SYSTEM_PROMPT } from "./agents/fire.js";
import { SYNTHESIS_SYSTEM_PROMPT } from "./agents/synthesis.js";

// Default model for Prebloom evaluations
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

interface RunAgentOptions {
  name: string;
  systemPrompt: string;
  userMessage: string;
  model?: string;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

async function runAgent(options: RunAgentOptions): Promise<AgentOutput> {
  const { name, systemPrompt, userMessage, model = DEFAULT_MODEL } = options;
  
  console.log(`🤖 [Prebloom] Running ${name} agent...`);
  const started = Date.now();

  // Get API key - prefer env var for standalone Docker deployment
  let apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    // Fall back to Bloem's auth system
    const cfg = loadConfig();
    const authResult = await resolveApiKeyForProvider({
      cfg,
      provider: "anthropic",
    });
    apiKey = authResult.apiKey;
  }
  
  if (!apiKey) {
    throw new Error(`No API key found for anthropic. Set ANTHROPIC_API_KEY environment variable.`);
  }

  // Call Anthropic API directly
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ] as AnthropicMessage[],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as AnthropicResponse;

  const elapsed = Date.now() - started;
  console.log(`✅ [Prebloom] ${name} agent complete (${elapsed}ms)`);

  // Extract text from response
  const text = data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");

  return {
    agent: name,
    analysis: text,
  };
}

function formatIdeaForAgents(input: IdeaInput): string {
  return `
## Startup Idea Submission

**Problem:** ${input.problem}

**Solution:** ${input.solution}

**Target Market:** ${input.targetMarket}

**Business Model:** ${input.businessModel}

${input.whyYou ? `**Why You (Founder):** ${input.whyYou}` : ""}
`.trim();
}

export async function evaluateIdea(input: IdeaInput): Promise<Verdict> {
  const id = crypto.randomUUID();
  const ideaText = formatIdeaForAgents(input);
  
  console.log(`\n🌱 [Prebloom] Starting evaluation ${id}\n`);
  const totalStarted = Date.now();

  // Phase 1: Intake
  const intake = await runAgent({
    name: "Intake",
    systemPrompt: INTAKE_SYSTEM_PROMPT,
    userMessage: ideaText,
  });

  // Phase 2: Catalyst and Fire run in parallel
  const [catalyst, fire] = await Promise.all([
    runAgent({
      name: "Catalyst",
      systemPrompt: CATALYST_SYSTEM_PROMPT,
      userMessage: `${ideaText}\n\n---\n\n## Intake Analysis\n${intake.analysis}`,
    }),
    runAgent({
      name: "Fire",
      systemPrompt: FIRE_SYSTEM_PROMPT,
      userMessage: `${ideaText}\n\n---\n\n## Intake Analysis\n${intake.analysis}`,
    }),
  ]);

  // Phase 3: Synthesis
  const synthesisInput = `
${ideaText}

---

## Intake Analysis
${intake.analysis}

---

## Catalyst Squad (The Believers)
${catalyst.analysis}

---

## Fire Squad (The Skeptics)
${fire.analysis}
`.trim();

  const synthesis = await runAgent({
    name: "Synthesis",
    systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
    userMessage: synthesisInput,
  });

  // Parse synthesis output for structured verdict
  const parsedVerdict = parseSynthesisOutput(synthesis.analysis);

  const totalElapsed = Date.now() - totalStarted;
  console.log(`\n✨ [Prebloom] Evaluation complete: ${parsedVerdict.decision} (${parsedVerdict.confidence}/10) in ${totalElapsed}ms\n`);

  return {
    id,
    createdAt: new Date().toISOString(),
    input,
    intake,
    catalyst,
    fire,
    synthesis,
    ...parsedVerdict,
  };
}

function parseSynthesisOutput(analysis: string): {
  decision: "PASS" | "FAIL" | "CONDITIONAL_PASS";
  confidence: number;
  executiveSummary: string;
  keyStrengths: string[];
  keyRisks: string[];
  nextSteps: string[];
  killConditions: string[];
} {
  // Safety: ensure analysis is a string
  const safeAnalysis = analysis || "";
  
  // Determine decision
  let decision: "PASS" | "FAIL" | "CONDITIONAL_PASS" = "CONDITIONAL_PASS";
  const upperAnalysis = safeAnalysis.toUpperCase();
  
  if (upperAnalysis.includes("VERDICT: PASS") && !upperAnalysis.includes("CONDITIONAL")) {
    decision = "PASS";
  } else if (upperAnalysis.includes("VERDICT: FAIL")) {
    decision = "FAIL";
  } else if (upperAnalysis.includes("CONDITIONAL_PASS") || upperAnalysis.includes("CONDITIONAL PASS")) {
    decision = "CONDITIONAL_PASS";
  }

  // Extract confidence score (look for patterns like "7/10" or "Confidence: 7")
  const confidenceMatch = safeAnalysis.match(/confidence[:\s]*(\d+)\s*\/\s*10|(\d+)\s*\/\s*10/i);
  const confidence = confidenceMatch 
    ? parseInt(confidenceMatch[1] || confidenceMatch[2]) 
    : 5;

  // Extract executive summary (first section after "Executive Summary")
  const summaryMatch = safeAnalysis.match(/executive summary[:\s]*\n+([\s\S]*?)(?=\n\n|\n###|$)/i);
  let executiveSummary = "Evaluation complete.";
  if (summaryMatch && summaryMatch[1]) {
    executiveSummary = summaryMatch[1].trim().split("\n")[0] || executiveSummary;
  } else if (safeAnalysis) {
    executiveSummary = safeAnalysis.split("\n\n")[0] || executiveSummary;
  }

  // Helper to extract bullet lists
  const extractList = (label: string): string[] => {
    const regex = new RegExp(`${label}[:\\s]*(?:\\([^)]+\\))?[:\\s]*\\n([\\s\\S]*?)(?=\\n\\n|\\n###|$)`, "i");
    const match = safeAnalysis.match(regex);
    if (!match || !match[1]) return [];
    return match[1]
      .split("\n")
      .map((line: string) => line.replace(/^[\d\.\-\*•]\s*/, "").trim())
      .filter((line: string) => line.length > 0 && !line.startsWith("#"))
      .slice(0, 5);
  };

  return {
    decision,
    confidence: Math.min(10, Math.max(1, confidence)),
    executiveSummary,
    keyStrengths: extractList("Key Strengths"),
    keyRisks: extractList("Key Risks"),
    nextSteps: extractList("Recommended Next Steps|Next Steps"),
    killConditions: extractList("Kill Conditions"),
  };
}
