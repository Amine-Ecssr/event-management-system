# Client (Frontend) Dockerfile - Multi-stage build
# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files for the entire monorepo
COPY package*.json ./

# Install all dependencies (needed for building)
RUN npm ci

# Copy client source code and shared types
COPY client ./client
COPY shared ./shared
COPY attached_assets ./attached_assets
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./

# Build only the client application (frontend)
RUN npx vite build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-check-certificate curl

# Copy built files from build stage (vite outputs to dist/public)
COPY --from=build /app/dist/public /usr/share/nginx/html

# Copy nginx configuration
COPY client/nginx/default.conf /etc/nginx/conf.d/default.conf


CMD ["nginx", "-g", "daemon off;"]
