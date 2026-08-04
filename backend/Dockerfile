FROM node:20-alpine

WORKDIR /app

# Dépendances d'abord (cache Docker)
COPY package*.json ./
RUN npm install --production --silent

# Code source
COPY . .

# Le dossier backups sera monté en volume
RUN mkdir -p /backups

EXPOSE 5001

CMD ["node", "src/server.js"]
