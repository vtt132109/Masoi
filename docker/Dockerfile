# syntax=docker/dockerfile:1

# ---- Build: cài thư viện, build web + server ------------------------------
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
# Chỉ lấy các thư viện chạy thật của server (bỏ package nội bộ vì đã được gộp vào bản build).
RUN mkdir /deps && node -e "\
const p=require('./apps/server/package.json');\
const deps=Object.fromEntries(Object.entries(p.dependencies).filter(([k])=>!k.startsWith('@masoi/')));\
require('fs').writeFileSync('/deps/package.json',JSON.stringify({name:'masoi-runtime',private:true,type:'module',dependencies:deps}))"
RUN cd /deps && npm install --omit=dev --no-audit --no-fund

# ---- Chạy -----------------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/web \
    TRUST_PROXY=1
WORKDIR /app
COPY --from=build /deps/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/web/dist ./web
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/index.js"]
