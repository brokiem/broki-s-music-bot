FROM node:19-alpine3.17

WORKDIR /app

COPY package.json ./

RUN apk update && \
    apk add --no-cache libsodium ffmpeg && \
    apk add --no-cache --repository https://dl-cdn.alpinelinux.org/alpine/edge/main libcrypto1.1 && \
    yarn install --production=true

ENV FFMPEG_PATH=/usr/bin/ffmpeg

COPY . .

CMD ["yarn", "start"]
