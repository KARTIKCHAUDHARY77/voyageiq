// VoyageIQ AI — Maritime Intelligence Platform
// Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
// Unauthorized copying or use of this file is strictly prohibited.
// Contact: 2512520007@geu.ac.in
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Use --legacy-peer-deps to handle vite v8 + plugin-react peer dep mismatch
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
