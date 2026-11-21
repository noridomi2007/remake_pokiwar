FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/

RUN pnpm install --filter @pokiwar/shared --filter @pokiwar/server --frozen-lockfile || pnpm install --filter @pokiwar/shared --filter @pokiwar/server

COPY packages/shared packages/shared
COPY apps/server apps/server

RUN pnpm --filter @pokiwar/shared build && pnpm --filter @pokiwar/server build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/server/package.json apps/server/
COPY --from=builder /app/apps/server/dist apps/server/dist
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=builder /app/apps/server/node_modules apps/server/node_modules

EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
