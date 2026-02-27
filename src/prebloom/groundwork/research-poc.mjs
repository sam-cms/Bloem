/**
 * Groundwork Research POC — Streaming
 *
 * Tests Claude API with web_search + web_fetch using streaming
 * to see real-time progress events for the frontend.
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const events = [];
const startTime = Date.now();

function elapsed() {
  return ((Date.now() - startTime) / 1000).toFixed(1);
}

async function runResearch(idea) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧪 GROUNDWORK RESEARCH POC (streaming)");
  console.log(`📝 Idea: "${idea}"`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const systemPrompt = `You are a senior market research analyst for Prebloom, an AI startup idea validator.

Given a startup idea, conduct thorough research using web search to produce:

1. **Market Analysis** - TAM/SAM/SOM with sources, growth rate, trends
2. **Competitive Landscape** (3-5 competitors) - name, URL, pricing, funding. Fetch websites for real data.
3. **Target Customer Personas** (2-3 ICPs) - who, where to find them, pain points
4. **Key Insights** - competitive advantage, biggest risk, positioning

Be specific. Use real data. Cite sources.`;

  let fullText = "";
  let searchCount = 0;
  let fetchCount = 0;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 10,
      },
      {
        type: "web_fetch_20260209",
        name: "web_fetch",
        max_uses: 5,
      },
    ],
    messages: [
      {
        role: "user",
        content: `Research this startup idea for our Groundwork report:\n\n"${idea}"`,
      },
    ],
  });

  let currentBlockType = null;
  let currentToolName = null;
  let toolInputJson = "";
  let textStarted = false;

  stream.on("event", (event) => {
    // content_block_start — tells us what kind of block is starting
    if (event.type === "content_block_start") {
      const block = event.content_block;
      currentBlockType = block?.type;

      if (block?.type === "server_tool_use") {
        currentToolName = block.name;
        toolInputJson = "";
      } else if (block?.type === "web_search_tool_result") {
        searchCount++;
        console.log(`[${elapsed()}s] ✅ Search #${searchCount} results received`);
        events.push({ type: "search_result", time: elapsed() });
      } else if (block?.type === "text") {
        if (!textStarted) {
          console.log(`[${elapsed()}s] 🧠 Synthesizing report...`);
          textStarted = true;
          events.push({ type: "synthesize", time: elapsed() });
        }
      }
    }

    // input_json_delta — tool input being streamed
    if (event.type === "content_block_delta") {
      if (event.delta?.type === "input_json_delta") {
        toolInputJson += event.delta.partial_json || "";
      } else if (event.delta?.type === "text_delta") {
        fullText += event.delta.text || "";
      }
    }

    // content_block_stop — block finished
    if (event.type === "content_block_stop") {
      if (currentToolName && toolInputJson) {
        try {
          const parsed = JSON.parse(toolInputJson);
          if (currentToolName === "web_search") {
            console.log(`[${elapsed()}s] 🔍 Searching: "${parsed.query}"`);
            events.push({ type: "search", query: parsed.query, time: elapsed() });
          } else if (currentToolName === "web_fetch") {
            fetchCount++;
            console.log(`[${elapsed()}s] 🌐 Fetching: ${parsed.url}`);
            events.push({ type: "fetch", url: parsed.url, time: elapsed() });
          }
        } catch (e) {
          // partial json, skip
        }
        currentToolName = null;
        toolInputJson = "";
      }
      currentBlockType = null;
    }

    // message_stop — all done
    if (event.type === "message_stop") {
      console.log(`[${elapsed()}s] ✅ Complete!\n`);
      events.push({ type: "done", time: elapsed() });
    }
  });

  const finalMessage = await stream.finalMessage();

  // Print results
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 RESEARCH OUTPUT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(fullText);

  // Stats
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📈 STATS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Model: claude-sonnet-4-6`);
  console.log(`Input tokens: ${finalMessage.usage.input_tokens}`);
  console.log(`Output tokens: ${finalMessage.usage.output_tokens}`);
  console.log(`Web searches: ${searchCount}`);
  console.log(`Page fetches: ${fetchCount}`);
  console.log(`Total time: ${elapsed()}s`);
  console.log(`Stop reason: ${finalMessage.stop_reason}`);

  // Event timeline
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⏱️  EVENT TIMELINE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const e of events) {
    const icon = { search: "🔍", search_result: "✅", fetch: "🌐", synthesize: "🧠", done: "✅" }[
      e.type
    ];
    const detail = e.query ? `"${e.query}"` : e.url || "";
    console.log(`  ${e.time}s  ${icon} ${e.type} ${detail}`);
  }

  // Raw block types for debugging
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔧 RESPONSE BLOCKS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const block of finalMessage.content) {
    const extra = block.input?.query || block.input?.url || "";
    console.log(`  ${block.type}${block.name ? ` (${block.name})` : ""} ${extra}`);
  }
}

const idea =
  process.argv[2] || "An AI tool that helps startup founders validate their business ideas";
runResearch(idea).catch(console.error);
