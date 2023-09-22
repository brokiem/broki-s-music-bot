FROM node:18-alpine3.17

WORKDIR /app

COPY package.json ./

RUN apk update && \
    apk add git && \
    apk add libsodium ffmpeg && \
    apk add --repository https://dl-cdn.alpinelinux.org/alpine/edge/main libcrypto1.1 && \
    yarn install --production=true

RUN cd node_modules/play-dl && \
    yarn build && \
    cd ../..

ENV FFMPEG_PATH=/usr/bin/ffmpeg

COPY . .

CMD ["yarn", "start"]
