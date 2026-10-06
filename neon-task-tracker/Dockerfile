# Stage 1: Build the React application
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .

# Build argument for API base URL (empty string uses Nginx reverse proxy)
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

# Stage 2: Serve production assets via Nginx
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts to Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
