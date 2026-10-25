/**
 * CredGestor - Sistema de Histórico de Pagamentos
 * Versão: 2026.10.25.1
 *
 * Funcionalidades:
 * - Histórico completo de pagamentos por cliente
 * - Extrato detalhado com filtros
 * - Armazenamento persistente (Firebase + LocalStorage)
 * - Exportação de extrato em PDF e CSV
 * - Excluir pagamentos
 * - Enviar comprovante via WhatsApp
 */

(function() {
  'use strict';

  // Namespace global
  window.PaymentHistory = window.PaymentHistory || {};

  /**
   * Estrutura de dados de pagamento
   * {
   *   id: string,
   *   clientId: string,
   *   clientName: string,
   *   clientPhone: string,
   *   loanId: string,
   *   amount: number,
   *   date: string (ISO),
   *   type: 'total' | 'partial',
   *   reference: string (mês/ano),
   *   balance: number (saldo após pagamento),
   *   method: 'dinheiro' | 'pix' | 'transferencia' | 'cartao',
   *   notes: string,
   *   receiptNumber: string,
   *   createdAt: string (ISO),
   *   createdBy: string (userId),
   *   deletedAt: string (ISO) | null,
   *   deletedBy: string | null
   * }
   */

  // ============================================
  // ARMAZENAMENTO E PERSISTÊNCIA
  // ============================================

  /**
   * Salva um pagamento no histórico
   */
  async function savePayment(payment) {
    try {
      // Gera ID único se não existir
      if (!payment.id) {
        payment.id = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Adiciona metadados
      payment.createdAt = payment.createdAt || new Date().toISOString();
      payment.createdBy = payment.createdBy || (window.appState?.user?.email || 'unknown');

      // Salva no Firebase (se disponível)
      if (window.firebase && window.appState?.user) {
        const db = firebase.firestore();
        await db.collection('payments').doc(payment.id).set(payment);
      }

      // Salva no LocalStorage como backup
      const localPayments = getLocalPayments();
      localPayments[payment.id] = payment;
      localStorage.setItem('credigestor_payments', JSON.stringify(localPayments));

      // Atualiza índice por cliente
      updateClientIndex(payment.clientId, payment.id);

      return payment;
    } catch (error) {
      console.error('Erro ao salvar pagamento:', error);
      throw error;
    }
  }

  /**
   * Exclui um pagamento (soft delete)
   */
  async function deletePayment(paymentId) {
    try {
      const payment = await getPaymentById(paymentId);

      if (!payment) {
        throw new Error('Pagamento não encontrado');
      }

      // Marca como deletado
      payment.deletedAt = new Date().toISOString();
      payment.deletedBy = window.appState?.user?.email || 'unknown';

      // Atualiza no Firebase
      if (window.firebase && window.appState?.user) {
        const db = firebase.firestore();
        await db.collection('payments').doc(paymentId).update({
          deletedAt: payment.deletedAt,
          deletedBy: payment.deletedBy
        });
      }

      // Atualiza no LocalStorage
      const localPayments = getLocalPayments();
      if (localPayments[paymentId]) {
        localPayments[paymentId].deletedAt = payment.deletedAt;
        localPayments[paymentId].deletedBy = payment.deletedBy;
        localStorage.setItem('credigestor_payments', JSON.stringify(localPayments));
      }

      return true;
    } catch (error) {
      console.error('Erro ao excluir pagamento:', error);
      throw error;
    }
  }

  /**
   * Obtém um pagamento por ID
   */
  async function getPaymentById(paymentId) {
    try {
      // Tenta buscar do Firebase primeiro
      if (window.firebase && window.appState?.user) {
        const db = firebase.firestore();
        const doc = await db.collection('payments').doc(paymentId).get();

        if (doc.exists) {
          return { id: doc.id, ...doc.data() };
        }
      }

      // Fallback para LocalStorage
      const localPayments = getLocalPayments();
      return localPayments[paymentId] || null;
    } catch (error) {
      console.error('Erro ao buscar pagamento:', error);
      return null;
    }
  }

  /**
   * Obtém pagamentos do LocalStorage
   */
  function getLocalPayments() {
    try {
      const data = localStorage.getItem('credigestor_payments');
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Erro ao ler pagamentos locais:', error);
      return {};
    }
  }

  /**
   * Atualiza índice de pagamentos por cliente
   */
  function updateClientIndex(clientId, paymentId) {
    try {
      const indexKey = 'credigestor_payment_index';
      const index = JSON.parse(localStorage.getItem(indexKey) || '{}');

      if (!index[clientId]) {
        index[clientId] = [];
      }

      if (!index[clientId].includes(paymentId)) {
        index[clientId].push(paymentId);
      }

      localStorage.setItem(indexKey, JSON.stringify(index));
    } catch (error) {
      console.error('Erro ao atualizar índice:', error);
    }
  }

  /**
   * Obtém histórico de pagamentos de um cliente
   */
  async function getClientPaymentHistory(clientId, options = {}) {
    try {
      let payments = [];

      // Tenta buscar do Firebase primeiro
      if (window.firebase && window.appState?.user) {
        const db = firebase.firestore();
        let query = db.collection('payments')
          .where('clientId', '==', clientId)
          .where('deletedAt', '==', null);

        // Aplicar filtros
        if (options.startDate) {
          query = query.where('date', '>=', options.startDate);
        }
        if (options.endDate) {
          query = query.where('date', '<=', options.endDate);
        }

        const snapshot = await query.orderBy('date', 'desc').get();
        payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      // Fallback para LocalStorage se Firebase falhar ou não houver dados
      if (payments.length === 0) {
        const localPayments = getLocalPayments();
        const index = JSON.parse(localStorage.getItem('credigestor_payment_index') || '{}');
        const clientPaymentIds = index[clientId] || [];

        payments = clientPaymentIds
          .map(id => localPayments[id])
          .filter(p => p && !p.deletedAt && (!options.startDate || p.date >= options.startDate) && (!options.endDate || p.date <= options.endDate))
          .sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      // Aplicar filtros adicionais
      if (options.type) {
        payments = payments.filter(p => p.type === options.type);
      }
      if (options.method) {
        payments = payments.filter(p => p.method === options.method);
      }

      return payments;
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      return [];
    }
  }

  /**
   * Calcula estatísticas do histórico
   */
  function calculateStats(payments) {
    const stats = {
      total: 0,
      count: payments.length,
      byType: { total: 0, partial: 0 },
      byMethod: {},
      avgAmount: 0,
      lastPayment: null,
      firstPayment: null
    };

    payments.forEach(payment => {
      stats.total += payment.amount;
      stats.byType[payment.type] = (stats.byType[payment.type] || 0) + 1;
      stats.byMethod[payment.method] = (stats.byMethod[payment.method] || 0) + payment.amount;

      if (!stats.lastPayment || new Date(payment.date) > new Date(stats.lastPayment.date)) {
        stats.lastPayment = payment;
      }
      if (!stats.firstPayment || new Date(payment.date) < new Date(stats.firstPayment.date)) {
        stats.firstPayment = payment;
      }
    });

    stats.avgAmount = stats.count > 0 ? stats.total / stats.count : 0;

    return stats;
  }

  // ============================================
  // GERAÇÃO DE COMPROVANTES
  // ============================================

  /**
   * Gera texto do comprovante para envio
   */
  function generateReceiptText(payment) {
    const date = new Date(payment.date);
    const typeLabel = payment.type === 'total' ? 'Pagamento Total' : 'Pagamento Parcial';

    return `
🧾 *COMPROVANTE DE PAGAMENTO*
━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *Dados do Pagamento*
• Comprovante: ${payment.receiptNumber || payment.id}
• Data: ${date.toLocaleDateString('pt-BR')}
• Horário: ${date.toLocaleTimeString('pt-BR')}

👤 *Cliente*
• Nome: ${payment.clientName}

💰 *Valores*
• Tipo: ${typeLabel}
• Valor Pago: R$ ${payment.amount.toFixed(2)}
• Referência: ${payment.reference}
• Saldo Restante: R$ ${payment.balance.toFixed(2)}

💳 *Forma de Pagamento*
• ${payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}

${payment.notes ? `📝 *Observações*\n• ${payment.notes}\n\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Pagamento registrado com sucesso

_CredGestor - Sistema de Gestão de Crédito_
_Gerado em: ${new Date().toLocaleString('pt-BR')}_
    `.trim();
  }

  /**
   * Envia comprovante via WhatsApp
   */
  async function sendReceiptViaWhatsApp(paymentId) {
    try {
      const payment = await getPaymentById(paymentId);

      if (!payment) {
        throw new Error('Pagamento não encontrado');
      }

      if (!payment.clientPhone) {
        throw new Error('Cliente não possui telefone cadastrado');
      }

      // Limpa número de telefone (remove caracteres não numéricos)
      const phone = payment.clientPhone.replace(/\D/g, '');

      // Gera texto do comprovante
      const receiptText = generateReceiptText(payment);

      // Codifica texto para URL
      const encodedText = encodeURIComponent(receiptText);

      // Monta URL do WhatsApp
      const whatsappUrl = `https://wa.me/55${phone}?text=${encodedText}`;

      // Abre WhatsApp
      window.open(whatsappUrl, '_blank');

      return true;
    } catch (error) {
      console.error('Erro ao enviar comprovante:', error);
      throw error;
    }
  }

  /**
   * Copia comprovante para área de transferência
   */
  async function copyReceiptToClipboard(paymentId) {
    try {
      const payment = await getPaymentById(paymentId);

      if (!payment) {
        throw new Error('Pagamento não encontrado');
      }

      const receiptText = generateReceiptText(payment);

      // Tenta usar API moderna primeiro
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(receiptText);
      } else {
        // Fallback para navegadores antigos
        const textarea = document.createElement('textarea');
        textarea.value = receiptText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      return true;
    } catch (error) {
      console.error('Erro ao copiar comprovante:', error);
      throw error;
    }
  }

  // ============================================
  // INTERFACE DE USUÁRIO
  // ============================================

  /**
   * Renderiza a tela de histórico de pagamentos
   */
  async function renderPaymentHistory(clientId, clientName, clientPhone) {
    const payments = await getClientPaymentHistory(clientId);
    const stats = calculateStats(payments);

    const html = `
      <div class="payment-history-container">
        <div class="history-header">
          <h2>Histórico de Pagamentos</h2>
          <p class="client-name">${clientName}</p>
        </div>

        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-value">R$ ${stats.total.toFixed(2)}</div>
            <div class="stat-label">Total Pago</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.count}</div>
            <div class="stat-label">Pagamentos</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">R$ ${stats.avgAmount.toFixed(2)}</div>
            <div class="stat-label">Média por Pagamento</div>
          </div>
        </div>

        <div class="history-filters">
          <input type="month" id="filterMonth" placeholder="Filtrar por mês" />
          <select id="filterType">
            <option value="">Todos os tipos</option>
            <option value="total">Pagamento total</option>
            <option value="partial">Pagamento parcial</option>
          </select>
          <select id="filterMethod">
            <option value="">Todas as formas</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="transferencia">Transferência</option>
            <option value="cartao">Cartão</option>
          </select>
          <button id="clearFilters" class="btn-secondary">Limpar Filtros</button>
        </div>

        <div class="history-actions">
          <button id="exportPDF" class="btn-primary">
            <span>📄</span> Exportar PDF
          </button>
          <button id="exportCSV" class="btn-secondary">
            <span>📊</span> Exportar CSV
          </button>
          <button id="printStatement" class="btn-secondary">
            <span>🖨️</span> Imprimir
          </button>
        </div>

        <div class="payments-list">
          ${renderPaymentsList(payments, clientPhone)}
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Renderiza lista de pagamentos
   */
  function renderPaymentsList(payments, clientPhone) {
    if (payments.length === 0) {
      return '<div class="empty-state">Nenhum pagamento registrado.</div>';
    }

    let currentMonth = '';
    let html = '';

    payments.forEach(payment => {
      const paymentDate = new Date(payment.date);
      const monthYear = paymentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      if (monthYear !== currentMonth) {
        currentMonth = monthYear;
        html += `<div class="month-divider">${monthYear}</div>`;
      }

      const typeLabel = payment.type === 'total' ? 'Pagamento Total' : 'Pagamento Parcial';
      const methodEmoji = {
        dinheiro: '💵',
        pix: '📱',
        transferencia: '🏦',
        cartao: '💳'
      }[payment.method] || '💰';

      html += `
        <div class="payment-item" data-payment-id="${payment.id}">
          <div class="payment-date">
            ${paymentDate.toLocaleDateString('pt-BR')}
          </div>
          <div class="payment-details">
            <div class="payment-type">${typeLabel}</div>
            <div class="payment-reference">Ref: ${payment.reference}</div>
            ${payment.notes ? `<div class="payment-notes">${payment.notes}</div>` : ''}
          </div>
          <div class="payment-method">
            ${methodEmoji} ${payment.method}
          </div>
          <div class="payment-amount">
            R$ ${payment.amount.toFixed(2)}
          </div>
          <div class="payment-actions">
            <button class="btn-icon send-receipt" data-payment-id="${payment.id}" data-phone="${clientPhone || ''}" title="Enviar Comprovante">
              📤
            </button>
            <button class="btn-icon copy-receipt" data-payment-id="${payment.id}" title="Copiar Comprovante">
              📋
            </button>
            <button class="btn-icon view-details" data-payment-id="${payment.id}" title="Detalhes">
              ℹ️
            </button>
            <button class="btn-icon delete-payment" data-payment-id="${payment.id}" title="Excluir">
              🗑️
            </button>
          </div>
        </div>
      `;
    });

    return html;
  }

  /**
   * Exporta extrato em CSV
   */
  function exportToCSV(payments, clientName) {
    const headers = ['Data', 'Tipo', 'Referência', 'Valor', 'Forma de Pagamento', 'Saldo', 'Observações', 'Comprovante'];
    const rows = payments.map(p => [
      new Date(p.date).toLocaleDateString('pt-BR'),
      p.type === 'total' ? 'Total' : 'Parcial',
      p.reference,
      p.amount.toFixed(2),
      p.method,
      p.balance.toFixed(2),
      p.notes || '',
      p.receiptNumber || ''
    ]);

    const csvContent = [
      [`Extrato de Pagamentos - ${clientName}`],
      [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
      [],
      headers,
      ...rows
    ].map(row => row.join(';')).join('\n');

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extrato_${clientName.replace(/\s/g, '_')}_${Date.now()}.csv`;
    link.click();
  }

  /**
   * Exporta extrato em PDF
   */
  async function exportToPDF(payments, clientName, stats) {
    // Esta função requer uma biblioteca de PDF (jsPDF ou similar)
    // Por enquanto, vou criar uma versão HTML para impressão
    const printWindow = window.open('', '_blank');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Extrato - ${clientName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #0f172a; }
          .header { text-align: center; margin-bottom: 30px; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat { text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #0f172a; }
          .stat-label { font-size: 12px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; }
          .amount { text-align: right; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CredGestor</h1>
          <h2>Extrato de Pagamentos</h2>
          <p><strong>Cliente:</strong> ${clientName}</p>
          <p><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="stat-value">R$ ${stats.total.toFixed(2)}</div>
            <div class="stat-label">Total Pago</div>
          </div>
          <div class="stat">
            <div class="stat-value">${stats.count}</div>
            <div class="stat-label">Pagamentos</div>
          </div>
          <div class="stat">
            <div class="stat-value">R$ ${stats.avgAmount.toFixed(2)}</div>
            <div class="stat-label">Média</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Referência</th>
              <th>Forma</th>
              <th class="amount">Valor</th>
              <th class="amount">Saldo</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td>${new Date(p.date).toLocaleDateString('pt-BR')}</td>
                <td>${p.type === 'total' ? 'Total' : 'Parcial'}</td>
                <td>${p.reference}</td>
                <td>${p.method}</td>
                <td class="amount">R$ ${p.amount.toFixed(2)}</td>
                <td class="amount">R$ ${p.balance.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>CredGestor - Sistema de Gestão de Crédito</p>
          <p>Versão 2026.10.25</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  // ============================================
  // INTEGRAÇÃO COM SISTEMA DE PAGAMENTOS
  // ============================================

  /**
   * Hook para registrar pagamento automaticamente
   */
  function hookPaymentRegistration() {
    // Intercepta chamadas de pagamento do sistema existente
    const originalRegisterPayment = window.registerPayment;

    window.registerPayment = async function(paymentData) {
      // Chama função original
      if (originalRegisterPayment) {
        const result = await originalRegisterPayment(paymentData);

        // Registra no histórico
        if (result.success) {
          await savePayment({
            clientId: paymentData.clientId,
            clientName: paymentData.clientName,
            clientPhone: paymentData.clientPhone,
            loanId: paymentData.loanId,
            amount: paymentData.amount,
            date: paymentData.date || new Date().toISOString(),
            type: paymentData.type,
            reference: paymentData.reference,
            balance: paymentData.balance || 0,
            method: paymentData.method || 'dinheiro',
            notes: paymentData.notes || '',
            receiptNumber: result.receiptNumber
          });
        }

        return result;
      }
    };
  }

  // ============================================
  // INICIALIZAÇÃO
  // ============================================

  /**
   * Inicializa o módulo de histórico
   */
  function init() {
    console.log('PaymentHistory module initialized');

    // Registra hook de pagamentos
    hookPaymentRegistration();

    // Adiciona botão de histórico na tela de cliente
    document.addEventListener('DOMContentLoaded', () => {
      // Event delegation para botões dinâmicos
      document.addEventListener('click', async (e) => {
        // Ver histórico
        if (e.target.closest('.view-payment-history')) {
          const btn = e.target.closest('.view-payment-history');
          const clientId = btn.dataset.clientId;
          const clientName = btn.dataset.clientName;
          const clientPhone = btn.dataset.clientPhone;

          const modal = document.getElementById('modal');
          const modalContent = document.getElementById('modalContent');

          modalContent.innerHTML = await renderPaymentHistory(clientId, clientName, clientPhone);
          modal.showModal();

          attachHistoryEventListeners(clientId, clientName, clientPhone);
        }

        // Enviar comprovante via WhatsApp
        if (e.target.closest('.send-receipt')) {
          const btn = e.target.closest('.send-receipt');
          const paymentId = btn.dataset.paymentId;
          const phone = btn.dataset.phone;

          if (!phone) {
            alert('Cliente não possui telefone cadastrado.');
            return;
          }

          try {
            await sendReceiptViaWhatsApp(paymentId);
            showNotification('Comprovante enviado via WhatsApp!', 'success');
          } catch (error) {
            alert('Erro ao enviar comprovante: ' + error.message);
          }
        }

        // Copiar comprovante
        if (e.target.closest('.copy-receipt')) {
          const btn = e.target.closest('.copy-receipt');
          const paymentId = btn.dataset.paymentId;

          try {
            await copyReceiptToClipboard(paymentId);
            showNotification('Comprovante copiado!', 'success');
          } catch (error) {
            alert('Erro ao copiar comprovante: ' + error.message);
          }
        }

        // Excluir pagamento
        if (e.target.closest('.delete-payment')) {
          const btn = e.target.closest('.delete-payment');
          const paymentId = btn.dataset.paymentId;

          if (!confirm('Tem certeza que deseja excluir este pagamento?')) {
            return;
          }

          try {
            await deletePayment(paymentId);

            // Remove item da lista
            const paymentItem = btn.closest('.payment-item');
            paymentItem.style.opacity = '0';
            setTimeout(() => {
              paymentItem.remove();

              // Atualiza estatísticas
              const clientId = document.querySelector('.payment-history-container').dataset.clientId;
              refreshStatistics(clientId);
            }, 300);

            showNotification('Pagamento excluído com sucesso!', 'success');
          } catch (error) {
            alert('Erro ao excluir pagamento: ' + error.message);
          }
        }
      });
    });
  }

  /**
   * Anexa event listeners aos elementos do histórico
   */
  function attachHistoryEventListeners(clientId, clientName, clientPhone) {
    // Salva dados no container para uso posterior
    const container = document.querySelector('.payment-history-container');
    if (container) {
      container.dataset.clientId = clientId;
      container.dataset.clientName = clientName;
      container.dataset.clientPhone = clientPhone;
    }

    // Filtros
    document.getElementById('filterMonth')?.addEventListener('change', async (e) => {
      const [year, month] = e.target.value.split('-');
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0).toISOString();

      const payments = await getClientPaymentHistory(clientId, { startDate, endDate });
      document.querySelector('.payments-list').innerHTML = renderPaymentsList(payments, clientPhone);
      attachHistoryEventListeners(clientId, clientName, clientPhone);
    });

    document.getElementById('filterType')?.addEventListener('change', async (e) => {
      const payments = await getClientPaymentHistory(clientId, { type: e.target.value || undefined });
      document.querySelector('.payments-list').innerHTML = renderPaymentsList(payments, clientPhone);
      attachHistoryEventListeners(clientId, clientName, clientPhone);
    });

    document.getElementById('clearFilters')?.addEventListener('click', async () => {
      document.getElementById('filterMonth').value = '';
      document.getElementById('filterType').value = '';
      document.getElementById('filterMethod').value = '';

      const payments = await getClientPaymentHistory(clientId);
      document.querySelector('.payments-list').innerHTML = renderPaymentsList(payments, clientPhone);
      attachHistoryEventListeners(clientId, clientName, clientPhone);
    });

    // Exportação
    document.getElementById('exportCSV')?.addEventListener('click', async () => {
      const payments = await getClientPaymentHistory(clientId);
      exportToCSV(payments, clientName);
    });

    document.getElementById('exportPDF')?.addEventListener('click', async () => {
      const payments = await getClientPaymentHistory(clientId);
      const stats = calculateStats(payments);
      await exportToPDF(payments, clientName, stats);
    });
  }

  /**
   * Atualiza estatísticas após mudanças
   */
  async function refreshStatistics(clientId) {
    const payments = await getClientPaymentHistory(clientId);
    const stats = calculateStats(payments);

    // Atualiza cards de estatísticas
    const statCards = document.querySelectorAll('.stat-card');
    if (statCards.length >= 3) {
      statCards[0].querySelector('.stat-value').textContent = `R$ ${stats.total.toFixed(2)}`;
      statCards[1].querySelector('.stat-value').textContent = stats.count;
      statCards[2].querySelector('.stat-value').textContent = `R$ ${stats.avgAmount.toFixed(2)}`;
    }
  }

  /**
   * Mostra notificação
   */
  function showNotification(message, type = 'info') {
    // Implementação simples - pode ser substituída por um sistema de notificações mais elaborado
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#3b82f6'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Expõe API pública
  window.PaymentHistory = {
    savePayment,
    deletePayment,
    getPaymentById,
    getClientPaymentHistory,
    calculateStats,
    renderPaymentHistory,
    exportToCSV,
    exportToPDF,
    sendReceiptViaWhatsApp,
    copyReceiptToClipboard,
    init
  };

  // Auto-inicializa
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
