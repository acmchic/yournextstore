FROM oven/bun:1.2 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS builder
WORKDIR /app
COPY . .
ARG STORE_API_URL=http://api:8000
ENV STORE_API_URL=$STORE_API_URL
RUN bun run build

FROM oven/bun:1.2-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER bun
EXPOSE 3000
CMD ["bun", "server.js"]
