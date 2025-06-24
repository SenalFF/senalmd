# Use latest Node.js and Debian base
FROM node:lts-bookworm

# Install Python 3.10+, ffmpeg, imagemagick, webp, git
RUN apt-get update && \
  apt-get install -y \
  ffmpeg \
  imagemagick \
  webp \
  python3 \
  python3-pip \
  python-is-python3 \
  git && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json & install deps
COPY package.json ./

# Set env to skip preinstall Python check and auto-updates
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1
ENV YTDL_NO_UPDATE=1

# Install Node.js deps
RUN npm install && npm install -g qrcode-terminal pm2

# Copy the source code
COPY . .

# Expose the port your app uses
EXPOSE 3000

# Start the app using PM2
CMD ["pm2-runtime", "start", "index.js"]
