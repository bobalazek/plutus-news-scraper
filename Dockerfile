# Dependencies
FROM node:16-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

# Builder
FROM node:16-alpine AS builder
WORKDIR /app

COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN apk add --no-cache git
RUN npm run build
RUN npm prune --production

# Runner
FROM node:16-alpine AS runner
WORKDIR /app

ARG NODE_ENV=prod
ENV NODE_ENV=$NODE_ENV

COPY --from=builder /app/dist .
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

ENTRYPOINT [ "node", "index.js" ]
