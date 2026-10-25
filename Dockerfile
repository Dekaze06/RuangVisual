FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 4321
ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

CMD ["node", "./dist/server/entry.mjs"]
