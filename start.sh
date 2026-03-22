#!/bin/sh
# Zaleto Railway start script — runs backend + scraper concurrently.
# If either process exits, the container exits (Railway restarts it).

DB="${DATABASE_PATH:-/data/zaleto.db}"

echo "============================================"
echo "  Zaleto — Railway Service"
echo "  Database : $DB"
echo "  Started  : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"
echo ""

# ── Backend (Node.js) ─────────────────────────────────────────────────────
cd /app/backend
DATABASE_PATH="$DB" node src/index.js &
BACKEND_PID=$!
echo "[backend] started  (PID $BACKEND_PID)"

# ── Scraper (Python) ──────────────────────────────────────────────────────
cd /app/scraper
DATABASE_PATH="$DB" python3 run_all.py &
SCRAPER_PID=$!
echo "[scraper] started  (PID $SCRAPER_PID)"

echo ""

# ── Monitor both processes ────────────────────────────────────────────────
# Propagate SIGTERM/SIGINT to both children
trap 'echo "Shutting down..."; kill "$BACKEND_PID" "$SCRAPER_PID" 2>/dev/null; exit 0' TERM INT

while true; do
  # Backend died?
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[start.sh] Backend exited unexpectedly — restarting container."
    kill "$SCRAPER_PID" 2>/dev/null
    exit 1
  fi
  # Scraper died?
  if ! kill -0 "$SCRAPER_PID" 2>/dev/null; then
    echo "[start.sh] Scraper exited unexpectedly — restarting container."
    kill "$BACKEND_PID" 2>/dev/null
    exit 1
  fi
  sleep 10
done
