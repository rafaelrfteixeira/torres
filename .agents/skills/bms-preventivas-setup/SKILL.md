---
name: bms-preventivas-setup
description: >-
  Guia completo, referências e passo a passo para implantar o módulo de Manutenção Preventiva de Área Comum BMS (Building Management System) para qualquer tenant no TorresCx. Use esta skill quando o usuário solicitar adicionar, configurar ou integrar preventivas BMS para um novo shopping/cliente, incluindo matriz mestra em Excel, listas do SharePoint, checklists operacionais, dashboards, menus e geração de relatórios.
---

# Skill: Implantação de Preventivas de Área Comum BMS no TorresCx

Este guia padroniza o fluxo de ponta a ponta para habilitar o módulo de **Manutenção Preventiva BMS** para novos shoppings (tenants) no sistema TorresCx.

---

## 1. Visão Geral da Arquitetura BMS

O módulo de preventivas BMS opera de forma independente do SDAI, integrando três pilares:

```
[ Matriz Mestra Excel ] (Cronograma anual 1..12 no SharePoint)
          │
          ▼
[ Backend TorresCx ] ── Graph API ──► [ List Histórico Preventivas BMS ]
   - matrizMestraService                 (Registros executados, fotos e logs)
   - preventivas.controller               │
          │                               ▼
          ├─────────────────────────► [ List Corretivas BMS ] (Abertura de OS se houver falha/sem acesso)
          ▼
[ Frontend TorresCx ]
   - /:tenant/bms/preventivas/area-comum  (Painel Operacional com cards do mês)
   - /:tenant/bms/preventivas/dashboard   (Dashboard e conciliação da matriz)
   - /:tenant/bms/cadastros               (Links rápidos da matriz e lista)
   - /:tenant/bms/relatorios              (Dossiê mensal com rodapé sem NBR 17240)
```

---

## 2. Checklist de Ativação de um Novo Tenant

Para implantar um novo shopping no BMS, siga rigorosamente as etapas abaixo:

### Etapa 1: Coleta de Dados do Cliente

Antes de alterar código, colete os 3 dados essenciais:
1. **Link de Compartilhamento do Excel da Matriz Mestra BMS** (no SharePoint).
2. **Nome da Lista do SharePoint de Histórico de Preventivas BMS** (ex.: `NOME_SHOPPING_PREVENTIVAS_2026`).
3. **Nome da Lista do SharePoint de Corretivas/Ocorrências BMS** (ex.: `CC-202X-...-BMS`).

> **Estrutura Esperada na Matriz Mestra BMS (Colunas Excel):**
> - **Pavimento / Piso / Local**: `L1`, `L2`, `E1`, etc.
> - **TAG**: Código único do quadro/medidor (ex.: `QDF-01`, `QDL-01`, `3019`, `3038`).
> - **Tipo de Equipamento**: `Medição`, `Iluminação` ou `Fancoil` (ou `Ar Condicionado`).
> - **Descrição / Localização**: Nome da loja ou descrição do setor (ex.: `PICADYLLI`, `ILUMINAÇÃO`).
> - **Mês Manutenção**: Nome do mês (`Janeiro` .. `Dezembro`) ou número (`1` .. `12`).
> - **Realizado 2026**: Status atual (`sim` ou vazio).

---

### Etapa 2: Configuração no Backend (`backend/config/tenants.js`)

No objeto `shoppings`, localize ou adicione a chave do tenant:

```javascript
'slug-do-shopping': {
  name: 'Shopping Exemplo',
  logo: '/logo_shopping_exemplo.png',
  
  // Inspeção de lojas (se houver)
  listaSDAI: null,
  listaBMS: '2024-X-XXX-BMS-...',
  excelLojasUrl: 'https://torrescx.sharepoint.com/:x:/s/...',
  ccEmails: ['carlos.gueiros@torrescx.com.br'],

  // Preventivas Área Comum (BMS)
  excelPreventivasBmsUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/LINK_COMPARTILHADO_EXCEL',
  listaHistoricoPreventivasBms: 'EXEMPLO_SHOPPING_PREVENTIVAS_2026',
  listaCorretivasBms: 'CC-2024-X-XXX-MAN-EXEMPLO-BMS',

  responsavelShopping: {
    sdai: null,
    bms: {
      solicitante: 'Nome do Responsável',
      telefone: 'DDD999999999',
      email: 'responsavel@shopping.com.br',
    },
  },
},
```

---

### Etapa 3: Exposição de Metadados (`backend/routes/auth.routes.js`)

Verifique se os campos de BMS estão sendo expostos na sessão do usuário (`shoppingsMetadata`):
- `excelPreventivasBmsUrl`
- `listaHistoricoPreventivasBms`
- `listaCorretivasBms`

*(Esses campos já são propagados por padrão para qualquer tenant configurado).*

---

### Etapa 4: Habilitação de Menus no Frontend (`frontend/src/config/clientMenuConfig.js`)

No arquivo `frontend/src/config/clientMenuConfig.js`:

1. No bloco de detecção de menus do BMS:
```javascript
const isNovoShopping = tenant === 'slug-do-shopping';
const hasPreventivasBMSActive = isRioMarKennedy || isNovoShopping;
const hasCorretivasActive = isRioMarAracaju || isRioMarKennedy || isNovoShopping;
const hasRelatoriosActive = isRioMarAracaju || isRioMarKennedy || isNovoShopping;
```

2. Adicione o tenant na lista de autorização por tenant se aplicável:
```javascript
// Ex: menuConfigMap
'slug-do-shopping': ['sdai', 'bms'],
```

---

### Etapa 5: Habilitação de Rotas no Frontend (`frontend/src/App.jsx`)

1. Inclua o slug do tenant no array `TENANTS_WITH_PREVENTIVAS_BMS`:
```javascript
const TENANTS_WITH_PREVENTIVAS_BMS = ['riomar-kennedy', 'slug-do-shopping'];
```

2. As seguintes rotas serão automaticamente disponibilizadas para o shopping:
- `/:tenant/bms/preventivas/area-comum` -> [`PreventivasAreaComum.jsx`](file:///e:/app-torres-novo/frontend/src/pages/PreventivasAreaComum.jsx) (`sistema="bms"`)
- `/:tenant/bms/preventivas/dashboard` -> [`DashboardPreventivasBMS.jsx`](file:///e:/app-torres-novo/frontend/src/pages/DashboardPreventivasBMS.jsx)
- `/:tenant/bms/cadastros` -> [`Cadastros.jsx`](file:///e:/app-torres-novo/frontend/src/pages/Cadastros.jsx)
- `/:tenant/bms/relatorios` -> [`Relatorios.jsx`](file:///e:/app-torres-novo/frontend/src/pages/Relatorios.jsx)

---

## 3. Regras de Negócio e Particularidades do BMS (Gotchas)

Ao implementar ou manter o BMS, observe estas regras críticas:

### 1. Identificação de Ativos: `TAG - Descrição`
- **Problema:** Em SDAI, detectores costumam ter descrições distintas. No BMS, múltiplos quadros compartilham o mesmo nome (ex.: 10 quadros chamados apenas `ILUMINAÇÃO`).
- **Solução:** O título do card e da tabela **deve** usar a combinação texto puro `TAG - Descrição` (ex: `QDF-01 - ILUMINAÇÃO`, `3019 - PICADYLLI`).
- **Formatação:** Texto puro uniforme (sem badges/caixas azuis no meio do texto). Se a TAG for igual à descrição ou for inválida (`TAG-N/A`), exibir apenas a descrição.

### 2. Validação de Duplicidade e Cruzamento de Histórico por TAG
- No SharePoint, o campo `Title` armazena a `TAG` do dispositivo.
- O cruzamento de histórico no backend **deve priorizar a TAG única** quando for BMS (`isBMS = true`).
- Caso contrário, concluir um quadro `ILUMINAÇÃO` marcaria falsamente todos os outros como concluídos.

### 3. Checklists Operacionais Específicos do BMS
No [`InspecaoFormModal.jsx`](file:///e:/app-torres-novo/frontend/src/components/InspecaoFormModal.jsx):
- **Campo "Tipo de Dispositivo":** Fixo e somente leitura (`readOnly`), refletindo estritamente o valor da matriz mestra (`dispositivo.tipo`).
- **Checklist 1 (Medição / MEI-PRO):** 10 itens (inspeção de TCs, LEDs RUN/Status, tráfego RS-485/Ethernet, validação de potências ativas sem inversão de TC, display supervisório).
- **Checklist 2 (Iluminação):** 10 itens (limpeza de canaletas, medição da fonte 24Vcc, relés auxiliares, chaves manual/auto, comando e feedback via supervisório).
- **Checklist 3 (Ar Condicionado / HVAC / Fancoil):** 10 itens (controladores DDC, atuadores de válvulas 0-10V, pressostatos de filtro, sensores de temperatura).

### 4. Tabela do Dashboard BMS
No [`DashboardPreventivasBMS.jsx`](file:///e:/app-torres-novo/frontend/src/pages/DashboardPreventivasBMS.jsx):
- Coluna **TAG / Descrição / Localização**: Formato `TAG - Descrição`.
- Coluna **Tipo**: Apenas o badge do tipo (`Medição`, `Iluminação`, `Fancoil`).
- **Proibido inventar painel:** Não exibir `PAINEL 01` fictício para o BMS (isso só existe no SDAI legado).

### 5. Independência Total de SDAI e BMS
- **Nunca** alterar `DashboardPreventivas.jsx` (SDAI) para atender demandas do BMS.
- O BMS utiliza o componente dedicado `DashboardPreventivasBMS.jsx`.
- As colunas de SDAI (`Laço / Painel`, `Endereço`, `Tipo de Incêndio`) permanecem intocadas.

### 6. Relatório Mensal sem NBR 17240
No [`backend/services/reportService.js`](file:///e:/app-torres-novo/backend/services/reportService.js):
- A norma regulamentadora **NBR 17240** aplica-se exclusivamente a sistemas de detecção e alarme de incêndio (SDAI).
- No relatório de BMS, o rodapé final não menciona a NBR 17240, limitando-se ao parecer técnico de automação predial e acompanhamento de Ordens de Serviço.

---

## 4. Testes e Validação Pós-Implantação

Após configurar o novo tenant:

1. **Compilação do Frontend:**
   ```powershell
   npm run build --prefix frontend
   ```
   Deve compilar com `0` erros.

2. **Sintaxe do Backend:**
   ```powershell
   node -c backend/config/tenants.js backend/controllers/preventivas.controller.js backend/services/reportService.js
   ```

3. **Checklist Manual na Interface:**
   - [ ] Acessar `/:tenant/bms/preventivas/area-comum` e verificar se os cards aparecem como `TAG - Descrição`.
   - [ ] Abrir o modal de inspeção e checar se o tipo de dispositivo está fixo e com o checklist correto de 10 itens.
   - [ ] Acessar `/:tenant/bms/preventivas/dashboard` e verificar os KPIs, filtros por tipo (`Medição`, `Iluminação`, `Fancoil`) e paginação.
   - [ ] Acessar `/:tenant/bms/cadastros` e confirmar abertura da Matriz Mestra e do Histórico BMS.
   - [ ] Gerar o Relatório Mensal e confirmar que o rodapé **não** contém o texto da NBR 17240.
