FROM oven/bun:latest

WORKDIR /app

COPY package.json ./

RUN apt-get update \
    && apt-get install -y yarn \
    && yarn install --production=true

COPY . .

CMD ["bun", "start"]
