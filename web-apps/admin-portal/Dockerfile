# Admin portal static site
FROM node:20-bookworm-slim AS build
WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:3000
ARG VITE_TENANT_ID=00000000-0000-0000-0000-000000000001
ARG VITE_AUTH_TOKEN=dev
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_TENANT_ID=$VITE_TENANT_ID
ENV VITE_AUTH_TOKEN=$VITE_AUTH_TOKEN

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
