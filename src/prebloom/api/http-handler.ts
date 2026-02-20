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

// Maximum iterations allowed
const MAX_ITERATIONS = 3;

// In-memory job store (replace with persistent storage in production)
const jobs = new Map<string, EvaluationJob>();
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

  // Health check (no auth required for now)
  if (url.pathname === "/prebloom/health" && req.method === "GET") {
    const whisperHealthy = await checkWhisperHealth();
    sendJson(res, 200, {
      service: "prebloom",
      status: "healthy",
      jobsInMemory: jobs.size,
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
      const jobId = crypto.randomUUID();

      // Extract skill options from body
      const rawBody = body as Record<string, unknown>;
      const options: EvaluationOptions = {
        humanize: rawBody.humanize === true,
        transcribe: rawBody.transcribe === true,
        skills: Array.isArray(rawBody.skills)
          ? rawBody.skills.filter((s): s is string => typeof s === "string")
          : undefined,
      };

      // Create job record
      const job: EvaluationJob = {
        id: jobId,
        status: "pending",
        input,
        createdAt: new Date().toISOString(),
      };
      jobs.set(jobId, job);

      // Start evaluation async
      job.status = "processing";

      evaluateIdea(input, options)
        .then((verdict) => {
          job.status = "completed";
          job.verdict = verdict;
          job.completedAt = new Date().toISOString();
        })
        .catch((error) => {
          job.status = "failed";
          job.error = error.message;
          job.completedAt = new Date().toISOString();
        });

      // Return job ID immediately (async processing)
      sendJson(res, 202, {
        jobId,
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
    const jobId = evaluateMatch[1];
    const job = jobs.get(jobId);

    if (!job) {
      sendError(res, 404, "Job not found");
      return true;
    }

    if (job.status === "completed") {
      sendJson(res, 200, {
        status: "completed",
        verdict: job.verdict,
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
      message: "Evaluation in progress...",
    });
    return true;
  }

  // POST /prebloom/iterate/:id — Submit iteration based on previous evaluation
  const iterateMatch = url.pathname.match(/^\/prebloom\/iterate\/([a-f0-9-]+)$/);
  if (iterateMatch && req.method === "POST") {
    const previousJobId = iterateMatch[1];
    const previousJob = jobs.get(previousJobId);

    // Check previous job exists and is completed
    if (!previousJob) {
      sendError(res, 404, "Previous evaluation not found");
      return true;
    }

    if (previousJob.status !== "completed" || !previousJob.verdict) {
      sendError(res, 400, "Previous evaluation must be completed before iterating");
      return true;
    }

    const previousVerdict = previousJob.verdict;

    // Check iteration limit
    if (previousVerdict.version >= MAX_ITERATIONS) {
      sendJson(res, 400, {
        error: "Iteration limit reached",
        message: `You've refined this idea ${MAX_ITERATIONS} times. Consider proceeding with the current assessment, starting fresh with a new idea, or pivoting to a related concept.`,
        version: previousVerdict.version,
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
      const jobId = crypto.randomUUID();

      // Build updated input (merge original with any updates)
      const updatedInput = {
        ...previousJob.input,
        ...iterationRequest.updatedPitch,
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

      // Create job record
      const job: EvaluationJob = {
        id: jobId,
        status: "processing",
        input: inputValidation.data,
        createdAt: new Date().toISOString(),
      };
      jobs.set(jobId, job);

      // Build evaluation options with iteration context
      const options: EvaluationOptions = {
        previousEvaluation: previousVerdict,
        userResponses: iterationRequest.responses,
      };

      // Start evaluation async
      evaluateIdea(inputValidation.data, options)
        .then((verdict) => {
          job.status = "completed";
          job.verdict = verdict;
          job.completedAt = new Date().toISOString();
        })
        .catch((error) => {
          job.status = "failed";
          job.error = error.message;
          job.completedAt = new Date().toISOString();
        });

      // Return job ID immediately
      sendJson(res, 202, {
        jobId,
        status: "processing",
        version: previousVerdict.version + 1,
        previousId: previousJobId,
        message: `Iteration ${previousVerdict.version + 1} started. Poll /prebloom/evaluate/${jobId} for results.`,
      });
      return true;
    } catch (error) {
      sendError(res, 500, "Internal server error");
      return true;
    }
  }

  // GET /prebloom/history/:id — Get full version chain for an evaluation
  const historyMatch = url.pathname.match(/^\/prebloom\/history\/([a-f0-9-]+)$/);
  if (historyMatch && req.method === "GET") {
    const jobId = historyMatch[1];
    const job = jobs.get(jobId);

    if (!job || !job.verdict) {
      sendError(res, 404, "Evaluation not found");
      return true;
    }

    // Build version chain by walking backwards
    const versions: { id: string; version: number; decision: string; confidence: number }[] = [];
    let current: EvaluationJob | undefined = job;

    while (current && current.verdict) {
      versions.unshift({
        id: current.id,
        version: current.verdict.version,
        decision: current.verdict.decision,
        confidence: current.verdict.confidence,
      });

      // Find previous version if exists
      if (current.verdict.previousId) {
        current = jobs.get(current.verdict.previousId);
      } else {
        break;
      }
    }

    sendJson(res, 200, {
      currentId: jobId,
      currentVersion: job.verdict.version,
      maxIterations: MAX_ITERATIONS,
      canIterate: job.verdict.version < MAX_ITERATIONS,
      versions,
      actionItems: job.verdict.actionItems,
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
