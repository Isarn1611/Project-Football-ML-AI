FROM node:22-alpine

ENV NODE_ENV=development

WORKDIR /app

# Install dependencies before copying source code so Docker can reuse this
# layer when only application code changes.
COPY package.json package-lock.json ./
RUN npm ci

# Do not copy backend/.env into the image. Compose injects it at runtime.
COPY src ./src

EXPOSE 5000

CMD ["npm", "run", "dev"]
