/**
 * Prebloom Skills System - Skill Application
 *
 * Applies skills to agent outputs via LLM post-processing.
 * Prefers local Ollama (Llama 3.2) for speed/cost, falls back to Claude Haiku.
 */

import { loadConfig } from "../../config/config.js";
import { resolveApiKeyForProvider } from "../../agents/model-auth.js";
import type { PrebloomSkill, SkillApplicationContext, SkillApplicationResult } from "./types.js";
import { getSkill } from "./registry.js";

// Configuration
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const CLEANUP_MODEL = process.env.CLEANUP_MODEL || "llama3.2:3b";
const FALLBACK_MODEL = "claude-3-5-haiku-20241022";

// Set USE_LOCAL_CLEANUP=false to skip Ollama and use Haiku directly
const USE_LOCAL_CLEANUP = process.env.USE_LOCAL_CLEANUP !== "false";

interface OllamaResponse {
  response: string;
  done: boolean;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

/**
 * Check if Ollama is available and has the model
 */
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return false;

    const data = (await response.json()) as { models?: Array<{ name: string }> };
    const models = data.models || [];

    // Check if our cleanup model is available
    const modelBase = CLEANUP_MODEL.split(":")[0];
    return models.some((m) => m.name.startsWith(modelBase));
  } catch {
    return false;
  }
}

/**
 * Pull the model if not available
 */
async function ensureOllamaModel(): Promise<boolean> {
  try {
    console.log(`[prebloom-skills] Pulling Ollama model: ${CLEANUP_MODEL}`);
    const response = await fetch(`${OLLAMA_URL}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: CLEANUP_MODEL, stream: false }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Apply skill using local Ollama
 */
async function applyWithOllama(skill: PrebloomSkill, text: string): Promise<string | null> {
  const prompt = `You are a text processor. Apply the following skill to transform the input text.

## Skill: ${skill.name}

${skill.content}

## Input Text

${text}

## Instructions

Apply the skill instructions above. Return ONLY the transformed text, nothing else. No explanations.`;

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CLEANUP_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 2048,
        },
      }),
    });

    if (!response.ok) {
      console.warn(`[prebloom-skills] Ollama error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as OllamaResponse;
    return data.response?.trim() || null;
  } catch (error) {
    console.warn(`[prebloom-skills] Ollama failed:`, error);
    return null;
  }
}

/**
 * Apply skill using Claude Haiku (fallback)
 */
async function applyWithAnthropic(skill: PrebloomSkill, text: string): Promise<string | null> {
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
    console.warn(`[prebloom-skills] No Anthropic API key available`);
    return null;
  }

  const systemPrompt = `You are a text processor. Your job is to apply the following skill to the provided text.

## Skill: ${skill.name}

${skill.content}

## Instructions

Apply the skill instructions above to transform the input text. Return ONLY the transformed text, nothing else. Do not add explanations, commentary, or meta-text. Just output the processed result.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: FALLBACK_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: `Process this text:\n\n${text}` }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[prebloom-skills] Anthropic error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = (await response.json()) as AnthropicResponse;
    return (
      data.content
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n")
        .trim() || null
    );
  } catch (error) {
    console.warn(`[prebloom-skills] Anthropic failed:`, error);
    return null;
  }
}

/**
 * Apply a skill to text using an LLM call
 * Prefers local Ollama (Llama 3.2), falls back to Claude Haiku
 */
export async function applySkill(
  skill: PrebloomSkill,
  context: SkillApplicationContext,
): Promise<SkillApplicationResult> {
  const { text, agent } = context;

  console.log(`[prebloom-skills] Applying skill "${skill.name}" to ${agent || "unknown"} output`);
  const started = Date.now();

  let processedText: string | null = null;
  let usedBackend = "none";

  // Try Ollama first if enabled (local, fast, free)
  if (USE_LOCAL_CLEANUP) {
    const ollamaAvailable = await isOllamaAvailable();
    if (ollamaAvailable) {
      console.log(`[prebloom-skills] Using local Ollama (${CLEANUP_MODEL})`);
      processedText = await applyWithOllama(skill, text);
      if (processedText) {
        usedBackend = `ollama:${CLEANUP_MODEL}`;
      }
    } else {
      // Try to pull the model
      console.log(`[prebloom-skills] Ollama model not found, attempting to pull...`);
      const pulled = await ensureOllamaModel();
      if (pulled) {
        processedText = await applyWithOllama(skill, text);
        if (processedText) {
          usedBackend = `ollama:${CLEANUP_MODEL}`;
        }
      }
    }
  } else {
    console.log(`[prebloom-skills] Local cleanup disabled, using API`);
  }

  // Fall back to Anthropic if Ollama failed
  if (!processedText) {
    console.log(`[prebloom-skills] Falling back to Anthropic (${FALLBACK_MODEL})`);
    processedText = await applyWithAnthropic(skill, text);
    if (processedText) {
      usedBackend = `anthropic:${FALLBACK_MODEL}`;
    }
  }

  const elapsed = Date.now() - started;

  if (processedText) {
    console.log(
      `[prebloom-skills] Skill "${skill.name}" applied in ${elapsed}ms via ${usedBackend}`,
    );
    return {
      text: processedText,
      applied: true,
      notes: `Processed with ${skill.name} v${skill.version} via ${usedBackend}`,
    };
  }

  console.warn(`[prebloom-skills] All backends failed, returning original text`);
  return { text, applied: false, notes: "All backends failed" };
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
