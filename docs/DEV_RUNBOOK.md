# Prebloom Dev Runbook

## Quick Start (Dev Mode)

### 1. Build TypeScript
```bash
cd ~/Projects/bloem-source && npx tsc
```

### 2. Start Backend (port 4000)
```bash
cd ~/Projects/bloem-source
export $(grep -E "^(ANTHROPIC_API_KEY|SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)" .env | xargs)
node scripts/prebloom-server.mjs
```

### 3. Start Frontend (port 3457)
```bash
cd ~/Projects/bloem-source/frontend
npm run dev -- --host 127.0.0.1 --port 3457
```

### 4. Tailscale Serve (port 3456 → 3457)
```bash
sudo tailscale serve --bg --https=3456 http://127.0.0.1:3457
```

### 5. Access
- **Dev URL:** https://localhost-0.tailb786fe.ts.net:3456
- Vite proxies `/prebloom/*` requests to backend on port 4000

## How It Works

```
Browser → Tailscale (3456) → Vite (3457) → proxy /prebloom/* → Backend (4000)
```

- Frontend: React + Vite on 3457
- Backend: Node.js standalone server on 4000 (`scripts/prebloom-server.mjs`)
- Vite proxy config in `frontend/vite.config.ts` routes `/prebloom/*` to `localhost:4000`
- API_BASE in `frontend/src/lib/api.ts` is empty (relative URLs)

## Common Issues

### "Failed to submit" / Network Error
**Cause:** Backend not running on port 4000.
**Fix:** Start the backend (step 2 above).

### Build errors after code changes
**Fix:** Rebuild TypeScript: `npx tsc`

### Environment variables
All env vars are in `.env` at project root. Backend needs them exported.

## Docker (Stable)
```bash
cd ~/Projects/bloem-source
docker compose -f docker-compose.prebloom.yml up -d
```
- **Stable URL:** https://localhost-0.tailb786fe.ts.net:8443
- Docker handles both frontend + backend internally

## Full Pipeline Test (CLI)
```bash
cd ~/Projects/bloem-source
export $(grep -E "^(ANTHROPIC_API_KEY|SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)" .env | xargs)
node test-full-pipeline.mjs
```
Output saved to `test-output.json`.
