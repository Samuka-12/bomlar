FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ENV NODE_ENV=production
RUN pnpm build

EXPOSE 3000
CMD ["sh", "-c", "pnpm start"]
