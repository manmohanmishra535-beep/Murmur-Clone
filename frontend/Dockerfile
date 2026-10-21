# The web image: Next.js in `output: "standalone"` mode, so the runtime carries
# the server and the traced dependencies only — not the whole node_modules tree.
#
# NEXT_PUBLIC_* values are inlined by `next build`, so they are build arguments,
# not runtime variables. Changing one means rebuilding the image.
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a real key: without it the image
# still builds, but the browser cannot start a Clerk session.
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:5000/api
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


FROM node:20-alpine AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Bind on every interface, not just loopback, or the port mapping reaches nothing.
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# See next.config.js: outputFileTracingRoot is this folder, so the standalone
# server lands at .next/standalone/server.js rather than under a parent path.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/login" > /dev/null || exit 1

CMD ["node", "server.js"]
