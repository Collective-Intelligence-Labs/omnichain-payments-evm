FROM node:20-alpine AS ui-build
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json* ./
RUN npm ci
COPY ui/ ./
ARG VITE_BASE=/omnichain-payments-evm/
ENV VITE_BASE=${VITE_BASE}
RUN npm run build

FROM node:20-alpine AS vue-build
WORKDIR /app/omniassets-ui
COPY omniassets-ui/package.json omniassets-ui/package-lock.json* ./
RUN npm ci
COPY omniassets-ui/ ./
RUN npm run build

FROM node:20-alpine AS admin-build
WORKDIR /app/admin
COPY admin/package.json admin/package-lock.json* ./
RUN npm ci
COPY admin/ ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM node:20-alpine AS server-build
WORKDIR /app
COPY omniassets-server/package.json omniassets-server/package-lock.json* ./
RUN npm ci --omit=dev
COPY omniassets-server/ ./

FROM nginx:alpine
RUN apk add --no-cache supervisor

COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

COPY --from=ui-build /app/ui/dist /usr/share/nginx/html/ui
COPY --from=vue-build /app/omniassets-ui/dist /usr/share/nginx/html/vue
COPY --from=admin-build /app/admin/dist /usr/share/nginx/html/admin

COPY --from=server-build /app /app/server

EXPOSE 80
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
