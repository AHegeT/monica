FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY public ./public
COPY server ./server
RUN mkdir -p /app/.data && chown -R node:node /app
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4178 FIELDWORK_AUTH_MODE=password
EXPOSE 4178
CMD ["node", "server/index.js"]
