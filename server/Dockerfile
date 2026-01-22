# Server (Backend) Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (we need dev dependencies for tsx and types)
RUN npm ci

# Copy source code and config files
COPY server ./server
COPY shared ./shared
COPY migrations ./migrations
COPY drizzle.config.ts ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Switch to non-root user for security
USER node

# Set environment to production
ENV NODE_ENV=production

# Start the application with tsx (runs TypeScript directly)
CMD ["npx", "tsx", "server/index.ts"]
