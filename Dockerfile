FROM node:19-alpine3.16

WORKDIR /app

COPY package.json ./

RUN yarn install --production=true && \
    yarn global add bun

COPY . .

CMD ["bun", "start"]
