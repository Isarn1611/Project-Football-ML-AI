# ==============================================================================
# All-in-One Dockerfile: Football ML AI & Player Scouting System
# Includes: Frontend (React/Vite SPA), Backend (Node/Express), ML API (FastAPI/ScoutAI)
# Managed by Supervisor & served via Nginx Reverse Proxy on Port 80
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend (React + Vite)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

# Build-time arguments for Vite (embedded into client bundle from build environment)
ARG VITE_API_URL=""
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}

# Install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source code and build
COPY frontend/index.html frontend/vite.config.js frontend/eslint.config.js ./
COPY frontend/public ./public
COPY frontend/src ./src

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Install Backend Production Dependencies
# ------------------------------------------------------------------------------
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ------------------------------------------------------------------------------
# Stage 3: All-in-One Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    PORT=5000 \
    ML_API_URL=http://127.0.0.1:8000

WORKDIR /app

# 1. Install System Dependencies:
#    - libgomp1: required by scikit-learn OpenMP
#    - nginx: high-performance web server & reverse proxy
#    - supervisor: process manager for multi-process container
#    - curl: for healthcheck probe
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    nginx \
    supervisor \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 2. Copy Node.js runtime from official Debian Bookworm Node image
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# 3. Install Python Dependencies for ScoutAI ML engine
COPY ScoutAI/requirements.txt ./ScoutAI/requirements.txt
RUN python -m pip install --no-cache-dir -r ScoutAI/requirements.txt

# 4. Copy ScoutAI Application Files (API, Engine, Dataset)
COPY ScoutAI/api.py ScoutAI/scout_engine.py ScoutAI/fm_dataset.csv ./ScoutAI/

# 5. Copy Backend Application Files & Production Node Modules
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/package.json
COPY backend/src ./backend/src

# 6. Copy Frontend Production Build (HTML, JS, CSS, Club Logos)
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 7. Configure Nginx and Supervisor
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 8. Setup logging directories and runtime paths
RUN mkdir -p /var/log/supervisor /var/log/nginx /run

# Expose Port 80 (Main entrypoint via Nginx), 5000 (Backend API), 8000 (ML API)
EXPOSE 80 5000 8000

# Healthcheck testing the full stack (Nginx -> Express -> FastAPI)
HEALTHCHECK --interval=20s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://127.0.0.1:80/api/ml/health || exit 1

# Start all services via Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
