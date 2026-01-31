/**
 * Prebloom Skills System - Type Definitions
 */

export interface SkillFrontmatter {
  name: string;
  version: string;
  description: string;
  "allowed-tools"?: string[];
  /** When to apply this skill: 'pre' (before agent), 'post' (after agent), 'wrap' (both) */
  apply?: "pre" | "post" | "wrap";
  /** Which agents this skill applies to */
  agents?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface PrebloomSkill {
  /** Unique skill identifier (folder name) */
  id: string;
  /** Skill name from frontmatter */
  name: string;
  /** Skill version */
  version: string;
  /** Short description */
  description: string;
  /** Full skill content (instructions) */
  content: string;
  /** Raw frontmatter */
  frontmatter: SkillFrontmatter;
  /** Path to SKILL.md */
  filePath: string;
}

export interface SkillRegistry {
  skills: Map<string, PrebloomSkill>;
  get(id: string): PrebloomSkill | undefined;
  list(): PrebloomSkill[];
  has(id: string): boolean;
}

export interface SkillApplicationContext {
  /** The text to process */
  text: string;
  /** Which agent produced this text */
  agent?: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

export interface SkillApplicationResult {
  /** Processed text */
  text: string;
  /** Whether the skill was applied */
  applied: boolean;
  /** Any notes from the skill application */
  notes?: string;
}
