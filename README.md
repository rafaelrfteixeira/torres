# 🏢 Torres CX — Sistema de Inspeção e Manutenção Técnica Predial

> **Documento Oficial de Arquitetura e Engenharia de Software**  
> *Versão do Sistema: 2.0 (Multi-Tenant & Offline-First)*  
> *Data de Atualização: Setembro de 2026*  
> *Este documento foi estruturado para fornecer entendimento completo, técnico e funcional da aplicação para desenvolvedores, engenheiros de dados e agentes de Inteligência Artificial (IA).*

---

## 📑 Sumário Executivo

1. [Visão Geral do Projeto](#-1-visão-geral-do-projeto)
2. [Arquitetura & Ecossistema Microsoft 365](#-2-arquitetura--ecossistema-microsoft-365)
3. [Multi-Tenancy & Matriz de Permissões (RBAC)](#-3-multi-tenancy--matriz-de-permissões-rbac)
4. [Sistemas de Engenharia Monitorados](#-4-sistemas-de-engenharia-monitorados)
5. [Módulos Funcionais da Aplicação](#-5-módulos-funcionais-da-aplicação)
6. [Arquitetura Offline-First & PWA (Dexie.js)](#-6-arquitetura-offline-first--pwa-dexiejs)
7. [Motor de Relatórios PDF & Disparo de E-mails](#-7-motor-de-relatórios-pdf--disparo-de-e-mails)
8. [Mapa Completo do Código-Fonte (Codebase Map)](#-8-mapa-completo-do-código-fonte-codebase-map)
9. [Dicionário de Endpoints da API REST](#-9-dicionário-de-endpoints-da-api-rest)
10. [Configuração de Ambiente (.env) & Segurança](#-10-configuração-de-ambiente-env--segurança)
11. [Instalação e Execução Local](#-11-instalação-e-execução-local)
12. [Deploy em Produção (Docker & Easypanel)](#-12-deploy-em-produção-docker--easypanel)
13. [Roadmap de Evolução Contínua](#-13-roadmap-de-evolução-contínua)

---

## 📌 1. Visão Geral do Projeto

O **Torres CX** é uma plataforma corporativa web (PWA - Progressive Web App) desenvolvida para a **Torres Engenharia / Torres CX**, focada na gestão, auditoria, execução e controle de manutenções preventivas, inspeções rotineiras e manutenções corretivas em shopping centers e edifícios empresariais de grande porte.

### Principais Objetivos do Software:
- **Digitalização Total em Campo**: Substituição completa de pranchetas e planilhas manuais por um formulário inteligente e responsivo para tablets e smartphones.
- **Auditoria e Conformidade**: Registro fotográfico de não conformidades (evidências antes e depois) e cruzamento em tempo real com matrizes mestras de engenharia.
- **Relatórios Técnicos Imediatos**: Geração automatizada de relatórios em PDF de alta qualidade e despacho instantâneo por e-mail para lojistas e superintendências de condomínio.
- **Resiliência Offline**: Operação contínua em locais sem conectividade celular (subsolos, casas de máquinas, shafts e docas).

---

## 🏗 2. Arquitetura & Ecossistema Microsoft 365

A solução adota uma arquitetura híbrida e orientada à nuvem da **Microsoft 365**, utilizando o Microsoft SharePoint / Lists como repositório de persistência e auditoria, dispensando bancos de dados relacionais tradicionais e aproveitando a governança de dados corporativa já existente.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 + Vite)                      │
│   • Tailwind CSS v4   • Lucide React   • React Router v7   • PWA       │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │              Dexie.js (IndexedDB — Offline First)              │   │
│   │  • syncQueue (Outbox)   • cachedData   • drafts   • localSub   │   │
│   └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST (Cookies + Session)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Node.js + Express)                     │
│   • MSAL Node (OAuth 2.0)   • Express-Session   • Puppeteer (PDF)      │
│   • Helmet / CORS / Morgan  • XLSX Parser       • Multi-Tenant Engine  │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │                               │
       Microsoft Graph API (v1.0)       Microsoft Graph API (v1.0)
                    ▼                               ▼
┌────────────────────────────────────────┐  ┌────────────────────────────┐
│      SharePoint & Microsoft Lists      │  │    OneDrive / SharePoint   │
│   • Listas SDAI (Inspeções)            │  │        Excel Files         │
│   • Listas BMS (Automação)             │  │   • Cadastro de Lojas/LUC  │
│   • Histórico de Preventivas           │  │   • Matrizes Mestras       │
│   • Gestão de Corretivas / OS          │  │     de Preventivas (Ano)   │
└────────────────────────────────────────┘  └────────────────────────────┘
                    ▲
                    │ Graph API (/me/sendMail)
┌───────────────────┴────────────────────┐
│         Microsoft Exchange Mail        │
│   • Disparo de laudos técnicos PDF     │
│     com anexos aos destinatários e CC  │
└────────────────────────────────────────┘
```

---

## 🏢 3. Multi-Tenancy & Matriz de Permissões (RBAC)

O sistema é estritamente **multi-tenant**. Cada empreendimento (shopping ou empresarial) possui seu próprio slug identificador, rotas dedicadas (`/:tenant/...`), planilhas de lojas, matrizes mestras de preventivas, listas no SharePoint e configurações de e-mails de notificação.

A configuração central reside no arquivo [`backend/config/tenants.js`](file:///e:/app-torres-novo/backend/config/tenants.js).

### Empreendimentos Habilitados (Tenants)

| Slug (`tenant`) | Nome do Empreendimento | Sistemas Ativos | Lista SharePoint SDAI / BMS | Matriz Mestra Preventiva |
|---|---|---|---|---|
| `riomar-recife` | Shopping RioMar Recife | SDAI, BMS, SCA | `2024-6-1361-SDAI...` / `2024-6-1361-BMS...` | Em configuração |
| `riomar-kennedy` | Shopping RioMar Kennedy | SDAI, BMS *(Área Comum ativa)* | `2021-5-491-SDAI...` / `RIOMAR_KENNEDY_PREVENTIVAS_2026` | `RIOMAR_KENNEDY_PREVENTIVAS_2026` (SDAI & BMS) |
| `shopping-recife` | Shopping Recife | SDAI | `2026-3-180-SDAI...` / `2026-3-180-BMS...` | `SHOPPING_RECIFE_PREVENTIVAS_2026` |
| `shopping-guararapes` | Shopping Guararapes | SDAI, BMS | `2026-1-1765-SDAI...` / `2026-1-1765-BMS...` | `SHOPPING_GUARARAPES_PREVENTIVAS_2026` |
| `riomar-aracaju` | Shopping RioMar Aracaju | BMS *(Customizado)* | `2018-6-26-BMS...` / `CC-2018-6-26-MAN...` | Em configuração |
| `salvador-norte` | Salvador Norte Shopping | SDAI, BMS | Em configuração | `SALVADOR_NORTE_SHOPPING_PREVENTIVAS_2026` |
| `empresarial-rui-barbosa` | Empresarial Rui Barbosa | SDAI | `2024-3-1308-MAN...` | `EMPRESARIAL_RUI_BARBOSA_PREVENTIVAS_2026` |
| `empresarial-cicero-dias` | Empresarial Cicero Dias | SDAI, BMS, SCA, CFTV | `2021-11-656-SDAI...` | `EMPRESARIAL_CICERO_DIAS_PREVENTIVAS_2026` |
| `empresarial-kronos` | Empresarial Kronos | SDAI | `2024-11-1485-SDAI...` | `EMPRESARIA_KRONOS_PREVENTIVAS_2026` |
| `plaza-shopping-recife` | Plaza Shopping Recife | SDAI | `2026-7-1915-SDAI...` | `PLAZA_SHOPPING_PREVENTIVAS_2026` |
| `jcpm-trade-center` | JCPM Trade Center | SDAI, BMS | Listas JCPM | `JCPM_TRADE_CENTER_PREVENTIVAS_2026` |
| `beach-class` | Beach Class Convention | SDAI | Listas Beach Class | `BEACH_CLASS_PREVENTIVAS_2026` |

### Controle de Acesso Baseado em Função (RBAC)

O controle de privilégios opera por verificação do e-mail autenticado via Microsoft Entra ID:
- **Acesso Master (`['*']`)**: Administradores e gerentes que possuem visão completa de todos os tenants cadastrados.
- **Acesso Regional/Setorial**: Técnicos de campo que visualizam apenas os shoppings onde atuam (ex: técnicos alocados exclusivamente no RioMar Kennedy ou Shopping Recife).
- **Tratamento de Sessão**: Se o usuário não tiver permissão no tenant requisitado na URL, o backend devolve status `403 Forbidden` e o frontend redireciona de volta à seleção de shoppings.

---

## ⚙️ 4. Sistemas de Engenharia Monitorados

A aplicação subdivide-se em 4 grandes verticais de engenharia predial:

### 1. SDAI (Sistema de Detecção e Alarme de Incêndio)
Audita e valida dispositivos em lojas e áreas comuns:
- **DF**: Detector Óptico / Detector de Fumaça
- **DT**: Detector Térmico / Termovelocimétrico
- **AM**: Acionador Manual (Botoeira de Emergência)
- **Sirenes**: Audiovisuais e Sonoras
- **DG**: Detector de Gás (GLP / Gás Natural)
- **Módulos**: Módulos de Entrada/Monitoramento e Módulos de Saída/Comando (Relés)
- **Centrais de Incêndio**: Centrais endereçáveis ou convencionais (centrais próprias de lojistas interligadas à central do shopping)
- **Status Operacional**: Normal, Parcialmente em Falha, Em Defeito ou Ausência de Detecção
- **Pendências Críticas**: Abertura de forro, fiação/integridade de cabo de sinal e alimentação, necessidade de interligação de sistemas.

### 2. BMS (Building Management System / Automação Predial)
Gerenciamento de utilidades e automação de ar condicionado/conforto:
- Sensores de temperatura de ambiente e temperatura de duto
- Sensores de presença / infravermelho passivo e micro-ondas
- Botões de pânico e sensores magnéticos de abertura de portas/portões
- Barreira perimetral infravermelha
- Relés de falta de fase elétrica
- Comandos e monitoramento de status de fancoils e chillers
- Comandos e status de circuitos de iluminação/vitrines
- Medidores inteligentes de consumo de energia elétrica e hidrômetros (água gelada e potável)

### 3. SCA (Sistema de Controle de Acesso)
*(Módulo em fase de expansão)*:
- Monitoramento de catracas, torniquetes, cancelas de estacionamento e leitoras de proximidade/biometria.

### 4. CFTV (Circuito Fechado de Televisão)
*(Módulo em fase de expansão)*:
- Monitoramento de câmeras IP, analógicas, switches PoE, no-breaks e gravadores NVR/DVR.

---

## 📋 5. Módulos Funcionais da Aplicação

### 🏪 A. Inspeção de Lojas (SDAI e BMS)
- **Autocomplete Inteligente**: O técnico digita o nome ou número LUC (Código da Loja) e o frontend busca instantaneamente na planilha oficial do shopping armazenada no SharePoint.
- **Formulário Completo**: Coleta de dados do solicitante da loja, responsável do shopping, contagens de dispositivos, testes de alarmes, centrais próprias e checklists de pendências.
- **Evidências Fotográficas**: Upload de até 3 fotos (máx. 15MB) comprimidas e enviadas para o item do SharePoint como anexos oficiais.
- **Emissão Automática de Laudo**: Criação do registro no Microsoft Lists, geração em background do PDF com Puppeteer e envio automático por e-mail para o lojista e supervisores com cópia pré-definida.

### 🛠 B. Preventivas de Área Comum (Matriz Mestra)
- **Sincronização Bidirecional**: O sistema lê a **Matriz Mestra em Excel** do shopping (onde estão cadastrados todos os equipamentos e a programação anual mês a mês) e cruza com a **Lista de Histórico de Preventivas** no SharePoint.
- **Execução em Campo**: O técnico seleciona o dispositivo, confere localização/pavimento, preenche as checagens preventivas e marca como realizado.
- **Abertura Condicional de OS Corretiva**: Caso o técnico aponte anomalia ou defeito durante a preventiva, o sistema cria automaticamente um chamado na **Lista de Corretivas** com prioridade, fotos do defeito e descrição técnica da falha.
- **Atualização na Planilha**: A célula do mês correspondente no Excel da Matriz Mestra é atualizada remotamente via API Graph (`Realizado 2026`).

### 🚨 C. Corretivas & Ocorrências
- **Gestão de Chamados**: Interface para visualização de ordens de serviço pendentes, em andamento ou concluídas.
- **Encerramento de Ocorrência**: Permite que a equipe de manutenção anexe a **foto 3 (evidência da correção)**, registre a descrição da solução adotada, informe a data efetiva de atendimento e finalize o status para *Concluído*.

### 📊 D. Dashboards Executivos
- Métricas em tempo real para tomada de decisão:
  - Percentual de cobertura de lojas inspecionadas no ciclo atual.
  - Taxa de conformidade de sistemas (Normal vs. Parcial vs. Em Defeito).
  - Progresso mensal e acumulado das preventivas da área comum frente ao planejado na Matriz Mestra.
  - Indicadores de tempo médio de atendimento e taxa de resolução de corretivas.

### 📄 E. Emissão de Relatórios Técnicos Mensais
- Relatórios técnicos consolidados (Mensais ou por Período) contendo gráficos de desempenho, tabela de dispositivos testados e galeria fotográfica de anomalias encontradas.

---

## 🔄 6. Arquitetura Offline-First & PWA (Dexie.js)

Técnicos de engenharia frequentemente atuam em subsolos, áreas técnicas e shafts sem sinal de internet ou Wi-Fi. O Torres CX foi projetado com uma arquitetura **Offline-First** completa utilizando o **Dexie.js** (IndexedDB):

```
                        DISPOSITIVO DO USUÁRIO
┌────────────────────────────────────────────────────────────────────────┐
│                        Formulário de Vistoria                          │
│                                   │                                    │
│                 ┌─────────────────┴─────────────────┐                  │
│                 ▼ [Online]                          ▼ [Sem Internet]   │
│       Envio Imediato via API            Gravação na syncQueue (IndexedDB)│
│                 │                                   │                  │
│                 ▼                                   ▼                  │
│        Sucesso na Nuvem                Armazena rascunho em drafts      │
│                                                     │                  │
│                                        Evento 'online' do Navegador    │
│                                                     │                  │
│                                                     ▼                  │
│                                        Processamento FIFO da Fila      │
│                                        (Outbox Pattern com Retentativa)│
└────────────────────────────────────────────────────────────────────────┘
```

### Tabelas Locais no IndexedDB (`TorresCX_DB`):
1. **`syncQueue`**: Fila de requisições no padrão *Outbox*. Guarda a URL, método (POST/PUT), headers, payloads com fotos Base64 e contagem de tentativas (`retryCount`). Ao restabelecer a conexão, os itens são transmitidos ao backend na ordem cronológica (FIFO).
2. **`cachedData`**: Cache local de dados estáticos ou semi-estáticos: relação de lojas por shopping, metadados de permissão, matrizes de dispositivos e sessão ativa do usuário.
3. **`drafts`**: Auto-save contínuo de vistorias em andamento. Caso a bateria acabe ou o navegador reinicie, o técnico não perde os dados preenchidos.
4. **`localSubmissions`**: Histórico local de formulários preenchidos no dia, permitindo conferência e consulta imediata antes da sincronização.

### Fallback de Autenticação Offline:
Ao efetuar login online, os dados do perfil e shoppings autorizados são cacheados de forma segura. Se o técnico abrir o PWA sem internet, a sessão é restaurada do cache local permitindo o acesso imediato aos formulários.

---

## 📄 7. Motor de Relatórios PDF & Disparo de E-mails

A geração de relatórios de vistoria é processada no backend via **Puppeteer** (Chromium headless):

1. **Templates HTML**: Utiliza layouts homologados ([`modelo_preventiva.html`](file:///e:/app-torres-novo/modelo_preventiva.html) e [`modelo_dashboard_preventiva.html`](file:///e:/app-torres-novo/modelo_dashboard_preventiva.html)).
2. **Injeção de Assets em Base64**: Para garantir renderização rápida e independente de links externos no momento da geração, logos da empresa, logos dos shoppings e fotos das inspeções são convertidas em Data URIs Base64 e injetadas diretamente no DOM do template.
3. **Renderização PDF**: O Puppeteer abre o HTML em background, aguarda o carregamento de imagens e gera um buffer PDF com precisão gráfica milimétrica (margens A4, cabeçalhos, rodapés e paginação).
4. **Disparo Transacional (Microsoft Graph Mail)**: O backend invoca o endpoint `/me/sendMail` da Graph API usando o token de acesso da sessão do técnico, enviando o laudo com o anexo PDF para o e-mail do lojista, responsável do condomínio e cópia oculta para auditoria da engenharia.

---

## 📁 8. Mapa Completo do Código-Fonte (Codebase Map)

```
app-torres-novo/
├── README.md                      # Documento mestre de arquitetura (este arquivo)
├── modelo_preventiva.html         # Template HTML oficial do laudo técnico de preventivas
├── modelo_dashboard_preventiva.html # Template HTML oficial do dashboard executivo
├── form_preventiva 1.html         # Rascunho inicial do formulário de preventivas
├── testPdf.js                     # Script isolado para teste de geração de PDF com Puppeteer
├── testScreenshot.js              # Script auxiliar para captura de tela com Puppeteer
├── docs/                          # Documentos auxiliares, templates CSV de listas e logos
│   ├── Template_BMS_List.csv      # Definição das colunas da Lista de BMS no SharePoint
│   ├── microsoft_lists_structure.csv # Estrutura padrão de listas de SDAI
│   └── *.png                      # Logos dos shoppings em alta resolução
│
├── backend/                       # API REST em Node.js + Express
│   ├── server.js                  # Ponto de entrada do servidor, middlewares de segurança e CORS
│   ├── Dockerfile                 # Configuração para contêiner Linux com dependências Chromium
│   ├── package.json               # Dependências do backend (msal-node, graph-client, puppeteer, xlsx)
│   ├── .env.example               # Template de variáveis de ambiente do Azure e SharePoint
│   │
│   ├── config/                    # Configurações de domínio do sistema
│   │   ├── authConfig.js          # Configuração do MSAL Node, escopos e URLs de redirect
│   │   └── tenants.js             # Dicionário mestre dos shoppings e matriz de RBAC por e-mail
│   │
│   ├── middlewares/               # Middlewares da API Express
│   │   ├── auth.middleware.js     # Valida se a sessão do usuário possui token de acesso válido
│   │   ├── tenant.middleware.js   # Valida se o usuário tem permissão para acessar o tenant solicitado
│   │   └── errorHandler.middleware.js # Tratamento centralizado de erros e exceções da API
│   │
│   ├── controllers/               # Controladores de regras de negócio
│   │   ├── checklists.controller.js # CRUD de vistorias de lojas, upload de fotos e envio de PDF
│   │   ├── preventivas.controller.js# Leitura da Matriz Mestra, cruzamento e salvamento com OS condicional
│   │   ├── corretivas.controller.js # Listagem e encerramento de ocorrências / chamados corretivos
│   │   ├── report.controller.js     # Endpoint para geração do relatório HTML/PDF consolidado
│   │   └── inspections.controller.js# Métodos legados de inspeções
│   │
│   ├── routes/                    # Definição e roteamento das rotas HTTP
│   │   ├── index.js               # Agrupador central de rotas (/api/auth, /api/checklists, etc.)
│   │   ├── auth.routes.js         # Rotas de signin, redirect callback, profile e signout
│   │   ├── checklists.routes.js   # Rotas de inspeções de lojas e download de relatórios
│   │   ├── lojas.routes.js        # Autocomplete de lojas lidas via Excel no SharePoint
│   │   ├── preventivas.routes.js  # Rotas de dispositivos da matriz e salvamento de preventivas
│   │   ├── corretivas.routes.js   # Rotas de listagem e atualização de corretivas
│   │   └── report.routes.js       # Rotas de relatórios técnicos mensais
│   │
│   └── services/                  # Serviços de integração e utilitários
│       ├── graphClient.js         # Fábrica de instâncias do cliente Microsoft Graph autenticado
│       ├── msGraph.service.js     # Operações auxiliares no Microsoft Graph
│       ├── excelService.js        # Leitura, parsing e cache de planilhas de lojas (LUC)
│       ├── matrizMestraService.js # Download e processamento das planilhas de matriz anual de preventivas
│       ├── pdfService.js          # Motor Puppeteer para geração de laudos em PDF de SDAI
│       ├── pdfServiceBMS.js       # Motor Puppeteer para geração de laudos em PDF de BMS
│       ├── emailService.js        # Disparo de e-mails via Microsoft Graph Mail com anexo PDF
│       └── reportService.js       # Montagem e cálculo de KPIs do relatório mensal de preventivas
│
└── frontend/                      # Aplicação Single Page Application (SPA / PWA)
    ├── index.html                 # Ponto de entrada HTML do Vite com metadados PWA
    ├── vite.config.js             # Configuração do Vite, Tailwind CSS v4 e VitePWA plugin
    ├── package.json               # Dependências do frontend (React 19, Dexie, Tailwind v4, Lucide)
    │
    └── src/
        ├── main.jsx               # Bootstrap do React DOM
        ├── App.jsx                # Roteamento global, verificação de auth e guards de rotas
        ├── index.css              # Importações do Tailwind CSS e estilos utilitários
        │
        ├── config/
        │   └── clientMenuConfig.js # Configuração dinâmica dos menus laterais de acordo com o tenant
        │
        ├── services/
        │   ├── db.js              # Implementação do IndexedDB com Dexie.js (syncQueue, cache, drafts)
        │   ├── syncService.js     # Worker responsável pela sincronização da fila offline ao conectar
        │   └── api.js             # Cliente HTTP central para chamadas à API com credentials
        │
        ├── components/            # Componentes reutilizáveis
        │   ├── TenantLayout.jsx   # Layout com barra superior, sidebar dinâmica e status do tenant
        │   ├── ChecklistForm.jsx  # Formulário padrão de vistoria de lojas SDAI
        │   ├── OfflineBanner.jsx  # Barra de alerta visual quando o dispositivo perde a internet
        │   ├── InstallPWA.jsx     # Banner e modal de instalação do aplicativo no dispositivo
        │   └── SyncIndicator.jsx  # Indicador de itens pendentes de sincronização na fila
        │
        └── pages/                 # Páginas da aplicação
            ├── ShoppingSelection.jsx   # Seleção do shopping permitido para o usuário logado
            ├── DashboardSDAI.jsx       # Dashboard e gráficos de inspeção de lojas SDAI
            ├── DashboardBMS.jsx        # Dashboard e gráficos de automação predial BMS
            ├── DashboardPreventivas.jsx# Dashboard e indicadores da manutenção preventiva de área comum
            ├── FormBMS.jsx             # Formulário de vistoria de lojas focado em BMS (com regras de Aracaju)
            ├── InspecaoLojas.jsx       # Listagem e histórico de vistorias realizadas em lojas
            ├── PreventivasAreaComum.jsx # Execução de checklist de preventivas de equipamentos da matriz
            ├── CorretivasOcorrencias.jsx# Quadro e listagem de corretivas com fotos de solução
            ├── Relatorios.jsx          # Emissão e visualização de relatórios executivos em PDF
            ├── Cadastros.jsx           # Gestão e conferência de lojas e dispositivos cadastrados
            └── ComingSoon.jsx          # Tela padrão para módulos e shoppings em desenvolvimento
```

---

## 🔌 9. Dicionário de Endpoints da API REST

Todas as rotas de negócio são servidas sob o prefixo `/api` e exigem que o usuário esteja autenticado (`isAuthenticated`). As rotas com parâmetro `tenant` também executam o middleware de validação de acesso (`tenantAuthorization`).

### Autenticação & Sessão (`/api/auth`)
| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/auth/signin` | Inicia o fluxo OAuth 2.0 redirecionando para a tela de login da Microsoft. |
| `GET` | `/api/auth/redirect` | Callback oficial que recebe o `code`, gera o access token e inicia a sessão. |
| `GET` | `/api/auth/profile` | Retorna o usuário logado, estado de auth e a lista de shoppings autorizados para ele. |
| `GET` | `/api/auth/signout` | Encerra a sessão no Express e efetua o logout no Microsoft Entra ID. |

### Lojas & Autocomplete (`/api/lojas`)
| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| `GET` | `/api/lojas` | `?tenant=<slug>&refresh=<bool>` | Retorna a lista de lojas, pisos e códigos LUC lidos da planilha Excel no SharePoint. |
| `POST` | `/api/lojas/refresh` | `?tenant=<slug>` | Força a limpeza do cache de memória e faz download atualizado da planilha. |

### Checklists de Lojas (`/api/checklists`)
| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| `GET` | `/api/checklists` | `?tenant=<slug>` | Lista as vistorias já cadastradas na lista correspondente do Microsoft Lists. |
| `GET` | `/api/checklists/:id` | `?tenant=<slug>` | Busca os dados completos de uma vistoria específica pelo ID da lista. |
| `POST` | `/api/checklists` | `body: { ...formData, tenant }` | Salva uma nova inspeção, faz upload das fotos, gera o PDF e dispara o e-mail. |
| `GET` | `/api/checklists/:id/pdf` | `?tenant=<slug>` | Faz o download direto do laudo PDF da inspeção gerado via Puppeteer. |
| `POST` | `/api/checklists/:id/resend` | `?tenant=<slug>` | Reenvia o e-mail de relatório com anexo PDF para os destinatários. |

### Preventivas de Área Comum (`/api/preventivas`)
| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| `GET` | `/api/preventivas/dispositivos` | `?tenant=<slug>&mes=<num>&ano=<num>` | Lista os equipamentos da Matriz Mestra em Excel cruzando com o que já foi realizado no SharePoint. |
| `GET` | `/api/preventivas/dashboard-status` | `?tenant=<slug>` | Retorna o consolidado de dispositivos totais, realizados, pendentes e atrasados. |
| `POST` | `/api/preventivas/salvar` | `body: { tenant, dispositivo, checagens, fotos, ... }` | Registra a preventiva no SharePoint, atualiza o Excel da matriz e cria OS Corretiva se houver falha. |

### Corretivas & Ocorrências (`/api/corretivas`)
| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| `GET` | `/api/corretivas` | `?tenant=<slug>` | Lista todas as ordens de serviço corretivas ativas e encerradas do tenant. |
| `PUT` | `/api/corretivas/:id` | `?tenant=<slug>` | Atualiza a ocorrência (descrição da solução técnica, foto 3 da correção e encerramento). |

### Relatórios Técnicos Consolidados (`/api/reports`)
| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| `GET` | `/api/reports/monthly-preventive` | `?tenant=<slug>&mes=<num>&ano=<num>` | Gera dinamicamente o HTML/PDF do Relatório Técnico Mensal de Engenharia com KPIs e gráficos. |

---

## 🔐 10. Configuração de Ambiente (.env) & Segurança

As configurações do backend são parametrizadas via variáveis de ambiente no arquivo [`backend/.env`](file:///e:/app-torres-novo/backend/.env):

```ini
# Configuração do Servidor Express
PORT=3001
NODE_ENV=development
SESSION_SECRET=chave-criptografica-forte-de-sessao

# Microsoft Entra ID (Azure AD) — Registro de Aplicativo
CLIENT_ID=eab00bde-7ad2-4f42-a6ad-ffdbae578aae
TENANT_ID=9a0c3aac-2369-47a9-9c5a-8bd72f05c458
CLIENT_SECRET=sua_chave_secreta_do_azure_ad
REDIRECT_URI=http://localhost:3001/api/auth/redirect

# SharePoint / Microsoft Lists — Graph API
SHAREPOINT_HOSTNAME=torrescx.sharepoint.com
SHAREPOINT_SITE_PATH=/sites/Manutencao

# URLs de Produção e Comunicação Cross-Origin
FRONTEND_URL=https://dinastia-app_torres_frontend.zj3i1b.easypanel.host/
```

### Boas Práticas de Segurança Implementadas:
- **Cookies de Sessão com Proteção Dupla**: Em ambiente de produção, os cookies operam com `secure: true` (apenas HTTPS) e `sameSite: 'none'` para suportar a comunicação cross-origin entre o frontend e backend hospedados no Easypanel.
- **Proxy Reverso Confiável**: A diretiva `app.set('trust proxy', true)` está habilitada no Express para ler corretamente os cabeçalhos `X-Forwarded-Proto` e `X-Forwarded-For` gerados pelo Traefik/Docker.
- **Proteção de Cabeçalhos HTTP**: Uso do middleware `helmet` para prevenção contra clickjacking, MIME-sniffing e injeções de script maliciosas.

---

## 🚀 11. Instalação e Execução Local

### Pré-requisitos:
- **Node.js**: Versão 20.x ou 22.x LTS instalada
- **NPM**: Gerenciador de pacotes padrão

### Passo 1: Configurar e Rodar o Backend
```bash
# Navegar até a pasta do backend
cd backend

# Instalar dependências
npm install

# Iniciar em modo de desenvolvimento (com nodemon)
npm run dev
```
> O backend estará ativo em: `http://localhost:3001`  
> Health check: `http://localhost:3001/health`

### Passo 2: Configurar e Rodar o Frontend
```bash
# Em outro terminal, navegar até a pasta do frontend
cd frontend

# Instalar dependências
npm install

# Iniciar em modo de desenvolvimento com Vite
npm run dev
```
> O frontend estará acessível em: `http://localhost:5173`

---

## 🐳 12. Deploy em Produção (Docker & Easypanel)

O backend possui um [`Dockerfile`](file:///e:/app-torres-novo/backend/Dockerfile) otimizado baseado em `node:20-slim`.

### Considerações Críticas para o Puppeteer no Docker:
O Puppeteer requer dependências nativas de sistema para conseguir executar o navegador Chromium sem interface gráfica no Linux:
```dockerfile
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates procps libxss1 libnss3 \
    libasound2 libatk-bridge2.0-0 libgtk-3-0 libgbm-dev \
    fonts-liberation --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
```
No deploy pelo **Easypanel / Hostinger**, a aplicação backend e frontend são configuradas como dois serviços interligados:
- **Frontend**: Aplicação estática servida em Vite com variáveis `VITE_API_URL` apontando para o subdomínio da API.
- **Backend**: Contêiner Node.js com limites de memória configurados para suportar instâncias do Puppeteer durante a geração simultânea de relatórios PDF.

---

## 🗺 13. Roadmap de Evolução Contínua

- [x] **Arquitetura Multi-Tenant**: Suporte nativo a 12 empreendimentos comerciais e shopping centers.
- [x] **Autenticação Microsoft Entra ID**: Login federado OAuth 2.0 corporativo.
- [x] **Inspeção de Lojas SDAI e BMS**: Checklists com fotos, PDF e e-mail transacional.
- [x] **Preventivas de Área Comum**: Integração entre Matriz Mestra em Excel e SharePoint Lists.
- [x] **Gestão de Corretivas**: Abertura automática de chamados a partir de preventivas com defeito.
- [x] **Offline-First & PWA**: Instalação no celular e sincronização automática via Dexie.js.
- [ ] **Módulo SCA Completo**: Checklists preventivos e cadastros de catracas e leitoras de acesso.
- [ ] **Módulo CFTV Completo**: Auditoria visual de câmeras e armazenamento de gravações.
- [ ] **Integração com Sensores IoT**: Leitura por telemetria MQTT de dados de fancoils e chillers.

---

*Torres CX — Tecnologia e Engenharia Conectadas para a Segurança Predial.*
