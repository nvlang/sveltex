# This is the test environment for Vitest and Playwright
FROM texlive/texlive:latest

# Install dependencies and tools
RUN apt-get update && \
    apt-get install -y curl gnupg poppler-data poppler-utils && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verify installation and set PATH
RUN which pdfinfo && which pdftocairo

# Set environment variable for Poppler path
ENV PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/texlive/2024/bin/x86_64-linux:/usr/local/texlive/2024/bin/custom:/usr/local/texlive/2024/bin"
