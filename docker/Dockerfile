# This is the test environment for Vitest and Playwright
FROM texlive/texlive:latest

# Install dependencies and tools
RUN apt-get update && \
    apt-get install -y curl gnupg poppler-data poppler-utils && \
    curl -fsSL https://deb.nodesource.com/setup_14.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm && \
    pnpm install playwright vitest && \
    pnpm exec playwright install --with-deps && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

