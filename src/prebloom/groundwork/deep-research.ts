import crypto from "node:crypto";
import type { MarketResearchResult, ResearchRequest } from "./types.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message: string };
}

const DEEP_RESEARCH_PROMPT = `You are a senior market research analyst conducting deep competitive analysis.

Your task is to provide EXHAUSTIVE research on a startup idea. Go deeper than surface-level analysis.

## Research Depth Requirements:

1. **Market Analysis**
   - Detailed TAM/SAM/SOM with methodology
   - Market growth rate and projections
   - Key market drivers and inhibitors
   - Regulatory landscape

2. **Competitive Landscape** (find 5-10 competitors)
   - Direct competitors with detailed profiles
   - Indirect/adjacent competitors
   - Emerging threats and startups to watch
   - Competitive moats and defensibility analysis

3. **Strategic Intelligence**
   - White space opportunities
   - Potential pivot directions
   - Partnership opportunities
   - M&A landscape (who might acquire, who to acquire)

4. **Go-to-Market Insights**
   - Customer acquisition strategies used by competitors
   - Pricing benchmarks across the market
   - Distribution channel analysis
   - Marketing spend benchmarks

## For Each Competitor, Provide:
- Company name and website
- Detailed description (3-4 sentences)
- Funding history and investors
- Pricing tiers and model
- Key features and differentiators
- Strengths (3-5)
- Weaknesses (3-5)
- Recent news or developments

## Output Format:
Respond with a JSON object:
{
  "summary": "Comprehensive 4-5 sentence market overview",
  "marketSize": "Detailed TAM/SAM/SOM with methodology",
  "trends": ["trend 1 with context", "trend 2 with context", ...],
  "directCompetitors": [
    {
      "name": "Company Name",
      "website": "https://...",
      "description": "Detailed description",
      "funding": "Detailed funding history",
      "pricing": "Detailed pricing breakdown",
      "strengths": ["strength 1", "strength 2", "strength 3"],
      "weaknesses": ["weakness 1", "weakness 2", "weakness 3"]
    }
  ],
  "indirectCompetitors": [...],
  "gaps": ["detailed gap 1", "detailed gap 2", ...],
  "opportunities": ["detailed opportunity 1", ...],
  "threats": ["detailed threat 1", ...],
  "recommendations": ["detailed recommendation 1", ...]
}

Be thorough, specific, and actionable. This is institutional-grade research.`;

export async function runDeepResearch(request: ResearchRequest): Promise<MarketResearchResult> {
  const apiKey = GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key not configured. Set GEMINI_API_KEY environment variable.");
  }

  const id = crypto.randomUUID();
  console.log(`\n🔬 [Prebloom] Starting DEEP research ${id}`);
  console.log(`📝 [Prebloom] Idea: ${request.idea.substring(0, 100)}...`);

  const userMessage = `Conduct exhaustive market and competitive research on this startup idea:

**Idea:** ${request.idea}
${request.industry ? `**Industry:** ${request.industry}` : ""}

Provide institutional-grade research in the JSON format specified. Be thorough and detailed.`;

  const started = Date.now();

  // Use Gemini 2.0 Flash for deep research
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: DEEP_RESEARCH_PROMPT }, { text: userMessage }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [Prebloom] Gemini API error:`, errorText);
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;

  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message}`);
  }

  const elapsed = Date.now() - started;
  console.log(`✅ [Prebloom] Deep research complete (${elapsed}ms)`);

  // Extract text from response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse deep research output");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    id,
    createdAt: new Date().toISOString(),
    query: request.idea,
    summary: parsed.summary || "Deep research complete.",
    marketSize: parsed.marketSize,
    trends: parsed.trends || [],
    directCompetitors: parsed.directCompetitors || [],
    indirectCompetitors: parsed.indirectCompetitors || [],
    gaps: parsed.gaps || [],
    opportunities: parsed.opportunities || [],
    threats: parsed.threats || [],
    recommendations: parsed.recommendations || [],
    sources: ["Gemini Deep Research Analysis"],
    researchType: "deep",
  };
}
