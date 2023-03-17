FROM node

WORKDIR /app

COPY package.json ./

RUN sudo apt update && \
    sudo apt install -y libsodium ffmpeg libssl-dev && \
    yarn install --production=true

ENV FFMPEG_PATH=/usr/bin/ffmpeg

COPY . .

CMD ["yarn", "start"]
