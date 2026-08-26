import { CashRegisterSession, CashTransaction, Order } from '../types';
import { formatDateBrasilia, formatTimeBrasilia, formatDateTimeBrasilia } from './dateUtils';

export interface CashSessionMetrics {
  initial: number;
  counterSalesTotal: number;
  counterSalesCount: number;
  counterTxs: CashTransaction[];
  counterCash: number;
  counterDebito: number;
  counterCredito: number;
  counterPix: number;
  counterVr: number;
  counterMachineTotals: Record<string, number>;
  counterDiscounts: number;
  deliverySalesTotal: number;
  deliverySalesCount: number;
  deliveryTxs: CashTransaction[];
  deliveryCash: number;
  deliveryDebito: number;
  deliveryCredito: number;
  deliveryPix: number;
  deliveryVr: number;
  deliveryFeesTotal: number;
  deliveryMachineTotals: Record<string, number>;
  deliveryDiscounts: number;
  totalTurnover: number;
  totalOrdersCount: number;
  totalSalesTxsCount: number;
  cashSales: number;
  debitoSales: number;
  creditoSales: number;
  pixSales: number;
  vrSales: number;
  machineTotals: Record<string, number>;
  totalDiscounts: number;
  totalDeliveryFees: number;
  suprimentos: number;
  sangrias: number;
  expectedCashInDrawer: number;
  actualCashInDrawer: number;
  cashDifference: number;
}

export function formatMachineName(cardProvider?: string, machineModel?: string): string {
  const parts = [];
  if (cardProvider) parts.push(cardProvider.toUpperCase());
  if (machineModel) parts.push(machineModel);
  return parts.join(' - ');
}

export function getCashSessionMetrics(
  session: CashRegisterSession | null,
  ordersList: Order[] = []
): CashSessionMetrics {
  const empty: CashSessionMetrics = {
    initial: 0,
    counterSalesTotal: 0,
    counterSalesCount: 0,
    counterTxs: [],
    counterCash: 0,
    counterDebito: 0,
    counterCredito: 0,
    counterPix: 0,
    counterVr: 0,
    counterMachineTotals: {},
    counterDiscounts: 0,
    deliverySalesTotal: 0,
    deliverySalesCount: 0,
    deliveryTxs: [],
    deliveryCash: 0,
    deliveryDebito: 0,
    deliveryCredito: 0,
    deliveryPix: 0,
    deliveryVr: 0,
    deliveryFeesTotal: 0,
    deliveryMachineTotals: {},
    deliveryDiscounts: 0,
    totalTurnover: 0,
    totalOrdersCount: 0,
    totalSalesTxsCount: 0,
    cashSales: 0,
    debitoSales: 0,
    creditoSales: 0,
    pixSales: 0,
    vrSales: 0,
    machineTotals: {},
    totalDiscounts: 0,
    totalDeliveryFees: 0,
    suprimentos: 0,
    sangrias: 0,
    expectedCashInDrawer: 0,
    actualCashInDrawer: 0,
    cashDifference: 0
  };

  if (!session) return empty;

  const rawTxs = session.transactions || [];
  const initial = Number(session.initialCash) || 0;

  // Filter out any transactions that belong to cancelled orders
  const cancelledOrders = (ordersList || []).filter(o => o.status === 'cancelado');
  const cancelledOrderIds = new Set(cancelledOrders.map(o => o.id));
  const cancelledOrderCodes = new Set(cancelledOrders.map(o => o.code).filter(Boolean));

  const txs = rawTxs.filter(tx => {
    if (tx.orderId && cancelledOrderIds.has(tx.orderId)) return false;
    if (tx.orderCode && cancelledOrderCodes.has(tx.orderCode)) return false;
    if (tx.id && Array.from(cancelledOrderIds).some(id => id && tx.id.includes(id))) return false;
    if (tx.description && Array.from(cancelledOrderCodes).some(code => code && tx.description.includes(code))) return false;
    return true;
  });

  const suprimentos = txs.filter(t => t.type === 'suprimento').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const sangrias = txs.filter(t => t.type === 'sangria').reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const counterTxs: CashTransaction[] = [];
  const deliveryTxs: CashTransaction[] = [];

  let counterSalesTotal = 0;
  let counterCash = 0;
  let counterDebito = 0;
  let counterCredito = 0;
  let counterPix = 0;
  let counterVr = 0;
  const counterMachineTotals: Record<string, number> = {};

  let deliverySalesTotal = 0;
  let deliveryCash = 0;
  let deliveryDebito = 0;
  let deliveryCredito = 0;
  let deliveryPix = 0;
  let deliveryVr = 0;
  let deliveryFeesTotal = 0;
  const deliveryMachineTotals: Record<string, number> = {};

  const machineTotals: Record<string, number> = {};

  txs.forEach(t => {
    if (t.type !== 'sale') return;
    const amount = Number(t.amount) || 0;
    const isDelivery = t.channel === 'delivery' || t.deliveryType === 'entrega';
    const pm = (t.paymentMethod || '').toLowerCase();
    const machKey = formatMachineName(t.cardProvider, t.machineModel);

    if (isDelivery) {
      deliveryTxs.push(t);
      deliverySalesTotal += amount;
      if (pm === 'dinheiro') deliveryCash += amount;
      else if (pm === 'debito') deliveryDebito += amount;
      else if (pm === 'credito') deliveryCredito += amount;
      else if (pm === 'pix') deliveryPix += amount;
      else if (pm === 'vr') deliveryVr += amount;

      if (machKey) {
        deliveryMachineTotals[machKey] = (deliveryMachineTotals[machKey] || 0) + amount;
      }
    } else {
      counterTxs.push(t);
      counterSalesTotal += amount;
      if (pm === 'dinheiro') counterCash += amount;
      else if (pm === 'debito') counterDebito += amount;
      else if (pm === 'credito') counterCredito += amount;
      else if (pm === 'pix') counterPix += amount;
      else if (pm === 'vr') counterVr += amount;

      if (machKey) {
        counterMachineTotals[machKey] = (counterMachineTotals[machKey] || 0) + amount;
      }
    }

    if (machKey) {
      machineTotals[machKey] = (machineTotals[machKey] || 0) + amount;
    }
  });

  const cashSales = counterCash + deliveryCash;
  const debitoSales = counterDebito + deliveryDebito;
  const creditoSales = counterCredito + deliveryCredito;
  const pixSales = counterPix + deliveryPix;
  const vrSales = counterVr + deliveryVr;
  const totalTurnover = counterSalesTotal + deliverySalesTotal;

  // Calculate delivery fees total
  const processedDeliveryFeeOrderKeys = new Set<string>();
  deliveryTxs.forEach(t => {
    const matchedOrder = (ordersList || []).find(o => o.id === t.orderId || (t.orderCode && o.code === t.orderCode) || (t.id && o.id && t.id.includes(o.id)));
    const fee = t.deliveryFee !== undefined ? Number(t.deliveryFee) : (Number(matchedOrder?.deliveryFee) || 0);
    const ordKey = t.orderId || t.orderCode || (matchedOrder ? matchedOrder.id : t.id);
    if (ordKey && !processedDeliveryFeeOrderKeys.has(ordKey)) {
      processedDeliveryFeeOrderKeys.add(ordKey);
      deliveryFeesTotal += fee;
    } else if (!ordKey) {
      deliveryFeesTotal += fee;
    }
  });

  // Expected in drawer
  const expectedCashInDrawer = session.expectedCashInDrawer !== undefined && session.expectedCashInDrawer !== null
    ? Number(session.expectedCashInDrawer)
    : (initial + cashSales + suprimentos - sangrias);

  const actualCashInDrawer = session.actualCashInDrawer !== undefined && session.actualCashInDrawer !== null
    ? Number(session.actualCashInDrawer)
    : expectedCashInDrawer;

  const cashDifference = session.cashDifference !== undefined && session.cashDifference !== null
    ? Number(session.cashDifference)
    : (actualCashInDrawer - expectedCashInDrawer);

  return {
    initial,
    counterSalesTotal,
    counterSalesCount: counterTxs.length,
    counterTxs,
    counterCash,
    counterDebito,
    counterCredito,
    counterPix,
    counterVr,
    counterMachineTotals,
    counterDiscounts: 0,
    deliverySalesTotal,
    deliverySalesCount: deliveryTxs.length,
    deliveryTxs,
    deliveryCash,
    deliveryDebito,
    deliveryCredito,
    deliveryPix,
    deliveryVr,
    deliveryFeesTotal,
    deliveryMachineTotals,
    deliveryDiscounts: 0,
    totalTurnover,
    totalOrdersCount: counterTxs.length + deliveryTxs.length,
    totalSalesTxsCount: counterTxs.length + deliveryTxs.length,
    cashSales,
    debitoSales,
    creditoSales,
    pixSales,
    vrSales,
    machineTotals,
    totalDiscounts: 0,
    totalDeliveryFees: deliveryFeesTotal,
    suprimentos,
    sangrias,
    expectedCashInDrawer,
    actualCashInDrawer,
    cashDifference
  };
}

export const printThermalClosingReport = (
  session: CashRegisterSession,
  ordersList: Order[] = [],
  storeName = 'BAGÔ - Submarine & Eats'
) => {
  if (!session) return;

  const m = getCashSessionMetrics(session, ordersList);
  const openedDate = session.openedAt ? formatDateTimeBrasilia(session.openedAt) : '-';
  const closedDate = session.closedAt ? formatDateTimeBrasilia(session.closedAt) : formatDateTimeBrasilia(new Date());

  // Counter Details
  let counterDetailsHtml = '';
  if (m.counterTxs.length === 0) {
    counterDetailsHtml = `<div style="font-style: italic; color: #555; text-align: center; margin: 3px 0; font-size: 9px;">Nenhuma venda de balcão registrada</div>`;
  } else {
    counterDetailsHtml = m.counterTxs.map(t => {
      const pm = (t.paymentMethod || 'debito').toUpperCase();
      const mName = formatMachineName(t.cardProvider, t.machineModel);
      const timeStr = formatTimeBrasilia(t.timestamp);
      const amtStr = Number(t.amount || 0).toFixed(2).replace('.', ',');
      const mStr = mName ? ` [${mName}]` : '';

      return `
        <div style="margin-bottom: 3px; font-size: 10px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>${t.description || 'Venda Balcão'} (${timeStr})</span>
            <span>R$ ${amtStr}</span>
          </div>
          <div style="color: #444; font-size: 9px;">Pgto: ${pm}${mStr}</div>
        </div>
      `;
    }).join('');
  }

  // Delivery Details
  let deliveryDetailsHtml = '';
  if (m.deliveryTxs.length === 0) {
    deliveryDetailsHtml = `<div style="font-style: italic; color: #555; text-align: center; margin: 3px 0; font-size: 9px;">Nenhuma venda de delivery registrada</div>`;
  } else {
    deliveryDetailsHtml = m.deliveryTxs.map(t => {
      const pm = (t.paymentMethod || 'debito').toUpperCase();
      const mName = formatMachineName(t.cardProvider, t.machineModel);
      const timeStr = formatTimeBrasilia(t.timestamp);
      const amtStr = Number(t.amount || 0).toFixed(2).replace('.', ',');
      const mStr = mName ? ` [${mName}]` : '';

      // Find delivery fee
      const matchedOrder = (ordersList || []).find(o => o.id === t.orderId || (t.orderCode && o.code === t.orderCode) || (t.id && o.id && t.id.includes(o.id)));
      const feeVal = t.deliveryFee !== undefined ? Number(t.deliveryFee) : (matchedOrder?.deliveryType === 'entrega' ? (Number(matchedOrder.deliveryFee) || 0) : 0);
      const feeStr = feeVal > 0 ? ` | Frete: R$ ${feeVal.toFixed(2).replace('.', ',')}` : '';

      return `
        <div style="margin-bottom: 3px; font-size: 10px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>${t.description || 'Pedido Delivery'} (${timeStr})</span>
            <span>R$ ${amtStr}</span>
          </div>
          <div style="color: #444; font-size: 9px;">Pgto: ${pm}${mStr}${feeStr}</div>
        </div>
      `;
    }).join('');
  }

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    alert('Por favor, permita popups no seu navegador para imprimir o comprovante térmico.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Comprovante Fechamento de Caixa - ${session.id}</title>
      <meta charset="utf-8" />
      <style>
        * { font-weight: bold !important; box-sizing: border-box; }
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Courier New', Courier, monospace, sans-serif;
          width: 72mm;
          margin: 0 auto;
          padding: 8px 4px;
          font-size: 11px;
          color: #000;
          line-height: 1.25;
        }
        .text-center { text-align: center; }
        .dashed { border-bottom: 1px dashed #000; margin: 6px 0; }
        .double-line { border-bottom: 2px double #000; margin: 6px 0; }
        .header-title { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
        .tag-non-fiscal { font-size: 10px; font-weight: bold; border: 1px solid #000; padding: 2px 4px; display: inline-block; margin-top: 3px; }
        .sec-title { font-weight: bold; text-transform: uppercase; font-size: 11px; margin-bottom: 3px; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="header-title">${storeName}</div>
        <div style="font-size: 12px; font-weight: 900; margin-top: 2px;">FECHAMENTO DE CAIXA - RELATÓRIO</div>
        <div style="font-size: 10px; font-weight: normal; margin-top: 1px;">ID: ${session.id}</div>
        <div class="tag-non-fiscal">DOCUMENTO NÃO FISCAL</div>
      </div>

      <div class="dashed"></div>

      <div class="sec-title">1. FLUXO DE ABERTURA</div>
      <div style="font-size: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Abertura:</span> <span>${openedDate}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Op. Abertura:</span> <span>${session.openedBy || 'Operador'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>Fundo Inicial:</span> <span>R$ ${m.initial.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>

      <div class="dashed"></div>

      <div class="sec-title">2. ATENDIMENTO BALCÃO / PDV</div>
      <div style="font-size: 10px; margin-bottom: 4px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>Total Balcão (${m.counterSalesCount} pedidos):</span>
          <span>R$ ${m.counterSalesTotal.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #333; font-size: 9px; margin-top: 2px;">
          <span>Dinheiro: R$ ${m.counterCash.toFixed(2).replace('.', ',')}</span>
          <span>PIX: R$ ${m.counterPix.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #333; font-size: 9px;">
          <span>Débito: R$ ${m.counterDebito.toFixed(2).replace('.', ',')}</span>
          <span>Crédito: R$ ${m.counterCredito.toFixed(2).replace('.', ',')}</span>
        </div>
        ${m.counterVr > 0 ? `
        <div style="color: #333; font-size: 9px;">
          <span>VR: R$ ${m.counterVr.toFixed(2).replace('.', ',')}</span>
        </div>` : ''}
      </div>
      <div style="margin-top: 4px; border-top: 1px dashed #444; padding-top: 3px;">
        ${counterDetailsHtml}
      </div>

      <div class="dashed"></div>

      <div class="sec-title">3. DELIVERY / ENTREGAS</div>
      <div style="font-size: 10px; margin-bottom: 4px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>Total Delivery (${m.deliverySalesCount} pedidos):</span>
          <span>R$ ${m.deliverySalesTotal.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #333; font-size: 9px; margin-top: 2px;">
          <span>Dinheiro: R$ ${m.deliveryCash.toFixed(2).replace('.', ',')}</span>
          <span>PIX: R$ ${m.deliveryPix.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #333; font-size: 9px;">
          <span>Débito: R$ ${m.deliveryDebito.toFixed(2).replace('.', ',')}</span>
          <span>Crédito: R$ ${m.deliveryCredito.toFixed(2).replace('.', ',')}</span>
        </div>
        ${m.deliveryVr > 0 ? `
        <div style="color: #333; font-size: 9px;">
          <span>VR: R$ ${m.deliveryVr.toFixed(2).replace('.', ',')}</span>
        </div>` : ''}
        ${m.deliveryFeesTotal > 0 ? `
        <div style="color: #333; font-size: 9px; font-weight: bold;">
          <span>Taxas Entrega Inclusas: R$ ${m.deliveryFeesTotal.toFixed(2).replace('.', ',')}</span>
        </div>` : ''}
      </div>
      <div style="margin-top: 4px; border-top: 1px dashed #444; padding-top: 3px;">
        ${deliveryDetailsHtml}
      </div>

      <div class="dashed"></div>

      <div class="sec-title">4. RESUMO GERAL DO TURNO</div>
      <div style="font-size: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal Balcão:</span> <span>R$ ${m.counterSalesTotal.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal Delivery:</span> <span>R$ ${m.deliverySalesTotal.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid #000; padding-top: 2px; margin-top: 2px; font-size: 11px;">
          <span>TOTAL FATURAMENTO:</span> <span>R$ ${m.totalTurnover.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="margin-top: 4px; font-size: 9px; border-top: 1px dashed #999; padding-top: 3px;">
          <div style="display: flex; justify-content: space-between;"><span>Consol. Dinheiro:</span> <span>R$ ${m.cashSales.toFixed(2).replace('.', ',')}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Consol. Débito:</span> <span>R$ ${m.debitoSales.toFixed(2).replace('.', ',')}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Consol. Crédito:</span> <span>R$ ${m.creditoSales.toFixed(2).replace('.', ',')}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Consol. PIX:</span> <span>R$ ${m.pixSales.toFixed(2).replace('.', ',')}</span></div>
          ${m.vrSales > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Consol. VR:</span> <span>R$ ${m.vrSales.toFixed(2).replace('.', ',')}</span></div>` : ''}
        </div>
      </div>

      ${Object.keys(m.machineTotals).length > 0 ? `
      <div class="dashed"></div>
      <div class="sec-title">4.1 MAQUININHAS / OPERADORAS</div>
      <div style="font-size: 10px;">
        ${Object.entries(m.machineTotals).map(([mach, amt]) => `
          <div style="display: flex; justify-content: space-between;">
            <span>${mach}:</span> <span>R$ ${amt.toFixed(2).replace('.', ',')}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <div class="dashed"></div>

      <div class="sec-title">5. MOVIMENTAÇÕES E GAVETA</div>
      <div style="font-size: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Fundo Inicial:</span> <span>R$ ${m.initial.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Entrada Dinheiro Balcão (+):</span> <span>R$ ${m.counterCash.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Entrada Dinheiro Delivery (+):</span> <span>R$ ${m.deliveryCash.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Suprimentos (+):</span> <span>R$ ${m.suprimentos.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Sangrias (-):</span> <span>R$ ${m.sangrias.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px; border-top: 1px solid #000; padding-top: 2px;">
          <span>Dinheiro Esperado na Gaveta:</span> <span>R$ ${m.expectedCashInDrawer.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>Dinheiro Contado pelo Operador:</span> <span>R$ ${m.actualCashInDrawer.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px; border-top: 1px dashed #000; padding-top: 2px;">
          <span>Diferença / Quebra:</span> <span>R$ ${m.cashDifference.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>

      <div class="dashed"></div>

      <div style="font-size: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Fechamento:</span> <span>${closedDate}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Op. Fechamento:</span> <span>${session.closedBy || 'Operador'}</span>
        </div>
        ${session.notes ? `<div style="margin-top: 3px;"><b>Obs:</b> ${session.notes}</div>` : ''}
      </div>

      <div class="double-line"></div>

      <div class="text-center font-bold" style="font-size: 10px; margin-top: 6px;">
        *** FECHAMENTO CONCLUÍDO ***
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
};

export const printPdfClosingReport = (
  session: CashRegisterSession,
  ordersList: Order[] = [],
  storeName = 'BAGÔ - Submarine & Eats'
) => {
  if (!session) return;

  const m = getCashSessionMetrics(session, ordersList);
  const openedDate = session.openedAt ? formatDateTimeBrasilia(session.openedAt) : '-';
  const closedDate = session.closedAt ? formatDateTimeBrasilia(session.closedAt) : formatDateTimeBrasilia(new Date());

  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) {
    alert('Por favor, permita popups no seu navegador para visualizar e imprimir o relatório em PDF/A4.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Relatório de Fechamento de Caixa - ${session.id}</title>
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        body { margin: 0; padding: 24px; color: #1e293b; background-color: #fff; font-size: 13px; }
        .no-print { margin-bottom: 20px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; gap: 10px; align-items: center; justify-content: space-between; }
        .btn-print { background: #059669; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
        .btn-print:hover { background: #047857; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 20px; }
        .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; }
        .subtitle { font-size: 12px; color: #64748b; margin: 0; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
        .card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
        .row.bold { font-weight: 700; color: #0f172a; }
        .row.highlight { font-weight: 800; font-size: 14px; color: #059669; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
        th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 700; color: #334155; border-bottom: 1px solid #cbd5e1; }
        td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-blue { background: #dbeafe; color: #1e40af; }
        .badge-amber { background: #fef3c7; color: #92400e; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        @media print {
          .no-print { display: none !important; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <div>
          <strong>Relatório de Fechamento de Caixa</strong> &bull; Sessão: ${session.id}
        </div>
        <button class="btn-print" onclick="window.print()">
          🖨️ Imprimir / Salvar PDF
        </button>
      </div>

      <div class="header">
        <div>
          <h1 class="title">${storeName}</h1>
          <p class="subtitle">Comprovante de Fechamento e Prestação de Contas do Caixa</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 800; color: #059669;">Sessão #${session.id}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            Abertura: ${openedDate}<br/>
            Fechamento: ${closedDate}
          </div>
        </div>
      </div>

      <!-- Info Turno -->
      <div class="grid-3">
        <div class="card">
          <div class="card-title">Responsáveis</div>
          <div class="row"><span>Abertura por:</span> <strong>${session.openedBy || 'Operador'}</strong></div>
          <div class="row"><span>Fechado por:</span> <strong>${session.closedBy || 'Operador'}</strong></div>
          <div class="row"><span>Status:</span> <span class="badge badge-green">Fechado</span></div>
        </div>

        <div class="card">
          <div class="card-title">Faturamento Total do Turno</div>
          <div class="row"><span>Vendas Balcão (${m.counterSalesCount}):</span> <strong>R$ ${m.counterSalesTotal.toFixed(2).replace('.', ',')}</strong></div>
          <div class="row"><span>Vendas Delivery (${m.deliverySalesCount}):</span> <strong>R$ ${m.deliverySalesTotal.toFixed(2).replace('.', ',')}</strong></div>
          <div class="row highlight"><span>Faturamento Total:</span> <span>R$ ${m.totalTurnover.toFixed(2).replace('.', ',')}</span></div>
        </div>

        <div class="card">
          <div class="card-title">Conferência da Gaveta (Dinheiro)</div>
          <div class="row"><span>Fundo Inicial:</span> <strong>R$ ${m.initial.toFixed(2).replace('.', ',')}</strong></div>
          <div class="row"><span>Vendas em Dinheiro:</span> <strong>R$ ${m.cashSales.toFixed(2).replace('.', ',')}</strong></div>
          <div class="row"><span>Suprimentos (+):</span> <strong>R$ ${m.suprimentos.toFixed(2).replace('.', ',')}</strong></div>
          <div class="row"><span>Sangrias (-):</span> <strong>R$ ${m.sangrias.toFixed(2).replace('.', ',')}</strong></div>
          <div class="row bold"><span>Esperado na Gaveta:</span> <span>R$ ${m.expectedCashInDrawer.toFixed(2).replace('.', ',')}</span></div>
          <div class="row bold"><span>Contado pelo Operador:</span> <span>R$ ${m.actualCashInDrawer.toFixed(2).replace('.', ',')}</span></div>
          <div class="row highlight" style="color: ${m.cashDifference < 0 ? '#dc2626' : (m.cashDifference > 0 ? '#2563eb' : '#059669')};">
            <span>Diferença / Quebra:</span> <span>R$ ${m.cashDifference.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
      </div>

      <!-- Métodos de Pagamento e Maquininhas -->
      <div class="grid-2">
        <div class="card">
          <div class="card-title">Consolidação por Forma de Pagamento</div>
          <div class="row"><span>💵 Dinheiro:</span> <strong>R$ ${m.cashSales.toFixed(2).replace('.', ',')}</strong></div>
          <div class="row"><span>⚡ PIX:</span> <strong>R$ ${m.pixSales.toFixed(2).replace('.', ',')}</strong></div>
          <div class="row"><span>💳 Cartão de Débito:</span> <strong>R$ ${m.debitoSales.toFixed(2).replace('.', ',')}</strong></div>
          <div class="row"><span>💳 Cartão de Crédito:</span> <strong>R$ ${m.creditoSales.toFixed(2).replace('.', ',')}</strong></div>
          ${m.vrSales > 0 ? `<div class="row"><span>🍽️ Vale Refeição (VR):</span> <strong>R$ ${m.vrSales.toFixed(2).replace('.', ',')}</strong></div>` : ''}
          <div class="row highlight"><span>Total Vendas:</span> <span>R$ ${m.totalTurnover.toFixed(2).replace('.', ',')}</span></div>
        </div>

        <div class="card">
          <div class="card-title">Maquininhas & Operadoras de Cartão</div>
          ${Object.keys(m.machineTotals).length === 0 ? `
            <div style="color: #64748b; font-style: italic; font-size: 12px;">Nenhuma transação de maquininha com identificação registrada neste caixa.</div>
          ` : Object.entries(m.machineTotals).map(([mach, val]) => `
            <div class="row">
              <span>${mach}:</span>
              <strong>R$ ${val.toFixed(2).replace('.', ',')}</strong>
            </div>
          `).join('')}
          ${session.notes ? `
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 11px;">
              <strong>Observações do Fechamento:</strong> ${session.notes}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Tabela Completa de Transações do Caixa -->
      <div class="card" style="margin-top: 16px;">
        <div class="card-title">Extrato Detalhado de Transações da Sessão (${(session.transactions || []).length} movimentações)</div>
        <table>
          <thead>
            <tr>
              <th>Horário</th>
              <th>Tipo</th>
              <th>Canal / Origem</th>
              <th>Descrição / Pedido</th>
              <th>Forma Pgto / Maquininha</th>
              <th style="text-align: right;">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${(session.transactions || []).map(tx => {
              const time = tx.timestamp ? formatTimeBrasilia(tx.timestamp) : '-';
              const isEntry = tx.type === 'opening' || tx.type === 'sale' || tx.type === 'suprimento';
              let typeBadge = '<span class="badge badge-green">Venda</span>';
              if (tx.type === 'opening') typeBadge = '<span class="badge badge-blue">Abertura</span>';
              else if (tx.type === 'suprimento') typeBadge = '<span class="badge badge-blue">Suprimento</span>';
              else if (tx.type === 'sangria') typeBadge = '<span class="badge badge-red">Sangria</span>';

              const channelLabel = tx.channel === 'delivery' || tx.deliveryType === 'entrega' ? 'Delivery' : (tx.type === 'sale' ? 'Balcão' : 'Caixa');
              const machStr = formatMachineName(tx.cardProvider, tx.machineModel);
              const pmStr = tx.paymentMethod ? tx.paymentMethod.toUpperCase() : '-';
              const amtFormatted = (Number(tx.amount) || 0).toFixed(2).replace('.', ',');

              const matchedOrder = (ordersList || []).find(o => o.id === tx.orderId || (tx.orderCode && o.code === tx.orderCode) || (tx.id && o.id && tx.id.includes(o.id)));
              const isDeliveryTx = tx.channel === 'delivery' || tx.deliveryType === 'entrega' || matchedOrder?.deliveryType === 'entrega';
              const feeVal = isDeliveryTx ? (tx.deliveryFee !== undefined ? Number(tx.deliveryFee) : (Number(matchedOrder?.deliveryFee) || 0)) : 0;
              const feeFormatted = feeVal > 0 ? `<br/><span style="font-size: 9px; color: #b45309; font-weight: 800;">🛵 Frete: R$ ${feeVal.toFixed(2).replace('.', ',')}</span>` : '';

              return `
                <tr>
                  <td>${time}</td>
                  <td>${typeBadge}</td>
                  <td>${channelLabel}</td>
                  <td>${tx.description || tx.orderCode || '-'}</td>
                  <td>${pmStr}${machStr ? ` (${machStr})` : ''}${feeFormatted}</td>
                  <td style="text-align: right; font-weight: 700; color: ${tx.type === 'sangria' ? '#dc2626' : '#0f172a'};">
                    ${tx.type === 'sangria' ? '-' : ''}R$ ${amtFormatted}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 12px;">
        <div>Relatório gerado em: ${formatDateTimeBrasilia(new Date())}</div>
        <div>BAGÔ Sistema de Gestão &bull; Fechamento Oficial</div>
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
};
