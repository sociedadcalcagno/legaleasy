FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY . ./

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
