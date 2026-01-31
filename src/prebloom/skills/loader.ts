/**
 * Prebloom Skills System - Skill Loader
 *
 * Loads SKILL.md files from the skills-library directory,
 * parses YAML frontmatter, and creates PrebloomSkill objects.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PrebloomSkill, SkillFrontmatter } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Skills library can be in src (dev) or copied to dist (prod)
// We check both locations
function resolveSkillsLibraryDir(): string {
  // First try relative to compiled dist
  const distPath = path.resolve(__dirname, "../skills-library");
  if (fs.existsSync(distPath)) {
    return distPath;
  }

  // Then try src directory (for development)
  const srcPath = path.resolve(__dirname, "../../../src/prebloom/skills-library");
  if (fs.existsSync(srcPath)) {
    return srcPath;
  }

  // Finally try from project root (for Docker)
  const rootPath = path.resolve(process.cwd(), "src/prebloom/skills-library");
  if (fs.existsSync(rootPath)) {
    return rootPath;
  }

  // Fallback to dist path even if it doesn't exist
  return distPath;
}

const SKILLS_LIBRARY_DIR = resolveSkillsLibraryDir();

/**
 * Parse YAML frontmatter from a SKILL.md file
 */
function parseFrontmatter(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error("Invalid SKILL.md format: missing frontmatter");
  }

  const [, frontmatterRaw, body] = match;
  const frontmatter: Record<string, unknown> = {};

  // Simple YAML parser for frontmatter
  const lines = frontmatterRaw.split("\n");
  let currentKey = "";
  let currentValue = "";
  let inMultiline = false;
  let inArray = false;
  let arrayValues: string[] = [];

  for (const line of lines) {
    // Handle array items
    if (inArray && line.match(/^\s+-\s+/)) {
      const value = line.replace(/^\s+-\s+/, "").trim();
      arrayValues.push(value);
      continue;
    } else if (inArray && !line.match(/^\s+-\s+/) && line.trim()) {
      // End of array
      frontmatter[currentKey] = arrayValues;
      inArray = false;
      arrayValues = [];
    }

    // Handle multiline values
    if (inMultiline) {
      if (line.startsWith("  ") || line.trim() === "") {
        currentValue += (currentValue ? "\n" : "") + line.replace(/^\s{2}/, "");
        continue;
      } else {
        frontmatter[currentKey] = currentValue.trim();
        inMultiline = false;
      }
    }

    // Parse key: value pairs
    const keyValueMatch = line.match(/^(\S+?):\s*(.*)$/);
    if (keyValueMatch) {
      const [, key, value] = keyValueMatch;
      currentKey = key;

      if (value === "|" || value === ">") {
        inMultiline = true;
        currentValue = "";
      } else if (value === "") {
        // Could be start of array or object
        inArray = true;
        arrayValues = [];
      } else {
        frontmatter[key] = value.replace(/^["']|["']$/g, "");
      }
    }
  }

  // Handle any remaining multiline or array
  if (inMultiline) {
    frontmatter[currentKey] = currentValue.trim();
  }
  if (inArray && arrayValues.length > 0) {
    frontmatter[currentKey] = arrayValues;
  }

  return {
    frontmatter: frontmatter as unknown as SkillFrontmatter,
    body: body.trim(),
  };
}

/**
 * Load a single skill from a directory
 */
export function loadSkill(skillDir: string): PrebloomSkill | null {
  const skillPath = path.join(skillDir, "SKILL.md");

  if (!fs.existsSync(skillPath)) {
    console.warn(`[prebloom-skills] No SKILL.md found in ${skillDir}`);
    return null;
  }

  try {
    const content = fs.readFileSync(skillPath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(content);
    const id = path.basename(skillDir);

    return {
      id,
      name: frontmatter.name || id,
      version: frontmatter.version || "1.0.0",
      description: frontmatter.description || "",
      content: body,
      frontmatter,
      filePath: skillPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[prebloom-skills] Failed to load skill from ${skillDir}: ${message}`);
    return null;
  }
}

/**
 * Load all skills from the skills-library directory
 */
export function loadAllSkills(libraryDir: string = SKILLS_LIBRARY_DIR): PrebloomSkill[] {
  if (!fs.existsSync(libraryDir)) {
    console.warn(`[prebloom-skills] Skills library not found: ${libraryDir}`);
    return [];
  }

  const skills: PrebloomSkill[] = [];
  const entries = fs.readdirSync(libraryDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillDir = path.join(libraryDir, entry.name);
      const skill = loadSkill(skillDir);
      if (skill) {
        skills.push(skill);
        console.log(`[prebloom-skills] Loaded skill: ${skill.name} v${skill.version}`);
      }
    }
  }

  return skills;
}

/**
 * Get the default skills library directory
 */
export function getSkillsLibraryDir(): string {
  return SKILLS_LIBRARY_DIR;
}
