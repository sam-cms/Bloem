#!/usr/bin/env npx tsx
/**
 * Test script for Prebloom Skills System
 * 
 * Usage: npx tsx scripts/test-prebloom-skills.ts
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

// Set up paths before importing
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(__dirname, ".."));

async function main() {
  console.log("\n🧪 Testing Prebloom Skills System\n");
  console.log("=".repeat(50));

  // Test 1: Load skills
  console.log("\n📦 Test 1: Loading skills...\n");
  
  const { loadAllSkills, getSkillsLibraryDir } = await import("../src/prebloom/skills/loader.js");
  const skillsDir = getSkillsLibraryDir();
  console.log(`Skills library: ${skillsDir}`);
  
  const skills = loadAllSkills();
  console.log(`Loaded ${skills.length} skill(s):`);
  for (const skill of skills) {
    console.log(`  - ${skill.name} v${skill.version}: ${skill.description.slice(0, 50)}...`);
  }

  if (skills.length === 0) {
    console.error("❌ No skills loaded! Check skills-library directory.");
    process.exit(1);
  }

  // Test 2: Registry
  console.log("\n📋 Test 2: Testing registry...\n");
  
  const { getRegistry, getSkill, hasSkill } = await import("../src/prebloom/skills/registry.js");
  const registry = getRegistry();
  
  console.log(`Registry has ${registry.list().length} skill(s)`);
  console.log(`Has 'humanizer': ${hasSkill("humanizer")}`);
  console.log(`Has 'transcription': ${hasSkill("transcription")}`);
  console.log(`Has 'nonexistent': ${hasSkill("nonexistent")}`);

  const humanizer = getSkill("humanizer");
  if (humanizer) {
    console.log(`\nHumanizer skill details:`);
    console.log(`  ID: ${humanizer.id}`);
    console.log(`  Name: ${humanizer.name}`);
    console.log(`  Version: ${humanizer.version}`);
    console.log(`  Content length: ${humanizer.content.length} chars`);
  } else {
    console.error("❌ Humanizer skill not found!");
    process.exit(1);
  }

  // Test 3: Skill application (if API key available)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    console.log("\n🔧 Test 3: Testing skill application...\n");
    
    const { applySkillById } = await import("../src/prebloom/skills/apply.js");
    
    const testText = `
This serves as a testament to the company's commitment to innovation. 
Additionally, it highlights the crucial role that technology plays in the 
evolving landscape of modern business. The vibrant ecosystem fosters 
collaboration and drives meaningful outcomes.
    `.trim();
    
    console.log("Input text (AI-sounding):");
    console.log(`"${testText.slice(0, 100)}..."\n`);
    
    const result = await applySkillById("humanizer", { text: testText, agent: "test" });
    
    if (result.applied) {
      console.log("✅ Skill applied successfully!");
      console.log("\nOutput text (humanized):");
      console.log(`"${result.text.slice(0, 200)}..."`);
    } else {
      console.log(`⚠️ Skill not applied: ${result.notes}`);
    }
  } else {
    console.log("\n⏭️ Skipping Test 3: No ANTHROPIC_API_KEY set\n");
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ All tests passed!\n");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
