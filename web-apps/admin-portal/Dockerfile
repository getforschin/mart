# Build from monorepo root:
#   docker build -f web-apps/admin-portal/Dockerfile .
FROM node:20-bookworm-slim AS build
WORKDIR /app

ARG VITE_API_BASE_URL=https://mart-production-cdeb28ec.up.railway.app
ARG VITE_TENANT_ID=00000000-0000-0000-0000-000000000001
ARG VITE_FACILITY_ID=00000000-0000-0000-0000-000000000002
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_TENANT_ID=$VITE_TENANT_ID
ENV VITE_FACILITY_ID=$VITE_FACILITY_ID

COPY packages/mart-app /app/packages/mart-app
COPY web-apps/admin-portal /app/web-apps/admin-portal

WORKDIR /app/web-apps/admin-portal
RUN npm install && npm run build

FROM nginx:1.27-alpine AS runtime
COPY web-apps/admin-portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web-apps/admin-portal/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
