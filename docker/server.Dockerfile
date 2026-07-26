# Build context: repository root
FROM node:22-alpine AS build

WORKDIR /app

# Copy root manifest and lockfile alongside all workspace package definitions
# to ensure workspace dependency tree resolves correctly during npm ci
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

RUN npm ci --workspace server

COPY server server
RUN npm run build --workspace server

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

# Ensure non-root ownership and copy workspace definitions for production dependencies
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node client/package.json client/
COPY --chown=node:node server/package.json server/

RUN npm ci --workspace server --omit=dev && npm cache clean --force

COPY --chown=node:node --from=build /app/server/dist server/dist

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/v1/health || exit 1

CMD ["node", "server/dist/server.js"]

