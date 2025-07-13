# Use a supported and secure Node.js base image
FROM node:lts-bullseye

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Install required system packages
RUN apt-get update && \
    apt-get install -y \
        ffmpeg \
        imagemagick \
        webp && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# Copy remaining project files
COPY . .

# Expose port if needed (optional)
EXPOSE 3000

# Default command (change if needed)
CMD ["node", "index.js"]
