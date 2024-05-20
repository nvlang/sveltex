# Extend the Playwright Docker image
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Set environment variables to skip interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

# Install TeX Live for LaTeX document compilation
RUN apt-get update && \
    apt-get install -y texlive tzdata && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js dependencies (assuming package.json is present)
COPY package*.json ./
RUN npm install

# Copy the rest of your application
COPY . .

# Entrypoint for your application (adjust as needed)
CMD ["npm", "run", "test:e2e"]
