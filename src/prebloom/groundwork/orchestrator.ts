import crypto from "node:crypto";

import type {
  CouncilContext,
  GroundworkAgentOutput,
  GroundworkResult,
  GroundworkMetrics,
  GroundworkEventCallback,
} from "./types.js";

import {
  COMPETITOR_INTELLIGENCE_SYSTEM_PROMPT,
  COMPETITOR_INTELLIGENCE_SEARCH_BUDGET,
} from "./agents/competitor-intelligence.js";
import {
  MARKET_SIZING_SYSTEM_PROMPT,
  MARKET_SIZING_SEARCH_BUDGET,
} from "./agents/market-sizing.js";
import { GAP_ANALYSIS_SYSTEM_PROMPT, GAP_ANALYSIS_SEARCH_BUDGET } from "./agents/gap-analysis.js";
import {
  CUSTOMER_PERSONAS_SYSTEM_PROMPT,
  CUSTOMER_PERSONAS_SEARCH_BUDGET,
} from "./agents/customer-personas.js";
import { GTM_PLAYBOOK_SYSTEM_PROMPT, GTM_PLAYBOOK_SEARCH_BUDGET } from "./agents/gtm-playbook.js";
import {
  MVP_SCOPE_SYSTEM_PROMPT,
  MVP_SCOPE_SEARCH_BUDGET,
  MVP_SCOPE_MODEL,
} from "./agents/mvp-scope.js";

const MODEL = "claude-sonnet-4-6";
const MAX_RETRIES = 3;

// Anthropic API response types for native web search
interface AnthropicResponse {
  content: Array<{
    type: string;
    text?: string;
  }>;
  stop_reason?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    server_tool_use?: {
      web_search_requests?: number;
    };
  };
  error?: { message: string };
}

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("No API key found. Set ANTHROPIC_API_KEY environment variable.");
  }
  return apiKey;
}

/**
 * Run a single Groundwork agent using Anthropic's native web search.
 *
 * ONE fetch call per agent — Claude searches and writes server-side.
 * If stop_reason is "pause_turn", re-submit to continue.
 */
async function runGroundworkAgent(opts: {
  name: string;
  systemPrompt: string;
  userMessage: string;
  maxSearches: number;
  model?: string;
}): Promise<GroundworkAgentOutput> {
  const { name, systemPrompt, userMessage, maxSearches, model: modelOverride } = opts;
  const apiKey = getApiKey();

  const agentModel = modelOverride || MODEL;
  console.log(
    `🤖 [Groundwork] Running ${name} (model: ${agentModel}, searches: ${maxSearches})...`,
  );
  const started = Date.now();

  // Build tools array — only include web search if budget > 0
  const tools: Array<Record<string, unknown>> =
    maxSearches > 0
      ? [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }]
      : [];

  const messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }> = [
    { role: "user", content: userMessage },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalSearches = 0;
  let allText = "";

  // Loop to handle pause_turn (API may pause long-running turns)
  while (true) {
    const requestBody: Record<string, unknown> = {
      model: agentModel,
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    };
    if (tools.length > 0) {
      requestBody.tools = tools;
    }

    let data: AnthropicResponse;

    // Retry loop with token bucket awareness (read retry-after header on 429)
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(300_000), // 5 min — web search can be slow
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitSec = retryAfter ? parseInt(retryAfter, 10) : 30 * attempt;
        console.log(
          `  ⏳ [${name}] Rate limited (attempt ${attempt}/${MAX_RETRIES}) — waiting ${waitSec}s...`,
        );
        await sleep(waitSec * 1000);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error for ${name}: ${response.status} - ${errorText}`);
      }

      data = (await response.json()) as AnthropicResponse;

      if (data.error) {
        throw new Error(`Anthropic API error for ${name}: ${data.error.message}`);
      }
      break; // Success — exit retry loop
    }

    // @ts-expect-error data is assigned inside the retry loop
    if (!data) {
      throw new Error(`${name}: All ${MAX_RETRIES} retry attempts exhausted (rate limited)`);
    }

    if (data.usage) {
      totalInputTokens += data.usage.input_tokens;
      totalOutputTokens += data.usage.output_tokens;
      totalSearches += data.usage.server_tool_use?.web_search_requests || 0;
      if (data.usage.cache_read_input_tokens) {
        console.log(
          `  💾 [${name}] Cache hit: ${data.usage.cache_read_input_tokens} tokens read from cache`,
        );
      }
    }

    // Extract text blocks
    const texts = data.content?.filter((b) => b.type === "text").map((b) => b.text ?? "");
    if (texts && texts.length > 0) {
      allText += texts.join("\n");
    }

    // If pause_turn, re-submit the response to continue
    if (data.stop_reason === "pause_turn") {
      console.log(`  ⏸️ [${name}] Paused — re-submitting to continue...`);
      messages.push({ role: "assistant", content: data.content as Array<Record<string, unknown>> });
      messages.push({ role: "user", content: "Continue." });
      continue;
    }

    // Done (end_turn or max_tokens)
    break;
  }

  const elapsed = Date.now() - started;
  console.log(
    `✅ [Groundwork] ${name} complete (${(elapsed / 1000).toFixed(1)}s` +
      ` | ${totalInputTokens}in/${totalOutputTokens}out` +
      (totalSearches > 0 ? ` | ${totalSearches} searches` : "") +
      `)`,
  );

  return {
    agent: name,
    analysis: allText.trim(),
    metrics: {
      durationMs: elapsed,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      searches: totalSearches,
    },
  };
}

/**
 * Extract 2-3 key headlines from agent output using regex heuristics.
 * Looks for bold text, numbers/stats, and competitor names.
 */
export function extractHeadlines(analysis: string): string[] {
  const headlines: string[] = [];

  // Pull bold text lines (e.g. **DimeADozen — $49/report**)
  const boldMatches = analysis.match(/\*\*([^*]{10,120})\*\*/g);
  if (boldMatches) {
    for (const m of boldMatches.slice(0, 2)) {
      const clean = m.replace(/\*\*/g, "").trim();
      // Skip headings that are just section titles
      if (clean.length > 15 && !clean.startsWith("#")) {
        headlines.push(clean);
      }
    }
  }

  // Pull lines with key stats (numbers, $, %, M, B)
  if (headlines.length < 3) {
    const lines = analysis.split("\n");
    for (const line of lines) {
      if (headlines.length >= 3) break;
      const trimmed = line.replace(/^[\s\-*#>]+/, "").trim();
      if (
        trimmed.length > 15 &&
        trimmed.length < 150 &&
        /(\$[\d,.]+[MBK]?|[\d,.]+%|\d+[MBK]\+?|TAM|SAM|SOM|CAGR)/i.test(trimmed) &&
        !headlines.includes(trimmed)
      ) {
        headlines.push(trimmed.replace(/\*\*/g, ""));
      }
    }
  }

  return headlines.slice(0, 3);
}

/**
 * Build the council context into a user message for Groundwork agents.
 */
function buildCouncilContextBlock(ctx: CouncilContext): string {
  return `<documents>
<document index="1">
<source>intake_brief</source>
<document_content>
${ctx.intake}
</document_content>
</document>
<document index="2">
<source>catalyst_analysis</source>
<document_content>
${ctx.catalyst}
</document_content>
</document>
<document index="3">
<source>fire_analysis</source>
<document_content>
${ctx.fire}
</document_content>
</document>
<document index="4">
<source>synthesis_verdict</source>
<document_content>
${ctx.synthesis}
</document_content>
</document>
${
  ctx.ideaText
    ? `<document index="5">
<source>original_idea</source>
<document_content>
${ctx.ideaText}
</document_content>
</document>`
    : ""
}
</documents>`;
}

/**
 * Run the full Groundwork pipeline.
 *
 * Phase A: A1 (Competitors) + A2 (Market) in parallel, then A3 (Gaps) with their outputs.
 * Phase B: B1 (Personas) + B2 (GTM) + B3 (MVP) in parallel with all prior context.
 */
export async function runGroundwork(
  evaluationId: string,
  councilContext: CouncilContext,
  onEvent?: GroundworkEventCallback,
): Promise<GroundworkResult> {
  const id = crypto.randomUUID();
  const councilBlock = buildCouncilContextBlock(councilContext);

  console.log(`\n🔬 [Groundwork] Starting pipeline for evaluation ${evaluationId}\n`);
  const totalStarted = Date.now();

  const result: GroundworkResult = {
    id,
    evaluationId,
    createdAt: new Date().toISOString(),
    status: "running",
  };

  try {
    // === Phase A: Intelligence ===
    const phaseAStarted = Date.now();

    // A1 then A2 sequential (Tier 1 rate limit: 30k ITPM — parallel spikes past it)
    // TODO: Switch to Promise.all when org upgrades to Tier 2+ (80k+ ITPM)
    onEvent?.({
      type: "stage",
      agent: "competitorIntelligence",
      status: "running",
      label: "Finding your competitors...",
    });
    const a1 = await runGroundworkAgent({
      name: "Competitor Intelligence",
      systemPrompt: COMPETITOR_INTELLIGENCE_SYSTEM_PROMPT,
      userMessage: `${councilBlock}\n\nSearch for and profile the real competitors for this startup idea. Use web search to find actual pricing, funding data, and features.`,
      maxSearches: COMPETITOR_INTELLIGENCE_SEARCH_BUDGET,
    });
    for (const h of extractHeadlines(a1.analysis)) {
      onEvent?.({ type: "headline", agent: "competitorIntelligence", text: h });
    }
    onEvent?.({ type: "stage", agent: "competitorIntelligence", status: "complete" });

    // Brief cooldown between agents
    console.log(`  ⏳ [Groundwork] Cooling down 10s before A2...`);
    await sleep(10_000);

    onEvent?.({
      type: "stage",
      agent: "marketSizing",
      status: "running",
      label: "Sizing your market...",
    });
    const a2 = await runGroundworkAgent({
      name: "Market Sizing",
      systemPrompt: MARKET_SIZING_SYSTEM_PROMPT,
      userMessage: `${councilBlock}\n\nCalculate the market size (TAM/SAM/SOM) for this startup idea. Use web search to find market reports, industry data, and growth rates.`,
      maxSearches: MARKET_SIZING_SEARCH_BUDGET,
    });
    for (const h of extractHeadlines(a2.analysis)) {
      onEvent?.({ type: "headline", agent: "marketSizing", text: h });
    }
    onEvent?.({ type: "stage", agent: "marketSizing", status: "complete" });

    result.competitorIntelligence = a1;
    result.marketSizing = a2;

    // Cooldown before A3 — rate limit recovery (token bucket replenishment)
    console.log(`  ⏳ [Groundwork] Cooling down 15s before A3 (rate limit recovery)...`);
    await sleep(15_000);

    // A3 runs with A1 + A2 outputs
    onEvent?.({
      type: "stage",
      agent: "gapAnalysis",
      status: "running",
      label: "Hunting for gaps in the market...",
    });
    const a3 = await runGroundworkAgent({
      name: "Gap Analysis",
      systemPrompt: GAP_ANALYSIS_SYSTEM_PROMPT,
      userMessage: `${councilBlock}

<document index="6">
<source>competitor_intelligence</source>
<document_content>
${a1.analysis}
</document_content>
</document>
<document index="7">
<source>market_sizing</source>
<document_content>
${a2.analysis}
</document_content>
</document>

Synthesize the competitor intelligence and market sizing data above. Identify gaps and opportunities, and recommend the founder's best entry wedge.`,
      maxSearches: GAP_ANALYSIS_SEARCH_BUDGET,
    });
    for (const h of extractHeadlines(a3.analysis)) {
      onEvent?.({ type: "headline", agent: "gapAnalysis", text: h });
    }
    onEvent?.({ type: "stage", agent: "gapAnalysis", status: "complete" });

    result.gapAnalysis = a3;
    const phaseADuration = Date.now() - phaseAStarted;

    console.log(`\n📊 [Groundwork] Phase A complete (${(phaseADuration / 1000).toFixed(1)}s)\n`);

    // Cooldown before Phase B — let rate limit window fully recover
    console.log(`  ⏳ [Groundwork] Cooling down 30s before Phase B (rate limit recovery)...`);
    await sleep(30_000);

    // === Phase B: Blueprint ===
    const phaseBStarted = Date.now();

    // Build full context for Phase B agents (council + all Phase A outputs)
    const phaseBContext = `${councilBlock}

<document index="6">
<source>competitor_intelligence</source>
<document_content>
${a1.analysis}
</document_content>
</document>
<document index="7">
<source>market_sizing</source>
<document_content>
${a2.analysis}
</document_content>
</document>
<document index="8">
<source>gap_analysis</source>
<document_content>
${a3.analysis}
</document_content>
</document>`;

    // B1, B2, B3 sequential (Tier 1 rate limit safety)
    // TODO: Switch to Promise.all when org upgrades to Tier 2+
    onEvent?.({
      type: "stage",
      agent: "customerPersonas",
      status: "running",
      label: "Building your customer personas...",
    });
    const b1 = await runGroundworkAgent({
      name: "Customer Personas",
      systemPrompt: CUSTOMER_PERSONAS_SYSTEM_PROMPT,
      userMessage: `${phaseBContext}\n\nDefine 2-3 specific customer personas for this startup idea, based on the competitor research, market sizing, and gap analysis above.`,
      maxSearches: CUSTOMER_PERSONAS_SEARCH_BUDGET,
    });
    for (const h of extractHeadlines(b1.analysis)) {
      onEvent?.({ type: "headline", agent: "customerPersonas", text: h });
    }
    onEvent?.({ type: "stage", agent: "customerPersonas", status: "complete" });

    console.log(`  ⏳ [Groundwork] Cooling down 10s before B2...`);
    await sleep(10_000);

    onEvent?.({
      type: "stage",
      agent: "gtmPlaybook",
      status: "running",
      label: "Crafting your go-to-market playbook...",
    });
    const b2 = await runGroundworkAgent({
      name: "GTM Playbook",
      systemPrompt: GTM_PLAYBOOK_SYSTEM_PROMPT,
      userMessage: `${phaseBContext}\n\nBuild a go-to-market playbook for this startup idea, based on the competitive landscape, market sizing, and opportunity gaps identified above.`,
      maxSearches: GTM_PLAYBOOK_SEARCH_BUDGET,
    });
    for (const h of extractHeadlines(b2.analysis)) {
      onEvent?.({ type: "headline", agent: "gtmPlaybook", text: h });
    }
    onEvent?.({ type: "stage", agent: "gtmPlaybook", status: "complete" });

    console.log(`  ⏳ [Groundwork] Cooling down 10s before B3...`);
    await sleep(10_000);

    onEvent?.({
      type: "stage",
      agent: "mvpScope",
      status: "running",
      label: "Figuring out what to build first...",
    });
    const b3 = await runGroundworkAgent({
      name: "Focus First",
      systemPrompt: MVP_SCOPE_SYSTEM_PROMPT,
      userMessage: `${phaseBContext}\n\nAs a seasoned founder, tell this founder what to focus on first and what to skip. Be direct, warm, and specific.`,
      maxSearches: MVP_SCOPE_SEARCH_BUDGET,
      model: MVP_SCOPE_MODEL,
    });
    for (const h of extractHeadlines(b3.analysis)) {
      onEvent?.({ type: "headline", agent: "mvpScope", text: h });
    }
    onEvent?.({ type: "stage", agent: "mvpScope", status: "complete" });

    result.customerPersonas = b1;
    result.gtmPlaybook = b2;
    result.mvpScope = b3;

    const phaseBDuration = Date.now() - phaseBStarted;
    const totalDuration = Date.now() - totalStarted;

    // Build metrics
    const agents: Record<string, GroundworkAgentOutput["metrics"]> = {
      competitorIntelligence: a1.metrics,
      marketSizing: a2.metrics,
      gapAnalysis: a3.metrics,
      customerPersonas: b1.metrics,
      gtmPlaybook: b2.metrics,
      mvpScope: b3.metrics,
    };

    const allAgents = [a1, a2, a3, b1, b2, b3];
    const metrics: GroundworkMetrics = {
      totalDurationMs: totalDuration,
      phaseADurationMs: phaseADuration,
      phaseBDurationMs: phaseBDuration,
      agents,
      totalInputTokens: allAgents.reduce((sum, a) => sum + a.metrics.inputTokens, 0),
      totalOutputTokens: allAgents.reduce((sum, a) => sum + a.metrics.outputTokens, 0),
      totalSearches: allAgents.reduce((sum, a) => sum + a.metrics.searches, 0),
    };

    result.metrics = metrics;
    result.status = "completed";

    onEvent?.({ type: "complete", groundworkId: id, evaluationId });

    console.log(
      `\n✨ [Groundwork] Pipeline complete (${(totalDuration / 1000).toFixed(1)}s` +
        ` | ${metrics.totalInputTokens}in/${metrics.totalOutputTokens}out` +
        ` | ${metrics.totalSearches} total searches)\n`,
    );

    return result;
  } catch (error) {
    const elapsed = Date.now() - totalStarted;
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `❌ [Groundwork] Pipeline failed after ${(elapsed / 1000).toFixed(1)}s: ${message}`,
    );

    result.status = "failed";
    result.error = message;
    return result;
  }
}
