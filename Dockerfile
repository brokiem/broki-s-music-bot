FROM node:19-alpine3.16

WORKDIR /app

COPY package.json ./

RUN yarn install --production=true

COPY . .

CMD ["yarn", "start"]
