# Event scraping microservice
FROM node:22-alpine AS base
WORKDIR /app

# Install Chromium for Puppeteer and skip the bundled download to keep the image lean
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN apk add --no-check-certificate \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Install esbuild globally to ensure correct binary for Alpine
RUN npm install -g esbuild

# Install dependencies (including devDependencies for build)
COPY scraper-service/package*.json ./scraper-service/
COPY shared ./shared

WORKDIR /app/scraper-service
RUN npm install --ignore-scripts

# Copy source and build using global esbuild
COPY scraper-service ./
RUN esbuild src/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    ENABLE_PUPPETEER=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN apk add --no-check-certificate \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

COPY --from=base /app/scraper-service/node_modules ./node_modules
COPY --from=base /app/scraper-service/dist ./dist
COPY --from=base /app/shared ../shared

# Switch to non-root user for security
USER node

EXPOSE 3002
CMD ["node", "dist/index.js"]
