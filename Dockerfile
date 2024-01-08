FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
RUN apk update && \
    apk add --no-cache openssl python3 make g++ \
    && ln -sf python3 /usr/bin/python

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy application files
COPY src/ src/
COPY scripts/ scripts/
COPY prisma/schema.prisma prisma/
COPY tsconfig.json ./

# Generate prisma client and build the application
RUN npx prisma generate
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app

RUN apk update && \
    apk add --no-cache openssl

# Copy built files from the build stage
COPY --from=build /app .

# Install only runtime dependencies
RUN npm install --only=production

# Copy and run migrations
COPY --from=build /app/prisma ./prisma
RUN npx prisma migrate deploy
RUN npx prisma db push

# Set entrypoint
ENTRYPOINT [ "node", "scripts/start.js" ]
CMD ["start"]
