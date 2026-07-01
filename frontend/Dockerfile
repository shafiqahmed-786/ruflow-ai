# frontend/Dockerfile
# CareerOS AI — Next.js 14 App Router (standalone output)
#
# NEXT_PUBLIC_API_URL must be passed as a build arg because Next.js
# inlines NEXT_PUBLIC_* variables at BUILD time, not runtime.
#
# Stage 1: deps    — npm ci (all deps for build)
# Stage 2: builder — next build (produces .next/standalone)
# Stage 3: runner  — minimal image, only standalone bundle + static assets
# ---------------------------------------------------------------------------

# Stage 1 — install dependencies
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2 — build
FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build-time API URL (required for NEXT_PUBLIC_ inlining)
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 3 — minimal runtime image
FROM node:20-alpine AS runner

LABEL maintainer="careeros-team" \
      version="2.0.0" \
      description="CareerOS AI Next.js frontend"

RUN apk add --no-cache curl

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nextjs

# Copy standalone server bundle (includes its own node_modules subset)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Static files must sit at these exact paths for the standalone server
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public       ./public

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

CMD ["node", "server.js"]
