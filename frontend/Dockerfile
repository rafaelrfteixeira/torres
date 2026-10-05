# Estágio 1: Build da aplicação React usando Vite
FROM node:20-slim AS builder

WORKDIR /app

# Copiar arquivos de dependências e instalar
COPY package*.json ./
RUN npm install && npm install @rolldown/binding-linux-x64-gnu@1.0.0-rc.10

# Copiar o restante do código fonte
COPY . .

# Argumentos de build para o Vite (EasyPanel)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

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
