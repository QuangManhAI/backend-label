FROM node:20-alpine AS builder

# install deps for sharp
RUN apk add --no-cache \
    vips-dev \
    build-base \
    python3

WORKDIR /app

COPY package*.json ./
RUN npm install


COPY . .
RUN npm run build


FROM node:20-alpine AS runner

RUN apk add --no-cache vips

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/main.js"]
