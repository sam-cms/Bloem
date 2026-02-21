/**
 * Prebloom Storage Module
 *
 * Uses Supabase for production, in-memory for local dev without Supabase.
 * Exports unified interface via adapter.
 */

// Re-export adapter functions (handles Supabase vs in-memory automatically)
export * from "./adapter.js";

// Also export raw Supabase functions for direct use if needed
export * as supabase from "./supabase.js";
