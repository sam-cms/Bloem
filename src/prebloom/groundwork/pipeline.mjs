/**
 * Groundwork Pipeline — Multi-Agent Research System
 *
 * Three-stage cascade:
 *   Stage 1: Market Intelligence (Research Agent + Verification Agent)
 *   Stage 2: Competitive Deep Dive (1 agent per competitor, parallel)
 *   Stage 3: Synthesis + Challenge (Analyst Agent + Challenger Agent)
 *
 * Usage: node pipeline.mjs "Your startup idea" "Market context"
 *
 * Environment: ANTHROPIC_API_KEY must be set
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";

// Track all costs
const costs = { inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0 };
const events = [];
const startTime = Date.now();

function elapsed() {
  return ((Date.now() - startTime) / 1000).toFixed(1);
}

function logEvent(type, detail) {
  const e = { type, detail, time: elapsed() };
  events.push(e);
  const icons = {
    stage: "🏗️",
    search: "🔍",
    fetch: "🌐",
    agent: "🤖",
    verify: "✅",
    challenge: "⚔️",
    done: "✅",
    error: "❌",
  };
  console.log(`[${e.time}s] ${icons[type] || "•"} ${detail}`);
}

function trackUsage(response) {
  costs.inputTokens += response.usage?.input_tokens || 0;
  costs.outputTokens += response.usage?.output_tokens || 0;

  // Count tool uses
  for (const block of response.content) {
    if (block.type === "server_tool_use" && block.name === "web_search") costs.searches++;
    if (block.type === "server_tool_use" && block.name === "web_fetch") costs.fetches++;
  }
}

function extractText(response) {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function callAgent(name, systemPrompt, userMessage, tools = [], maxTokens = 4096) {
  logEvent("agent", `${name} starting...`);

  const toolDefs = [];
  if (tools.includes("search")) {
    toolDefs.push({ type: "web_search_20260209", name: "web_search", max_uses: 8 });
  }
  if (tools.includes("fetch")) {
    toolDefs.push({ type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 });
  }

  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  };

  if (toolDefs.length > 0) params.tools = toolDefs;

  const response = await client.messages.create(params);
  trackUsage(response);

  const text = extractText(response);
  logEvent("agent", `${name} complete (${response.usage?.output_tokens} tokens out)`);

  return { text, response };
}

// ============================================================
// STAGE 1: MARKET INTELLIGENCE
// ============================================================

async function stage1_marketResearch(idea, context) {
  logEvent("stage", "STAGE 1: MARKET INTELLIGENCE");

  // Agent A: Primary Research
  const researchPrompt = `You are a senior market research analyst specializing in startup opportunity assessment.

## RULES
- EVERY number (market size, growth rate, user count) MUST come from web search. Do NOT use training data for statistics.
- Search at least 4-5 different queries to build comprehensive market picture.
- If data is unavailable, explicitly say "Data unavailable" — never fabricate.
- Include source URLs for every data point.
- Focus on CURRENT data (2024-2026).

## YOUR TASK
Research the market for this startup idea and output a structured analysis.

## OUTPUT FORMAT (use exactly this JSON structure)
Return your analysis as a JSON block wrapped in \`\`\`json ... \`\`\` with these fields:
{
  "tam": { "value": "€X", "methodology": "...", "source": "url", "confidence": "high|medium|low" },
  "sam": { "value": "€X", "methodology": "...", "source": "url", "confidence": "high|medium|low" },
  "som": { "value": "€X", "methodology": "...", "source": "url", "confidence": "high|medium|low" },
  "growth_rate": { "value": "X%", "source": "url", "confidence": "high|medium|low" },
  "trends": [
    { "trend": "...", "evidence": "...", "source": "url" }
  ],
  "timing_signals": [
    { "signal": "...", "impact": "positive|negative|neutral", "source": "url" }
  ],
  "competitors_found": [
    { "name": "...", "url": "...", "description": "one line", "why_competitor": "..." }
  ],
  "regulatory": "...",
  "total_addressable_users": { "value": "X", "source": "url" }
}`;

  const { text: researchOutput } = await callAgent(
    "Market Research Agent",
    researchPrompt,
    `Research the market for this startup idea:\n\nIDEA: ${idea}\nCONTEXT: ${context}`,
    ["search", "fetch"],
    6000,
  );

  // Agent B: Verification
  logEvent("verify", "Verification Agent cross-checking...");

  const verifyPrompt = `You are a fact-checking analyst. Your job is to verify market research findings.

## RULES
- For each major claim (TAM, SAM, competitor list), run an independent web search to verify.
- Search for data from DIFFERENT sources than the original research.
- Flag any claims you cannot independently verify.
- Look for competitors that the original research MISSED.

## OUTPUT FORMAT
Return your verification as a JSON block wrapped in \`\`\`json ... \`\`\` with:
{
  "verified_claims": [
    { "claim": "...", "status": "verified|unverified|conflicting", "your_source": "url", "notes": "..." }
  ],
  "missed_competitors": [
    { "name": "...", "url": "...", "why_relevant": "..." }
  ],
  "revised_estimates": {
    "tam_adjustment": "...",
    "notes": "..."
  },
  "confidence_assessment": "Overall assessment of data reliability"
}`;

  const { text: verifyOutput } = await callAgent(
    "Verification Agent",
    verifyPrompt,
    `Verify these market research findings. Search for independent sources.\n\nORIGINAL RESEARCH:\n${researchOutput}\n\nIDEA: ${idea}`,
    ["search"],
    3000,
  );

  return { researchOutput, verifyOutput };
}

// ============================================================
// STAGE 2: COMPETITIVE DEEP DIVE
// ============================================================

async function stage2_competitiveDeepDive(competitors, idea) {
  logEvent("stage", "STAGE 2: COMPETITIVE DEEP DIVE");

  const competitorPrompt = `You are a competitive intelligence analyst. Research ONE specific competitor in depth.

## RULES
- FETCH their actual website for pricing — do not guess.
- Search for real user reviews and complaints (Reddit, forums, review sites).
- Search for their funding/company size.
- Be specific — exact pricing tiers, exact features.

## OUTPUT FORMAT
Return as JSON wrapped in \`\`\`json ... \`\`\` with:
{
  "name": "...",
  "url": "...",
  "what_they_do": "one sentence",
  "founding_year": "...",
  "funding": "...",
  "pricing": {
    "model": "subscription|freemium|percentage|flat",
    "tiers": [{ "name": "...", "price": "...", "features": "..." }],
    "source": "url"
  },
  "key_features": ["..."],
  "strengths": ["..."],
  "weaknesses": ["..."],
  "user_complaints": [
    { "complaint": "...", "source": "url" }
  ],
  "recent_news": ["..."],
  "user_sentiment": "positive|mixed|negative"
}`;

  // Parse competitor list from Stage 1
  let competitorList;
  try {
    const jsonMatch = competitors.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      competitorList = parsed.competitors_found || [];
    }
  } catch (e) {
    // Fallback: try to extract competitor names from text
    competitorList = [];
  }

  if (!competitorList || competitorList.length === 0) {
    logEvent("error", "No competitors found in Stage 1 output, searching manually...");
    // Fallback search
    const { text } = await callAgent(
      "Competitor Finder",
      "Find 3-5 direct competitors for this startup idea. Return as JSON with competitors_found array.",
      `Find competitors for: ${idea}`,
      ["search"],
      2000,
    );
    try {
      const match = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) competitorList = JSON.parse(match[1]).competitors_found || [];
    } catch (e) {
      competitorList = [];
    }
  }

  // Cap at 5 competitors
  competitorList = competitorList.slice(0, 5);
  logEvent("agent", `Researching ${competitorList.length} competitors in parallel...`);

  // Run competitor agents in parallel
  const competitorResults = await Promise.all(
    competitorList.map((comp) =>
      callAgent(
        `Competitor: ${comp.name}`,
        competitorPrompt,
        `Research this competitor:\nNAME: ${comp.name}\nURL: ${comp.url || "unknown"}\nDESCRIPTION: ${comp.description || comp.why_competitor || ""}\n\nContext — they compete with this idea: ${idea}`,
        ["search", "fetch"],
        3000,
      ).catch((err) => {
        logEvent("error", `Failed to research ${comp.name}: ${err.message}`);
        return { text: `Error researching ${comp.name}`, response: null };
      }),
    ),
  );

  return competitorResults.map((r) => r.text);
}

// ============================================================
// STAGE 3: SYNTHESIS + CHALLENGE
// ============================================================

async function stage3_synthesis(idea, context, marketData, verificationData, competitorData) {
  logEvent("stage", "STAGE 3: SYNTHESIS & CHALLENGE");

  // Agent A: Analyst
  const analystPrompt = `You are a senior strategy consultant producing an investor-grade Groundwork Report.

## RULES
- Use ONLY the research data provided. Do not add claims without evidence.
- Every data point must reference where it came from in the research.
- Be specific and actionable — no generic advice.
- Battlecards should give founders a real competitive edge.
- Personas must be grounded in the market data found.

## OUTPUT FORMAT
Produce a full Groundwork Report in clean markdown:

# Groundwork Report: [Idea Name]

## 1. Market Analysis
### Market Size
- **TAM:** [with source]
- **SAM:** [with source]  
- **SOM:** [with source]
- **Confidence:** [based on verification]

### Market Trends
[Key trends with evidence]

### Timing Assessment
[Why now? Regulatory signals, market shifts]

## 2. Competitive Battlecards
### [Competitor Name]
- **What they do:** 
- **Pricing:** [exact, from their website]
- **Strengths:**
- **Weaknesses:**
- **User complaints:**
- **🎯 Your wedge:** [specific angle to win against them]

[Repeat for each competitor]

### Competitive Positioning Map
[Where does this idea sit vs competitors? What's the unique angle?]

## 3. Target Customer Personas

### Persona 1: "[Name]" — [Archetype]
- **Demographics:**
- **Income/Budget:**
- **Pain points:** [grounded in market data]
- **Where to find them:**
- **Messaging angle:**
- **Why they'd switch from [competitor]:**

[Repeat for 2-3 personas]

## 4. Strategic Verdict
- **Biggest opportunity:** [backed by data]
- **Biggest risk:** [honest assessment]
- **Recommended positioning:** [one sentence]
- **First move:** [what to do in the next 30 days]

## Data Confidence
[Summary of what's verified vs unverified]`;

  const { text: reportOutput } = await callAgent(
    "Analyst Agent",
    analystPrompt,
    `Produce the Groundwork Report from this research data:

IDEA: ${idea}
CONTEXT: ${context}

=== MARKET RESEARCH ===
${marketData}

=== VERIFICATION ===
${verificationData}

=== COMPETITOR DEEP DIVES ===
${competitorData.join("\n\n---\n\n")}`,
    [],
    8000,
  );

  // Agent B: Challenger
  logEvent("challenge", "Challenger Agent reviewing report...");

  const challengerPrompt = `You are a critical reviewer — a skeptical VC partner who challenges assumptions.

## YOUR JOB
Read this Groundwork Report and challenge it. Be tough but fair.

For each section, ask:
1. Is this claim actually supported by the data?
2. Is the TAM/SAM realistic or inflated?
3. Are the personas grounded or generic?
4. Do the battlecard "wedges" actually hold up?
5. What's the biggest blind spot?
6. What question should the founder be asking that this report doesn't answer?

## OUTPUT FORMAT

# Challenger's Review

## Strength Assessment
[What's solid and well-supported]

## Challenges
[Numbered list of specific challenges with reasoning]

## Blind Spots
[What the report misses or assumes]

## Revised Recommendations
[Any adjustments based on your challenges]

## Final Confidence Rating
[1-10 score with justification]`;

  const { text: challengeOutput } = await callAgent(
    "Challenger Agent",
    challengerPrompt,
    `Challenge this Groundwork Report:\n\n${reportOutput}\n\nOriginal idea: ${idea}`,
    [],
    4000,
  );

  return { reportOutput, challengeOutput };
}

// ============================================================
// MAIN PIPELINE
// ============================================================

async function runGroundwork(idea, context) {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║        PREBLOOM GROUNDWORK PIPELINE              ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`\n📝 Idea: "${idea}"`);
  console.log(`🌍 Context: "${context}"\n`);
  console.log("─".repeat(50));

  try {
    // Stage 1: Market Intelligence
    const { researchOutput, verifyOutput } = await stage1_marketResearch(idea, context);

    // Stage 2: Competitive Deep Dive
    const competitorProfiles = await stage2_competitiveDeepDive(researchOutput, idea);

    // Stage 3: Synthesis + Challenge
    const { reportOutput, challengeOutput } = await stage3_synthesis(
      idea,
      context,
      researchOutput,
      verifyOutput,
      competitorProfiles,
    );

    // Final output
    console.log("\n" + "═".repeat(50));
    console.log("📊 GROUNDWORK REPORT");
    console.log("═".repeat(50) + "\n");
    console.log(reportOutput);

    console.log("\n" + "═".repeat(50));
    console.log("⚔️  CHALLENGER'S REVIEW");
    console.log("═".repeat(50) + "\n");
    console.log(challengeOutput);

    // Cost summary
    console.log("\n" + "═".repeat(50));
    console.log("💰 COST SUMMARY");
    console.log("═".repeat(50));
    console.log(`Input tokens:  ${costs.inputTokens.toLocaleString()}`);
    console.log(`Output tokens: ${costs.outputTokens.toLocaleString()}`);
    console.log(`Web searches:  ${costs.searches}`);
    console.log(`Page fetches:  ${costs.fetches}`);

    // Cost calculation (Sonnet 4.6 pricing)
    const inputCost = (costs.inputTokens / 1_000_000) * 3; // $3/M input
    const outputCost = (costs.outputTokens / 1_000_000) * 15; // $15/M output
    const searchCost = costs.searches * 0.01; // $0.01/search
    console.log(`\nEstimated cost:`);
    console.log(`  Input:    $${inputCost.toFixed(4)}`);
    console.log(`  Output:   $${outputCost.toFixed(4)}`);
    console.log(`  Searches: $${searchCost.toFixed(4)}`);
    console.log(`  TOTAL:    $${(inputCost + outputCost + searchCost).toFixed(4)}`);
    console.log(`\nTotal time: ${elapsed()}s`);

    // Event timeline
    console.log("\n" + "═".repeat(50));
    console.log("⏱️  EVENT TIMELINE");
    console.log("═".repeat(50));
    for (const e of events) {
      console.log(`  ${e.time}s  ${e.detail}`);
    }
  } catch (error) {
    logEvent("error", `Pipeline failed: ${error.message}`);
    console.error(error);
  }
}

// Run
const idea =
  process.argv[2] || "An AI tool that helps startup founders validate their business ideas";
const context = process.argv[3] || "Global SaaS market, B2C and B2B founders";

runGroundwork(idea, context).catch(console.error);
