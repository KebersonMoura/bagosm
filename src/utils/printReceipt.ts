import { Order } from '../types';
import { formatDateBrasilia, formatTimeBrasilia } from './dateUtils';

const formatAddressForPrint = (addressStr?: string) => {
  if (!addressStr) return '';
  const rawParts = addressStr
    .split(/\n| \| | - |,(?=\s*)/)
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => !p.toLowerCase().includes('gps') && !p.toLowerCase().includes('maps') && !p.includes('📍'));

  return rawParts.map(p => `<div style="margin-bottom: 2px;">${p}</div>`).join('');
};

const isProteinExtra = (name: string): boolean => {
  const n = name.toLowerCase();
  return (
    n.includes('frango') ||
    n.includes('carne') ||
    n.includes('sol') ||
    n.includes('atum') ||
    n.includes('peito') ||
    n.includes('peru') ||
    n.includes('veggie') ||
    n.includes('ovo') ||
    n.includes('hambúrguer') ||
    n.includes('hamburguer') ||
    n.includes('picanha') ||
    n.includes('costela') ||
    n.includes('calabresa') ||
    n.includes('teriyaki') ||
    n.includes('proteína') ||
    n.includes('proteina')
  );
};

export const printThermalReceipt = (order: Order, options?: { isKitchenTicket?: boolean }) => {
  if (!order) return;

  const timeStr = formatTimeBrasilia(order.createdAt || new Date());
  const dateStr = formatDateBrasilia(order.createdAt || new Date());

  const methodLabelMap: Record<string, string> = {
    debito: 'DÉBITO',
    credito: 'CRÉDITO',
    pix: 'PIX',
    dinheiro: 'DINHEIRO',
    vr: 'VR'
  };

  let paymentMethodText = '';
  let trocoHtml = '';

  if (order.paymentSplits && order.paymentSplits.length > 0) {
    paymentMethodText = order.paymentSplits
      .map(s => {
        const mL = methodLabelMap[s.method] || s.method.toUpperCase();
        const amt = (Number(s.amount) || 0).toFixed(2).replace('.', ',');
        return `${mL} (R$ ${amt})`;
      })
      .join(' + ');

    const cashSplit = order.paymentSplits.find(s => s.method === 'dinheiro');
    if (cashSplit) {
      const splitAmount = Number(cashSplit.amount || 0);
      const splitReceived = Number(cashSplit.cashReceived || 0);
      let splitChange = 0;
      if (cashSplit.changeAmount !== undefined && cashSplit.changeAmount !== null && Number(cashSplit.changeAmount) > 0) {
        splitChange = Number(cashSplit.changeAmount);
      } else if (splitReceived > splitAmount) {
        splitChange = splitReceived - splitAmount;
      }

      if (splitReceived > 0 || splitChange > 0) {
        trocoHtml = `
          <div style="font-size: 12px; font-weight: 900; margin-top: 4px; padding: 4px 6px; border: 1.5px dashed #000; background-color: #f8f8f8;">
            ${splitReceived > 0 ? `<div>💵 RECEBIDO EM DINHEIRO: R$ ${splitReceived.toFixed(2).replace('.', ',')}</div>` : ''}
            ${splitChange > 0 ? `<div style="font-size: 13px; font-weight: 900; margin-top: 2px;">👉 VALOR DO TROCO: R$ ${splitChange.toFixed(2).replace('.', ',')}</div>` : ''}
          </div>
        `;
      }
    }
  } else {
    paymentMethodText = methodLabelMap[order.paymentMethod || ''] || (order.paymentMethod || 'NÃO INFORMADO').toUpperCase();
    
    // Check if cash or troco info is provided
    const totalOrder = Number(order.totalPrice || 0);
    const cashGiven = Number(order.changeForAmount || order.cashReceived || 0);
    let changeVal = 0;

    if (order.changeAmount !== undefined && order.changeAmount !== null && Number(order.changeAmount) > 0) {
      changeVal = Number(order.changeAmount);
    } else if (cashGiven > totalOrder) {
      changeVal = cashGiven - totalOrder;
    }

    if (cashGiven > 0 || changeVal > 0 || order.needChange) {
      trocoHtml = `
        <div style="font-size: 12px; font-weight: 900; margin-top: 4px; padding: 4px 6px; border: 1.5px dashed #000; background-color: #f8f8f8;">
          ${cashGiven > 0 ? `<div>💵 TROCO PARA: R$ ${cashGiven.toFixed(2).replace('.', ',')}</div>` : ''}
          ${changeVal > 0 ? `
            <div style="font-size: 13px; font-weight: 900; margin-top: 2px;">
              👉 VALOR DO TROCO: R$ ${changeVal.toFixed(2).replace('.', ',')}
            </div>
          ` : (order.needChange ? `<div style="font-size: 12px; font-weight: 900;">💵 CLIENTE SOLICITOU TROCO</div>` : '')}
        </div>
      `;
    }
  }

  let deliveryTypeText = 'MESA/RETIRADA';
  if (order.deliveryType === 'entrega') {
    deliveryTypeText = 'ENTREGA';
  } else if (order.tableNumber) {
    deliveryTypeText = `MESA ${order.tableNumber}`;
  }

  const itemsHtml = (order.items || []).map(item => {
    if (item.sandwich) {
      const sw = item.sandwich;
      const extraProteins = (sw.extras || []).filter(isProteinExtra);
      const otherExtras = (sw.extras || []).filter(e => !isProteinExtra(e));

      const titleName = item.productName || (sw.protein ? `BAGÔ ${sw.protein}` : 'BAGÔ SANDUÍCHE');
      const qtySuffix = item.quantity > 1 ? ` (${item.quantity}x)` : '';

      return `
        <div style="margin-top: 10px; margin-bottom: 12px;">
          <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; margin-bottom: 8px; font-weight: 900; font-size: 13px; text-transform: uppercase;">
            🥪 ${titleName}${qtySuffix}
          </div>

          ${sw.bread ? `
            <div style="margin-top: 6px; font-weight: 900; font-size: 12px;">🍞 PÃO</div>
            <div style="font-size: 12px; font-weight: bold; padding-left: 4px;">☑️ ${sw.bread}</div>
          ` : ''}

          ${(sw.protein || extraProteins.length > 0) ? `
            <div style="margin-top: 6px; font-weight: 900; font-size: 12px;">🥩 PROTEÍNA</div>
            ${sw.protein ? `<div style="font-size: 12px; font-weight: bold; padding-left: 4px;">☑️ ${sw.protein}</div>` : ''}
            ${extraProteins.map(p => `<div style="font-size: 12px; font-weight: bold; padding-left: 4px;">➕ ${p}</div>`).join('')}
          ` : ''}

          ${(sw.cheese && sw.cheese !== 'Sem Queijo') ? `
            <div style="margin-top: 6px; font-weight: 900; font-size: 12px;">🧀 QUEIJOS</div>
            <div style="font-size: 12px; font-weight: bold; padding-left: 4px;">☑️ ${sw.cheese}</div>
          ` : ''}

          ${otherExtras.length > 0 ? `
            <div style="margin-top: 6px; font-weight: 900; font-size: 12px;">🥓 ADICIONAIS</div>
            ${otherExtras.map(e => `<div style="font-size: 12px; font-weight: bold; padding-left: 4px;">☑️ ${e}</div>`).join('')}
          ` : ''}

          ${(sw.veggies && sw.veggies.length > 0) ? `
            <div style="margin-top: 6px; font-weight: 900; font-size: 12px;">🥬 SALADA</div>
            ${sw.veggies.map(v => `<div style="font-size: 12px; font-weight: bold; padding-left: 4px;">☑️ ${v}</div>`).join('')}
          ` : ''}

          ${(sw.sauces && sw.sauces.length > 0) ? `
            <div style="margin-top: 6px; font-weight: 900; font-size: 12px;">🥣 MOLHOS</div>
            ${sw.sauces.map(s => `<div style="font-size: 12px; font-weight: bold; padding-left: 4px;">☑️ ${s}</div>`).join('')}
          ` : ''}

          ${(sw.drinksAndCookies && sw.drinksAndCookies.length > 0) ? `
            <div style="margin-top: 6px; font-weight: 900; font-size: 12px;">🥤 BEBIDAS / ACOMPANHAMENTOS</div>
            ${sw.drinksAndCookies.map(dc => `<div style="font-size: 12px; font-weight: bold; padding-left: 4px;">☑️ ${dc}</div>`).join('')}
          ` : ''}


        </div>
      `;
    }

    // Ready products / standard items
    const itemTotal = ((Number(item.price) || 0) * (Number(item.quantity) || 1)).toFixed(2).replace('.', ',');
    return `
      <div style="border-top: 1px dashed #000; padding: 6px 0; margin-top: 8px;">
        <div style="font-size: 12px; font-weight: 900; display: flex; justify-content: space-between;">
          <span>☑️ ${item.quantity}x ${item.productName || 'Produto'}</span>
          <span>R$ ${itemTotal}</span>
        </div>
      </div>
    `;
  }).join('');

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pedido #${order.code}</title>
      <meta charset="utf-8" />
      <style>
        * {
          font-weight: bold !important;
          box-sizing: border-box;
        }
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-family: 'Courier New', Courier, monospace, 'DejaVu Sans Mono', sans-serif;
          width: 74mm;
          margin: 0 auto;
          padding: 6px 2px;
          font-size: 12px;
          color: #000;
          line-height: 1.25;
          font-weight: bold !important;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .double-header {
          border-top: 2px double #000;
          border-bottom: 2px double #000;
          padding: 6px 0;
          margin-bottom: 8px;
          text-align: center;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .double-footer {
          border-top: 2px double #000;
          border-bottom: 2px double #000;
          padding: 6px 0;
          margin-top: 10px;
          margin-bottom: 10px;
        }
      </style>
    </head>
    <body>
      <div class="double-header">
        🍔 BAGÔ
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin-bottom: 3px;">
        <span>PEDIDO: #${order.code}</span>
        <span>${deliveryTypeText}</span>
      </div>
      <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin-bottom: 3px;">
        CLIENTE: ${order.customerName || 'CLIENTE'}
      </div>
      <div style="font-size: 12px; font-weight: 900; margin-bottom: 6px;">
        DATA/HORA: ${dateStr} às ${timeStr}
      </div>

      ${order.deliveryAddress ? `
        <div style="border-top: 1px dashed #000; padding-top: 4px; margin-top: 6px; margin-bottom: 6px;">
          <div style="font-size: 11px; font-weight: 900; text-transform: uppercase;">ENDEREÇO PARA ENTREGA:</div>
          <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin-top: 2px;">
            ${formatAddressForPrint(order.deliveryAddress)}
          </div>
        </div>
      ` : ''}

      ${itemsHtml}

      <div class="double-footer">
        <div style="font-size: 12px; font-weight: 900; text-transform: uppercase;">
          FORMA DE PAGAMENTO: ${paymentMethodText}
        </div>
        ${trocoHtml}
        ${(order.deliveryType === 'entrega' && order.deliveryFee && Number(order.deliveryFee) > 0) ? `
          <div style="font-size: 12px; font-weight: 900; margin-top: 3px;">
            Taxa de Entrega: R$ ${Number(order.deliveryFee).toFixed(2).replace('.', ',')}
          </div>
        ` : ''}
        ${(order.discountAmount && Number(order.discountAmount) > 0) ? `
          <div style="font-size: 12px; font-weight: 900; margin-top: 3px;">
            🏷️ Desconto Cupom (${order.couponCode || 'CUPOM'}): - R$ ${Number(order.discountAmount).toFixed(2).replace('.', ',')}
          </div>
        ` : ''}
        <div style="font-size: 15px; font-weight: 900; margin-top: 5px;">
          💲 Valor Final: R$ ${(Number(order.totalPrice) || 0).toFixed(2).replace('.', ',')}
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

