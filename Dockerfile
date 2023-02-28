FROM jrottenberg/ffmpeg:4.4-alpine as ffmpeg

FROM node:19-alpine3.16

WORKDIR /app

COPY package.json ./

RUN yarn install --production=true

COPY --from=ffmpeg /usr/local/bin/ffmpeg /usr/local/bin/

COPY . .

CMD ["yarn", "start"]
