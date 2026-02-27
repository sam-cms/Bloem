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
const DEFAULT_MODEL = "claude-sonnet-4-6";

// Web search tool definition — agents use this when they need to verify
// facts, check competitors, or find current data. Same capability as Bruce.
const WEB_SEARCH_TOOL = {
  type: "web_search_20260209" as const,
  name: "web_search",
};

interface RunAgentOptions {
  name: string;
  systemPrompt: string;
  userMessage: string;
  model?: string;
  /** Max web searches this agent can perform (0 = no search) */
  maxSearches?: number;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

interface AnthropicResponse {
  content: Array<{
    type: string;
    text?: string;
    name?: string;
    id?: string;
    input?: Record<string, unknown>;
  }>;
  stop_reason?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Resolve the Anthropic API key from environment or Bloem auth system.
 */
function getApiKey(): string {
  // Prefer env var for standalone Docker deployment
  let apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Fall back to Bloem's auth system
    const cfg = loadConfig();
    // resolveApiKeyForProvider is async but we need sync here —
    // caller should pre-resolve if needed
    throw new Error(`No API key found for anthropic. Set ANTHROPIC_API_KEY environment variable.`);
  }

  return apiKey;
}

/**
 * Run a Prebloom agent with optional web search capability.
 *
 * Agents autonomously decide when to search — just like Bruce.
 * The web search tool is Claude's built-in server-side search.
 * For Tier 1 agents, maxSearches is low (0-2) — safety net only.
 * For Tier 2 agents (Groundwork), maxSearches is higher (8-10).
 */
async function runAgent(options: RunAgentOptions): Promise<AgentOutput> {
  const { name, systemPrompt, userMessage, model = DEFAULT_MODEL, maxSearches = 0 } = options;

  console.log(
    `🤖 [Prebloom] Running ${name} agent${maxSearches > 0 ? ` (search enabled, max ${maxSearches})` : ""}...`,
  );
  const started = Date.now();

  const apiKey = getApiKey();

  // Build request body
  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  };

  // Add web search tool if agent has search capability
  if (maxSearches > 0) {
    requestBody.tools = [
      {
        ...WEB_SEARCH_TOOL,
        max_uses: maxSearches,
      },
    ];
  }

  // Call Anthropic API
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as AnthropicResponse;

  const elapsed = Date.now() - started;

  // Count searches performed
  const searchCount = data.content.filter(
    (block) => block.type === "server_tool_use" && block.name === "web_search",
  ).length;

  console.log(
    `✅ [Prebloom] ${name} agent complete (${elapsed}ms)` +
      (searchCount > 0 ? ` — ${searchCount} web search${searchCount > 1 ? "es" : ""}` : "") +
      (data.usage ? ` — ${data.usage.input_tokens}in/${data.usage.output_tokens}out tokens` : ""),
  );

  // Extract text from response (skip tool use/result blocks)
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
  // V2 format: XML-structured input, documents first, instructions last
  const intakeMessage = iterationContext
    ? `${iterationContext}\n\n---\n\n<idea_submission>\n${ideaText}\n</idea_submission>\n\nAnalyze this startup idea submission and produce your structured intake brief.`
    : `<idea_submission>\n${ideaText}\n</idea_submission>\n\nAnalyze this startup idea submission and produce your structured intake brief.`;

  let intake = await runAgent({
    name: "Intake",
    systemPrompt: INTAKE_SYSTEM_PROMPT,
    userMessage: intakeMessage,
    maxSearches: 2, // Tier 1: safety net search
  });

  // Phase 2: Catalyst and Fire run in parallel
  // V2 format: documents first (long context at top), instructions last
  const catalystMessage = `<documents>
<document index="1">
<source>intake_brief</source>
<document_content>
${intake.analysis}
</document_content>
</document>
<document index="2">
<source>original_idea</source>
<document_content>
${ideaText}
</document_content>
</document>
${
  iterationContext
    ? `<document index="3">
<source>iteration_context</source>
<document_content>
${iterationContext}
</document_content>
</document>`
    : ""
}
</documents>

Apply your three lenses (Visionary, Hacker, Strategist) to this startup idea and produce your Catalyst Council analysis.`;

  const fireMessage = `<documents>
<document index="1">
<source>intake_brief</source>
<document_content>
${intake.analysis}
</document_content>
</document>
<document index="2">
<source>original_idea</source>
<document_content>
${ideaText}
</document_content>
</document>
${
  iterationContext
    ? `<document index="3">
<source>iteration_context</source>
<document_content>
${iterationContext}
</document_content>
</document>`
    : ""
}
</documents>

Apply your three lenses (VC, Cynic, Real User) to this startup idea. Challenge assumptions and find the dangers.`;

  let [catalyst, fire] = await Promise.all([
    runAgent({
      name: "Catalyst",
      systemPrompt: CATALYST_SYSTEM_PROMPT,
      userMessage: catalystMessage,
      maxSearches: 2, // Tier 1: safety net search
    }),
    runAgent({
      name: "Fire",
      systemPrompt: FIRE_SYSTEM_PROMPT,
      userMessage: fireMessage,
      maxSearches: 2, // Tier 1: safety net search
    }),
  ]);

  // Phase 3: Synthesis
  // V2 format: all upstream data in documents, instruction last
  const synthesisInput = `<documents>
<document index="1">
<source>intake_brief</source>
<document_content>
${intake.analysis}
</document_content>
</document>
<document index="2">
<source>catalyst_analysis</source>
<document_content>
${catalyst.analysis}
</document_content>
</document>
<document index="3">
<source>firing_squad_analysis</source>
<document_content>
${fire.analysis}
</document_content>
</document>
<document index="4">
<source>original_idea</source>
<document_content>
${ideaText}
</document_content>
</document>
${
  iterationContext
    ? `<document index="5">
<source>iteration_context</source>
<document_content>
${iterationContext}
</document_content>
</document>`
    : ""
}
</documents>

Weigh the Catalyst Council's case FOR and the Firing Squad's case AGAINST this startup idea. Deliver your Market Fit Scan verdict.`;

  let synthesis = await runAgent({
    name: "Synthesis",
    systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
    userMessage: synthesisInput,
    maxSearches: 1, // Synthesis rarely needs search — reasoning over existing data
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
    // Match both "Label | X/10" (table format) and "Label: X/10" formats
    const regex = new RegExp(`${label}[:\\s|]*(?:\\[)?(\\d+)\\s*\\/\\s*10`, "i");
    const match = analysis.match(regex);
    return match ? Math.min(10, Math.max(1, parseInt(match[1]))) : 5;
  };

  return {
    // V2 dimension names (with fallbacks to V1 names)
    problemClarity: extractScore("Problem Clarity"),
    marketSize: extractScore("Market Opportunity|Market Size"),
    competitionRisk: extractScore("Competitive Position|Competition Risk"),
    execution: extractScore("Execution Feasibility|Execution"),
    businessModel: extractScore("Business Viability|Business Model"),
  };
}

/**
 * Extract content from an XML tag in the analysis text.
 * Returns the content between <tag> and </tag>, or empty string if not found.
 */
function extractXmlTag(analysis: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = analysis.match(regex);
  return match ? match[1].trim() : "";
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
  // V2: look inside <verdict> tag first, then fall back to scanning full text
  let decision: "STRONG_SIGNAL" | "CONDITIONAL_FIT" | "WEAK_SIGNAL" | "NO_MARKET_FIT" =
    "CONDITIONAL_FIT";

  const verdictTag = extractXmlTag(safeAnalysis, "verdict");
  const searchText = (verdictTag || safeAnalysis).toUpperCase();

  if (searchText.includes("STRONG_SIGNAL") || searchText.includes("STRONG SIGNAL")) {
    decision = "STRONG_SIGNAL";
  } else if (
    searchText.includes("NO_MARKET_FIT") ||
    searchText.includes("NO MARKET FIT") ||
    searchText.includes("NO FIT")
  ) {
    decision = "NO_MARKET_FIT";
  } else if (searchText.includes("WEAK_SIGNAL") || searchText.includes("WEAK SIGNAL")) {
    decision = "WEAK_SIGNAL";
  } else if (searchText.includes("CONDITIONAL_FIT") || searchText.includes("CONDITIONAL FIT")) {
    decision = "CONDITIONAL_FIT";
  }

  // Extract confidence score
  // V2: look inside <verdict> tag first
  const confidenceSource = verdictTag || safeAnalysis;
  const confidenceMatch = confidenceSource.match(
    /confidence[:\s]*(\d+)\s*\/\s*10|(\d+)\s*\/\s*10/i,
  );
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1] || confidenceMatch[2]) : 5;

  // Extract executive summary
  // V2: try <executive_summary> tag first, then fall back to markdown
  let executiveSummary = extractXmlTag(safeAnalysis, "executive_summary");
  if (!executiveSummary) {
    const summaryMatch = safeAnalysis.match(
      /executive summary[:\s]*\n+([\s\S]*?)(?=\n\n|\n###|$)/i,
    );
    if (summaryMatch && summaryMatch[1]) {
      executiveSummary = summaryMatch[1].trim().split("\n")[0] || "Evaluation complete.";
    } else if (safeAnalysis) {
      executiveSummary = safeAnalysis.split("\n\n")[0] || "Evaluation complete.";
    } else {
      executiveSummary = "Evaluation complete.";
    }
  }

  // Helper to extract bullet lists — tries XML tag first, then markdown
  const extractList = (xmlTag: string, markdownLabel: string): string[] => {
    // V2: try XML tag first
    const xmlContent = extractXmlTag(safeAnalysis, xmlTag);
    const source =
      xmlContent ||
      (() => {
        const regex = new RegExp(
          `${markdownLabel}[:\\s]*(?:\\([^)]+\\))?[:\\s]*\\n([\\s\\S]*?)(?=\\n\\n|\\n###|$)`,
          "i",
        );
        const match = safeAnalysis.match(regex);
        return match?.[1] || "";
      })();

    if (!source) return [];
    return source
      .split("\n")
      .map((line: string) => line.replace(/^[\d\.\-\*•]\s*/, "").trim())
      .filter((line: string) => line.length > 0 && !line.startsWith("#") && !line.startsWith("<"))
      .slice(0, 5);
  };

  // V2: extract straight talk
  const straightTalk = extractXmlTag(safeAnalysis, "straight_talk");

  return {
    decision,
    confidence: Math.min(10, Math.max(1, confidence)),
    dimensions: parseDimensionScores(safeAnalysis),
    executiveSummary,
    keyStrengths: extractList("top_strengths", "Key Strengths|Top Strengths"),
    keyRisks: extractList("top_risks", "Key Risks|Top Risks"),
    nextSteps: extractList("next_steps", "Recommended Next Steps|Next Steps"),
    killConditions: extractList("kill_conditions", "Kill Conditions"),
    ...(straightTalk ? { straightTalk } : {}),
  };
}
