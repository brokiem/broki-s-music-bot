FROM oven/bun:latest

WORKDIR /app

COPY package.json ./

RUN yarn install --production=true

COPY . .

CMD ["bun", "start"]
