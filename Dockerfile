# Stage 1: Build
FROM oven/bun:1 as builder

WORKDIR /app

# Copy package files
COPY package*.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN bun run build

# Stage 2: Production
FROM oven/bun:1-slim

WORKDIR /app

# Create logs directory and set permissions
RUN mkdir -p logs && chown -R bun:bun logs

# Copy package files and built code
COPY --from=builder /app/package*.json /app/bun.lock ./
COPY --from=builder /app/dist ./dist

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Switch to non-root user
USER bun

# Set environment variables
ENV NODE_ENV=production

# Start the bot
CMD ["bun", "run", "start"]