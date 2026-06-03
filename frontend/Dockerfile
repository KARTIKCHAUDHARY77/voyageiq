# VoyageIQ AI — Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./

# Install with legacy-peer-deps (vite v5 + plugin-react compatibility)
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
