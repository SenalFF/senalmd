# Use Debian Buster base image
FROM debian:buster

# Install system-level dependencies including Git, Python, and create python symlink
RUN apt-get update && \
  apt-get install -y \
  curl \
  git \
  ffmpeg \
  imagemagick \
  webp \
  python3 \
  python3-pip && \
  ln -s /usr/bin/python3 /usr/bin/python && \
  # Add NodeSource repo for latest Node.js LTS
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
  apt-get install -y nodejs && \
  npm install -g npm@latest && \
  apt-get upgrade -y && \
  rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package metadata and install dependencies
COPY package.json package-lock.json* ./

# Install Node.js dependencies and global tools
RUN npm install && \
    npm install -g qrcode-terminal pm2

# Copy all source code
COPY . .

# Expose port for the app
EXPOSE 3000

# Run the app using PM2 runtime
CMD ["pm2-runtime", "start", "index.js"]
