FROM --platform=linux/amd64 node:19-buster-slim as build
WORKDIR /app

COPY package.json package-lock.json .
RUN npm i

COPY src/ src/
COPY prisma/schema.prisma prisma/
COPY tsconfig.json .

RUN apt-get update -y && apt-get install -y openssl

RUN npx prisma generate

RUN npm run build

RUN npm i
RUN npx prisma migrate deploy

ENTRYPOINT [ "node", "dist/index.js" ]
CMD ["start"]
