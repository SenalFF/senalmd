# Use a stable Node.js base image
FROM node:20-bullseye

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Install required system packages
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y ffmpeg imagemagick libwebp-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy remaining project files
COPY . .

# Expose port
EXPOSE 3000

# Default command
CMD ["node", "index.js"]
