/**
 * Storage Adapter for Prebloom
 *
 * Uses Supabase when configured, falls back to in-memory for local dev.
 * Provides a unified interface for both backends.
 */

import type { Verdict, IdeaInput } from "../types.js";
import * as supabase from "./supabase.js";

// In-memory fallback storage
interface InMemoryProject {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  email: string | null;
  summary: string | null;
}

interface InMemoryEvaluation {
  id: string;
  created_at: string;
  project_id: string;
  version: number;
  status: "pending" | "processing" | "completed" | "failed";
  raw_idea: string | null;
  language: string | null;
  user_responses: Record<string, string> | null;
  verdict: Verdict | null;
  error: string | null;
}

const inMemoryProjects = new Map<string, InMemoryProject>();
const inMemoryEvaluations = new Map<string, InMemoryEvaluation>();

/**
 * Check if Supabase is configured
 * Accepts either service role key (preferred for backend) or anon key
 */
export function isSupabaseConfigured(): boolean {
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  return hasUrl && hasKey;
}

/**
 * Generate a UUID
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Create a new project with its first evaluation
 */
export async function createProjectWithEvaluation(data: {
  email?: string;
  summary?: string;
  rawIdea?: string;
  language?: string;
  userId?: string;
}): Promise<{ projectId: string; evaluationId: string }> {
  if (isSupabaseConfigured()) {
    const result = await supabase.createProjectWithEvaluation(data);
    return {
      projectId: result.project.id,
      evaluationId: result.evaluation.id,
    };
  }

  // In-memory fallback
  const projectId = generateId();
  const evaluationId = generateId();
  const now = new Date().toISOString();

  const project: InMemoryProject = {
    id: projectId,
    created_at: now,
    updated_at: now,
    user_id: data.userId || null,
    email: data.email || null,
    summary: data.summary || null,
  };

  const evaluation: InMemoryEvaluation = {
    id: evaluationId,
    created_at: now,
    project_id: projectId,
    version: 1,
    status: "pending",
    raw_idea: data.rawIdea || null,
    language: data.language || null,
    user_responses: null,
    verdict: null,
    error: null,
  };

  inMemoryProjects.set(projectId, project);
  inMemoryEvaluations.set(evaluationId, evaluation);

  return { projectId, evaluationId };
}

/**
 * Get evaluation by ID
 */
export async function getEvaluation(id: string): Promise<{
  id: string;
  projectId: string;
  version: number;
  status: "pending" | "processing" | "completed" | "failed";
  ideaTitle: string | null;
  rawIdea: string | null;
  decision: string | null;
  confidence: number | null;
  executiveSummary: string | null;
  keyStrengths: string[] | null;
  keyRisks: string[] | null;
  nextSteps: string[] | null;
  killConditions: string[] | null;
  agentIntake: string | null;
  agentCatalyst: string | null;
  agentFire: string | null;
  agentSynthesis: string | null;
  actionItems: any[] | null;
  dimensions: {
    problemClarity: number;
    marketSize: number;
    competitionRisk: number;
    execution: number;
    businessModel: number;
  } | null;
  inputData: Record<string, any> | null;
  error: string | null;
  createdAt: string;
} | null> {
  if (isSupabaseConfigured()) {
    const result = await supabase.getEvaluation(id);
    if (!result) return null;
    return {
      id: result.id,
      projectId: result.project_id,
      version: result.version,
      status: result.status,
      ideaTitle: result.idea_title,
      rawIdea: result.raw_idea,
      decision: result.decision,
      confidence: result.confidence,
      executiveSummary: result.executive_summary,
      keyStrengths: result.key_strengths,
      keyRisks: result.key_risks,
      nextSteps: result.next_steps,
      killConditions: result.kill_conditions,
      agentIntake: result.agent_intake,
      agentCatalyst: result.agent_catalyst,
      agentFire: result.agent_fire,
      agentSynthesis: result.agent_synthesis,
      actionItems: result.action_items,
      dimensions:
        result.score_problem_clarity != null
          ? {
              problemClarity: result.score_problem_clarity || 5,
              marketSize: result.score_market_size || 5,
              competitionRisk: result.score_competition_risk || 5,
              execution: result.score_execution || 5,
              businessModel: result.score_business_model || 5,
            }
          : null,
      inputData: result.input_data,
      error: result.error || null,
      createdAt: result.created_at,
    };
  }

  // In-memory fallback
  const evaluation = inMemoryEvaluations.get(id);
  if (!evaluation) return null;

  return {
    id: evaluation.id,
    projectId: evaluation.project_id,
    version: evaluation.version,
    status: evaluation.status,
    ideaTitle: evaluation.verdict?.input?.problem?.slice(0, 60) || null,
    rawIdea: evaluation.raw_idea,
    decision: evaluation.verdict?.decision || null,
    confidence: evaluation.verdict?.confidence || null,
    executiveSummary: evaluation.verdict?.executiveSummary || null,
    keyStrengths: evaluation.verdict?.keyStrengths || null,
    keyRisks: evaluation.verdict?.keyRisks || null,
    nextSteps: evaluation.verdict?.nextSteps || null,
    killConditions: evaluation.verdict?.killConditions || null,
    agentIntake: evaluation.verdict?.intake?.analysis || null,
    agentCatalyst: evaluation.verdict?.catalyst?.analysis || null,
    agentFire: evaluation.verdict?.fire?.analysis || null,
    agentSynthesis: evaluation.verdict?.synthesis?.analysis || null,
    dimensions: evaluation.verdict?.dimensions || null,
    actionItems: evaluation.verdict?.actionItems || null,
    inputData: evaluation.verdict?.input || null,
    error: evaluation.error,
    createdAt: evaluation.created_at,
  };
}

/**
 * Update evaluation status and verdict
 */
export async function updateEvaluation(
  id: string,
  updates: {
    status?: "pending" | "processing" | "completed" | "failed";
    verdict?: Verdict;
    error?: string;
  },
): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.updateEvaluation(id, updates);
    return;
  }

  // In-memory fallback
  const evaluation = inMemoryEvaluations.get(id);
  if (evaluation) {
    if (updates.status) evaluation.status = updates.status;
    if (updates.verdict) evaluation.verdict = updates.verdict;
    if (updates.error) evaluation.error = updates.error;
  }
}

/**
 * Update project summary (auto-generated from first evaluation)
 */
export async function updateProjectSummary(projectId: string, summary: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.updateProjectSummary(projectId, summary);
    return;
  }

  // In-memory fallback
  const project = inMemoryProjects.get(projectId);
  if (project) {
    project.summary = summary;
    project.updated_at = new Date().toISOString();
  }
}

/**
 * Update project with latest evaluation overview
 * Called when an evaluation completes
 */
export async function updateProjectOverview(
  projectId: string,
  data: {
    decision: string;
    confidence: number;
    version: number;
    summary?: string;
  },
): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.updateProjectOverview(projectId, data);
    return;
  }

  // In-memory fallback - no-op for now
}

/**
 * Create a new iteration (new version of an evaluation)
 */
export async function createIteration(
  projectId: string,
  data: {
    rawIdea?: string;
    language?: string;
    userResponses?: Record<string, string>;
  },
): Promise<{ evaluationId: string; version: number }> {
  if (isSupabaseConfigured()) {
    const result = await supabase.createIteration(projectId, data);
    return {
      evaluationId: result.id,
      version: result.version,
    };
  }

  // In-memory fallback: find max version for this project
  let maxVersion = 0;
  for (const eval_ of inMemoryEvaluations.values()) {
    if (eval_.project_id === projectId && eval_.version > maxVersion) {
      maxVersion = eval_.version;
    }
  }

  const evaluationId = generateId();
  const evaluation: InMemoryEvaluation = {
    id: evaluationId,
    created_at: new Date().toISOString(),
    project_id: projectId,
    version: maxVersion + 1,
    status: "pending",
    raw_idea: data.rawIdea || null,
    language: data.language || null,
    user_responses: data.userResponses || null,
    verdict: null,
    error: null,
  };

  inMemoryEvaluations.set(evaluationId, evaluation);

  return { evaluationId, version: maxVersion + 1 };
}

/**
 * Get all evaluations for a project (version history)
 */
export async function getProjectHistory(projectId: string): Promise<
  Array<{
    id: string;
    version: number;
    status: string;
    decision: string | null;
    confidence: number | null;
    createdAt: string;
  }>
> {
  if (isSupabaseConfigured()) {
    const evaluations = await supabase.getProjectEvaluations(projectId);
    return evaluations.map((e) => ({
      id: e.id,
      version: e.version,
      status: e.status,
      decision: e.decision || null,
      confidence: e.confidence || null,
      createdAt: e.created_at,
    }));
  }

  // In-memory fallback
  const versions: Array<{
    id: string;
    version: number;
    status: string;
    decision: string | null;
    confidence: number | null;
    createdAt: string;
  }> = [];

  for (const eval_ of inMemoryEvaluations.values()) {
    if (eval_.project_id === projectId) {
      versions.push({
        id: eval_.id,
        version: eval_.version,
        status: eval_.status,
        decision: eval_.verdict?.decision || null,
        confidence: eval_.verdict?.confidence || null,
        createdAt: eval_.created_at,
      });
    }
  }

  return versions.sort((a, b) => a.version - b.version);
}

/**
 * List projects for a user
 */
export async function listProjects(options: {
  email?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  projects: Array<{
    id: string;
    summary: string | null;
    email: string | null;
    createdAt: string;
    latestVersion: number;
    latestDecision: string | null;
  }>;
  total: number;
}> {
  if (isSupabaseConfigured()) {
    const result = await supabase.listProjects(options);

    // Get latest evaluation for each project
    const projectsWithLatest = await Promise.all(
      result.projects.map(async (p) => {
        const latest = await supabase.getProjectWithLatestEvaluation(p.id);
        return {
          id: p.id,
          summary: p.summary,
          email: p.email,
          createdAt: p.created_at,
          latestVersion: latest?.evaluation?.version || 1,
          latestDecision: latest?.evaluation?.decision || null,
        };
      }),
    );

    return { projects: projectsWithLatest, total: result.total };
  }

  // In-memory fallback
  const limit = options.limit || 20;
  const offset = options.offset || 0;

  let filtered = Array.from(inMemoryProjects.values());

  if (options.email) {
    filtered = filtered.filter((p) => p.email === options.email);
  }
  if (options.userId) {
    filtered = filtered.filter((p) => p.user_id === options.userId);
  }

  const total = filtered.length;
  const paginated = filtered
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(offset, offset + limit);

  const projects = paginated.map((p) => {
    // Find latest evaluation
    let latestVersion = 0;
    let latestDecision: string | null = null;

    for (const eval_ of inMemoryEvaluations.values()) {
      if (eval_.project_id === p.id && eval_.version > latestVersion) {
        latestVersion = eval_.version;
        latestDecision = eval_.verdict?.decision || null;
      }
    }

    return {
      id: p.id,
      summary: p.summary,
      email: p.email,
      createdAt: p.created_at,
      latestVersion: latestVersion || 1,
      latestDecision,
    };
  });

  return { projects, total };
}

/**
 * Get storage stats
 */
export async function getStats(): Promise<{
  totalProjects: number;
  totalEvaluations: number;
  completedEvaluations: number;
  storageMode: "supabase" | "in-memory";
}> {
  if (isSupabaseConfigured()) {
    const stats = await supabase.getStats();
    return {
      ...stats,
      storageMode: "supabase",
    };
  }

  // In-memory fallback
  let completed = 0;
  for (const eval_ of inMemoryEvaluations.values()) {
    if (eval_.status === "completed") completed++;
  }

  return {
    totalProjects: inMemoryProjects.size,
    totalEvaluations: inMemoryEvaluations.size,
    completedEvaluations: completed,
    storageMode: "in-memory",
  };
}
