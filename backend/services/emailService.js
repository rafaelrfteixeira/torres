const { getGraphClient } = require('./graphClient');

/**
 * emailService.js — Envio de E-mails via Microsoft Graph API
 * 
 * Envia o PDF gerado (em Base64) como anexo de um e-mail 
 * através da conta autenticada do usuário ativo.
 */

async function sendChecklistEmail(accessToken, formData, pdfBase64, recipientEmails = [], ccEmails = ['msantos@torrescx.com.br']) {
  if (!accessToken) {
    throw new Error('Access token não fornecido para o envio de e-mail.');
  }
  
  // recipientEmails é um array de endereços já filtrados pelo controller
  const lojaName = formData.loja || '[Loja Não Informada]';

  if (!recipientEmails || recipientEmails.length === 0) {
    console.log('⚠️ Nenhum e-mail de destinatário fornecido. E-mail não será enviado.');
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
    toRecipients: recipientEmails.map(email => ({
      emailAddress: { address: email }
    })),
    attachments: [
      {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: `Relatorio_Inspecao_${lojaName.replace(/\s+/g, '_')}.pdf`,
        contentType: 'application/pdf',
        contentBytes: pdfBase64 // Buffer codificado em Base64 gerado pelo pdfService
      }
    ]
  };

  if (ccEmails && ccEmails.length > 0) {
    message.ccRecipients = ccEmails.map(email => ({
      emailAddress: { address: email }
    }));
  }

  try {
    const ccLog = ccEmails && ccEmails.length > 0 ? ` com cópia para ${ccEmails.join(', ')}` : '';
    console.log(`✉️ Enviando e-mail para ${recipientEmails.join(', ')}${ccLog}...`);
    // Endpoint do MS Graph para disparar emails
    await client.api('/me/sendMail')
      .post({
        message,
        saveToSentItems: true 
      });
    
    console.log(`✅ E-mail enviado com sucesso para ${recipientEmails.join(', ')}${ccLog}`);
    return true;
  } catch (error) {
    console.error('❌ Erro da Graph API ao enviar e-mail:', error.message);
    throw error;
  }
}

module.exports = {
  sendChecklistEmail
};
