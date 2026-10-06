FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN npm test
USER node
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
CMD ["node", "server.mjs"]
