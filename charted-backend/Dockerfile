# Recipe to pack the backend into a runnable image.

# Start from an official, slim Node 20 image (Debian-based, glibc — fewer surprises).
FROM node:20-slim

# Everything below happens inside /app in the image.
WORKDIR /app

# Copy only the dependency manifests first. Docker caches this layer, so as long
# as package.json/lock don't change, it won't re-download deps on every build.
COPY package*.json ./

# Install only production deps (skips vitest, typescript, @types). tsx is a
# production dep now, so the app can still run TypeScript directly.
RUN npm ci --omit=dev

# Now copy the rest of the source code in.
COPY . .

# Document the port the app listens on (the actual value comes from PORT in env).
EXPOSE 8080

# How to start the container: same command you run locally.
CMD ["npm", "start"]
