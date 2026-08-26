export interface DeliveryFeeTier {
  id: string;
  minKm: number;
  maxKm: number;
  fee: number;
}

export interface StoreDeliverySettings {
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  tiers: DeliveryFeeTier[];
  allowOutOfRange: boolean;
  outOfRangeFee: number;
  maxDeliveryKm: number;
  freeDeliveryMinOrder: number; // 0 = sem entrega grátis por valor
  deliveryOpeningTime: string; // Ex: "18:00"
  deliveryClosingTime: string; // Ex: "23:30"
  isDeliveryBlocked?: boolean; // Bloqueio manual de recebimento de pedidos
  deliveryBlockedReason?: string; // Motivo do bloqueio manual (opcional)
  forceAlwaysOpen?: boolean; // Liberar delivery a qualquer momento (ignorar horário de funcionamento)
  pickupOnly?: boolean; // Habilitar somente retirada (bloqueia pedidos por delivery)
  pickupOnlyMessage?: string; // Mensagem exibida para os clientes quando Somente Retirada estiver ativo
  whatsappEnabled?: boolean; // Se o botão do WhatsApp deve aparecer na página inicial
  whatsappPhone?: string; // Número de WhatsApp para atendimento
  whatsappMessage?: string; // Mensagem padrão pré-definida
  kdsNotifyWhatsAppEnabled?: boolean; // Se deve perguntar para enviar WhatsApp no KDS ao mudar status
  kdsMessagePreparing?: string; // Mensagem padrão para pedido em preparação
  kdsMessageReady?: string; // Mensagem padrão para pedido pronto para retirada
  kdsMessageDelivery?: string; // Mensagem padrão para pedido saiu para entrega
}

export const DEFAULT_DELIVERY_SETTINGS: StoreDeliverySettings = {
  storeAddress: 'antonio leite rego leite',
  storeLat: -6.2098782704622675,
  storeLng: -38.49826149765623,
  tiers: [
    { id: 't1', minKm: 0, maxKm: 2, fee: 3.00 },
    { id: 't2', minKm: 2, maxKm: 3, fee: 5.00 },
    { id: 't3', minKm: 3, maxKm: 5, fee: 7.00 },
    { id: 't4', minKm: 5, maxKm: 10, fee: 10.00 }
  ],
  allowOutOfRange: true,
  outOfRangeFee: 15.00,
  maxDeliveryKm: 10,
  freeDeliveryMinOrder: 0,
  deliveryOpeningTime: '15:00',
  deliveryClosingTime: '23:00',
  isDeliveryBlocked: false,
  deliveryBlockedReason: '',
  forceAlwaysOpen: false,
  pickupOnly: false,
  pickupOnlyMessage: 'Hoje é o dia de folga do nosso delivery! 🛵💨\nMas fique tranquilo: estamos com a loja aberta e também disponível para retirada de pedidos. 🥖',
  whatsappEnabled: true,
  whatsappPhone: '5511999999999',
  whatsappMessage: 'Olá! Gostaria de tirar uma dúvida sobre a loja e o cardápio.',
  kdsNotifyWhatsAppEnabled: true,
  kdsMessagePreparing: 'Segue pedido esta sendo preparado.',
  kdsMessageReady: 'Seu pedido está pronto para retirada!',
  kdsMessageDelivery: 'Seu pedido saiu para entrega e está a caminho!'
};

const STORAGE_KEY = 'bago_delivery_settings';

export function getDeliverySettings(): StoreDeliverySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DELIVERY_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_DELIVERY_SETTINGS,
      ...parsed,
      tiers: Array.isArray(parsed.tiers) && parsed.tiers.length > 0 ? parsed.tiers : DEFAULT_DELIVERY_SETTINGS.tiers
    };
  } catch (err) {
    console.error('Error loading delivery settings:', err);
    return DEFAULT_DELIVERY_SETTINGS;
  }
}

export async function fetchDeliverySettingsFromApi(): Promise<StoreDeliverySettings> {
  try {
    const res = await fetch('/api/settings/delivery');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const merged = {
          ...DEFAULT_DELIVERY_SETTINGS,
          ...data,
          tiers: Array.isArray(data.tiers) && data.tiers.length > 0 ? data.tiers : DEFAULT_DELIVERY_SETTINGS.tiers
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new Event('deliverySettingsUpdated'));
        return merged;
      }
    }
  } catch (err) {
    console.warn('[DeliverySettings] API fetch failed, falling back to local cache:', err);
  }
  return getDeliverySettings();
}

export function saveDeliverySettings(settings: StoreDeliverySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Dispatch custom event so open tabs/components react immediately
    window.dispatchEvent(new Event('deliverySettingsUpdated'));

    // Asynchronously sync with backend MySQL Database
    fetch('/api/settings/delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(err => console.warn('[DeliverySettings] DB sync notice:', err));
  } catch (err) {
    console.error('Error saving delivery settings:', err);
  }
}

export async function saveDeliverySettingsToDb(settings: StoreDeliverySettings): Promise<{ success: boolean; savedInDb: boolean; message?: string }> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('deliverySettingsUpdated'));

    const res = await fetch('/api/settings/delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });

    if (res.ok) {
      const result = await res.json();
      return result;
    } else {
      return { success: false, savedInDb: false, message: 'Erro ao salvar no servidor' };
    }
  } catch (err: any) {
    console.error('Error saving delivery settings to DB:', err);
    return { success: false, savedInDb: false, message: err.message || 'Erro de conexão' };
  }
}

/**
 * Calculates straight line distance in km between two lat/lng coordinates (Haversine formula)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place (e.g. 2.4 km)
}

export interface FeeCalculationResult {
  fee: number;
  tierLabel: string;
  isOutOfRange: boolean;
  isFreeDelivery: boolean;
}

export function calculateDeliveryFee(
  distanceKm: number,
  subtotal: number = 0,
  settings: StoreDeliverySettings = getDeliverySettings()
): FeeCalculationResult {
  const freeMin = Number(settings?.freeDeliveryMinOrder) || 0;
  if (freeMin > 0 && subtotal >= freeMin) {
    return {
      fee: 0,
      tierLabel: `Entrega Grátis (Pedido acima de R$ ${freeMin.toFixed(2).replace('.', ',')})`,
      isOutOfRange: false,
      isFreeDelivery: true
    };
  }

  const sortedTiers = Array.isArray(settings?.tiers) ? [...settings.tiers].sort((a, b) => (a.minKm || 0) - (b.minKm || 0)) : [];
  
  for (const tier of sortedTiers) {
    const minKm = tier.minKm || 0;
    const maxKm = tier.maxKm || 0;
    const feeVal = Number(tier.fee) || 0;
    if (distanceKm >= minKm && distanceKm <= maxKm) {
      const label = minKm === 0
        ? `Até ${maxKm}km — R$ ${feeVal.toFixed(2).replace('.', ',')}`
        : `${minKm}km a ${maxKm}km — R$ ${feeVal.toFixed(2).replace('.', ',')}`;
      return {
        fee: feeVal,
        tierLabel: label,
        isOutOfRange: false,
        isFreeDelivery: false
      };
    }
  }

  const maxConfiguredKm = sortedTiers.length > 0 ? Math.max(...sortedTiers.map(t => t.maxKm || 0)) : 0;
  const outOfRangeFeeVal = Number(settings?.outOfRangeFee) || 0;
  if (distanceKm > maxConfiguredKm) {
    if (settings?.allowOutOfRange) {
      return {
        fee: outOfRangeFeeVal,
        tierLabel: `Acima de ${maxConfiguredKm}km (${(distanceKm || 0).toFixed(1)}km) — R$ ${outOfRangeFeeVal.toFixed(2).replace('.', ',')}`,
        isOutOfRange: false,
        isFreeDelivery: false
      };
    } else {
      return {
        fee: outOfRangeFeeVal,
        tierLabel: `Endereço a ${(distanceKm || 0).toFixed(1)}km excede a distância máxima de entrega (${settings?.maxDeliveryKm || maxConfiguredKm}km)`,
        isOutOfRange: true,
        isFreeDelivery: false
      };
    }
  }

  const defaultFee = Number(sortedTiers[0]?.fee) || 3.00;
  return {
    fee: defaultFee,
    tierLabel: `Taxa Padrão — R$ ${defaultFee.toFixed(2).replace('.', ',')}`,
    isOutOfRange: false,
    isFreeDelivery: false
  };
}

export interface DeliveryOpeningStatus {
  isBlocked: boolean;
  reason?: string;
  isManualBlock: boolean;
  isScheduleBlock: boolean;
}

export function checkDeliveryOpeningStatus(settings: StoreDeliverySettings = getDeliverySettings()): DeliveryOpeningStatus {
  // 1. Manual Block check
  if (settings.isDeliveryBlocked) {
    return {
      isBlocked: true,
      reason: settings.deliveryBlockedReason?.trim() || 'O recebimento de pedidos (para entrega e retirada na loja) está suspenso temporariamente pelo estabelecimento.',
      isManualBlock: true,
      isScheduleBlock: false
    };
  }

  // 2. Liberar Delivery a Qualquer Momento (Ignorar Horário de Funcionamento)
  if (settings.forceAlwaysOpen) {
    return {
      isBlocked: false,
      isManualBlock: false,
      isScheduleBlock: false
    };
  }

  // 3. Schedule check (opening & closing times)
  const opening = settings.deliveryOpeningTime?.trim();
  const closing = settings.deliveryClosingTime?.trim();

  if (opening) {
    let currentHours: number;
    let currentMinutes: number;

    try {
      const timeStr = new Date().toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      const [h, m] = timeStr.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        currentHours = h;
        currentMinutes = m;
      } else {
        const now = new Date();
        currentHours = now.getHours();
        currentMinutes = now.getMinutes();
      }
    } catch (e) {
      const now = new Date();
      currentHours = now.getHours();
      currentMinutes = now.getMinutes();
    }

    const currentTotalMin = currentHours * 60 + currentMinutes;

    const [openH, openM] = opening.split(':').map(Number);
    const openTotalMin = (isNaN(openH) ? 15 : openH) * 60 + (isNaN(openM) ? 0 : openM);

    let closeTotalMin = 23 * 60;
    if (closing) {
      const [closeH, closeM] = closing.split(':').map(Number);
      closeTotalMin = (isNaN(closeH) ? 23 : closeH) * 60 + (isNaN(closeM) ? 0 : closeM);
    }

    let isWithinSchedule = false;
    if (closeTotalMin >= openTotalMin) {
      // Standard schedule within same day (e.g. 18:00 to 23:30)
      isWithinSchedule = currentTotalMin >= openTotalMin && currentTotalMin <= closeTotalMin;
    } else {
      // Overnight schedule (e.g. 18:00 to 02:00)
      isWithinSchedule = currentTotalMin >= openTotalMin || currentTotalMin <= closeTotalMin;
    }

    if (!isWithinSchedule) {
      const timeRangeStr = closing ? `das ${opening} às ${closing}` : `a partir das ${opening}`;
      return {
        isBlocked: true,
        reason: `Estabelecimento fechado! Nosso horário de atendimento para pedidos (entrega e retirada) é ${timeRangeStr}.`,
        isManualBlock: false,
        isScheduleBlock: true
      };
    }
  }

  return {
    isBlocked: false,
    isManualBlock: false,
    isScheduleBlock: false
  };
}
