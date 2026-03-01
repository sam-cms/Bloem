/**
 * Full Pipeline Test: Council → Groundwork
 * Saves all output to test-output.json
 */

import { evaluateIdea } from "./dist/prebloom/swarm/orchestrator.js";
import { runGroundwork } from "./dist/prebloom/groundwork/orchestrator.js";
import fs from "node:fs";

const IDEA = {
  problem: "Founders waste months building products nobody wants because they can't objectively stress-test their ideas — existing options are expensive consultants, biased friends, or generic frameworks with no real market data.",
  solution: "Prebloom is an AI council that evaluates startup ideas in 3 minutes: a Catalyst builds the bull case, a Firing Squad tries to kill it, and a Synthesis agent delivers a scored verdict with concrete risks and next steps.",
  targetMarket: "Solo founders, indie hackers, and pre-seed teams (~5M globally)",
  businessModel: "Freemium model: 1 free evaluation/month, Pro at €19/month for unlimited evaluations, iteration mode, and deep research reports."
};

async function run() {
  const totalStart = Date.now();
  
  console.log("\n" + "=".repeat(60));
  console.log("COUNCIL PHASE");
  console.log("=".repeat(60) + "\n");
  
  const councilStart = Date.now();
  const verdict = await evaluateIdea(IDEA);
  const councilDuration = (Date.now() - councilStart) / 1000;
  
  console.log(`\nCouncil completed in ${councilDuration.toFixed(1)}s\n`);

  console.log("\n" + "=".repeat(60));
  console.log("GROUNDWORK PHASE");
  console.log("=".repeat(60) + "\n");
  
  const councilContext = {
    intake: verdict.agentOutputs?.intake || "",
    catalyst: verdict.agentOutputs?.catalyst || "",
    fire: verdict.agentOutputs?.fire || "",
    synthesis: verdict.agentOutputs?.synthesis || "",
    ideaText: `Problem: ${IDEA.problem}\nSolution: ${IDEA.solution}\nTarget Market: ${IDEA.targetMarket}\nBusiness Model: ${IDEA.businessModel}`
  };

  const groundworkStart = Date.now();
  const groundwork = await runGroundwork(verdict.id, councilContext);
  const groundworkDuration = (Date.now() - groundworkStart) / 1000;
  
  const totalDuration = (Date.now() - totalStart) / 1000;

  console.log("\n" + "=".repeat(60));
  console.log("PIPELINE SUMMARY");
  console.log("=".repeat(60));
  console.log(`Council:    ${councilDuration.toFixed(1)}s`);
  console.log(`Groundwork: ${groundworkDuration.toFixed(1)}s`);
  console.log(`Total:      ${totalDuration.toFixed(1)}s`);
  
  if (groundwork.metrics) {
    const m = groundwork.metrics;
    console.log(`\nTokens in:  ${m.totalInputTokens.toLocaleString()}`);
    console.log(`Tokens out: ${m.totalOutputTokens.toLocaleString()}`);
    console.log(`Searches:   ${m.totalSearches}`);
    
    const gwInputCost = (m.totalInputTokens / 1_000_000) * 3;
    const gwOutputCost = (m.totalOutputTokens / 1_000_000) * 15;
    const gwSearchCost = m.totalSearches * 0.01;
    const gwTotal = gwInputCost + gwOutputCost + gwSearchCost;
    console.log(`\nGroundwork cost: $${gwTotal.toFixed(2)}`);
  }

  const output = {
    timestamp: new Date().toISOString(),
    idea: IDEA,
    council: {
      verdict,
      durationSec: councilDuration,
    },
    groundwork: {
      result: groundwork,
      durationSec: groundworkDuration,
    },
    totalDurationSec: totalDuration,
  };

  fs.writeFileSync("test-output.json", JSON.stringify(output, null, 2));
  console.log(`\nFull output saved to test-output.json`);
}

run().catch(err => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
