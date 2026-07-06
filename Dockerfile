# Asset Onboarding Tool — production image (README §11/§12 phase 7)
# Multi-stage: build native deps (better-sqlite3) in a full toolchain image,
# run on a slim runtime. Node 22 LTS.

FROM node:22-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 ships prebuilds for linux x64 glibc; the toolchain image covers
# any platform where the prebuild is missing and a source build kicks in.
RUN npm ci --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
# Seed fixture ships in the image; the live SQLite DB lives on the /app/data volume.
COPY data/seed-dataset.json ./data/seed-dataset.json

# Non-root: the data volume must be writable by uid 1000 (node user).
RUN chown -R node:node /app
USER node

EXPOSE 8080
# No curl/wget in slim — use node for the container healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Idempotent seed (seed_meta version guard) then serve.
CMD ["sh", "-c", "node scripts/seed-db.js && node src/server/server.js"]
