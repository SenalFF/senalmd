# Use Node.js LTS with Debian Buster
FROM node:lts-buster

# Install system-level dependencies
RUN apt-get update && \
  apt-get install -y \
  ffmpeg \
  imagemagick \
  webp && \
  apt-get upgrade -y && \
  rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package metadata and install dependencies
COPY package.json ./

# Install Node.js dependencies and global tools
RUN npm install && \
    npm install -g qrcode-terminal pm2

# Copy all source code
COPY . .

# Expose port for the app
EXPOSE 3000

# Run the app using PM2 runtime
CMD ["pm2-runtime", "start", "index.js"]
