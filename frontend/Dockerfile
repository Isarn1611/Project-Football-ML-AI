FROM node:22-alpine

ENV NODE_ENV=development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Copy only files needed by the Vite development server. frontend/.env is
# supplied by Compose at runtime and is not embedded in the image.
COPY index.html vite.config.js eslint.config.js ./
COPY public ./public
COPY src ./src

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
