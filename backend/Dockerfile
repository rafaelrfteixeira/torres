# Usa a imagem slim do Node 20
FROM node:20-slim

# Instala todas as dependências do sistema necessárias para rodar o Puppeteer (Chromium) no Linux
RUN apt-get update \
    && apt-get install -y wget gnupg ca-certificates procps libxss1 libnss3 libasound2 libatk-bridge2.0-0 libgtk-3-0 libgbm-dev \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Diretório de trabalho da aplicação no contêiner
WORKDIR /app

# Copia package.json e package-lock.json primeiro para cache das dependências
COPY package*.json ./

# Instala as dependências Node da aplicação
RUN npm install --omit=dev

# Copia o restante do código fonte
COPY . .

# Expõe a porta que o app escuta
EXPOSE 3001

# Comando para iniciar o backend
CMD ["node", "server.js"]
