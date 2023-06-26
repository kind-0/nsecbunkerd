FROM --platform=linux/amd64 node:19 as build
WORKDIR /app

COPY package.json package-lock.json .
RUN npm i

COPY src/ src/
COPY prisma/ prisma/
COPY tsconfig.json .

RUN npm run build

RUN npx prisma migrate deploy
ENTRYPOINT [ "node", "dist/index.js" ]
CMD ["start"]
