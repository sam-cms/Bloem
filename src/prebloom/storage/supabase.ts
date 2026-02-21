/**
 * Supabase storage for Prebloom evaluations
 * Production-ready persistent storage with auth support
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Verdict } from "../types.js";

// Types matching our schema
export interface Project {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  email: string | null;
  summary: string | null;
  latest_decision: string | null;
  latest_confidence: number | null;
  iteration_count: number;
}

export interface Evaluation {
  id: string;
  created_at: string;
  project_id: string;
  version: number;
  status: "pending" | "processing" | "completed" | "failed";

  // Input
  raw_idea: string | null;
  language: string | null;
  email: string | null;
  user_responses: Record<string, string> | null;

  // Verdict
  decision: string | null;
  confidence: number | null;
  executive_summary: string | null;

  // Scores
  score_problem_clarity: number | null;
  score_market_size: number | null;
  score_competition_risk: number | null;
  score_execution: number | null;
  score_business_model: number | null;

  // Lists
  key_strengths: string[] | null;
  key_risks: string[] | null;
  next_steps: string[] | null;
  kill_conditions: string[] | null;

  // Agents
  agent_intake: string | null;
  agent_catalyst: string | null;
  agent_fire: string | null;
  agent_synthesis: string | null;

  // Action Items
  action_items: any[] | null;

  // Structured input (for iterations)
  input_data: Record<string, any> | null;

  // Legacy (for backward compat during migration)
  verdict?: Verdict | null;
  error?: string | null;
}

// Combined view for API responses
export interface EvaluationWithProject extends Evaluation {
  project: Project;
}

let supabase: SupabaseClient | null = null;

/**
 * Get Supabase client (singleton)
 * Uses service role key for backend operations (bypasses RLS)
 * Falls back to anon key if service role not available
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  // Prefer service role key for backend (bypasses RLS)
  // Fall back to anon key for compatibility
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const key = serviceRoleKey || anonKey;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY environment variables",
    );
  }

  supabase = createClient(url, key);
  console.log(
    `[prebloom-storage] Supabase client initialized (${serviceRoleKey ? "service role" : "anon key"})`,
  );
  return supabase;
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
}): Promise<{ project: Project; evaluation: Evaluation }> {
  const client = getSupabaseClient();

  // Create project
  const { data: project, error: projectError } = await client
    .from("projects")
    .insert({
      email: data.email || null,
      summary: data.summary || null,
      user_id: data.userId || null,
    })
    .select()
    .single();

  if (projectError) {
    throw new Error(`Failed to create project: ${projectError.message}`);
  }

  // Create first evaluation
  const { data: evaluation, error: evalError } = await client
    .from("evaluations")
    .insert({
      project_id: project.id,
      version: 1,
      status: "pending",
      raw_idea: data.rawIdea || null,
      language: data.language || null,
    })
    .select()
    .single();

  if (evalError) {
    throw new Error(`Failed to create evaluation: ${evalError.message}`);
  }

  return { project, evaluation };
}

/**
 * Get evaluation by ID
 */
export async function getEvaluation(id: string): Promise<EvaluationWithProject | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("evaluations")
    .select(`
      *,
      project:projects(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw new Error(`Failed to get evaluation: ${error.message}`);
  }

  return data as EvaluationWithProject;
}

/**
 * Get all evaluations for a project (all versions)
 */
export async function getProjectEvaluations(projectId: string): Promise<Evaluation[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("evaluations")
    .select("*")
    .eq("project_id", projectId)
    .order("version", { ascending: true });

  if (error) {
    throw new Error(`Failed to get project evaluations: ${error.message}`);
  }

  return data || [];
}

/**
 * Update evaluation status and verdict
 * Now writes to individual columns instead of JSONB blob
 */
export async function updateEvaluation(
  id: string,
  updates: {
    status?: "pending" | "processing" | "completed" | "failed";
    verdict?: Verdict;
    error?: string;
  },
): Promise<void> {
  const client = getSupabaseClient();

  // Build update object with flattened columns
  const updateData: Record<string, any> = {};

  if (updates.status) {
    updateData.status = updates.status;
  }

  if (updates.error) {
    updateData.error = updates.error;
  }

  // Flatten verdict into individual columns
  if (updates.verdict) {
    const v = updates.verdict;

    // Verdict
    updateData.decision = v.decision;
    updateData.confidence = v.confidence;
    updateData.executive_summary = v.executiveSummary;

    // Scores
    if (v.dimensions) {
      updateData.score_problem_clarity = v.dimensions.problemClarity;
      updateData.score_market_size = v.dimensions.marketSize;
      updateData.score_competition_risk = v.dimensions.competitionRisk;
      updateData.score_execution = v.dimensions.execution;
      updateData.score_business_model = v.dimensions.businessModel;
    }

    // Lists
    updateData.key_strengths = v.keyStrengths || [];
    updateData.key_risks = v.keyRisks || [];
    updateData.next_steps = v.nextSteps || [];
    updateData.kill_conditions = v.killConditions || [];

    // Agents
    updateData.agent_intake = v.intake?.analysis || null;
    updateData.agent_catalyst = v.catalyst?.analysis || null;
    updateData.agent_fire = v.fire?.analysis || null;
    updateData.agent_synthesis = v.synthesis?.analysis || null;

    // Action Items (keep as JSONB)
    updateData.action_items = v.actionItems || [];

    // Store structured input for iterations
    if (v.input) {
      updateData.input_data = v.input;
    }
  }

  const { error } = await client.from("evaluations").update(updateData).eq("id", id);

  if (error) {
    throw new Error(`Failed to update evaluation: ${error.message}`);
  }
}

/**
 * Update project summary
 */
export async function updateProjectSummary(projectId: string, summary: string): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from("projects")
    .update({ summary, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) {
    throw new Error(`Failed to update project summary: ${error.message}`);
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
  const client = getSupabaseClient();

  const updateData: Record<string, any> = {
    latest_decision: data.decision,
    latest_confidence: data.confidence,
    iteration_count: data.version,
    updated_at: new Date().toISOString(),
  };

  if (data.summary) {
    updateData.summary = data.summary;
  }

  const { error } = await client.from("projects").update(updateData).eq("id", projectId);

  if (error) {
    throw new Error(`Failed to update project overview: ${error.message}`);
  }
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
): Promise<Evaluation> {
  const client = getSupabaseClient();

  // Get current max version
  const { data: existing } = await client
    .from("evaluations")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (existing?.version || 0) + 1;

  const { data: evaluation, error } = await client
    .from("evaluations")
    .insert({
      project_id: projectId,
      version: nextVersion,
      status: "pending",
      raw_idea: data.rawIdea || null,
      language: data.language || null,
      user_responses: data.userResponses || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create iteration: ${error.message}`);
  }

  return evaluation;
}

/**
 * List projects for a user (by email for now, user_id when auth is added)
 */
export async function listProjects(options: {
  email?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ projects: Project[]; total: number }> {
  const client = getSupabaseClient();
  const limit = options.limit || 20;
  const offset = options.offset || 0;

  let query = client.from("projects").select("*", { count: "exact" });

  if (options.email) {
    query = query.eq("email", options.email);
  }
  if (options.userId) {
    query = query.eq("user_id", options.userId);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list projects: ${error.message}`);
  }

  return { projects: data || [], total: count || 0 };
}

/**
 * Get project with latest evaluation
 */
export async function getProjectWithLatestEvaluation(
  projectId: string,
): Promise<{ project: Project; evaluation: Evaluation } | null> {
  const client = getSupabaseClient();

  const { data: project, error: projectError } = await client
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError) {
    if (projectError.code === "PGRST116") return null;
    throw new Error(`Failed to get project: ${projectError.message}`);
  }

  const { data: evaluation, error: evalError } = await client
    .from("evaluations")
    .select("*")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (evalError) {
    throw new Error(`Failed to get latest evaluation: ${evalError.message}`);
  }

  return { project, evaluation };
}

/**
 * Get statistics
 */
export async function getStats(): Promise<{
  totalProjects: number;
  totalEvaluations: number;
  completedEvaluations: number;
  byDecision: Record<string, number>;
}> {
  const client = getSupabaseClient();

  const { count: totalProjects } = await client
    .from("projects")
    .select("*", { count: "exact", head: true });

  const { count: totalEvaluations } = await client
    .from("evaluations")
    .select("*", { count: "exact", head: true });

  const { count: completedEvaluations } = await client
    .from("evaluations")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed");

  // Count by decision using the new column
  const byDecision: Record<string, number> = {
    STRONG_SIGNAL: 0,
    CONDITIONAL_FIT: 0,
    WEAK_SIGNAL: 0,
    NO_MARKET_FIT: 0,
  };

  // Query each decision type
  for (const decision of Object.keys(byDecision)) {
    const { count } = await client
      .from("evaluations")
      .select("*", { count: "exact", head: true })
      .eq("decision", decision);
    byDecision[decision] = count || 0;
  }

  return {
    totalProjects: totalProjects || 0,
    totalEvaluations: totalEvaluations || 0,
    completedEvaluations: completedEvaluations || 0,
    byDecision,
  };
}

/**
 * Delete a project and all its evaluations
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  const client = getSupabaseClient();

  const { error } = await client.from("projects").delete().eq("id", projectId);

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }

  return true;
}
