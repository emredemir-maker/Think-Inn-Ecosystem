# syntax=docker/dockerfile:1.7

# ---- Stage 1: build ----
FROM node:24-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Copy whole repo; .dockerignore prunes node_modules and other heavy paths.
COPY . .

# Install only api-server and its transitive workspace dependencies.
RUN pnpm install --frozen-lockfile --filter "@workspace/api-server..."

# Bundle the Express API with esbuild (build script lives in artifacts/api-server/build.mjs).
RUN pnpm --filter @workspace/api-server run build

# ---- Stage 2: runtime ----
FROM node:24-alpine AS runtime

WORKDIR /app

# Only ship the bundled dist/ — esbuild produced a self-contained ESM bundle.
COPY --from=builder /app/artifacts/api-server/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080

# Fly.io health-checks expect a listening port; api-server reads PORT from env.
EXPOSE 8080

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
