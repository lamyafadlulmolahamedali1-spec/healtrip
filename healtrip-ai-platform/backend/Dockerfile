FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
COPY sql ./sql
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=4s --retries=5 CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "src/server.js"]
