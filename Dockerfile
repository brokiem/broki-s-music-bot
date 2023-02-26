FROM node:19-alpine3.16

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install --production=true

COPY . .

CMD ["yarn", "start"]
