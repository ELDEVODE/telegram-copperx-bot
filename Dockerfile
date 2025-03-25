FROM oven/bun:1.0

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN bun run build

# Create logs directory
RUN mkdir -p logs

# Set environment variables
ENV NODE_ENV=production

# Start the bot
CMD ["bun", "run", "start"]