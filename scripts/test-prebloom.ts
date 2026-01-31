#!/usr/bin/env npx tsx
/**
 * Test script for Prebloom orchestrator.
 * 
 * Usage:
 *   npx tsx scripts/test-prebloom.ts
 * 
 * Requires ANTHROPIC_API_KEY to be set.
 */

import { evaluateIdea } from "../src/prebloom/index.js";

async function main() {
  console.log("🌱 Testing Prebloom Orchestrator\n");

  const testIdea = {
    problem: "Startup founders waste months building products nobody wants because they lack objective feedback on their ideas before committing resources.",
    solution: "An AI-powered council of specialized agents that stress-tests startup ideas, providing structured evaluation with a clear verdict, key risks, and actionable next steps.",
    targetMarket: "First-time founders, indie hackers, and accelerator programs looking to validate ideas quickly.",
    businessModel: "€29 per evaluation for individuals, enterprise pricing for accelerators and VCs.",
    whyYou: "Built by a technical founder with experience in AI and startup ecosystems.",
    email: "test@prebloom.ai",
  };

  console.log("📝 Test Idea:");
  console.log(`   Problem: ${testIdea.problem.substring(0, 60)}...`);
  console.log(`   Solution: ${testIdea.solution.substring(0, 60)}...`);
  console.log("");

  try {
    const verdict = await evaluateIdea(testIdea);

    console.log("\n" + "=".repeat(60));
    console.log("📊 VERDICT SUMMARY");
    console.log("=".repeat(60));
    console.log(`\nDecision: ${verdict.decision}`);
    console.log(`Confidence: ${verdict.confidence}/10`);
    console.log(`\nExecutive Summary:\n${verdict.executiveSummary}`);
    
    console.log("\n🟢 Key Strengths:");
    verdict.keyStrengths.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
    
    console.log("\n🔴 Key Risks:");
    verdict.keyRisks.forEach((r, i) => console.log(`   ${i + 1}. ${r}`));
    
    console.log("\n📋 Next Steps:");
    verdict.nextSteps.forEach((n, i) => console.log(`   ${i + 1}. ${n}`));

    console.log("\n✅ Test completed successfully!");
    
    // Write full verdict to file
    const fs = await import("node:fs/promises");
    const outputPath = "test-prebloom-output.json";
    await fs.writeFile(outputPath, JSON.stringify(verdict, null, 2));
    console.log(`\n📄 Full verdict written to: ${outputPath}`);

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();
