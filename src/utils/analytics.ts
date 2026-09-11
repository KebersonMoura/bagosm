/**
 * Utilitário de monitoramento de eventos para o Google Analytics (GA4)
 * ID de medição: G-VEY28HE4DF
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
 * Obtém ou inicializa a função gtag de forma segura e resiliente
 */
function safeGtag(...args: any[]) {
  if (typeof window === 'undefined') return;
  const win = window as any;

  // Garante que dataLayer existe
  win.dataLayer = win.dataLayer || [];

  // Garante que window.gtag existe
  if (typeof win.gtag !== 'function') {
    win.gtag = function() {
      win.dataLayer.push(arguments);
    };
  }

  try {
    // 1. Dispara pelo gtag nativo
    win.gtag(...args);

    // 2. Se for um evento, também empurra diretamente para o dataLayer como fallback
    if (args[0] === 'event' && typeof args[1] === 'string') {
      const eventName = args[1];
      const eventParams = args[2] || {};
      win.dataLayer.push({
        event: eventName,
        ...eventParams
      });
    }
  } catch (e) {
    console.warn('[Analytics GA4] Falha ao enviar evento:', e);
  }
}

/**
 * Dispara evento de clique em item/produto no Google Analytics (GA4)
 */
export function trackItemClick(item: TrackableItem, origin: string = 'pagina_inicial') {
  try {
    const priceNumber = typeof item.price === 'number' 
      ? item.price 
      : Number(item.price) || 0;

    const itemId = String(item.id || item.name);
    const itemName = item.name;
    const category = item.category || 'Geral';
    const subcategory = item.subcategory || '';

    // 1. Evento Recomendado de E-commerce do GA4: select_item
    safeGtag('event', 'select_item', {
      item_list_id: origin,
      item_list_name: origin,
      debug_mode: true,
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

    // 2. Evento Direto do GA4: product_click (Permite métricas e relatórios rápidos em tempo real)
    safeGtag('event', 'product_click', {
      item_name: itemName,
      item_id: itemId,
      item_category: category,
      item_subcategory: subcategory,
      price: priceNumber,
      currency: 'BRL',
      click_location: origin,
      is_combo: Boolean(item.isCombo),
      debug_mode: true
    });

    console.info(`[Analytics GA4] Clique registrado: "${itemName}" (origem: ${origin})`);
  } catch (err) {
    console.warn('[Analytics GA4] Erro ao registrar clique:', err);
  }
}

/**
 * Dispara evento quando o cliente adiciona um item ao carrinho
 */
export function trackAddToCart(item: TrackableItem) {
  try {
    const priceNumber = typeof item.price === 'number' 
      ? item.price 
      : Number(item.price) || 0;

    safeGtag('event', 'add_to_cart', {
      currency: 'BRL',
      value: priceNumber,
      debug_mode: true,
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

    console.info(`[Analytics GA4] Adicionado ao carrinho: "${item.name}"`);
  } catch (err) {
    console.warn('[Analytics GA4] Erro ao registrar add_to_cart:', err);
  }
}

/**
 * Dispara evento quando um pedido é concluído com sucesso
 */
export function trackPurchase(order: { id?: string; total: number; items?: any[] }) {
  try {
    safeGtag('event', 'purchase', {
      transaction_id: order.id || `order-${Date.now()}`,
      value: Number(order.total) || 0,
      currency: 'BRL',
      debug_mode: true,
      items: (order.items || []).map(i => ({
        item_name: i.name,
        price: Number(i.price) || 0,
        quantity: i.quantity || 1
      }))
    });

    console.info(`[Analytics GA4] Compra registrada com sucesso: Pedido #${order.id || ''}`);
  } catch (err) {
    console.warn('[Analytics GA4] Erro ao registrar purchase:', err);
  }
}

/**
 * Dispara evento quando o cliente filtra por subcategoria
 */
export function trackCategoryFilter(subcategory: string) {
  try {
    safeGtag('event', 'filter_subcategory', {
      subcategory_name: subcategory,
      debug_mode: true
    });
  } catch (err) {
    console.warn('[Analytics GA4] Erro ao registrar filtro:', err);
  }
}
