# Server Dockerfile - Production ready
FROM node:18-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy source files
COPY . .

# Create data directory for images
RUN mkdir -p /data && chown appuser:appgroup /data

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Start server (NOTA: --watch es solo para desarrollo)
CMD ["node", "src/index.js"]