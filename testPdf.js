const fs = require('fs');
const path = require('path');
const { generatePDFBuffer, generateHTML } = require('./backend/services/pdfService');

const mockData = {
  data: '2023-10-25',
  loja: 'Loja Exemplo Shopping',
  solicitante: 'João Silva',
  telefone: '(11) 98765-4321',
  email: 'joao.silva@lojaexemplo.com.br',
  manutencaoCorretiva: true,
  manutencaoPreventiva: false,
  tipoLoja: 'Megaloja',
  
  sistemas: {
    alarme_do_shopping: { existenteSim: true, existenteNao: false, funcionandoSim: true, funcionandoNao: false },
    alarme_da_loja: { existenteSim: true, existenteNao: false, funcionandoSim: false, funcionandoNao: true },
    extração_de_fumaça: { existenteSim: false, existenteNao: true, funcionandoSim: false, funcionandoNao: false },
    insuflamento_de_ar: { existenteSim: false, existenteNao: true, funcionandoSim: false, funcionandoNao: false },
    ar_condicionado: { existenteSim: true, existenteNao: false, funcionandoSim: true, funcionandoNao: false },
    comando_de_gás: { existenteSim: false, existenteNao: true, funcionandoSim: false, funcionandoNao: false },
    damper_extração: { existenteSim: false, existenteNao: true, funcionandoSim: false, funcionandoNao: false },
    damper_insuflamento: { existenteSim: false, existenteNao: true, funcionandoSim: false, funcionandoNao: false }
  },

  centralPropria: 'sim',
  especificacoes: {
    nDF: '12',
    nDT: '4',
    nAM: '2',
    nSirenes: '5',
    nDG: '1',
    nModulos: '3',
    outrosDispositivos: 'N/A'
  },

  observacoes: 'Durante a inspeção, notou-se que o alarme da loja apresentou falha intermitente na zona 2. Foi recomendado o reparo imediato.\n\nO ar condicionado está integrado corretamente e desligando no acionamento do DF.',

  statusLoja: {
    'Sistema Funcionando Normalmente': false,
    'Sistema Funcionando Parcialmente': true,
    'Sistema com Defeito': false,
    'Não Possui Detecção': false
  },
  statusOutros: 'Apenas alarme da loja com problema',

  pendencias: {
    'Necessário Abertura do Forro': false,
    'Verificar Integridade do Cabo de Alimentação': false,
    'Verificar Integridade do Cabo de Sinal': true,
    'Interligar o Sistema da Loja com do Shopping': false,
    'Necessário Verificar o Sistema da Loja': true,
    'Troca de Dispositivo': false
  },
  pendenciasOutros: '',

  engTecnico: 'Eng. Rafael Torres',
  horarioInicio: '09:00',
  horarioTermino: '11:30',
  totalHoras: '2h30',
  aceitoPor: 'Maria Ferreira (Gerente)'
};

async function test() {
  console.log('Gerando PDF de teste...');
  try {
    const html = generateHTML(mockData);
    // Salvar o HTML para debug tbm
    fs.writeFileSync(path.join(__dirname, 'docs', 'pdf_preview.html'), html);
    
    const pdfBuffer = await generatePDFBuffer(mockData);
    const outputPath = path.join(__dirname, 'docs', 'pdf_preview.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log('✅ PDF gerado com sucesso em:', outputPath);
  } catch (err) {
    console.error('❌ Erro ao gerar PDF:', err);
  }
}

test();
