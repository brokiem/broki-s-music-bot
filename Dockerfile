FROM node:19-alpine3.16

WORKDIR /app

COPY package.json ./

RUN npm install && \
    npm install -g bun

COPY . .

CMD ["bun", "start"]
