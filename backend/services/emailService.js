const { getGraphClient } = require('./graphClient');

/**
 * emailService.js — Envio de E-mails via Microsoft Graph API
 * 
 * Envia o PDF gerado (em Base64) como anexo de um e-mail 
 * através da conta autenticada do usuário ativo.
 */

async function sendChecklistEmail(accessToken, formData, pdfBase64) {
  if (!accessToken) {
    throw new Error('Access token não fornecido para o envio de e-mail.');
  }
  
  // Destinatário do e-mail será o preenchido no formulário (formData.email)
  const recipientEmail = formData.email;
  const lojaName = formData.loja || '[Loja Não Informada]';

  if (!recipientEmail) {
    console.log('⚠️ Campo de e-mail vazio no formulário. E-mail não será enviado.');
    return null;
  }

  const client = getGraphClient(accessToken);

  // Construção do objeto de mensagem de email no padrão MS Graph
  const message = {
    subject: `Relatório Operacional de Sistema de Incêndio — ${lojaName}`,
    body: {
      contentType: 'HTML',
      content: `
        <p>Olá,</p>
        <p>Segue em anexo o <strong>Relatório Operacional (Check List de Lojas)</strong> referente à inspeção na loja <strong>${lojaName}</strong>.</p>
        <p>Realizada em: <strong>${formData.data}</strong></p>
        <br/>
        <p>Atenciosamente, <br/> <strong>TORRES | Cx - Sistemas de Automação</strong></p>
      `
    },
    toRecipients: [
      {
        emailAddress: {
          address: recipientEmail
        }
      }
    ],
    attachments: [
      {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: `Relatorio_Inspecao_${lojaName.replace(/\s+/g, '_')}.pdf`,
        contentType: 'application/pdf',
        contentBytes: pdfBase64 // Buffer codificado em Base64 gerado pelo pdfService
      }
    ]
  };

  try {
    console.log(`✉️ Enviando e-mail para ${recipientEmail}...`);
    // Endpoint do MS Graph para disparar emails
    await client.api('/me/sendMail')
      .post({
        message,
        saveToSentItems: true 
      });
    
    console.log(`✅ E-mail enviado com sucesso para ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Erro da Graph API ao enviar e-mail:', error.message);
    throw error;
  }
}

module.exports = {
  sendChecklistEmail
};
