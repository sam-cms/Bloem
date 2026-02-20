import crypto from "node:crypto";

import { loadConfig } from "../../config/config.js";
import { resolveApiKeyForProvider } from "../../agents/model-auth.js";
import type {
  IdeaInput,
  Verdict,
  AgentOutput,
  DimensionScores,
  ActionItemResponse,
} from "../types.js";
import { INTAKE_SYSTEM_PROMPT } from "./agents/intake.js";
import { CATALYST_SYSTEM_PROMPT } from "./agents/catalyst.js";
import { FIRE_SYSTEM_PROMPT } from "./agents/fire.js";
import { SYNTHESIS_SYSTEM_PROMPT } from "./agents/synthesis.js";
import { applySkillById, getRegistry } from "../skills/index.js";
import { extractActionItems } from "./action-items.js";

export interface EvaluationOptions {
  /** Apply humanizer skill to outputs */
  humanize?: boolean;
  /** Apply transcription skill to input (for voice submissions) */
  transcribe?: boolean;
  /** Custom skills to apply (by ID) */
  skills?: string[];
  /** Previous evaluation for iteration context */
  previousEvaluation?: Verdict;
  /** User responses to action items (for iterations) */
  userResponses?: ActionItemResponse[];
}

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

/**
 * Build iteration context string for agents
 * This provides context from previous evaluation and user responses
 */
function buildIterationContext(
  previousEvaluation: Verdict,
  userResponses?: ActionItemResponse[],
): string {
  const decisionLabels: Record<string, string> = {
    STRONG_SIGNAL: "Strong Signal",
    CONDITIONAL_FIT: "Conditional Fit",
    WEAK_SIGNAL: "Weak Signal",
    NO_MARKET_FIT: "No Market Fit",
  };

  let context = `
## Previous Evaluation Context (Version ${previousEvaluation.version})

**Previous Result:** ${decisionLabels[previousEvaluation.decision]} (${previousEvaluation.confidence}/10)

**Previous Summary:** ${previousEvaluation.executiveSummary}

### Key Concerns from Previous Evaluation:
`;

  // Add action items with user responses if available
  if (previousEvaluation.actionItems && previousEvaluation.actionItems.length > 0) {
    for (const item of previousEvaluation.actionItems) {
      const response = userResponses?.find((r) => r.actionItemId === item.id);
      context += `\n**${item.severity.toUpperCase()}:** ${item.concern}`;
      if (response) {
        context += `\n→ *User's response:* ${response.response}`;
      }
      context += "\n";
    }
  } else {
    // Fall back to key risks if no action items
    for (const risk of previousEvaluation.keyRisks.slice(0, 3)) {
      context += `- ${risk}\n`;
    }
  }

  context += `
---

**Instructions:** This is Version ${previousEvaluation.version + 1} of this evaluation. 
The founder has refined their pitch based on previous feedback.
- Evaluate the new version on its own merits
- Note specific improvements from the previous version
- Identify any new concerns that emerged
- Be fair but thorough — iteration should show real progress
`;

  return context.trim();
}

export async function evaluateIdea(
  input: IdeaInput,
  options: EvaluationOptions = {},
): Promise<Verdict> {
  const id = crypto.randomUUID();
  let ideaText = formatIdeaForAgents(input);

  // Determine version number based on previous evaluation
  const version = options.previousEvaluation ? options.previousEvaluation.version + 1 : 1;
  const previousId = options.previousEvaluation?.id;

  // Build iteration context if this is a re-evaluation
  let iterationContext = "";
  if (options.previousEvaluation) {
    iterationContext = buildIterationContext(options.previousEvaluation, options.userResponses);
    console.log(`\n🔄 [Prebloom] Starting iteration ${version} (previous: ${previousId})\n`);
  } else {
    console.log(`\n🌱 [Prebloom] Starting evaluation ${id}\n`);
  }

  const totalStarted = Date.now();

  // Initialize skills registry
  const registry = getRegistry();
  console.log(
    `[Prebloom] Skills available: ${
      registry
        .list()
        .map((s) => s.name)
        .join(", ") || "none"
    }`,
  );

  // Phase 0: Apply transcription skill if enabled (for voice input)
  if (options.transcribe && registry.has("transcription")) {
    console.log(`[Prebloom] Applying transcription skill to input...`);
    const result = await applySkillById("transcription", { text: ideaText, agent: "input" });
    if (result.applied) {
      ideaText = result.text;
    }
  }

  // Phase 1: Intake (include iteration context if present)
  const intakeMessage = iterationContext ? `${iterationContext}\n\n---\n\n${ideaText}` : ideaText;

  let intake = await runAgent({
    name: "Intake",
    systemPrompt: INTAKE_SYSTEM_PROMPT,
    userMessage: intakeMessage,
  });

  // Phase 2: Catalyst and Fire run in parallel (include iteration context)
  const catalystMessage = iterationContext
    ? `${iterationContext}\n\n---\n\n${ideaText}\n\n---\n\n## Intake Analysis\n${intake.analysis}`
    : `${ideaText}\n\n---\n\n## Intake Analysis\n${intake.analysis}`;

  const fireMessage = iterationContext
    ? `${iterationContext}\n\n---\n\n${ideaText}\n\n---\n\n## Intake Analysis\n${intake.analysis}`
    : `${ideaText}\n\n---\n\n## Intake Analysis\n${intake.analysis}`;

  let [catalyst, fire] = await Promise.all([
    runAgent({
      name: "Catalyst",
      systemPrompt: CATALYST_SYSTEM_PROMPT,
      userMessage: catalystMessage,
    }),
    runAgent({
      name: "Fire",
      systemPrompt: FIRE_SYSTEM_PROMPT,
      userMessage: fireMessage,
    }),
  ]);

  // Phase 3: Synthesis (include iteration context)
  const synthesisInput = iterationContext
    ? `
${iterationContext}

---

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
`.trim()
    : `
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

  let synthesis = await runAgent({
    name: "Synthesis",
    systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
    userMessage: synthesisInput,
  });

  // Phase 4: Apply humanizer skill if enabled
  if (options.humanize && registry.has("humanizer")) {
    console.log(`[Prebloom] Applying humanizer skill to outputs...`);

    const [intakeHumanized, catalystHumanized, fireHumanized, synthesisHumanized] =
      await Promise.all([
        applySkillById("humanizer", { text: intake.analysis, agent: "intake" }),
        applySkillById("humanizer", { text: catalyst.analysis, agent: "catalyst" }),
        applySkillById("humanizer", { text: fire.analysis, agent: "fire" }),
        applySkillById("humanizer", { text: synthesis.analysis, agent: "synthesis" }),
      ]);

    if (intakeHumanized.applied) intake = { ...intake, analysis: intakeHumanized.text };
    if (catalystHumanized.applied) catalyst = { ...catalyst, analysis: catalystHumanized.text };
    if (fireHumanized.applied) fire = { ...fire, analysis: fireHumanized.text };
    if (synthesisHumanized.applied) synthesis = { ...synthesis, analysis: synthesisHumanized.text };
  }

  // Phase 5: Apply custom skills if specified
  if (options.skills && options.skills.length > 0) {
    for (const skillId of options.skills) {
      if (registry.has(skillId)) {
        console.log(`[Prebloom] Applying custom skill: ${skillId}`);
        const synthesisResult = await applySkillById(skillId, {
          text: synthesis.analysis,
          agent: "synthesis",
        });
        if (synthesisResult.applied) {
          synthesis = { ...synthesis, analysis: synthesisResult.text };
        }
      }
    }
  }

  // Parse synthesis output for structured verdict
  const parsedVerdict = parseSynthesisOutput(synthesis.analysis);

  // Extract action items for potential iteration
  const actionItems = extractActionItems({
    synthesis,
    fire,
    dimensions: parsedVerdict.dimensions,
    keyRisks: parsedVerdict.keyRisks,
    killConditions: parsedVerdict.killConditions,
  });

  const totalElapsed = Date.now() - totalStarted;
  console.log(
    `\n✨ [Prebloom] Evaluation complete (V${version}): ${parsedVerdict.decision} (${parsedVerdict.confidence}/10) in ${totalElapsed}ms\n`,
  );

  return {
    id,
    createdAt: new Date().toISOString(),
    input,
    intake,
    catalyst,
    fire,
    synthesis,
    ...parsedVerdict,
    // Iteration tracking
    version,
    previousId,
    actionItems,
    userResponses: options.userResponses,
  };
}

function parseDimensionScores(analysis: string): DimensionScores {
  const extractScore = (label: string): number => {
    const regex = new RegExp(`${label}[:\\s]*(?:\\[)?(\\d+)\\s*\\/\\s*10`, "i");
    const match = analysis.match(regex);
    return match ? Math.min(10, Math.max(1, parseInt(match[1]))) : 5;
  };

  return {
    problemClarity: extractScore("Problem Clarity"),
    marketSize: extractScore("Market Size"),
    competitionRisk: extractScore("Competition Risk"),
    execution: extractScore("Execution"),
    businessModel: extractScore("Business Model"),
  };
}

function parseSynthesisOutput(analysis: string): {
  decision: "STRONG_SIGNAL" | "CONDITIONAL_FIT" | "WEAK_SIGNAL" | "NO_MARKET_FIT";
  confidence: number;
  dimensions: DimensionScores;
  executiveSummary: string;
  keyStrengths: string[];
  keyRisks: string[];
  nextSteps: string[];
  killConditions: string[];
} {
  // Safety: ensure analysis is a string
  const safeAnalysis = analysis || "";

  // Determine decision from Market Fit Scan result
  let decision: "STRONG_SIGNAL" | "CONDITIONAL_FIT" | "WEAK_SIGNAL" | "NO_MARKET_FIT" =
    "CONDITIONAL_FIT";
  const upperAnalysis = safeAnalysis.toUpperCase();

  if (upperAnalysis.includes("STRONG_SIGNAL") || upperAnalysis.includes("STRONG SIGNAL")) {
    decision = "STRONG_SIGNAL";
  } else if (upperAnalysis.includes("NO_MARKET_FIT") || upperAnalysis.includes("NO MARKET FIT")) {
    decision = "NO_MARKET_FIT";
  } else if (upperAnalysis.includes("WEAK_SIGNAL") || upperAnalysis.includes("WEAK SIGNAL")) {
    decision = "WEAK_SIGNAL";
  } else if (
    upperAnalysis.includes("CONDITIONAL_FIT") ||
    upperAnalysis.includes("CONDITIONAL FIT")
  ) {
    decision = "CONDITIONAL_FIT";
  }

  // Extract confidence score (look for patterns like "7/10" or "Confidence: 7")
  const confidenceMatch = safeAnalysis.match(/confidence[:\s]*(\d+)\s*\/\s*10|(\d+)\s*\/\s*10/i);
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1] || confidenceMatch[2]) : 5;

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
    const regex = new RegExp(
      `${label}[:\\s]*(?:\\([^)]+\\))?[:\\s]*\\n([\\s\\S]*?)(?=\\n\\n|\\n###|$)`,
      "i",
    );
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
    dimensions: parseDimensionScores(safeAnalysis),
    executiveSummary,
    keyStrengths: extractList("Key Strengths"),
    keyRisks: extractList("Key Risks"),
    nextSteps: extractList("Recommended Next Steps|Next Steps"),
    killConditions: extractList("Kill Conditions"),
  };
}
