/**
 * SQLite storage for Prebloom evaluations
 * Provides persistent history and job storage
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Verdict } from "../types.js";

export interface StoredEvaluation {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "pending" | "processing" | "completed" | "failed";
  rawIdea: string;
  problem?: string;
  solution?: string;
  targetMarket?: string;
  businessModel?: string;
  email?: string;
  language?: string;
  verdict?: Verdict;
  error?: string;
}

let db: Database.Database | null = null;

/**
 * Get the database path
 */
function getDbPath(): string {
  const dataDir = process.env.PREBLOOM_DATA_DIR || "/tmp/prebloom";
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, "evaluations.db");
}

/**
 * Initialize the database connection and schema
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  console.log(`[prebloom-storage] Initializing SQLite at ${dbPath}`);

  db = new Database(dbPath);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending',
      raw_idea TEXT,
      problem TEXT,
      solution TEXT,
      target_market TEXT,
      business_model TEXT,
      email TEXT,
      language TEXT,
      verdict_json TEXT,
      error TEXT
    )
  `);

  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evaluations_created ON evaluations(created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evaluations_email ON evaluations(email)`);

  console.log(`[prebloom-storage] Database initialized`);
  return db;
}

/**
 * Save a new evaluation
 */
export function createEvaluation(data: {
  id: string;
  rawIdea?: string;
  problem?: string;
  solution?: string;
  targetMarket?: string;
  businessModel?: string;
  email?: string;
  language?: string;
}): StoredEvaluation {
  const database = initDatabase();

  const stmt = database.prepare(
    `INSERT INTO evaluations (id, raw_idea, problem, solution, target_market, business_model, email, language)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  stmt.run(
    data.id,
    data.rawIdea || null,
    data.problem || null,
    data.solution || null,
    data.targetMarket || null,
    data.businessModel || null,
    data.email || null,
    data.language || null,
  );

  return getEvaluation(data.id)!;
}

/**
 * Get an evaluation by ID
 */
export function getEvaluation(id: string): StoredEvaluation | null {
  const database = initDatabase();

  const stmt = database.prepare(
    `SELECT id, created_at, updated_at, status, raw_idea, problem, solution, 
            target_market, business_model, email, language, verdict_json, error
     FROM evaluations WHERE id = ?`,
  );

  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    rawIdea: row.raw_idea,
    problem: row.problem,
    solution: row.solution,
    targetMarket: row.target_market,
    businessModel: row.business_model,
    email: row.email,
    language: row.language,
    verdict: row.verdict_json ? JSON.parse(row.verdict_json) : undefined,
    error: row.error,
  };
}

/**
 * Update evaluation status
 */
export function updateEvaluationStatus(
  id: string,
  status: "pending" | "processing" | "completed" | "failed",
  verdict?: Verdict,
  error?: string,
): void {
  const database = initDatabase();

  const stmt = database.prepare(
    `UPDATE evaluations 
     SET status = ?, verdict_json = ?, error = ?, updated_at = datetime('now')
     WHERE id = ?`,
  );

  stmt.run(status, verdict ? JSON.stringify(verdict) : null, error || null, id);
}

/**
 * List evaluations with pagination
 */
export function listEvaluations(options: {
  limit?: number;
  offset?: number;
  email?: string;
  status?: string;
}): { evaluations: StoredEvaluation[]; total: number } {
  const database = initDatabase();

  const limit = options.limit || 20;
  const offset = options.offset || 0;

  let whereClause = "1=1";
  const params: any[] = [];

  if (options.email) {
    whereClause += " AND email = ?";
    params.push(options.email);
  }

  if (options.status) {
    whereClause += " AND status = ?";
    params.push(options.status);
  }

  // Get total count
  const countStmt = database.prepare(
    `SELECT COUNT(*) as count FROM evaluations WHERE ${whereClause}`,
  );
  const countResult = countStmt.get(...params) as { count: number };

  // Get paginated results
  const listStmt = database.prepare(
    `SELECT id, created_at, updated_at, status, raw_idea, problem, solution, 
            target_market, business_model, email, language, verdict_json, error
     FROM evaluations 
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
  );

  const rows = listStmt.all(...params, limit, offset) as any[];

  const evaluations = rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    rawIdea: row.raw_idea,
    problem: row.problem,
    solution: row.solution,
    targetMarket: row.target_market,
    businessModel: row.business_model,
    email: row.email,
    language: row.language,
    verdict: row.verdict_json ? JSON.parse(row.verdict_json) : undefined,
    error: row.error,
  }));

  return { evaluations, total: countResult.count };
}

/**
 * Delete an evaluation
 */
export function deleteEvaluation(id: string): boolean {
  const database = initDatabase();
  const stmt = database.prepare(`DELETE FROM evaluations WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Get statistics
 */
export function getStats(): {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  byDecision: Record<string, number>;
} {
  const database = initDatabase();

  const total = (
    database.prepare(`SELECT COUNT(*) as count FROM evaluations`).get() as { count: number }
  ).count;
  const completed = (
    database
      .prepare(`SELECT COUNT(*) as count FROM evaluations WHERE status = 'completed'`)
      .get() as { count: number }
  ).count;
  const pending = (
    database
      .prepare(
        `SELECT COUNT(*) as count FROM evaluations WHERE status IN ('pending', 'processing')`,
      )
      .get() as {
      count: number;
    }
  ).count;
  const failed = (
    database.prepare(`SELECT COUNT(*) as count FROM evaluations WHERE status = 'failed'`).get() as {
      count: number;
    }
  ).count;

  // Count by decision
  const byDecision: Record<string, number> = {
    STRONG_SIGNAL: 0,
    CONDITIONAL_FIT: 0,
    WEAK_SIGNAL: 0,
    NO_MARKET_FIT: 0,
  };
  const decisions = database
    .prepare(
      `SELECT json_extract(verdict_json, '$.decision') as decision, COUNT(*) as count 
       FROM evaluations 
       WHERE status = 'completed' AND verdict_json IS NOT NULL
       GROUP BY decision`,
    )
    .all() as { decision: string; count: number }[];

  for (const d of decisions) {
    if (d.decision) byDecision[d.decision] = d.count;
  }

  return { total, completed, pending, failed, byDecision };
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
