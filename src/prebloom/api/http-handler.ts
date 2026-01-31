import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";

import { loadConfig } from "../../config/config.js";
import { evaluateIdea, type EvaluationOptions } from "../swarm/orchestrator.js";
import { ideaInputSchema, type EvaluationJob } from "../types.js";
import { listSkills } from "../skills/index.js";

// In-memory job store (replace with persistent storage in production)
const jobs = new Map<string, EvaluationJob>();

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
    sendJson(res, 200, {
      service: "prebloom",
      status: "healthy",
      jobsInMemory: jobs.size,
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

  // Unknown route
  sendError(res, 404, "Not found");
  return true;
}
