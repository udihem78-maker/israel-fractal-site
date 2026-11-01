FROM node:24-bookworm-slim
RUN npm install --global pnpm@10.34.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
ENV NODE_ENV=production
ENV PORT=3001
ENV MONITOR_SYNC_ENABLED=false
USER node
EXPOSE 3001
CMD ["pnpm", "start"]
