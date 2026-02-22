/**
 * Prebloom Auth Middleware
 *
 * Validates JWT tokens from Supabase Auth.
 * Extracts user info and adds to request context.
 */

import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import type { IncomingMessage } from "node:http";

// Cached Supabase client for JWT validation
let supabaseAdmin: SupabaseClient | null = null;

/**
 * Get or create Supabase admin client
 */
function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn("[prebloom-auth] Supabase not configured, auth disabled");
    return null;
  }

  supabaseAdmin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
}

/**
 * Auth context attached to requests
 */
export interface AuthContext {
  user: User | null;
  userId: string | null;
  email: string | null;
  isAuthenticated: boolean;
}

/**
 * Extract auth context from request
 *
 * Checks for Bearer token in Authorization header.
 * Validates token with Supabase and extracts user info.
 *
 * Returns unauthenticated context if no token or invalid token.
 * Does NOT reject requests - auth is optional for most routes.
 */
export async function extractAuthContext(req: IncomingMessage): Promise<AuthContext> {
  const unauthenticated: AuthContext = {
    user: null,
    userId: null,
    email: null,
    isAuthenticated: false,
  };

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return unauthenticated;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix
  if (!token) {
    return unauthenticated;
  }

  // Get Supabase client
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return unauthenticated;
  }

  try {
    // Validate token and get user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.debug("[prebloom-auth] Invalid token:", error?.message);
      return unauthenticated;
    }

    return {
      user,
      userId: user.id,
      email: user.email || null,
      isAuthenticated: true,
    };
  } catch (err) {
    console.error("[prebloom-auth] Token validation error:", err);
    return unauthenticated;
  }
}

/**
 * Ensure user profile exists in our database
 *
 * Called on first authenticated request to create user profile.
 * Idempotent - safe to call multiple times.
 */
export async function ensureUserProfile(auth: AuthContext): Promise<void> {
  if (!auth.isAuthenticated || !auth.userId) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    // Check if profile exists
    const { data: existing } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", auth.userId)
      .single();

    if (existing) return; // Profile exists

    // Create profile
    const { error } = await supabase.from("user_profiles").insert({
      id: auth.userId,
      email: auth.email,
      full_name: auth.user?.user_metadata?.full_name || null,
      avatar_url: auth.user?.user_metadata?.avatar_url || null,
    });

    if (error && error.code !== "23505") {
      // 23505 = unique violation (race condition, profile exists)
      console.error("[prebloom-auth] Failed to create profile:", error.message);
    } else {
      console.log("[prebloom-auth] Created profile for:", auth.email);
    }
  } catch (err) {
    console.error("[prebloom-auth] Profile creation error:", err);
  }
}
