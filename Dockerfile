FROM node:19

WORKDIR /app

# Install bun.js
RUN apt-get update \
    && apt-get install -y curl \
    && curl -fsSL https://bun.sh/install | bash \
    && rm -rf /var/lib/apt/lists/*

RUN echo 'source /root/.bashrc' >> ~/.bashrc

# Copy package.json and install dependencies
COPY package.json ./
RUN yarn install --production=true

# Copy the rest of the application files
COPY . .

CMD ["bun", "index.js"]
