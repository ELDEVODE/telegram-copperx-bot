# Stage 1: Production
FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package*.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Create logs directory and set permissions
RUN mkdir -p logs && chown -R bun:bun logs

# Copy source code
COPY . .

# Switch to non-root user
USER bun

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port (this should match PORT env var)
EXPOSE ${PORT}

# Start the bot by running TypeScript source directly
CMD ["bun", "run", "src/index.ts"]