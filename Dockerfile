# ── Stage 1: install backend Node deps ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# ── Stage 2: final image ───────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Install Python + pip (scraper)
RUN apk add --no-cache python3 py3-pip

# Backend — deps + source
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/

# Python deps
COPY scraper/requirements.txt ./scraper/
RUN pip3 install --no-cache-dir --break-system-packages -r ./scraper/requirements.txt

# Scraper source (only .py files — no venv, no .env)
COPY scraper/*.py ./scraper/

# Data directory — Railway persistent volume mounts here
RUN mkdir -p /data/uploads

# Start script
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["./start.sh"]
