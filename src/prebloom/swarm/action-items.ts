/**
 * Action Item Extraction for Prebloom Iteration
 *
 * Extracts 3-5 actionable concerns from evaluation results
 * to guide users in refining their idea.
 */

import crypto from "node:crypto";
import type { ActionItem, AgentOutput, DimensionScores } from "../types.js";

interface ExtractionInput {
  synthesis: AgentOutput;
  fire: AgentOutput;
  dimensions: DimensionScores;
  keyRisks: string[];
  killConditions: string[];
}

/**
 * Extract actionable items from evaluation results.
 * Returns 3-5 prioritized concerns the user should address.
 */
export function extractActionItems(input: ExtractionInput): ActionItem[] {
  const items: ActionItem[] = [];

  // 1. Extract from key risks (highest priority)
  for (const risk of input.keyRisks.slice(0, 3)) {
    const category = categorizeRisk(risk);
    items.push({
      id: generateId(),
      concern: cleanRiskText(risk),
      category,
      severity: "major",
      source: "synthesis",
    });
  }

  // 2. Extract from kill conditions (critical severity)
  for (const condition of input.killConditions.slice(0, 2)) {
    // Skip if too similar to existing items
    if (items.some((item) => isSimilar(item.concern, condition))) continue;

    items.push({
      id: generateId(),
      concern: cleanRiskText(condition),
      category: categorizeRisk(condition),
      severity: "critical",
      source: "synthesis",
    });
  }

  // 3. Extract from low-scoring dimensions
  const lowDimensions = getLowScoringDimensions(input.dimensions);
  for (const dim of lowDimensions) {
    // Skip if already covered
    if (items.some((item) => item.category === dim.category)) continue;

    items.push({
      id: generateId(),
      concern: dim.concern,
      category: dim.category,
      severity: dim.score <= 3 ? "critical" : "major",
      source: "dimension",
    });
  }

  // 4. Extract critical risks from Fire agent
  const fireRisks = extractFireRisks(input.fire.analysis);
  for (const risk of fireRisks) {
    // Skip if too similar to existing items
    if (items.some((item) => isSimilar(item.concern, risk.text))) continue;

    items.push({
      id: generateId(),
      concern: risk.text,
      category: categorizeRisk(risk.text),
      severity: risk.severity,
      source: "fire",
    });
  }

  // Sort by severity (critical first) and dedupe
  const sorted = items
    .sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 5); // Max 5 items

  // Ensure at least 3 items if possible
  if (sorted.length < 3 && input.keyRisks.length > sorted.length) {
    // Add more from key risks
    for (const risk of input.keyRisks) {
      if (sorted.length >= 3) break;
      if (sorted.some((item) => isSimilar(item.concern, risk))) continue;

      sorted.push({
        id: generateId(),
        concern: cleanRiskText(risk),
        category: categorizeRisk(risk),
        severity: "minor",
        source: "synthesis",
      });
    }
  }

  return sorted;
}

/**
 * Categorize a risk/concern into one of our categories
 */
function categorizeRisk(text: string): "market" | "product" | "execution" | "business" | "timing" {
  const lower = text.toLowerCase();

  if (
    lower.includes("market") ||
    lower.includes("customer") ||
    lower.includes("user") ||
    lower.includes("demand") ||
    lower.includes("competition") ||
    lower.includes("competitor")
  ) {
    return "market";
  }

  if (
    lower.includes("timing") ||
    lower.includes("too early") ||
    lower.includes("too late") ||
    lower.includes("when") ||
    lower.includes("now")
  ) {
    return "timing";
  }

  if (
    lower.includes("revenue") ||
    lower.includes("monetiz") ||
    lower.includes("pricing") ||
    lower.includes("business model") ||
    lower.includes("profit") ||
    lower.includes("unit economics")
  ) {
    return "business";
  }

  if (
    lower.includes("build") ||
    lower.includes("technical") ||
    lower.includes("team") ||
    lower.includes("founder") ||
    lower.includes("scale") ||
    lower.includes("resource")
  ) {
    return "execution";
  }

  if (
    lower.includes("product") ||
    lower.includes("solution") ||
    lower.includes("feature") ||
    lower.includes("differenti")
  ) {
    return "product";
  }

  // Default to market (most common)
  return "market";
}

/**
 * Clean up risk text for display
 */
function cleanRiskText(text: string): string {
  return text
    .replace(/^\d+\.\s*/, "") // Remove leading numbers
    .replace(/^[-•]\s*/, "") // Remove bullets
    .replace(/^\*\*.*?\*\*\s*[-—:]\s*/i, "") // Remove bold prefix labels
    .replace(/^(risk|warning|concern):\s*/i, "") // Remove common prefixes
    .trim();
}

/**
 * Get low-scoring dimensions as action items
 */
function getLowScoringDimensions(
  dimensions: DimensionScores,
): { category: ActionItem["category"]; concern: string; score: number }[] {
  const results: { category: ActionItem["category"]; concern: string; score: number }[] = [];

  const dimensionMap: {
    key: keyof DimensionScores;
    category: ActionItem["category"];
    lowScoreConcern: string;
  }[] = [
    {
      key: "problemClarity",
      category: "product",
      lowScoreConcern: "Problem definition needs more clarity and validation",
    },
    {
      key: "marketSize",
      category: "market",
      lowScoreConcern: "Market size and opportunity need better definition",
    },
    {
      key: "competitionRisk",
      category: "market",
      lowScoreConcern: "Competitive positioning and defensibility need strengthening",
    },
    {
      key: "execution",
      category: "execution",
      lowScoreConcern: "Execution plan and team capabilities need more detail",
    },
    {
      key: "businessModel",
      category: "business",
      lowScoreConcern: "Business model and revenue strategy need more clarity",
    },
  ];

  for (const dim of dimensionMap) {
    const score = dimensions[dim.key];
    if (score <= 5) {
      results.push({
        category: dim.category,
        concern: dim.lowScoreConcern,
        score,
      });
    }
  }

  // Sort by score (lowest first)
  return results.sort((a, b) => a.score - b.score);
}

/**
 * Extract critical risks from Fire agent analysis
 */
function extractFireRisks(
  analysis: string,
): { text: string; severity: "critical" | "major" | "minor" }[] {
  const results: { text: string; severity: "critical" | "major" | "minor" }[] = [];

  // Look for Critical Risks section
  const criticalMatch = analysis.match(
    /critical risks?[:\s]*\n([\s\S]*?)(?=\n\n|\n###|fatal flaw|$)/i,
  );
  if (criticalMatch) {
    const lines = criticalMatch[1].split("\n").filter((line) => line.trim());
    for (const line of lines.slice(0, 2)) {
      const cleaned = cleanRiskText(line);
      if (cleaned.length > 15) {
        results.push({ text: cleaned, severity: "critical" });
      }
    }
  }

  // Look for Fatal Flaw
  const fatalMatch = analysis.match(/fatal flaw[:\s]*\n?([\s\S]*?)(?=\n\n|\n###|$)/i);
  if (fatalMatch) {
    const cleaned = cleanRiskText(fatalMatch[1].split("\n")[0] || "");
    if (cleaned.length > 15 && !cleaned.toLowerCase().includes("none")) {
      results.push({ text: cleaned, severity: "critical" });
    }
  }

  // Look for High severity risks in tables
  const highRiskMatches = analysis.matchAll(/🔴\s*high[^|]*\|\s*([^|\n]+)/gi);
  for (const match of highRiskMatches) {
    const cleaned = cleanRiskText(match[1]);
    if (cleaned.length > 10) {
      results.push({ text: cleaned, severity: "major" });
    }
  }

  return results;
}

/**
 * Check if two strings are semantically similar (simple overlap check)
 */
function isSimilar(a: string, b: string): boolean {
  const wordsA = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
  const wordsB = new Set(
    b
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  // If more than 40% of words overlap, consider similar
  const similarity = overlap / Math.min(wordsA.size, wordsB.size);
  return similarity > 0.4;
}

/**
 * Generate a unique ID for action items
 */
function generateId(): string {
  return crypto.randomBytes(8).toString("hex");
}
