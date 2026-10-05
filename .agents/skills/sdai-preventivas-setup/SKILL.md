---
name: sdai-preventivas-setup
description: >-
  Guia completo, referências e passo a passo para implantar o módulo de Manutenção Preventiva de Área Comum SDAI (Sistema de Detecção e Alarme de Incêndio) para qualquer tenant no TorresCx. Use esta skill quando o usuário solicitar adicionar, configurar ou integrar preventivas SDAI para um novo shopping/cliente, incluindo matriz mestra em Excel, listas do SharePoint, painéis operacionais, dashboards, menus, RBAC e relatórios NBR 17240.
---

# Skill: Implantação de Preventivas de Área Comum SDAI no TorresCx

Este guia padroniza o fluxo de ponta a ponta para habilitar o módulo de **Manutenção Preventiva de Área Comum SDAI** (Sistema de Detecção e Alarme de Incêndio) para novos shoppings e empreendimentos (tenants) no sistema TorresCx.

---

## 1. Visão Geral da Arquitetura SDAI

O módulo de preventivas SDAI atua no controle, rastreamento e manutenção periódica dos dispositivos de detecção e alarme de incêndio (detectores ópticos de fumaça, térmicos, acionadores manuais/botoeiras, sinalizadores audiovisuais/sirenes, módulos de monitoramento/controle):

```
[ Matriz Mestra Excel SDAI ] (Cronograma anual 1..12 no SharePoint)
          │
          ▼
[ Backend TorresCx ] ── Graph API ──► [ List Histórico Preventivas SDAI ]
    - matrizMestraService                 (Registros de teste, fotos e pareceres)
    - preventivas.controller               │
          │                               ▼
          ├─────────────────────────► [ List Corretivas/Ocorrências ] (Abertura automática de OS)
          ▼
[ Frontend TorresCx ]
    - /:tenant/sdai/preventivas/area-comum  (Painel Operacional com cards do mês e atrasados)
    - /:tenant/sdai/preventivas/dashboard   (Dashboard anual, conciliação e KPIs)
    - /:tenant/sdai/cadastros               (Links rápidos da Matriz Mestra e Histórico)
    - /:tenant/sdai/relatorios              (Dossiê mensal com conformidade NBR 17240)
```

---

## 2. Checklist de Ativação de um Novo Tenant

Para implantar a rotina de preventivas SDAI para um shopping, siga rigorosamente as etapas:

### Etapa 1: Coleta dos Dados do Tenant

Antes de alterar o código, obtenha com o usuário:
1. **Link de Compartilhamento do Excel da Matriz Mestra SDAI** (no SharePoint da Torres / Manutenção).
   - Formato típico: `https://torrescx.sharepoint.com/:x:/s/Manutencao/IQ...`
2. **Nome da Lista do SharePoint de Histórico de Preventivas SDAI**:
   - Padrão recomendado: `NOME_SHOPPING_PREVENTIVAS_SDAI_2026` (ou `NOME_SHOPPING_PREVENTIVAS_2026`).
3. **Nome da Lista de Corretivas/Ocorrências**:
   - Padrão: `CC-202X-X-XXX-MAN-SHOP_...` (já costuma existir no cadastro do tenant).
4. **Responsável Técnico do Shopping (SDAI)**:
   - Nome do solicitante, telefone e e-mail.

> **Estrutura Esperada na Matriz Mestra SDAI (Colunas Excel):**
> O serviço [`matrizMestraService.js`](file:///e:/app-torres-novo/backend/services/matrizMestraService.js) realiza o reconhecimento inteligente de cabeçalhos nas primeiras 10 linhas:
> - **Pavimento / Piso / Nível**: `L1`, `L2`, `Térreo`, `G1`, `Cobertura`, etc.
> - **Laço / Circuito / Painel**: `Laço 01`, `Laço 02`, `Painel Principal`, etc.
> - **Endereço / TAG / Ponto**: Endereço do dispositivo no laço (ex.: `001`, `124`, `L1-045`).
> - **Tipo de Dispositivo**: `Detector de Fumaça`, `Detector Térmico`, `Acionador Manual`, `Sirene`, `Módulo`, etc.
> - **Descrição / Localização**: Local físico exato (ex.: `Corredor Lojas Americanas`, `Doca 02`, `Hall Elevadores`).
> - **Mês Manutenção / Programação**: Nome do mês (`Janeiro` .. `Dezembro`) ou número (`1` .. `12`).
> - **Realizado 2026**: Status atual (`sim` ou vazio).

---

### Etapa 2: Configuração no Backend (`backend/config/tenants.js`)

No objeto `shoppings`, localize a chave do tenant (`slug-do-shopping`) e configure as propriedades de preventivas:

```javascript
'slug-do-shopping': {
  name: 'Shopping Exemplo',
  logo: '/logo_shopping_exemplo.png',
  listaSDAI: '2024-X-XXX-SDAI-Shopping Exemplo',
  listaBMS: '2024-X-XXX-BMS-Shopping Exemplo',
  excelLojasUrl: 'https://torrescx.sharepoint.com/:x:/s/...',
  ccEmails: ['carlos.gueiros@torrescx.com.br'],

  // Preventivas Área Comum (SDAI)
  excelPreventivasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/LINK_COMPARTILHADO_EXCEL_SDAI',
  listaHistoricoPreventivas: 'EXEMPLO_PREVENTIVAS_SDAI_2026',
  listaCorretivas: 'CC-2024-X-XXX-MAN-EXEMPLO',

  responsavelShopping: {
    sdai: {
      solicitante: 'Nome do Solicitante',
      telefone: '81999999999',
      email: 'responsavel.sdai@shopping.com.br',
    },
    bms: { ... },
  },
},
```

#### Permissões RBAC (ao final de `tenants.js`):
Adicione o `slug-do-shopping` nos arrays de e-mails dos técnicos e gestores autorizados:
```javascript
'carlos.gueiros@torrescx.com.br': [..., 'slug-do-shopping'],
'tecnico.responsavel@torrescx.com.br': ['slug-do-shopping'],
```

---

### Etapa 3: Habilitação de Menus no Frontend (`frontend/src/config/clientMenuConfig.js`)

Na função `getSDAISubmenus(tenant)`:

1. Crie a constante do tenant (se não existir):
```javascript
const isNovoShopping = tenant === 'slug-do-shopping';
```

2. Inclua o tenant na condição de preventivas ativas:
```javascript
const hasPreventivasActive = isSalvadorNorte || ... || isNovoShopping;
```

3. Certifique-se de que `hasCorretivasActive` herda `hasPreventivasActive` ou inclua o tenant nela.

Isso removerá a flag `comingSoon: true` dos submenus:
- `Dashboard Preventivas` (`route: /:tenant/sdai/preventivas/dashboard`)
- `Preventivas Área Comum` (`route: /:tenant/sdai/preventivas/area-comum`)
- `Relatórios` (`route: /:tenant/sdai/relatorios`)

---

### Etapa 4: Liberação de Rotas no Frontend (`frontend/src/App.jsx`)

1. Localize a constante `TENANTS_WITH_PREVENTIVAS` no topo do arquivo e adicione o slug:
```javascript
const TENANTS_WITH_PREVENTIVAS = [
  'salvador-norte',
  'empresarial-rui-barbosa',
  'shopping-guararapes',
  'empresarial-cicero-dias',
  'empresarial-kronos',
  'riomar-kennedy',
  'jcpm-trade-center',
  'beach-class',
  'shopping-recife',
  'plaza-shopping-recife',
  'slug-do-shopping', // <--- Adicionar aqui
];
```

2. As seguintes rotas serão liberadas automaticamente:
- `/:tenant/sdai/preventivas/area-comum` -> [`PreventivasAreaComum.jsx`](file:///e:/app-torres-novo/frontend/src/pages/PreventivasAreaComum.jsx)
- `/:tenant/sdai/preventivas/dashboard` -> [`DashboardPreventivas.jsx`](file:///e:/app-torres-novo/frontend/src/pages/DashboardPreventivas.jsx)
- `/:tenant/sdai/relatorios` -> [`Relatorios.jsx`](file:///e:/app-torres-novo/frontend/src/pages/Relatorios.jsx)

---

### Etapa 5: Atualização da Documentação (`README.md`)

Na tabela **Empreendimentos Habilitados (Tenants)**, atualize a linha do tenant:
- De: `| slug | Nome | SDAI | ... | Em configuração |`
- Para: `| slug | Nome | SDAI *(Preventiva SDAI ativa)* | ... | NOME_LISTA_PREVENTIVAS_2026 |`

---

## 3. Regras de Negócio e Particularidades do SDAI

Ao implantar preventivas SDAI, atente-se às seguintes regras cruciais do sistema TorresCx:

### 1. Distinção Crucial entre SDAI e BMS
- **SDAI**:
  - Chave de configuração: `excelPreventivasUrl` e `listaHistoricoPreventivas`.
  - Sistema padrão: `sistema="sdai"`.
  - Tela do Dashboard: [`DashboardPreventivas.jsx`](file:///e:/app-torres-novo/frontend/src/pages/DashboardPreventivas.jsx) (exibe Laço, Endereço, Pavimento e Tipo de Sensor).
  - Relatório: Contém obrigatoriamente parecer técnico e menção à **NBR 17240**.
- **BMS**:
  - Chave de configuração: `excelPreventivasBmsUrl` e `listaHistoricoPreventivasBms`.
  - Tela do Dashboard: [`DashboardPreventivasBMS.jsx`](file:///e:/app-torres-novo/frontend/src/pages/DashboardPreventivasBMS.jsx) (exibe `TAG - Descrição` e tipos `Medição`, `Iluminação`, `Fancoil`).
  - Relatório: **Nunca** menciona NBR 17240.

### 2. Identificação e Cruzamento de Histórico SDAI
- Dispositivos de SDAI são identificados pela tríade **Pavimento + Laço + Endereço/Ponto** (ou TAG quando existente).
- Ao registrar um teste no SharePoint, o campo `Title` armazena a identificação do dispositivo (ex.: `Laço 01 - Ponto 045` ou `TAG`).
- O backend cruza a Matriz Mestra com os registros da lista SharePoint do ano vigente para marcar os dispositivos como `realizado` ou `pendente`.

### 3. Checklists Operacionais de Incêndio (NBR 17240)
No modal de inspeção ([`InspecaoFormModal.jsx`](file:///e:/app-torres-novo/frontend/src/components/InspecaoFormModal.jsx)):
- Para SDAI, os itens avaliados cobrem:
  - Estado físico do dispositivo (sem poeira excessiva, danos físicos, pintura indevida ou obstruções).
  - Teste funcional de acionamento (resposta do LED indicativo de alarme).
  - Verificação de recebimento do sinal na Central SDAI com identificação correta de texto e endereço.
  - Se reprovado ou sem acesso físico, o sistema dispara a abertura imediata de Chamado/OS na lista de Corretivas.

### 4. Acesso Direto às Listas e Planilhas (`Cadastros.jsx`)
Na tela `/:tenant/sdai/cadastros`:
- O card **Matriz Mestra de Preventivas** abre a planilha Excel configurada em `excelPreventivasUrl`.
- O card **Histórico de Preventivas** redireciona via endpoint `/api/preventivas/go-to-list?list=listaHistoricoPreventivas&tenant=:tenant` resolvendo dinamicamente o link oficial da lista no SharePoint do cliente.

---

## 4. Roteiro de Testes e Validação

Execute os passos a seguir após qualquer configuração:

1. **Validação de Sintaxe do Backend:**
   ```powershell
   node -c backend/config/tenants.js
   ```
   Deve retornar saída vazia com código 0.

2. **Compilação do Frontend:**
   ```powershell
   npm run build --prefix frontend
   ```
   Deve compilar com `0` erros.

3. **Checklist Funcional na Aplicação:**
   - [ ] Acessar `/:tenant/sdai/preventivas/area-comum`: Confirmar que carrega os dispositivos do mês atual e atrasados da Matriz Mestra.
   - [ ] Testar Modal de Inspeção: Clicar em "Inspecionar", preencher o checklist de SDAI e verificar salvamento.
   - [ ] Acessar `/:tenant/sdai/preventivas/dashboard`: Validar KPIs de Meta, Inspecionados, Aderência e listagem anual com filtros por Laço/Tipo.
   - [ ] Acessar `/:tenant/sdai/cadastros`: Clicar nos cards e verificar se abrem a Matriz Mestra e a Lista do SharePoint corretas.
   - [ ] Acessar `/:tenant/sdai/relatorios`: Testar geração de Dossiê Mensal SDAI com a NBR 17240.
