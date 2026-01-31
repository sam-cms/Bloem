/**
 * Prebloom Skills System - Skill Registry
 *
 * Manages loaded skills and provides lookup functionality.
 */

import type { PrebloomSkill, SkillRegistry } from "./types.js";
import { loadAllSkills, getSkillsLibraryDir } from "./loader.js";

let globalRegistry: SkillRegistry | null = null;

/**
 * Create a new skill registry from loaded skills
 */
export function createRegistry(skills: PrebloomSkill[]): SkillRegistry {
  const skillsMap = new Map<string, PrebloomSkill>();

  for (const skill of skills) {
    skillsMap.set(skill.id, skill);
    // Also index by name for convenience
    if (skill.name !== skill.id) {
      skillsMap.set(skill.name.toLowerCase(), skill);
    }
  }

  return {
    skills: skillsMap,
    get(id: string): PrebloomSkill | undefined {
      return skillsMap.get(id) || skillsMap.get(id.toLowerCase());
    },
    list(): PrebloomSkill[] {
      // Return unique skills (avoid duplicates from name indexing)
      const seen = new Set<string>();
      const result: PrebloomSkill[] = [];
      for (const skill of skillsMap.values()) {
        if (!seen.has(skill.id)) {
          seen.add(skill.id);
          result.push(skill);
        }
      }
      return result;
    },
    has(id: string): boolean {
      return skillsMap.has(id) || skillsMap.has(id.toLowerCase());
    },
  };
}

/**
 * Initialize and return the global skill registry
 */
export function getRegistry(): SkillRegistry {
  if (!globalRegistry) {
    const skills = loadAllSkills(getSkillsLibraryDir());
    globalRegistry = createRegistry(skills);
    console.log(`[prebloom-skills] Registry initialized with ${skills.length} skill(s)`);
  }
  return globalRegistry;
}

/**
 * Reload the global registry (useful after adding new skills)
 */
export function reloadRegistry(): SkillRegistry {
  globalRegistry = null;
  return getRegistry();
}

/**
 * Get a skill by ID or name
 */
export function getSkill(id: string): PrebloomSkill | undefined {
  return getRegistry().get(id);
}

/**
 * List all available skills
 */
export function listSkills(): PrebloomSkill[] {
  return getRegistry().list();
}

/**
 * Check if a skill exists
 */
export function hasSkill(id: string): boolean {
  return getRegistry().has(id);
}
