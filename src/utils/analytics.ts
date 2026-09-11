/**
 * Utilitário de monitoramento de eventos para o Google Analytics (GA4)
 * Tag configurada no sistema: G-VEY28HE4DF
 */

export interface TrackableItem {
  id?: string | number;
  name: string;
  price?: number | string;
  category?: string;
  subcategory?: string;
  isCombo?: boolean;
}

/**
 * Dispara evento de clique em item/produto no Google Analytics (GA4)
 * Envia o evento padrão de e-commerce 'select_item' e o evento customizado 'product_click'
 */
export function trackItemClick(item: TrackableItem, origin: string = 'pagina_inicial') {
  try {
    if (typeof window === 'undefined') return;

    const win = window as any;
    if (typeof win.gtag !== 'function') return;

    const priceNumber = typeof item.price === 'number' 
      ? item.price 
      : Number(item.price) || 0;

    const itemId = String(item.id || item.name);
    const itemName = item.name;
    const category = item.category || 'Geral';
    const subcategory = item.subcategory || '';

    // 1. Evento Recomendado de E-commerce do GA4: select_item
    win.gtag('event', 'select_item', {
      item_list_id: origin,
      item_list_name: origin,
      items: [
        {
          item_id: itemId,
          item_name: itemName,
          item_category: category,
          item_category2: subcategory || undefined,
          price: priceNumber,
          currency: 'BRL',
          quantity: 1
        }
      ]
    });

    // 2. Evento Customizado Direto: product_click (Permite métricas e relatórios rápidos em tempo real no GA4)
    win.gtag('event', 'product_click', {
      item_name: itemName,
      item_id: itemId,
      item_category: category,
      item_subcategory: subcategory,
      price: priceNumber,
      currency: 'BRL',
      click_location: origin,
      is_combo: Boolean(item.isCombo)
    });

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[GA4] Click monitorado no produto: "${itemName}" (origem: ${origin})`);
    }
  } catch (err) {
    console.debug('[GA4] Erro ao registrar clique:', err);
  }
}

/**
 * Dispara evento quando o cliente adiciona um item ao carrinho rápido
 */
export function trackAddToCart(item: TrackableItem) {
  try {
    if (typeof window === 'undefined') return;
    const win = window as any;
    if (typeof win.gtag !== 'function') return;

    const priceNumber = typeof item.price === 'number' 
      ? item.price 
      : Number(item.price) || 0;

    win.gtag('event', 'add_to_cart', {
      currency: 'BRL',
      value: priceNumber,
      items: [
        {
          item_id: String(item.id || item.name),
          item_name: item.name,
          item_category: item.category || 'Geral',
          price: priceNumber,
          currency: 'BRL',
          quantity: 1
        }
      ]
    });
  } catch (err) {
    console.debug('[GA4] Erro ao registrar add_to_cart:', err);
  }
}

/**
 * Dispara evento quando um pedido é concluído com sucesso
 */
export function trackPurchase(order: { id?: string; total: number; items?: any[] }) {
  try {
    if (typeof window === 'undefined') return;
    const win = window as any;
    if (typeof win.gtag !== 'function') return;

    win.gtag('event', 'purchase', {
      transaction_id: order.id || `order-${Date.now()}`,
      value: Number(order.total) || 0,
      currency: 'BRL',
      items: (order.items || []).map(i => ({
        item_name: i.name,
        price: Number(i.price) || 0,
        quantity: i.quantity || 1
      }))
    });
  } catch (err) {
    console.debug('[GA4] Erro ao registrar purchase:', err);
  }
}
