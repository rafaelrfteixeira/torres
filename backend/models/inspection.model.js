/**
 * Inspection Model
 *
 * Define a estrutura de dados de uma inspeção de incêndio.
 * Atualmente serve como documentação/validação.
 *
 * 📌 PRÓXIMAS ETAPAS:
 *   - Quando integrado com Microsoft Lists, este modelo
 *     mapeará para as colunas da lista do SharePoint.
 *   - Considerar uso de uma lib de validação como Joi ou Zod.
 *
 * Estrutura:
 * {
 *   id: Number,
 *   storeNumber: String,         // Número da loja (ex: "L-001")
 *   storeName: String,           // Nome da loja
 *   inspectorName: String,       // Nome do inspetor
 *   date: String (ISO 8601),     // Data da inspeção
 *   status: String,              // "pendente" | "em_andamento" | "concluida"
 *   items: [                     // Itens do checklist
 *     {
 *       category: String,        // "deteccao_incendio" | "alarme" | "damper" | "extracao_fumaca"
 *       description: String,     // Descrição do item inspecionado
 *       result: String,          // "ok" | "nok" | "na" (não aplicável)
 *       observation: String,     // Observação livre
 *     }
 *   ],
 *   observations: String,        // Observações gerais da inspeção
 *   createdAt: String (ISO 8601),
 *   updatedAt: String (ISO 8601),
 * }
 */

module.exports = {
  STATUS: {
    PENDING: 'pendente',
    IN_PROGRESS: 'em_andamento',
    COMPLETED: 'concluida',
  },
  CATEGORIES: {
    FIRE_DETECTION: 'deteccao_incendio',
    ALARM: 'alarme',
    DAMPER: 'damper',
    SMOKE_EXTRACTION: 'extracao_fumaca',
  },
  RESULTS: {
    OK: 'ok',
    NOT_OK: 'nok',
    NOT_APPLICABLE: 'na',
  },
};
