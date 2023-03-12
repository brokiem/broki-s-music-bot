FROM node:19-alpine3.16

WORKDIR /app

COPY package.json ./

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    apk add --no-cache libsodium ffmpeg && \
    yarn install --production=true

ENV FFMPEG_PATH=/usr/bin/ffmpeg

COPY . .

CMD ["yarn", "start"]
