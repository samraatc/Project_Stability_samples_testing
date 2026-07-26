# Multi-stage Dockerfile for Enterprise Stability Management System (ESMS)
# Default target: server
# Build specific targets:
#   docker build --target server -t esms-server .
#   docker build --target client -t esms-client .

FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

# ------------------------------------------
# Server Build
# ------------------------------------------
FROM base AS server-build
RUN npm ci --workspace server
COPY server server
RUN npm run build --workspace server

# ------------------------------------------
# Client Build
# ------------------------------------------
FROM base AS client-build
RUN npm ci --workspace client
COPY client client
RUN npm run build --workspace client

# ------------------------------------------
# Server Runtime (Default Target)
# ------------------------------------------
FROM node:22-alpine AS server
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node client/package.json client/
COPY --chown=node:node server/package.json server/
RUN npm ci --workspace server --omit=dev && npm cache clean --force
COPY --chown=node:node --from=server-build /app/server/dist server/dist
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/v1/health || exit 1
CMD ["node", "server/dist/server.js"]

# ------------------------------------------
# Client Runtime Target
# ------------------------------------------
FROM nginx:1.27-alpine AS client
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=client-build /app/client/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1
