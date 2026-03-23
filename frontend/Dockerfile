# Estágio 1: Build da aplicação React usando Vite
FROM node:20-slim AS builder

WORKDIR /app

# Copiar arquivos de dependências e instalar
COPY package*.json ./
RUN npm install

# Copiar o restante do código fonte
COPY . .

# Fazer o build de produção (gera os arquivos estáticos na pasta /dist)
RUN npm run build

# Estágio 2: Subir um servidor web leve (Nginx) para servir os arquivos
FROM nginx:alpine

# Copiar os arquivos estáticos gerados no estágio de build para o diretório padrão do Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração customizada do Nginx para lidar com rotas do React (React Router) evitando erro 404
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# A imagem Nginx padrão usa e expõe a porta 80 do contêiner
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
