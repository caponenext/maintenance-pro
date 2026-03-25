FROM node:24-alpine

WORKDIR /app

# Copia package files
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia il resto dell'applicazione
COPY . .

# Espone la porta
EXPOSE 3000

# Variabili di ambiente di default
ENV NODE_ENV=production
ENV PORT=3000

# Comando di avvio
CMD ["node", "server.js"]
