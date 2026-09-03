# Multi-stage Production Dockerfile for Nexus Real-Time Platform

# ----------------------------------------------------
# Stage 1: Build React Client
# ----------------------------------------------------
FROM node:24-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ----------------------------------------------------
# Stage 2: Build Server
# ----------------------------------------------------
FROM node:24-alpine AS server-builder
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build

# ----------------------------------------------------
# Stage 3: Production Runner
# ----------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install dumb-init for proper signal forwarding and PID 1 handling
RUN apk add --no-cache dumb-init

# Copy compiled backend
COPY --from=server-builder /app/server/package*.json ./server/
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/prisma ./server/prisma

# Copy built frontend assets
COPY --from=client-builder /app/client/dist ./client/dist

# Create uploads directory and permissions
RUN mkdir -p /app/server/uploads /app/server/data && chown -R node:node /app

USER node
WORKDIR /app/server

EXPOSE 5000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
