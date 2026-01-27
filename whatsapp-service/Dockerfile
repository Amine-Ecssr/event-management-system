# WhatsApp Service Dockerfile
FROM node:20-alpine

# Install git (required by some npm dependencies including Baileys)
RUN apk add --no-check-certificate git

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Create directory for WhatsApp session data and set permissions
RUN mkdir -p /app/auth_info && chown -R node:node /app

# Expose the service port
EXPOSE 3001

# Start the service with tsx (runs TypeScript directly)
# Use an entrypoint script to ensure permissions at runtime
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npx", "tsx", "src/index.ts"]
