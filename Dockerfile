FROM node:19-buster-slim as build
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl python3 build-essential make gcc

COPY package.json package-lock.json ./
RUN npm i

RUN apt-get purge -y gcc make build-essential && apt-get autoremove -y

COPY src/ src/
COPY prisma/schema.prisma prisma/
COPY tsconfig.json ./

RUN npx prisma generate

RUN npm run build

RUN npm i
RUN npx prisma migrate deploy

ENTRYPOINT [ "node", "dist/index.js" ]
CMD ["start"]
