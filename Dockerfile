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

FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=ui-build /app/ui/dist /usr/share/nginx/html/ui
COPY --from=vue-build /app/omniassets-ui/dist /usr/share/nginx/html/vue
COPY --from=admin-build /app/admin/dist /usr/share/nginx/html/admin
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
