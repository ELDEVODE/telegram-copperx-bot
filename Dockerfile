FROM oven/bun:1.0

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./


# Remove existing lockfile and install dependencies
RUN rm -f bun.lock && bun install

# Copy source code
COPY . .


# Create logs directory
RUN mkdir -p logs

# Set environment variables
ENV NODE_ENV=production

# Start the bot
CMD ["bun", "run", "start"]