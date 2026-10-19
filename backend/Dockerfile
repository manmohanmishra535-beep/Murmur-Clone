# The API image: Express + Socket.IO on the same HTTP server.
#
# `npm ci --omit=dev` in a separate stage keeps the build tools and the test
# dependencies (Jest, Supertest, mongodb-memory-server) out of the runtime
# image while still letting Docker cache the install.
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev


FROM node:20-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=5000

WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

# Nothing in the API writes to disk: uploads go to Cloudinary from memory. The
# process therefore runs as the unprivileged `node` user the image ships with.
USER node

EXPOSE 5000

# The docs' uptime check, run inside the container so an orchestrator can
# restart a wedged process. Render uses its own healthCheckPath instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1

CMD ["node", "server.js"]
