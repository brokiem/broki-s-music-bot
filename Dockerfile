FROM node

WORKDIR /app

COPY package.json ./

RUN apt-get update && \
    apt-get install -y libsodium-dev && \
    rm -rf /var/lib/apt/lists/*

RUN yarn install --production=true

COPY . .

CMD ["yarn", "start"]
