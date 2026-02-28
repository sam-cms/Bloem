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

// Custom web_search tool — agents call this autonomously, orchestrator
// intercepts and executes via Brave Search API (10x cheaper than Claude built-in).
const WEB_SEARCH_TOOL = {
  name: "web_search",
  description:
    "Search the web for current information. Use when you need to verify facts, find competitors, check market data, or get recent information. Returns titles, URLs, and text snippets.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query. Be specific — include market, region, or product names.",
      },
    },
    required: ["query"],
  },
};

/**
 * Execute a web search via Brave Search API.
 * Returns formatted snippets for the agent to reason over.
 */
async function braveSearch(query: string): Promise<string> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    return "[Search unavailable: BRAVE_API_KEY not set]";
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;

  const response = await fetch(url, {
    headers: { "X-Subscription-Token": apiKey },
  });

  if (!response.ok) {
    return `[Search failed: ${response.status}]`;
  }

  const data = (await response.json()) as {
    web?: { results?: Array<{ title: string; url: string; description: string }> };
  };

  const results = data.web?.results || [];
  if (results.length === 0) {
    return "[No results found]";
  }

  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description}`)
    .join("\n\n");
}

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
 * Agentic tool-use loop: agent autonomously decides when to search.
 * When it calls web_search, we intercept, run Brave Search, and feed
 * the results back. Loop continues until agent produces end_turn.
 *
 * Tier 1 agents: maxSearches 0-2 (safety net only)
 * Tier 2 agents (Groundwork): maxSearches 8-10 (research primary)
 */
async function runAgent(options: RunAgentOptions): Promise<AgentOutput> {
  const { name, systemPrompt, userMessage, model = DEFAULT_MODEL, maxSearches = 0 } = options;

  console.log(
    `🤖 [Prebloom] Running ${name} agent${maxSearches > 0 ? ` (search enabled, max ${maxSearches})` : ""}...`,
  );
  const started = Date.now();

  const apiKey = getApiKey();

  // Conversation history for the agentic loop
  const messages: AnthropicMessage[] = [{ role: "user", content: userMessage }];

  let searchesUsed = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Agentic loop — keep going until agent stops calling tools
  while (true) {
    const requestBody: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    };

    // Provide search tool if agent still has budget
    if (maxSearches > 0 && searchesUsed < maxSearches) {
      requestBody.tools = [WEB_SEARCH_TOOL];
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120_000), // 2 min timeout per API call
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as AnthropicResponse;

    if (data.usage) {
      totalInputTokens += data.usage.input_tokens;
      totalOutputTokens += data.usage.output_tokens;
    }

    // Check if agent wants to use tools
    const toolUseBlocks = data.content.filter(
      (block) => block.type === "tool_use" && block.name === "web_search",
    );

    if (toolUseBlocks.length > 0 && searchesUsed < maxSearches) {
      // Add full assistant response to conversation history
      messages.push({ role: "assistant", content: data.content as Array<Record<string, unknown>> });

      // Execute all tool calls and build tool_result blocks
      const toolResults: Array<Record<string, unknown>> = [];
      for (const toolBlock of toolUseBlocks) {
        if (searchesUsed >= maxSearches) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: "[Search budget exhausted]",
          });
          continue;
        }
        const query = (toolBlock.input as { query: string })?.query || "";
        searchesUsed++;
        console.log(`  🔍 [${name}] Search ${searchesUsed}/${maxSearches}: "${query}"`);
        const searchResults = await braveSearch(query);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: searchResults,
        });
      }

      messages.push({ role: "user", content: toolResults });

      // Continue the loop — agent will process results and maybe search again
      continue;
    }

    // Agent is done (end_turn) — extract final text
    const elapsed = Date.now() - started;
    console.log(
      `✅ [Prebloom] ${name} complete (${elapsed}ms, stop: ${data.stop_reason || "unknown"})` +
        (searchesUsed > 0 ? ` — ${searchesUsed} search${searchesUsed > 1 ? "es" : ""}` : "") +
        ` — ${totalInputTokens}in/${totalOutputTokens}out tokens`,
    );

    let text = data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n");

    // Clean up agent output:
    // 1. Strip reasoning/thinking leaks before structured output
    // 2. Convert XML tags to markdown headers for frontend rendering
    text = cleanAgentOutput(text);

    return {
      agent: name,
      analysis: text,
      metrics: {
        durationMs: elapsed,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        searches: searchesUsed,
      },
    };
  }
}

/**
 * Clean agent output for frontend display:
 * - Strip reasoning/thinking leaks before structured tags
 * - Convert XML tags to markdown headers
 * - Remove empty sections
 */
function cleanAgentOutput(text: string): string {
  // Strip reasoning leaks before structured output (XML or markdown)
  // For XML output: strip before first XML tag
  // For markdown output: strip before first markdown header
  const firstXmlTag = text.search(/<[a-z_]+>/i);
  const firstMarkdownHeader = text.search(/^#{1,3}\s/m);

  if (firstXmlTag > 0 && (firstMarkdownHeader < 0 || firstXmlTag < firstMarkdownHeader)) {
    // XML output — strip reasoning before first tag
    text = text.slice(firstXmlTag);
  } else if (firstMarkdownHeader > 0 && firstXmlTag < 0) {
    // Markdown output — strip reasoning before first header
    text = text.slice(firstMarkdownHeader);
  }

  // Convert XML tags to markdown — covers all agent output tags
  const tagMap: Record<string, string> = {
    // Wrapper tags (no header needed)
    intake_brief: "",
    catalyst_analysis: "",
    firing_squad_analysis: "",
    // Intake
    one_liner: "### One-Liner",
    summary: "### Summary",
    classification: "### Classification",
    business_type: "### Business Type",
    market_context: "### Market Context",
    value_proposition: "### Value Proposition",
    key_assumptions: "### Key Assumptions",
    implicit_assumptions: "### Implicit Assumptions",
    missing_information: "### Missing Information",
    information_gaps: "### Information Gaps",
    ambiguity_flags: "### Ambiguity Flags",
    red_flags: "### 🚩 Red Flags",
    founder_advantage: "### Founder Advantage",
    // Catalyst
    visionary_lens: "### 🔮 The Visionary",
    hacker_lens: "### ⚡ The Hacker",
    strategist_lens: "### 🎯 The Strategist",
    menu_of_angles: "### Menu of Angles",
    convergence_point: "### Convergence Point",
    // Fire Squad
    vc_lens: "### 💰 The VC",
    cynic_lens: "### 😤 The Cynic",
    real_user_lens: "### 👤 The Real User",
    councils_concerns: "### Council's Concerns",
    strongest_objection: "### Strongest Objection",
    survival_conditions: "### Survival Conditions",
    // Synthesis
    verdict: "### Verdict",
    executive_summary: "### Executive Summary",
    straight_talk: "### Straight Talk",
    top_strengths: "### Top Strengths",
    top_risks: "### Top Risks",
    dimension_scores: "### Dimension Scores",
    next_steps: "### Next Steps",
    kill_conditions: "### Kill Conditions",
    final_assessment: "### Final Assessment",
  };

  for (const [tag, header] of Object.entries(tagMap)) {
    text = text.replace(new RegExp(`<${tag}>`, "gi"), header ? `\n${header}\n` : "");
    text = text.replace(new RegExp(`</${tag}>`, "gi"), "");
  }

  // Clean up any remaining XML tags
  text = text.replace(/<\/?[a-z_]+>/gi, "");

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
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
    maxSearches: 0,
  });

  // Phase 2: Catalyst and Fire run in parallel
  // Pass upstream analysis as context documents
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

Analyze this startup idea. Build the strongest honest case for why it could work.`;

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

Attack this startup idea. Challenge assumptions, find the dangers, try to kill it.`;

  let [catalyst, fire] = await Promise.all([
    runAgent({
      name: "Catalyst",
      systemPrompt: CATALYST_SYSTEM_PROMPT,
      userMessage: catalystMessage,
      maxSearches: 1,
    }),
    runAgent({
      name: "Fire",
      systemPrompt: FIRE_SYSTEM_PROMPT,
      userMessage: fireMessage,
      maxSearches: 1,
    }),
  ]);

  // Phase 3: Synthesis
  // Pass all upstream analyses for synthesis
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
    maxSearches: 0,
  });

  // Phase 4: Apply humanizer skill if enabled
  if (options.humanize && registry.has("humanizer")) {
    console.log(`[Prebloom] Applying humanizer skill to outputs...`);

    const [intakeHumanized, catalystHumanized, fireHumanized, synthesisHumanized] =
      await Promise.all([
        applySkillById("humanizer", { text: intake.analysis, agent: "intake" }),
        applySkillById("humanizer", { text: catalyst.analysis, agent: "catalyst" }),
        applySkillById("humanizer", { text: fire.analysis, agent: "fire" }),
        // Synthesis is JSON-parsed, humanize the readable version
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

  // Parse synthesis JSON output for structured verdict
  const parsedVerdict = parseSynthesisOutput(synthesis.analysis);

  // Convert structured verdict back to readable markdown for frontend display
  try {
    synthesis = { ...synthesis, analysis: verdictToMarkdown(parsedVerdict) };
  } catch (err) {
    console.error("[Prebloom] Failed to convert verdict to markdown:", (err as Error).message);
    // Keep the raw synthesis analysis as fallback
  }

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
    // Pipeline metrics
    metrics: {
      totalDurationMs: totalElapsed,
      agents: {
        intake: intake.metrics,
        catalyst: catalyst.metrics,
        fire: fire.metrics,
        synthesis: synthesis.metrics,
      },
      totalInputTokens:
        (intake.metrics?.inputTokens || 0) +
        (catalyst.metrics?.inputTokens || 0) +
        (fire.metrics?.inputTokens || 0) +
        (synthesis.metrics?.inputTokens || 0),
      totalOutputTokens:
        (intake.metrics?.outputTokens || 0) +
        (catalyst.metrics?.outputTokens || 0) +
        (fire.metrics?.outputTokens || 0) +
        (synthesis.metrics?.outputTokens || 0),
      totalSearches:
        (intake.metrics?.searches || 0) +
        (catalyst.metrics?.searches || 0) +
        (fire.metrics?.searches || 0) +
        (synthesis.metrics?.searches || 0),
    },
  };
}

/**
 * Convert parsed verdict back to readable markdown for frontend display.
 */
function verdictToMarkdown(v: ReturnType<typeof parseSynthesisOutput>): string {
  const decisionEmoji: Record<string, string> = {
    STRONG_SIGNAL: "🟢",
    CONDITIONAL_FIT: "🟡",
    WEAK_SIGNAL: "🟠",
    NO_MARKET_FIT: "🔴",
  };
  const emoji = decisionEmoji[v.decision] || "🟡";
  const decisionLabel = v.decision.replace(/_/g, " ");

  let md = "";

  // Key Evidence
  if (v.strongestBullCase || v.strongestBearCase) {
    md += "### Key Evidence\n";
    if (v.strongestBullCase) md += `- **Strongest bull case:** ${v.strongestBullCase}\n`;
    if (v.strongestBearCase) md += `- **Strongest bear case:** ${v.strongestBearCase}\n`;
    if (v.evidenceAssessment) md += `- **Who wins:** ${v.evidenceAssessment}\n`;
    md += "\n";
  }

  // Verdict
  md += `### Verdict\n**Signal:** ${emoji} ${decisionLabel}\n**Confidence:** ${v.confidence}/10\n\n`;

  // Executive Summary
  md += `### Executive Summary\n${v.executiveSummary}\n\n`;

  // Dimensions
  const dims = v.dimensions;
  md += "### Scores\n";
  md += "| Dimension | Score |\n|-----------|-------|\n";
  md += `| Problem Clarity | ${dims.problemClarity}/10 |\n`;
  md += `| Market Opportunity | ${dims.marketSize}/10 |\n`;
  md += `| Competitive Position | ${dims.competitionRisk}/10 |\n`;
  md += `| Execution Feasibility | ${dims.execution}/10 |\n`;
  md += `| Business Viability | ${dims.businessModel}/10 |\n`;
  const total =
    dims.problemClarity +
    dims.marketSize +
    dims.competitionRisk +
    dims.execution +
    dims.businessModel;
  md += `| **Overall** | **${total}/50** |\n\n`;

  // Strengths
  if (v.keyStrengths.length > 0) {
    md += "### Strengths\n";
    v.keyStrengths.forEach((s, i) => {
      md += `${i + 1}. ${s}\n`;
    });
    md += "\n";
  }

  // Risks
  if (v.keyRisks.length > 0) {
    md += "### Risks\n";
    v.keyRisks.forEach((r, i) => {
      md += `${i + 1}. ${r}\n`;
    });
    md += "\n";
  }

  // Next Steps
  if (v.nextSteps.length > 0) {
    md += "### Next Steps\n";
    v.nextSteps.forEach((n, i) => {
      md += `${i + 1}. ${n}\n`;
    });
    md += "\n";
  }

  // Straight Talk
  if (v.straightTalk) {
    md += `### Straight Talk\n${v.straightTalk}\n`;
  }

  return md.trim();
}

/**
 * Parse Synthesis output as JSON.
 * The Synthesis agent returns structured JSON directly — no regex needed.
 * Falls back to safe defaults if parsing fails.
 */
function parseSynthesisOutput(analysis: string): {
  decision: "STRONG_SIGNAL" | "CONDITIONAL_FIT" | "WEAK_SIGNAL" | "NO_MARKET_FIT";
  confidence: number;
  dimensions: DimensionScores;
  executiveSummary: string;
  keyStrengths: string[];
  keyRisks: string[];
  nextSteps: string[];
  killConditions: string[];
  straightTalk?: string;
  strongestBullCase?: string;
  strongestBearCase?: string;
  evidenceAssessment?: string;
} {
  const defaults = {
    decision: "CONDITIONAL_FIT" as const,
    confidence: 5,
    dimensions: {
      problemClarity: 5,
      marketSize: 5,
      competitionRisk: 5,
      execution: 5,
      businessModel: 5,
    },
    executiveSummary: "Evaluation complete.",
    keyStrengths: [] as string[],
    keyRisks: [] as string[],
    nextSteps: [] as string[],
    killConditions: [] as string[],
  };

  if (!analysis) return defaults;

  try {
    // Extract JSON from the response — handle potential markdown wrapping
    let jsonStr = analysis.trim();

    // Strip markdown code fences if present
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    // Find the JSON object boundaries if there's extra text
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and map decision
    const validDecisions = ["STRONG_SIGNAL", "CONDITIONAL_FIT", "WEAK_SIGNAL", "NO_MARKET_FIT"];
    const decision = validDecisions.includes(parsed.decision) ? parsed.decision : defaults.decision;

    // Map dimensions (handle both naming conventions)
    const dims = parsed.dimensions || {};
    const dimensions: DimensionScores = {
      problemClarity: clampScore(dims.problemClarity ?? dims.problem_clarity),
      marketSize: clampScore(
        dims.marketOpportunity ?? dims.market_opportunity ?? dims.marketSize ?? dims.market_size,
      ),
      competitionRisk: clampScore(
        dims.competitivePosition ??
          dims.competitive_position ??
          dims.competitionRisk ??
          dims.competition_risk,
      ),
      execution: clampScore(
        dims.executionFeasibility ?? dims.execution_feasibility ?? dims.execution,
      ),
      businessModel: clampScore(
        dims.businessViability ??
          dims.business_viability ??
          dims.businessModel ??
          dims.business_model,
      ),
    };

    // Extract arrays — no artificial limits
    const toStringArray = (val: unknown): string[] => {
      if (!Array.isArray(val)) return [];
      return val.filter((item): item is string => typeof item === "string" && item.length > 0);
    };

    // Build verdict sensitivity into killConditions for backward compat
    const killConditions: string[] = [];
    if (parsed.verdictSensitivity) {
      if (parsed.verdictSensitivity.upgrade)
        killConditions.push("Upgrade: " + parsed.verdictSensitivity.upgrade);
      if (parsed.verdictSensitivity.downgrade)
        killConditions.push("Downgrade: " + parsed.verdictSensitivity.downgrade);
    }

    return {
      decision,
      confidence: clampScore(parsed.confidence),
      dimensions,
      executiveSummary:
        parsed.executiveSummary || parsed.executive_summary || defaults.executiveSummary,
      keyStrengths: toStringArray(parsed.strengths || parsed.keyStrengths),
      keyRisks: toStringArray(parsed.risks || parsed.keyRisks),
      nextSteps: toStringArray(parsed.nextSteps || parsed.next_steps),
      killConditions,
      ...(parsed.straightTalk ? { straightTalk: parsed.straightTalk } : {}),
      ...(parsed.strongestBullCase ? { strongestBullCase: parsed.strongestBullCase } : {}),
      ...(parsed.strongestBearCase ? { strongestBearCase: parsed.strongestBearCase } : {}),
      ...(parsed.evidenceAssessment ? { evidenceAssessment: parsed.evidenceAssessment } : {}),
    };
  } catch (err) {
    console.error("[Prebloom] Failed to parse Synthesis JSON output:", (err as Error).message);
    console.error("[Prebloom] Raw output (first 500 chars):", analysis?.slice(0, 500));
    return defaults;
  }
}

function clampScore(val: unknown): number {
  const num = typeof val === "number" ? val : parseInt(String(val));
  if (isNaN(num)) return 5;
  return Math.min(10, Math.max(1, num));
}
