FROM oven/bun:latest

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

CMD ["bun", "start"]
