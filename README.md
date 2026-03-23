# 🔥 Torres — Sistema de Inspeção de Incêndio

Sistema digital para checklist de inspeção de sistemas de detecção de incêndio, alarmes e automação (dampers e extração de fumaça) para ~500 lojas de um complexo comercial.

## 🛠 Stack

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React (Vite) |
| **Backend** | Node.js + Express |
| **Autenticação** | Microsoft Graph API (OAuth 2.0) — *futuro* |
| **Dados** | Microsoft Lists (SharePoint) — *futuro* |
| **Relatórios** | PDF + envio via Outlook — *futuro* |

## 📁 Estrutura

```
torres/
├── backend/
│   ├── config/           # Configurações (MS Graph, etc.)
│   ├── controllers/      # Lógica de controle das rotas
│   ├── middlewares/       # Auth, error handler
│   ├── models/            # Modelos de dados
│   ├── routes/            # Definição de rotas da API
│   ├── services/          # Lógica de negócio e integrações
│   ├── server.js          # Ponto de entrada
│   └── .env.example       # Variáveis de ambiente
├── frontend/
│   └── src/
│       ├── components/    # Componentes reutilizáveis
│       ├── context/       # Context API (estado global)
│       ├── hooks/         # Custom hooks
│       ├── pages/         # Páginas da aplicação
│       └── services/      # Comunicação com a API
└── README.md
```

## 🚀 Como Rodar

### Backend
```bash
cd backend
npm install
npm run dev
```
Servidor disponível em `http://localhost:3001`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Aplicação disponível em `http://localhost:5173`

## 📌 Roadmap de Integrações

1. **Microsoft Graph API (OAuth 2.0)** — Autenticação dos inspetores via conta corporativa
2. **Microsoft Lists (SharePoint)** — Leitura e gravação de dados de inspeção
3. **Relatórios PDF via Outlook** — Geração e envio automático de relatórios

## 📋 Categorias do Checklist

- 🔴 Detecção de Incêndio
- 🔔 Alarmes
- 🌀 Dampers
- 💨 Extração de Fumaça
