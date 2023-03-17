FROM node

WORKDIR /app

COPY package.json ./

RUN apt update && \
    apt install -y libsodium ffmpeg libssl-dev && \
    yarn install --production=true

ENV FFMPEG_PATH=/usr/bin/ffmpeg

COPY . .

CMD ["yarn", "start"]
