FROM oven/bun:latest

WORKDIR /app

COPY package.json ./

RUN apk add --no-cache yarn && yarn install --production=true

COPY . .

CMD ["bun", "start"]
