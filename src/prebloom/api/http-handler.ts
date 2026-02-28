import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { z } from "zod";

import { loadConfig } from "../../config/config.js";
import { evaluateIdea, type EvaluationOptions } from "../swarm/orchestrator.js";
import {
  ideaInputSchema,
  iterationRequestSchema,
  type EvaluationJob,
  type Verdict,
} from "../types.js";
import { listSkills } from "../skills/index.js";
import { transcribeAudio, checkWhisperHealth } from "../audio/transcribe.js";
import { runMarketResearch } from "../groundwork/market-research.js";
import { runDeepResearch } from "../groundwork/deep-research.js";
import type { MarketResearchResult } from "../groundwork/types.js";
import * as storage from "../storage/adapter.js";
import { extractAuthContext, ensureUserProfile, type AuthContext } from "../auth/index.js";

// Maximum iterations allowed
const MAX_ITERATIONS = 3;

/**
 * Reconstruct a Verdict-like object from flattened evaluation data
 * Used for iteration context in the orchestrator
 */
function buildVerdictFromEvaluation(
  evaluation: NonNullable<Awaited<ReturnType<typeof storage.getEvaluation>>>,
): Verdict {
  return {
    id: evaluation.id,
    createdAt: evaluation.createdAt,
    input: (evaluation.inputData as any) || {},
    intake: { agent: "intake", analysis: evaluation.agentIntake || "" },
    catalyst: { agent: "catalyst", analysis: evaluation.agentCatalyst || "" },
    fire: { agent: "fire", analysis: evaluation.agentFire || "" },
    synthesis: { agent: "synthesis", analysis: evaluation.agentSynthesis || "" },
    decision: (evaluation.decision || "WEAK_SIGNAL") as Verdict["decision"],
    confidence: evaluation.confidence || 0,
    dimensions: {
      problemClarity: 0,
      marketSize: 0,
      competitionRisk: 0,
      execution: 0,
      businessModel: 0,
    },
    executiveSummary: evaluation.executiveSummary || "",
    keyStrengths: evaluation.keyStrengths || [],
    keyRisks: evaluation.keyRisks || [],
    nextSteps: evaluation.nextSteps || [],
    killConditions: evaluation.killConditions || [],
    version: evaluation.version,
    actionItems: evaluation.actionItems || [],
  };
}

// Research jobs stay in-memory (separate concern, short-lived)
const researchJobs = new Map<
  string,
  {
    id: string;
    status: "pending" | "processing" | "completed" | "failed";
    result?: MarketResearchResult;
    error?: string;
    createdAt: string;
    completedAt?: string;
  }
>();

// Research request schema
const researchRequestSchema = z.object({
  idea: z.string().min(10, "Idea must be at least 10 characters"),
  industry: z.string().optional(),
  researchType: z.enum(["quick", "deep"]).default("quick"),
});

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, status: number, error: string) {
  sendJson(res, status, { error });
}

async function readJsonBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf-8");
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

async function readRawBody(req: IncomingMessage, maxBytes = 25 * 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large (max 25MB)"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

/**
 * Handle Prebloom HTTP requests.
 *
 * Routes:
 * - POST /prebloom/evaluate — Submit idea for evaluation
 * - GET /prebloom/evaluate/:id — Get evaluation status/result
 * - GET /prebloom/health — Health check
 */
export async function handlePrebloomHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  // Parse URL
  const host = req.headers.host || "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);

  // Only handle /prebloom/* routes
  if (!url.pathname.startsWith("/prebloom")) {
    return false;
  }

  // Extract auth context (optional - doesn't block requests)
  const auth = await extractAuthContext(req);

  // Ensure user profile exists for authenticated users
  if (auth.isAuthenticated) {
    await ensureUserProfile(auth);
  }

  // Health check (no auth required)
  if (url.pathname === "/prebloom/health" && req.method === "GET") {
    const whisperHealthy = await checkWhisperHealth();
    const stats = await storage.getStats();
    sendJson(res, 200, {
      service: "prebloom",
      status: "healthy",
      storage: stats.storageMode,
      projects: stats.totalProjects,
      evaluations: stats.totalEvaluations,
      whisper: whisperHealthy ? "available" : "unavailable",
    });
    return true;
  }

  // GET /prebloom/skills — List available skills
  if (url.pathname === "/prebloom/skills" && req.method === "GET") {
    const skills = listSkills().map((s) => ({
      id: s.id,
      name: s.name,
      version: s.version,
      description: s.description,
    }));
    sendJson(res, 200, { skills });
    return true;
  }

  // GET /prebloom/me — Get current user info (requires auth)
  if (url.pathname === "/prebloom/me" && req.method === "GET") {
    if (!auth.isAuthenticated) {
      sendJson(res, 200, {
        authenticated: false,
        user: null,
      });
      return true;
    }

    sendJson(res, 200, {
      authenticated: true,
      user: {
        id: auth.userId,
        email: auth.email,
        name: auth.user?.user_metadata?.full_name || null,
        avatarUrl: auth.user?.user_metadata?.avatar_url || null,
      },
    });
    return true;
  }

  // GET /prebloom/my-projects — List user's projects (requires auth)
  if (url.pathname === "/prebloom/my-projects" && req.method === "GET") {
    if (!auth.isAuthenticated) {
      sendError(res, 401, "Authentication required");
      return true;
    }

    try {
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);

      const result = await storage.listProjects({
        userId: auth.userId!,
        limit,
        offset,
      });

      sendJson(res, 200, {
        projects: result.projects,
        total: result.total,
        limit,
        offset,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list projects";
      sendError(res, 500, message);
      return true;
    }
  }

  // POST /prebloom/transcribe — Transcribe audio to text
  if (url.pathname === "/prebloom/transcribe" && req.method === "POST") {
    try {
      const contentType = req.headers["content-type"] || "";

      // Validate content type
      if (!contentType.startsWith("audio/")) {
        sendError(res, 400, `Expected audio/* content type, got: ${contentType}`);
        return true;
      }

      // Check if whisper service is available
      const whisperHealthy = await checkWhisperHealth();
      if (!whisperHealthy) {
        sendError(res, 503, "Transcription service unavailable");
        return true;
      }

      // Read audio data
      const audioBuffer = await readRawBody(req);

      if (audioBuffer.length === 0) {
        sendError(res, 400, "Empty audio data");
        return true;
      }

      // Check for clean parameter (default: true)
      const clean = url.searchParams.get("clean") !== "false";

      // Transcribe
      const result = await transcribeAudio(audioBuffer, contentType, clean);

      sendJson(res, 200, {
        text: result.text,
        rawText: result.rawText,
        language: result.language,
        duration: result.duration,
        cleaned: result.cleaned,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transcription failed";
      sendError(res, 500, message);
      return true;
    }
  }

  // POST /prebloom/evaluate — Submit idea
  if (url.pathname === "/prebloom/evaluate" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);

      // Validate input
      const parseResult = ideaInputSchema.safeParse(body);
      if (!parseResult.success) {
        sendJson(res, 400, {
          error: "Invalid input",
          details: parseResult.error.issues,
        });
        return true;
      }

      const input = parseResult.data;

      // Extract skill options from body
      const rawBody = body as Record<string, unknown>;
      const options: EvaluationOptions = {
        humanize: rawBody.humanize === true,
        transcribe: rawBody.transcribe === true,
        skills: Array.isArray(rawBody.skills)
          ? rawBody.skills.filter((s): s is string => typeof s === "string")
          : undefined,
      };

      // Build raw idea text from structured input
      const rawIdea = `Problem: ${input.problem}\nSolution: ${input.solution}\nTarget Market: ${input.targetMarket}\nBusiness Model: ${input.businessModel}${input.whyYou ? `\nWhy You: ${input.whyYou}` : ""}`;

      // Create project and first evaluation in storage
      // Link to authenticated user if available
      const { projectId, evaluationId } = await storage.createProjectWithEvaluation({
        email: auth.email || input.email,
        rawIdea,
        summary: input.problem.slice(0, 100), // Use problem as initial summary
        userId: auth.userId || undefined,
      });

      // Mark as processing
      await storage.updateEvaluation(evaluationId, { status: "processing" });

      // Start evaluation async
      evaluateIdea(input, options)
        .then(async (verdict) => {
          await storage.updateEvaluation(evaluationId, {
            status: "completed",
            verdict,
          });
          // Update project overview with latest verdict info
          await storage.updateProjectOverview(projectId, {
            decision: verdict.decision,
            confidence: verdict.confidence,
            version: verdict.version,
            summary: verdict.executiveSummary?.slice(0, 200),
          });
        })
        .catch(async (error) => {
          await storage.updateEvaluation(evaluationId, {
            status: "failed",
            error: error.message,
          });
        });

      // Return evaluation ID immediately (async processing)
      sendJson(res, 202, {
        jobId: evaluationId,
        projectId,
        status: "processing",
        message: "Evaluation started. Poll /prebloom/evaluate/:id for results.",
      });
      return true;
    } catch (error) {
      sendError(res, 500, "Internal server error");
      return true;
    }
  }

  // GET /prebloom/evaluate/:id — Get result
  const evaluateMatch = url.pathname.match(/^\/prebloom\/evaluate\/([a-f0-9-]+)$/);
  if (evaluateMatch && req.method === "GET") {
    const evaluationId = evaluateMatch[1];
    const evaluation = await storage.getEvaluation(evaluationId);

    if (!evaluation) {
      sendError(res, 404, "Evaluation not found");
      return true;
    }

    if (evaluation.status === "completed") {
      sendJson(res, 200, {
        status: "completed",
        verdict: {
          decision: evaluation.decision,
          confidence: evaluation.confidence,
          executiveSummary: evaluation.executiveSummary,
          dimensions: evaluation.dimensions || null,
          keyStrengths: evaluation.keyStrengths || [],
          keyRisks: evaluation.keyRisks || [],
          nextSteps: evaluation.nextSteps || [],
          killConditions: evaluation.killConditions || [],
          actionItems: evaluation.actionItems || [],
          intake: { analysis: evaluation.agentIntake },
          catalyst: { analysis: evaluation.agentCatalyst },
          fire: { analysis: evaluation.agentFire },
          synthesis: { analysis: evaluation.agentSynthesis },
          straightTalk: evaluation.straightTalk || null,
        },
        projectId: evaluation.projectId,
        version: evaluation.version,
        metrics: evaluation.metrics || null,
      });
      return true;
    }

    if (evaluation.status === "failed") {
      sendJson(res, 200, {
        status: "failed",
        error: evaluation.error,
      });
      return true;
    }

    sendJson(res, 200, {
      status: evaluation.status,
      message: "Evaluation in progress...",
    });
    return true;
  }

  // POST /prebloom/iterate/:id — Submit iteration based on previous evaluation
  const iterateMatch = url.pathname.match(/^\/prebloom\/iterate\/([a-f0-9-]+)$/);
  if (iterateMatch && req.method === "POST") {
    const previousEvaluationId = iterateMatch[1];
    const previousEvaluation = await storage.getEvaluation(previousEvaluationId);

    // Check previous evaluation exists and is completed
    if (!previousEvaluation) {
      sendError(res, 404, "Previous evaluation not found");
      return true;
    }

    if (previousEvaluation.status !== "completed" || !previousEvaluation.decision) {
      sendError(res, 400, "Previous evaluation must be completed before iterating");
      return true;
    }

    // Build full Verdict object from flattened columns (for orchestrator)
    const previousVerdict = buildVerdictFromEvaluation(previousEvaluation);

    // Check iteration limit
    if (previousEvaluation.version >= MAX_ITERATIONS) {
      sendJson(res, 400, {
        error: "Iteration limit reached",
        message: `You've refined this idea ${MAX_ITERATIONS} times. Consider proceeding with the current assessment, starting fresh with a new idea, or pivoting to a related concept.`,
        version: previousEvaluation.version,
        maxIterations: MAX_ITERATIONS,
      });
      return true;
    }

    try {
      const body = await readJsonBody(req);

      // Validate iteration request
      const parseResult = iterationRequestSchema.safeParse(body);
      if (!parseResult.success) {
        sendJson(res, 400, {
          error: "Invalid iteration request",
          details: parseResult.error.issues,
        });
        return true;
      }

      const iterationRequest = parseResult.data;

      // For iterations, we use the previous evaluation's input as base
      // and merge any updates the user provided
      const previousInput = previousEvaluation.inputData || {};
      const updatedInput = {
        problem: iterationRequest.updatedPitch?.problem || previousInput.problem || "",
        solution: iterationRequest.updatedPitch?.solution || previousInput.solution || "",
        targetMarket:
          iterationRequest.updatedPitch?.targetMarket || previousInput.targetMarket || "",
        businessModel:
          iterationRequest.updatedPitch?.businessModel || previousInput.businessModel || "",
        whyYou: iterationRequest.updatedPitch?.whyYou || previousInput.whyYou || "",
        email: previousInput.email || "",
      };

      // Validate merged input
      const inputValidation = ideaInputSchema.safeParse(updatedInput);
      if (!inputValidation.success) {
        sendJson(res, 400, {
          error: "Invalid updated pitch",
          details: inputValidation.error.issues,
        });
        return true;
      }

      // Build raw idea text from updated input
      const validated = inputValidation.data;
      const rawIdea = `Problem: ${validated.problem}\nSolution: ${validated.solution}\nTarget Market: ${validated.targetMarket}\nBusiness Model: ${validated.businessModel}${validated.whyYou ? `\nWhy You: ${validated.whyYou}` : ""}`;

      // Convert responses array to Record<string, string> for storage
      const userResponsesRecord: Record<string, string> = {};
      for (const r of iterationRequest.responses) {
        userResponsesRecord[r.actionItemId] = r.response;
      }

      // Create new iteration in storage
      const { evaluationId, version } = await storage.createIteration(
        previousEvaluation.projectId,
        {
          rawIdea,
          userResponses: userResponsesRecord,
        },
      );

      // Mark as processing
      await storage.updateEvaluation(evaluationId, { status: "processing" });

      // Build evaluation options with iteration context
      const options: EvaluationOptions = {
        previousEvaluation: previousVerdict,
        userResponses: iterationRequest.responses,
      };

      // Start evaluation async
      evaluateIdea(inputValidation.data, options)
        .then(async (verdict) => {
          await storage.updateEvaluation(evaluationId, {
            status: "completed",
            verdict,
          });
          // Update project overview with latest verdict info
          await storage.updateProjectOverview(previousEvaluation.projectId, {
            decision: verdict.decision,
            confidence: verdict.confidence,
            version: verdict.version,
            summary: verdict.executiveSummary?.slice(0, 200),
          });
        })
        .catch(async (error) => {
          await storage.updateEvaluation(evaluationId, {
            status: "failed",
            error: error.message,
          });
        });

      // Return evaluation ID immediately
      sendJson(res, 202, {
        jobId: evaluationId,
        projectId: previousEvaluation.projectId,
        status: "processing",
        version,
        previousId: previousEvaluationId,
        message: `Iteration ${version} started. Poll /prebloom/evaluate/${evaluationId} for results.`,
      });
      return true;
    } catch (error) {
      sendError(res, 500, "Internal server error");
      return true;
    }
  }

  // GET /prebloom/history/:id — Get full version chain for a project
  // Accepts either evaluationId or projectId
  const historyMatch = url.pathname.match(/^\/prebloom\/history\/([a-f0-9-]+)$/);
  if (historyMatch && req.method === "GET") {
    const id = historyMatch[1];

    // Try to get evaluation first to find projectId
    const evaluation = await storage.getEvaluation(id);
    const projectId = evaluation?.projectId || id;

    // Get all versions for this project
    const versions = await storage.getProjectHistory(projectId);

    if (versions.length === 0) {
      sendError(res, 404, "Project not found");
      return true;
    }

    // Find the latest version
    const latestVersion = versions[versions.length - 1];

    sendJson(res, 200, {
      projectId,
      currentVersion: latestVersion.version,
      maxIterations: MAX_ITERATIONS,
      canIterate: latestVersion.version < MAX_ITERATIONS,
      versions,
    });
    return true;
  }

  // POST /prebloom/groundwork/research — Start market research (async)
  if (url.pathname === "/prebloom/groundwork/research" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const parseResult = researchRequestSchema.safeParse(body);

      if (!parseResult.success) {
        sendJson(res, 400, {
          error: "Invalid input",
          details: parseResult.error.issues,
        });
        return true;
      }

      const request = parseResult.data;
      const jobId = crypto.randomUUID();

      // Create job record
      const job = {
        id: jobId,
        status: "processing" as const,
        createdAt: new Date().toISOString(),
      };
      researchJobs.set(jobId, job);

      // Start research async - choose function based on type
      const researchFn = request.researchType === "deep" ? runDeepResearch : runMarketResearch;
      researchFn(request)
        .then((result) => {
          const job = researchJobs.get(jobId);
          if (job) {
            job.status = "completed";
            job.result = result;
            job.completedAt = new Date().toISOString();
          }
        })
        .catch((error) => {
          const job = researchJobs.get(jobId);
          if (job) {
            job.status = "failed";
            job.error = error.message;
            job.completedAt = new Date().toISOString();
          }
        });

      sendJson(res, 202, {
        jobId,
        status: "processing",
        message: "Research started. Poll /prebloom/groundwork/research/:id for results.",
      });
      return true;
    } catch (error) {
      sendError(res, 500, "Internal server error");
      return true;
    }
  }

  // GET /prebloom/groundwork/research/:id — Get research status/result
  const researchMatch = url.pathname.match(/^\/prebloom\/groundwork\/research\/([a-f0-9-]+)$/);
  if (researchMatch && req.method === "GET") {
    const jobId = researchMatch[1];
    const job = researchJobs.get(jobId);

    if (!job) {
      sendError(res, 404, "Research job not found");
      return true;
    }

    if (job.status === "completed") {
      sendJson(res, 200, {
        status: "completed",
        result: job.result,
      });
      return true;
    }

    if (job.status === "failed") {
      sendJson(res, 200, {
        status: "failed",
        error: job.error,
      });
      return true;
    }

    sendJson(res, 200, {
      status: job.status,
      message: "Research in progress...",
    });
    return true;
  }

  // POST /prebloom/groundwork/research/sync — Synchronous market research
  if (url.pathname === "/prebloom/groundwork/research/sync" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const parseResult = researchRequestSchema.safeParse(body);

      if (!parseResult.success) {
        sendJson(res, 400, {
          error: "Invalid input",
          details: parseResult.error.issues,
        });
        return true;
      }

      const request = parseResult.data;
      const researchFn = request.researchType === "deep" ? runDeepResearch : runMarketResearch;
      const result = await researchFn(request);

      sendJson(res, 200, {
        status: "completed",
        result,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research failed";
      sendError(res, 500, message);
      return true;
    }
  }

  // Unknown route
  sendError(res, 404, "Not found");
  return true;
}
