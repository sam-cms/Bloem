/**
 * API utilities for Prebloom
 * 
 * Handles auth token injection for API requests.
 */

import { getAccessToken } from './supabase'

const API_BASE = ''

/**
 * Build headers with auth token if available
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = await getAccessToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

/**
 * Fetch with automatic auth headers
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = await getAuthHeaders()
  
  return fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  })
}

/**
 * POST JSON with auth
 */
export async function postJson<T>(url: string, body: T): Promise<Response> {
  return authFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * GET with auth
 */
export async function getJson(url: string): Promise<Response> {
  return authFetch(url, {
    method: 'GET',
  })
}
