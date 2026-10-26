# Stage 1: Build Stage
# Install all dependencies and compile TypeScript to dist/
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable

# Copy manifests and Yarn Berry configuration
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

# Copy source and compile
COPY . .
RUN yarn build && test -f dist/index.js

# --------------------------------------------------
# Stage 2: Production Runner
# Minimal image: only production deps + compiled dist/
# --------------------------------------------------
FROM node:20-alpine AS runner

# dumb-init handles PID 1 correctly so SIGTERM propagates to Node
RUN apk add --no-cache dumb-init
RUN corepack enable

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# Install production dependencies
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy Drizzle migration SQL files
COPY --from=builder /app/drizzle ./drizzle

# Security: Run as non-root node user (built-in to node:alpine)
USER node

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
