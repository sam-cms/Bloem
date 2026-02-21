#!/bin/bash
# Prebloom Dev Mode Startup
# Ports: Backend=4000, Vite=3457, Tailscale=3456

set -e

cd "$(dirname "$0")/.."

echo "🌱 Starting Prebloom Dev Mode..."

# Kill any existing dev processes
pkill -f "prebloom-server" 2>/dev/null || true
pkill -f "vite.*3457" 2>/dev/null || true
sleep 1

# Load environment
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi
export PREBLOOM_PORT=4000
export SUPABASE_URL="${SUPABASE_URL:-https://nyxtykazcgdlyckjijtv.supabase.co}"

# Start backend
echo "📦 Starting backend on :4000..."
nohup node scripts/prebloom-server.mjs > /tmp/prebloom-backend.log 2>&1 &
sleep 2

# Start frontend
echo "⚡ Starting Vite on :3457..."
cd frontend
nohup npm run dev -- --host 127.0.0.1 --port 3457 > /tmp/prebloom-frontend.log 2>&1 &
cd ..
sleep 2

# Verify
echo ""
echo "=== Status ==="
curl -s http://localhost:4000/prebloom/health && echo " ← Backend OK"
curl -s http://localhost:3457 > /dev/null && echo "Frontend OK on :3457"

echo ""
echo "✅ Dev mode ready!"
echo "   URL: https://localhost-0.tailb786fe.ts.net:3456"
