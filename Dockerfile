FROM node:19-alpine3.16

WORKDIR /app

COPY package.json ./

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    apk add --no-cache libsodium && \
    yarn install --production=true

COPY . .

CMD ["yarn", "start"]
