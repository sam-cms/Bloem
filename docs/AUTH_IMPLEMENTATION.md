# Prebloom Authentication Implementation

**Date:** 2026-02-23  
**Based on:** BMAD Feature Brief (2026-02-22)

## Overview

Frictionless authentication for Prebloom using Supabase Auth with Google OAuth primary and Magic Link fallback. Auth happens AFTER value delivery ("Save this analysis?"), not before.

## What Was Built

### Frontend Components

| File | Purpose |
|------|---------|
| `frontend/src/lib/supabase.ts` | Supabase client singleton, auth helpers |
| `frontend/src/lib/api.ts` | Fetch utilities with auto auth headers |
| `frontend/src/contexts/AuthContext.tsx` | React context for auth state |
| `frontend/src/components/Auth/LoginModal.tsx` | "Save to garden" modal |
| `frontend/src/components/Auth/UserMenu.tsx` | User avatar dropdown |
| `frontend/src/vite-env.d.ts` | Vite env types |

### Backend Components

| File | Purpose |
|------|---------|
| `src/prebloom/auth/middleware.ts` | JWT validation, user extraction |
| `src/prebloom/auth/index.ts` | Module exports |
| `src/prebloom/api/http-handler.ts` | Updated with auth context |

### Database Migration

| File | Purpose |
|------|---------|
| `src/prebloom/migrations/002_auth_and_rls.sql` | user_profiles table, RLS policies |

### New API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/prebloom/me` | GET | Optional | Get current user info |
| `/prebloom/my-projects` | GET | Required | List user's projects |

## Setup Required (Manual Steps)

### 1. Supabase Dashboard

1. Go to Authentication → Providers
2. Enable **Email** (for magic links)
3. Enable **Google** OAuth

### 2. Google Cloud Console

1. Create OAuth 2.0 Client ID
2. Add authorized redirect URI: `https://nyxtykazcgdlyckjijtv.supabase.co/auth/v1/callback`
3. Copy Client ID and Secret to Supabase Google provider settings

### 3. Apply Database Migration

1. Go to Supabase Dashboard → SQL Editor
2. Paste contents of `src/prebloom/migrations/002_auth_and_rls.sql`
3. Run the migration

## Auth Flow

```
User visits Prebloom
        │
        ▼
    [Submit idea]
        │
        ▼
   Analysis runs
   (anonymous OK)
        │
        ▼
    Report shown
        │
        ▼
┌───────────────────────┐
│ 🌱 Save to garden?    │  ← LoginModal appears after 2s
│                       │
│ [Google] [Email]      │
└───────────────────────┘
        │
        ▼
   Auth completes
        │
        ▼
  Project linked to user
```

## Key Design Decisions

1. **Post-value auth** — Users get analysis first, auth prompt after
2. **Optional auth** — Anonymous evaluations still work
3. **No passwords** — Google OAuth or magic links only
4. **Gradual claim** — Anonymous projects can be claimed later

## Security

- JWTs validated via Supabase `auth.getUser()`
- Backend uses service_role key (bypasses RLS)
- Frontend uses anon key (subject to RLS)
- All auth tokens sent as `Bearer` in Authorization header
- Rate limiting: Supabase handles this for auth endpoints

## Environment Variables

### Backend
```bash
SUPABASE_URL=https://nyxtykazcgdlyckjijtv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from-dashboard>
```

### Frontend (optional, defaults exist)
```bash
VITE_SUPABASE_URL=https://nyxtykazcgdlyckjijtv.supabase.co
VITE_SUPABASE_ANON_KEY=<from-dashboard>
```

## Testing Checklist

- [ ] Magic link sends email
- [ ] Google OAuth redirects work
- [ ] Anonymous evaluation still works
- [ ] Authenticated user's projects appear in my-projects
- [ ] RLS prevents cross-user data access
- [ ] UserMenu shows correct avatar/name

## What's NOT Implemented Yet

1. **My Idea Garden page** — UI to view past evaluations (just the API)
2. **Claim anonymous project** — Function exists but no UI
3. **Passkeys** — Planned for v2
4. **Session anomaly detection** — P1 item
5. **Email notification on new device** — P1 item
