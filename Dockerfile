# NurseExamPrep — Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files first for Docker layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy application source
COPY . .

# Remove any local .env from Docker image (secrets via env vars)
RUN rm -f .env

EXPOSE 3000

CMD ["node", "app.js"]
