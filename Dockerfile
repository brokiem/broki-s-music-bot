FROM node:19-alpine3.16

WORKDIR /app

# Install bun.js
RUN apk add --no-cache curl \
    && curl -fsSL https://bun.sh/install | sh \
    && rm -rf /var/cache/apk/*

# Copy package.json and install dependencies
COPY package.json ./
RUN yarn install --production=true

# Copy the rest of the application files
COPY . .

CMD ["bun", "index.js"]
