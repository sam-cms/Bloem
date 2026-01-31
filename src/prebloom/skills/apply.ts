/**
 * Prebloom Skills System - Skill Application
 *
 * Applies skills to agent outputs via LLM post-processing.
 */

import { loadConfig } from "../../config/config.js";
import { resolveApiKeyForProvider } from "../../agents/model-auth.js";
import type { PrebloomSkill, SkillApplicationContext, SkillApplicationResult } from "./types.js";
import { getSkill } from "./registry.js";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

/**
 * Apply a skill to text using an LLM call
 */
export async function applySkill(
  skill: PrebloomSkill,
  context: SkillApplicationContext,
): Promise<SkillApplicationResult> {
  const { text, agent, metadata } = context;

  console.log(`[prebloom-skills] Applying skill "${skill.name}" to ${agent || "unknown"} output`);
  const started = Date.now();

  // Get API key
  let apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const cfg = loadConfig();
    const authResult = await resolveApiKeyForProvider({
      cfg,
      provider: "anthropic",
    });
    apiKey = authResult.apiKey;
  }

  if (!apiKey) {
    console.warn(`[prebloom-skills] No API key for skill application, returning original text`);
    return { text, applied: false, notes: "No API key available" };
  }

  // Build the system prompt from skill content
  const systemPrompt = `You are a text processor. Your job is to apply the following skill to the provided text.

## Skill: ${skill.name}

${skill.content}

## Instructions

Apply the skill instructions above to transform the input text. Return ONLY the transformed text, nothing else. Do not add explanations, commentary, or meta-text. Just output the processed result.`;

  const userMessage = `Process this text:\n\n${text}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const processedText = data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n");

    const elapsed = Date.now() - started;
    console.log(`[prebloom-skills] Skill "${skill.name}" applied in ${elapsed}ms`);

    return {
      text: processedText,
      applied: true,
      notes: `Processed with ${skill.name} v${skill.version}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[prebloom-skills] Failed to apply skill "${skill.name}": ${message}`);
    return { text, applied: false, notes: `Error: ${message}` };
  }
}

/**
 * Apply a skill by ID
 */
export async function applySkillById(
  skillId: string,
  context: SkillApplicationContext,
): Promise<SkillApplicationResult> {
  const skill = getSkill(skillId);
  if (!skill) {
    console.warn(`[prebloom-skills] Skill not found: ${skillId}`);
    return { text: context.text, applied: false, notes: `Skill not found: ${skillId}` };
  }
  return applySkill(skill, context);
}

/**
 * Apply multiple skills in sequence
 */
export async function applySkills(
  skillIds: string[],
  context: SkillApplicationContext,
): Promise<SkillApplicationResult> {
  let currentText = context.text;
  const appliedSkills: string[] = [];

  for (const skillId of skillIds) {
    const result = await applySkillById(skillId, { ...context, text: currentText });
    if (result.applied) {
      currentText = result.text;
      appliedSkills.push(skillId);
    }
  }

  return {
    text: currentText,
    applied: appliedSkills.length > 0,
    notes:
      appliedSkills.length > 0
        ? `Applied skills: ${appliedSkills.join(", ")}`
        : "No skills applied",
  };
}
