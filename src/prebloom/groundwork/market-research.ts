import crypto from "node:crypto";
import { loadConfig } from "../../config/config.js";
import { resolveApiKeyForProvider } from "../../agents/model-auth.js";
import type { MarketResearchResult, ResearchRequest } from "./types.js";

const RESEARCH_MODEL = "claude-sonnet-4-20250514";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

const MARKET_RESEARCH_PROMPT = `You are a senior market research analyst with expertise in startup competitive analysis.

Your task is to analyze a startup idea and provide comprehensive competitor and market research.

## Your Analysis Should Include:

1. **Market Overview** - Brief summary of the market landscape
2. **Market Size** - Estimated TAM/SAM/SOM if possible
3. **Key Trends** - 3-5 major trends in this space
4. **Direct Competitors** - Companies solving the exact same problem
5. **Indirect Competitors** - Companies solving adjacent problems or using different approaches
6. **Market Gaps** - Unmet needs or underserved segments
7. **Opportunities** - Where this idea could win
8. **Threats** - Risks and challenges
9. **Recommendations** - Strategic advice for entering this market

## For Each Competitor, Provide:
- Name and website
- Brief description (1-2 sentences)
- Known funding (if applicable)
- Pricing model (if known)
- Key strengths (2-3)
- Key weaknesses (2-3)

## Output Format:
Respond with a JSON object matching this structure:
{
  "summary": "2-3 sentence market overview",
  "marketSize": "Estimated market size with source/reasoning",
  "trends": ["trend 1", "trend 2", ...],
  "directCompetitors": [
    {
      "name": "Company Name",
      "website": "https://...",
      "description": "What they do",
      "funding": "Funding info or 'Unknown'",
      "pricing": "Pricing model or 'Unknown'",
      "strengths": ["strength 1", "strength 2"],
      "weaknesses": ["weakness 1", "weakness 2"]
    }
  ],
  "indirectCompetitors": [...],
  "gaps": ["gap 1", "gap 2", ...],
  "opportunities": ["opportunity 1", ...],
  "threats": ["threat 1", ...],
  "recommendations": ["recommendation 1", ...]
}

Be specific and actionable. Use real company names when you know them. If you're uncertain about specific details (like funding amounts), say "Unknown" rather than guessing.`;

export async function runMarketResearch(request: ResearchRequest): Promise<MarketResearchResult> {
  const id = crypto.randomUUID();
  console.log(`\n🔍 [Prebloom] Starting market research ${id} (${request.researchType})`);
  console.log(`📝 [Prebloom] Idea: ${request.idea.substring(0, 100)}...`);

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
    throw new Error("No API key found for anthropic. Set ANTHROPIC_API_KEY environment variable.");
  }

  const userMessage = `Analyze this startup idea and provide comprehensive market/competitor research:

**Idea:** ${request.idea}
${request.industry ? `**Industry:** ${request.industry}` : ""}

Provide your analysis in the JSON format specified.`;

  const started = Date.now();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: RESEARCH_MODEL,
      max_tokens: 4096,
      system: MARKET_RESEARCH_PROMPT,
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
  console.log(`✅ [Prebloom] Market research complete (${elapsed}ms)`);

  // Extract text from response
  const text = data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse research output");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    id,
    createdAt: new Date().toISOString(),
    query: request.idea,
    summary: parsed.summary || "Research complete.",
    marketSize: parsed.marketSize,
    trends: parsed.trends || [],
    directCompetitors: parsed.directCompetitors || [],
    indirectCompetitors: parsed.indirectCompetitors || [],
    gaps: parsed.gaps || [],
    opportunities: parsed.opportunities || [],
    threats: parsed.threats || [],
    recommendations: parsed.recommendations || [],
    sources: ["AI Analysis based on training data"],
    researchType: request.researchType,
  };
}
