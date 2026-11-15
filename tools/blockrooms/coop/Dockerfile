FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production COOP_HOST=0.0.0.0 COOP_DEFAULT_MODE=rooms
COPY --chown=node:node package.json ./
COPY --chown=node:node core ./core
COPY --chown=node:node public ./public
COPY --chown=node:node server/ws.mjs ./server/ws.mjs
COPY --chown=node:node tools/blockrooms/coop-server.mjs ./tools/blockrooms/coop-server.mjs
USER node
CMD ["node", "tools/blockrooms/coop-server.mjs"]
