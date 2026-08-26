import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, 
  ChevronRight, 
  ChevronLeft, 
  ChevronDown,
  Check, 
  Ruler, 
  Sparkles, 
  Flame, 
  Coffee, 
  Utensils, 
  Clock, 
  AlertCircle, 
  Compass, 
  Search, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Smile,
  Plus,
  Minus,
  X,
  SlidersHorizontal,
  Tag,
  Star,
  CreditCard,
  QrCode,
  Banknote,
  Printer,
  Wheat,
  MapPin,
  Truck,
  LayoutGrid,
  List,
  Lock,
  Ticket,
  Info,
  Instagram,
  Phone,
  Store,
  MessageCircle,
  Navigation
} from 'lucide-react';
import { Ingredient, CustomSandwich, Order, CustomizerStep, ReadyProduct, StoreInfo } from '../types';
import { calculateAssemblyExtras, getOptionStatus } from '../utils/assemblyRules';
import { BuildSandwichModal } from './BuildSandwichModal';
import { DeliveryMapPicker } from './DeliveryMapPicker';
import {
  getDeliverySettings,
  fetchDeliverySettingsFromApi,
  calculateHaversineDistance,
  calculateDeliveryFee,
  checkDeliveryOpeningStatus,
  StoreDeliverySettings,
  DEFAULT_DELIVERY_SETTINGS
} from '../utils/deliverySettings';

interface CustomerSiteProps {
  ingredients: Ingredient[];
  onOrderCreated: (order: Order) => void;
  activeTrackingOrder: Order | null;
  setActiveTrackingOrder: (order: Order | null) => void;
  stepsConfig?: CustomizerStep[];
  readyProducts?: ReadyProduct[];
}

export default function CustomerSite({ 
  ingredients, 
  onOrderCreated, 
  activeTrackingOrder,
  setActiveTrackingOrder,
  stepsConfig = [],
  readyProducts = []
}: CustomerSiteProps) {
  const [view, setView] = useState<'home' | 'builder' | 'tracker'>('home');
  const [step, setStep] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [searchError, setSearchError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delivery type and address states
  const [deliveryType, setDeliveryType] = useState<'retirada' | 'entrega'>('entrega');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState('SAO MIGUEL');
  const [addressState, setAddressState] = useState('RN');
  const [addressComplement, setAddressComplement] = useState('');
  const [addressReference, setAddressReference] = useState('');
  const [gpsTriggerSignal, setGpsTriggerSignal] = useState<number>(0);
  const [isGpsSearching, setIsGpsSearching] = useState<boolean>(false);
  const [gpsSearchError, setGpsSearchError] = useState<string | null>(null);
  const [manualAddressEntry, setManualAddressEntry] = useState<boolean>(false);

  // Customer auto-lookup states
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [customerFoundNotice, setCustomerFoundNotice] = useState('');

  const lookupCustomerByPhone = async (phoneToSearch: string) => {
    const digits = phoneToSearch.replace(/\D/g, '');
    if (digits.length < 8) return;

    try {
      setSearchingCustomer(true);
      const res = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(phoneToSearch.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.customer) {
          const c = data.customer;
          if (c.name) setCustomerName(c.name);
          if (c.street) setAddressStreet(c.street);
          if (c.number) setAddressNumber(c.number);
          if (c.neighborhood) setAddressNeighborhood(c.neighborhood);
          if (c.city) setAddressCity(c.city);
          if (c.state) setAddressState(c.state);
          if (c.complement) setAddressComplement(c.complement);
          if (c.reference) setAddressReference(c.reference);
          if (c.lat && c.lng) {
            setDeliveryMapLat(c.lat);
            setDeliveryMapLng(c.lng);
          }
          setCustomerFoundNotice(`✓ Cadastro localizado! Dados de ${c.name} preenchidos automaticamente.`);
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar cadastro de cliente por telefone:', err);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (val: string) => {
    const formatted = formatPhoneNumber(val);
    setCustomerPhone(formatted);
    if (orderError) setOrderError('');
    if (customerFoundNotice) setCustomerFoundNotice('');
    const digits = formatted.replace(/\D/g, '');
    if (digits.length >= 10) {
      lookupCustomerByPhone(formatted);
    }
  };

  // Map Delivery Fee states (Initialized from saved store settings in DB / localStorage)
  const initialSettings = getDeliverySettings();
  const defaultMinFee = (initialSettings.tiers && initialSettings.tiers.length > 0 && initialSettings.tiers[0].fee !== undefined) ? initialSettings.tiers[0].fee : 3.00;
  const [storeDeliverySettings, setStoreDeliverySettings] = useState<StoreDeliverySettings>(initialSettings);
  const [deliveryMapLat, setDeliveryMapLat] = useState<number>(initialSettings.storeLat || -5.6138);
  const [deliveryMapLng, setDeliveryMapLng] = useState<number>(initialSettings.storeLng || -38.0169);
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(defaultMinFee);
  const [deliveryTierDescription, setDeliveryTierDescription] = useState<string>('');
  const [deliveryOpeningTime, setDeliveryOpeningTime] = useState<string>(initialSettings.deliveryOpeningTime || '15:00');

  // Compute live delivery opening status (schedule & manual block)
  const deliveryStatus = checkDeliveryOpeningStatus(storeDeliverySettings);

  // Store Information State
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({
    city: 'sao miguel - rn',
    phone: '',
    instagram: '',
    address: '',
    openingHours: 'Segunda a Domingo: 15:00 às 23:00',
    paymentMethods: 'Pix, Cartão de Crédito, Cartão de Débito, Dinheiro',
    openingTime: 'Aberto • 15:00 às 23:00',
    showOnHomePage: true
  });
  const [isStoreInfoModalOpen, setIsStoreInfoModalOpen] = useState(false);

  const fetchStoreInfo = React.useCallback(async () => {
    try {
      const res = await fetch('/api/settings/info');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          setStoreInfo(prev => ({ ...prev, ...data }));
        }
      }
    } catch (err) {
      console.warn('Error fetching store info:', err);
    }
  }, []);

  useEffect(() => {
    fetchStoreInfo();
  }, [fetchStoreInfo]);

  // Fetch saved settings from DB on mount
  useEffect(() => {
    fetchDeliverySettingsFromApi().then(settings => {
      if (settings) {
        setStoreDeliverySettings(settings);
        if (settings.storeLat && settings.storeLng) {
          setDeliveryMapLat(prev => (prev === -5.6138 || !prev) ? settings.storeLat : prev);
          setDeliveryMapLng(prev => (prev === -38.0169 || !prev) ? settings.storeLng : prev);
        }
        if (settings.deliveryOpeningTime) {
          setDeliveryOpeningTime(settings.deliveryOpeningTime);
        }
        if (settings.tiers && settings.tiers.length > 0 && settings.tiers[0].fee !== undefined) {
          const apiMinFee = settings.tiers[0].fee;
          setDeliveryFee(prev => (prev === 0 || deliveryDistanceKm === 0 ? apiMinFee : prev));
        }
      }
    });

    const handleSettingsUpdate = () => {
      const updated = getDeliverySettings();
      setStoreDeliverySettings(updated);
      if (updated.pickupOnly) {
        setDeliveryType('retirada');
      }
      if (updated.storeLat && updated.storeLng) {
        setDeliveryMapLat(prev => (prev === -5.6138 || !prev) ? updated.storeLat : prev);
        setDeliveryMapLng(prev => (prev === -38.0169 || !prev) ? updated.storeLng : prev);
      }
      if (updated.deliveryOpeningTime) {
        setDeliveryOpeningTime(updated.deliveryOpeningTime);
      }
      if (updated.tiers && updated.tiers.length > 0 && updated.tiers[0].fee !== undefined) {
        const updatedMinFee = updated.tiers[0].fee;
        setDeliveryFee(prev => (deliveryDistanceKm === 0 ? updatedMinFee : prev));
      }
    };
    window.addEventListener('deliverySettingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('deliverySettingsUpdated', handleSettingsUpdate);
  }, [deliveryDistanceKm]);

  // Keep deliveryType synced to retirada if store is in pickupOnly mode
  useEffect(() => {
    if (storeDeliverySettings.pickupOnly && deliveryType === 'entrega') {
      setDeliveryType('retirada');
    }
  }, [storeDeliverySettings.pickupOnly, deliveryType]);

  // Helper to format full address string for order payload
  const getComputedDeliveryAddress = () => {
    if (deliveryType !== 'entrega') return undefined;
    const street = addressStreet.trim();
    const num = addressNumber.trim();
    const neighborhood = addressNeighborhood.trim();
    const city = addressCity.trim();
    const state = addressState.trim();
    const ref = addressReference.trim();

    const parts = [];
    if (street) parts.push(`Rua: ${street}`);
    if (num) parts.push(`Nº ${num}`);
    if (neighborhood) parts.push(`Bairro: ${neighborhood}`);
    if (city || state) parts.push(`Cidade/UF: ${city}${state ? `/${state}` : ''}`);
    if (ref) parts.push(`Ref: ${ref}`);

    if (deliveryMapLat != null && deliveryMapLng != null && !isNaN(Number(deliveryMapLat)) && !isNaN(Number(deliveryMapLng))) {
      parts.push(`📍 GPS: ${Number(deliveryMapLat).toFixed(6)}, ${Number(deliveryMapLng).toFixed(6)}`);
      parts.push(`Maps: https://www.google.com/maps?q=${deliveryMapLat},${deliveryMapLng}`);
    }

    if (parts.length === 0) {
      if (!deliveryAddress.trim()) return undefined;
      let text = deliveryAddress.trim();
      if (deliveryMapLat != null && deliveryMapLng != null && !isNaN(Number(deliveryMapLat)) && !isNaN(Number(deliveryMapLng))) {
        text += ` | 📍 GPS: ${Number(deliveryMapLat).toFixed(6)}, ${Number(deliveryMapLng).toFixed(6)}`;
      }
      return text;
    }

    return parts.join(', ');
  };

  // Helper to validate delivery address fields
  const validateDeliveryAddressFields = (): boolean => {
    if (deliveryType !== 'entrega') return true;
    if (!addressStreet.trim()) {
      setOrderError('Por favor, informe o nome da rua para a entrega.');
      return false;
    }
    if (!addressNeighborhood.trim()) {
      setOrderError('Por favor, informe o bairro para a entrega.');
      return false;
    }
    if (!addressNumber.trim()) {
      setOrderError('⚠️ O número da residência é obrigatório! Por favor, informe o número da casa (ou S/N caso não possua).');
      return false;
    }
    if (!addressCity.trim()) {
      setOrderError('Por favor, informe a cidade.');
      return false;
    }
    if (!addressState.trim()) {
      setOrderError('Por favor, informe o estado (UF).');
      return false;
    }
    return true;
  };

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<'debito' | 'credito' | 'pix' | 'dinheiro'>('debito');
  const [needChange, setNeedChange] = useState<boolean>(false);
  const [changeForAmount, setChangeForAmount] = useState<string>('');

  // Coupon Checkout States
  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number; description?: string } | null>(null);
  const [couponError, setCouponError] = useState<string>('');
  const [couponSuccess, setCouponSuccess] = useState<string>('');
  const [validatingCoupon, setValidatingCoupon] = useState<boolean>(false);

  // WhatsApp Order Confirmation Modal State
  const [whatsappPromptOrder, setWhatsappPromptOrder] = useState<Order | null>(null);

  // Function to build WhatsApp message with order summary
  const generateWhatsAppOrderSummary = (order: Order): string => {
    const lines: string[] = [];
    lines.push(`📋 *NOVO PEDIDO: #${order.code}*`);
    lines.push(`👤 *Cliente:* ${order.customerName}`);
    if (order.customerPhone) {
      lines.push(`📱 *Telefone/WhatsApp:* ${order.customerPhone}`);
    }
    lines.push(`📍 *Atendimento:* ${order.deliveryType === 'entrega' ? '🛵 Entrega em Casa' : '🏪 Retirada no Balcão'}`);
    
    if (order.deliveryType === 'entrega') {
      if (order.addressStreet) {
        let addr = `${order.addressStreet}`;
        if (order.addressNumber) addr += `, Nº ${order.addressNumber}`;
        if (order.addressNeighborhood) addr += ` - ${order.addressNeighborhood}`;
        if (order.addressCity || order.addressState) addr += `, ${order.addressCity || ''}${order.addressState ? `/${order.addressState}` : ''}`;
        if (order.addressComplement) addr += ` (${order.addressComplement})`;
        if (order.addressReference) addr += ` [Ref: ${order.addressReference}]`;
        lines.push(`🏠 *Endereço:* ${addr}`);
      } else if (order.deliveryAddress) {
        lines.push(`🏠 *Endereço:* ${order.deliveryAddress}`);
      }
      if (order.deliveryDistanceKm && order.deliveryDistanceKm > 0) {
        lines.push(`📏 *Distância:* ${Number(order.deliveryDistanceKm).toFixed(1)} km`);
      }
      lines.push(`🛵 *Taxa de Entrega:* ${Number(order.deliveryFee || 0) === 0 ? 'GRÁTIS' : `R$ ${Number(order.deliveryFee).toFixed(2).replace('.', ',')}`}`);
    }

    const payMethodName = 
      order.paymentMethod === 'pix' ? 'Pix' :
      order.paymentMethod === 'dinheiro' ? 'Dinheiro' :
      order.paymentMethod === 'credito' ? 'Cartão de Crédito' :
      order.paymentMethod === 'debito' ? 'Cartão de Débito' : (order.paymentMethod || 'Não informado');

    lines.push(`💳 *Forma de Pagamento:* ${payMethodName}`);
    if (order.paymentMethod === 'dinheiro' && order.needChange && order.changeForAmount) {
      lines.push(`💵 *Troco para:* R$ ${Number(order.changeForAmount).toFixed(2).replace('.', ',')}`);
    }

    lines.push('');
    lines.push(`🥪 *ITENS DO PEDIDO (${order.items?.length || 0}):*`);
    (order.items || []).forEach((item, idx) => {
      const itemQty = item.quantity || 1;
      const itemPrice = Number(item.price || 0) * itemQty;
      if (item.sandwich) {
        lines.push(`${idx + 1}. *${itemQty}x Sanduíche (${item.sandwich.size || '15cm'})* - R$ ${itemPrice.toFixed(2).replace('.', ',')}`);
        lines.push(`   - Pão: ${item.sandwich.bread}`);
        lines.push(`   - Recheio: ${item.sandwich.protein}`);
        lines.push(`   - Queijo: ${item.sandwich.cheese} ${item.sandwich.toasted ? '(Tostado)' : '(Frio)'}`);
        if (item.sandwich.veggies && item.sandwich.veggies.length > 0) {
          lines.push(`   - Saladas: ${item.sandwich.veggies.join(', ')}`);
        }
        if (item.sandwich.sauces && item.sandwich.sauces.length > 0) {
          lines.push(`   - Molhos: ${item.sandwich.sauces.join(', ')}`);
        }
        if (item.sandwich.extras && item.sandwich.extras.length > 0) {
          lines.push(`   - Adicionais: ${item.sandwich.extras.join(', ')}`);
        }
        if (item.sandwich.drinksAndCookies && item.sandwich.drinksAndCookies.length > 0) {
          lines.push(`   - Bebidas/Acomp: ${item.sandwich.drinksAndCookies.join(', ')}`);
        }
      } else {
        lines.push(`${idx + 1}. *${itemQty}x ${item.productName || 'Item'}* - R$ ${itemPrice.toFixed(2).replace('.', ',')}`);
      }
    });

    if (order.couponCode && order.discountAmount) {
      lines.push(`🏷️ *Cupom Aplicado:* ${order.couponCode} (- R$ ${Number(order.discountAmount).toFixed(2).replace('.', ',')})`);
    }

    lines.push('');
    lines.push(`💰 *TOTAL:* R$ ${Number(order.totalPrice || 0).toFixed(2).replace('.', ',')}`);
    lines.push('');
    lines.push(`Olá! Acabei de fazer este pedido pelo site e gostaria de acompanhar o status por aqui.`);

    return lines.join('\n');
  };

  // Function to open WhatsApp directly with company configured phone
  const handleOpenWhatsAppCompany = (order: Order) => {
    const rawCompanyPhone = (
      storeDeliverySettings.whatsappPhone ||
      storeInfo.phone ||
      DEFAULT_DELIVERY_SETTINGS.whatsappPhone ||
      ''
    ).replace(/\D/g, '');

    let cleanPhone = rawCompanyPhone;
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    const message = generateWhatsAppOrderSummary(order);
    const encoded = encodeURIComponent(message);
    const waUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;

    window.open(waUrl, '_blank');
    setWhatsappPromptOrder(null);
  };

  const handleApplyCoupon = async (subtotal: number) => {
    if (!couponInput.trim()) {
      setCouponError('Digite o código do cupom.');
      setCouponSuccess('');
      return;
    }
    setValidatingCoupon(true);
    setCouponError('');
    setCouponSuccess('');
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim().toUpperCase(), subtotal })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedCoupon({
          code: data.coupon.code,
          discountAmount: Number(data.discountAmount) || 0,
          description: data.coupon.description
        });
        setCouponSuccess(`Cupom ${data.coupon.code} aplicado com sucesso! Desconto de R$ ${Number(data.discountAmount).toFixed(2).replace('.', ',')}`);
      } else {
        setAppliedCoupon(null);
        setCouponError(data.message || 'Cupom inválido ou expirado.');
      }
    } catch (err) {
      setCouponError('Erro ao validar o cupom. Verifique sua conexão.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
    setCouponSuccess('');
  };

  const renderCouponSection = (subtotal: number) => {
    return (
      <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 space-y-2 mt-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-purple-900 uppercase flex items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5 text-purple-600" />
            <span>Adicionar Cupom de Desconto</span>
          </label>
          {appliedCoupon && (
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="text-[10px] text-rose-600 hover:text-rose-800 font-extrabold underline cursor-pointer"
            >
              Remover Cupom
            </button>
          )}
        </div>

        {appliedCoupon ? (
          <div className="bg-white border border-emerald-300 p-2.5 rounded-lg flex items-center justify-between text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border border-emerald-200">
                🎟️ {appliedCoupon.code}
              </span>
              <span className="font-bold text-emerald-700">
                - R$ {appliedCoupon.discountAmount.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
              ✓ Aplicado
            </span>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => {
                setCouponInput(e.target.value.toUpperCase());
                if (couponError) setCouponError('');
                if (couponSuccess) setCouponSuccess('');
              }}
              placeholder="Ex: BAGO10"
              className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-purple-950 placeholder:font-normal placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 uppercase"
            />
            <button
              type="button"
              onClick={() => handleApplyCoupon(subtotal)}
              disabled={validatingCoupon || !couponInput.trim()}
              className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-black text-xs rounded-lg transition-all shadow-xs disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {validatingCoupon ? (
                <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <span>Aplicar Cupom</span>
              )}
            </button>
          </div>
        )}

        {couponError && (
          <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{couponError}</span>
          </p>
        )}

        {couponSuccess && (
          <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mt-1">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>{couponSuccess}</span>
          </p>
        )}
      </div>
    );
  };

  // Quick Checkout State
  interface CartItem {
    id: string;
    name: string;
    price: number;
    image?: string;
    sandwichConfig?: any;
    quantity: number;
  }
  const [quickCart, setQuickCart] = useState<CartItem[]>([]);

  // Auto calculate fee when location or cart changes
  useEffect(() => {
    if (deliveryType === 'entrega' && deliveryMapLat && deliveryMapLng) {
      const settings = getDeliverySettings();
      const distance = calculateHaversineDistance(settings.storeLat, settings.storeLng, deliveryMapLat, deliveryMapLng);
      const subtotal = quickCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const feeResult = calculateDeliveryFee(distance, subtotal, settings);
      setDeliveryDistanceKm(distance);
      setDeliveryFee(feeResult.fee);
      setDeliveryTierDescription(feeResult.tierLabel);
    } else {
      setDeliveryDistanceKm(0);
      setDeliveryFee(0);
      setDeliveryTierDescription('');
    }
  }, [deliveryType, deliveryMapLat, deliveryMapLng, quickCart]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const neighborhoodInputRef = useRef<HTMLInputElement>(null);
  const [quickBuyProduct, setQuickBuyProduct] = useState<ReadyProduct | null>(null);
  const [quickBuyQty, setQuickBuyQty] = useState(1);
  const [checkoutStep, setCheckoutStep] = useState<number>(1);
  const [expressCategory, setExpressCategory] = useState<string>('all');
  const [expressSubcategory, setExpressSubcategory] = useState<string>('all');
  const [expressSearch, setExpressSearch] = useState<string>('');
  const [expressViewMode, setExpressViewMode] = useState<'card' | 'table'>('card');

  // Build Sandwich / Salad Modal State (Matches modern customizer modal design)
  const [isBuildModalOpen, setIsBuildModalOpen] = useState<boolean>(false);
  const [buildModalFormat, setBuildModalFormat] = useState<'sandwich' | 'salad'>('sandwich');
  const [buildModalProduct, setBuildModalProduct] = useState<ReadyProduct | null>(null);

  const handleAddFromBuildModal = (item: {
    sandwichConfig?: CustomSandwich;
    productName?: string;
    isReadyProduct?: boolean;
    price: number;
    quantity: number;
    notes?: string;
  }) => {
    setQuickCart(prev => [
      ...prev,
      {
        id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: item.notes ? `${item.productName || 'Customizado'} (${item.notes})` : (item.productName || 'Customizado'),
        price: item.price,
        sandwichConfig: item.sandwichConfig,
        quantity: item.quantity
      }
    ]);
    setCheckoutStep(1);
    setOrderError('');
    setIsCartOpen(true);
  };

  const addToQuickCart = (product: { name: string; price: number; image?: string; sandwichConfig?: any }) => {
    setQuickCart(prev => {
      const existing = prev.find(item => item.name === product.name);
      if (existing) {
        return prev.map(item => item.name === product.name ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: product.name,
        price: product.price,
        image: product.image,
        sandwichConfig: product.sandwichConfig,
        quantity: 1
      }];
    });
    setCheckoutStep(1);
    setOrderError('');
    setIsCartOpen(true);
  };

  const handleProductClick = (item: any) => {
    const isBuildItem = item.category === 'sandwich' || item.category === 'salad' || item.rawReadyProduct?.category === 'sandwich' || item.rawReadyProduct?.category === 'salad';
    if (isBuildItem) {
      setBuildModalFormat(item.category === 'salad' || item.rawReadyProduct?.category === 'salad' ? 'salad' : 'sandwich');
      setBuildModalProduct(item.rawReadyProduct || null);
      setIsBuildModalOpen(true);
    } else {
      const readyProd: ReadyProduct = item.rawReadyProduct || {
        id: item.id || `prod-${Date.now()}`,
        name: item.name,
        description: item.description || '',
        price: Number(item.price) || 0,
        category: item.category as any,
        image: item.image,
        isAvailable: true
      };
      setQuickBuyProduct(readyProd);
      setQuickBuyQty(1);
      setCheckoutStep(1);
      setOrderError('');
    }
  };

  // Combina Produtos Prontos e Controle de Estoque (Ingredientes/Insumos) para Peça sem Passos
  const expressCombinedItems = useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      originalPrice?: number;
      isPopular?: boolean;
      isPromo?: boolean;
      badgeText?: string;
      image?: string;
      category: string;
      subcategory: string;
      source: 'readyProduct' | 'ingredient';
      rawReadyProduct?: ReadyProduct;
      rawIngredient?: Ingredient;
      stock?: number;
      unit?: string;
    }> = [];

    // 1. Produtos Prontos
    readyProducts.filter(rp => rp.showOnHome !== false).forEach(rp => {
      let subcat = rp.subcategory?.trim();
      if (!subcat) {
        if (rp.category === 'sandwich') subcat = 'Lanches Prontos';
        else if (rp.category === 'salad') subcat = 'Saladas Prontas';
        else if (rp.category === 'drink') subcat = 'Bebidas Prontas';
        else if (rp.category === 'cookie') subcat = 'Cookies & Sobremesas';
        else if (rp.category === 'addon') subcat = 'Acompanhamentos';
        else subcat = 'Produtos Prontos Gerais';
      }

      items.push({
        id: `rp-${rp.id}`,
        name: rp.name,
        description: rp.description || 'Produto pronto do cardápio',
        price: rp.price,
        originalPrice: rp.originalPrice,
        isPopular: rp.isPopular,
        isPromo: rp.isPromo,
        badgeText: rp.badgeText,
        image: rp.image,
        category: rp.category,
        subcategory: subcat,
        source: 'readyProduct',
        rawReadyProduct: rp
      });
    });

    // 2. Controle de Estoque (Ingredientes e Insumos)
    ingredients.filter(ing => ing.showOnHome !== false).forEach(ing => {
      let subcat = ing.subcategory?.trim();
      if (!subcat) {
        if (ing.category === 'bread') subcat = 'Pães (Estoque)';
        else if (ing.category === 'protein') subcat = 'Proteínas & Recheios (Estoque)';
        else if (ing.category === 'cheese') subcat = 'Queijos & Laticínios (Estoque)';
        else if (ing.category === 'vegetable') subcat = 'Vegetais & Saladas (Estoque)';
        else if (ing.category === 'sauce') subcat = 'Molhos & Condimentos (Estoque)';
        else if (ing.category === 'drink_cookie' || ing.category === 'drink') subcat = 'Bebidas & Doces (Estoque)';
        else if (ing.category === 'extra' || ing.category === 'addon') subcat = 'Extras & Adicionais (Estoque)';
        else subcat = 'Insumos de Cozinha (Estoque)';
      }

      items.push({
        id: `ing-${ing.id}`,
        name: ing.name,
        description: '',
        price: ing.price || 0,
        image: ing.image,
        category: ing.category,
        subcategory: subcat,
        source: 'ingredient',
        rawIngredient: ing,
        stock: ing.stock,
        unit: ing.unit
      });
    });

    return items;
  }, [readyProducts, ingredients]);

  const availableExpressSubcategories = useMemo(() => {
    return Array.from(new Set(expressCombinedItems.map(item => item.subcategory))).filter(Boolean);
  }, [expressCombinedItems]);

  const groupedBySubcategory = useMemo(() => {
    const groups: { [subcat: string]: typeof expressCombinedItems } = {};

    const filtered = expressCombinedItems.filter(item => {
      const matchesSearch = !expressSearch.trim() ||
        item.name.toLowerCase().includes(expressSearch.toLowerCase()) ||
        item.description.toLowerCase().includes(expressSearch.toLowerCase()) ||
        item.subcategory.toLowerCase().includes(expressSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (expressSubcategory !== 'all' && item.subcategory !== expressSubcategory) {
        return false;
      }

      if (expressCategory !== 'all') {
        if (expressCategory === 'sandwich') return item.category === 'sandwich' || item.category === 'bread';
        if (expressCategory === 'salad') return item.category === 'salad' || item.category === 'vegetable';
        if (expressCategory === 'drink') return item.category === 'drink' || item.category === 'drink_cookie' || item.category === 'juice' || item.category === 'vitamin';
        if (expressCategory === 'cookie') return item.category === 'cookie';
        if (expressCategory === 'other') return item.category === 'other' || item.category === 'addon' || item.category === 'extra' || item.category === 'kitchen' || item.category === 'cheese' || item.category === 'protein' || item.category === 'sauce';
        return item.category === expressCategory;
      }

      return true;
    });

    filtered.forEach(item => {
      if (!groups[item.subcategory]) {
        groups[item.subcategory] = [];
      }
      groups[item.subcategory].push(item);
    });

    return groups;
  }, [expressCombinedItems, expressSearch, expressCategory, expressSubcategory]);

  const getItemImageUrl = (item: typeof expressCombinedItems[0]) => {
    if (item.image) return item.image;
    if (item.category === 'sandwich' || item.category === 'bread') return 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80';
    if (item.category === 'salad' || item.category === 'vegetable') return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80';
    if (item.category === 'drink' || item.category === 'juice' || item.category === 'vitamin' || item.category === 'drink_cookie') return 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&auto=format&fit=crop&q=80';
    if (item.category === 'cookie') return 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&auto=format&fit=crop&q=80';
    if (item.category === 'protein') return 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&auto=format&fit=crop&q=80';
    if (item.category === 'cheese') return 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600&auto=format&fit=crop&q=80';
    if (item.category === 'sauce') return 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=600&auto=format&fit=crop&q=80';
    return 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80';
  };

  const removeFromQuickCart = (cartItemId: string) => {
    setQuickCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  const updateCartQty = (cartItemId: string, change: number) => {
    setQuickCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const newQty = item.quantity + change;
        return { ...item, quantity: newQty < 1 ? 1 : newQty };
      }
      return item;
    }));
  };

  const handleQuickBuy = (product: ReadyProduct) => {
    setQuickBuyProduct(product);
    setQuickBuyQty(1);
    setOrderError('');
  };

  const handleQuickCheckout = async (itemsToSubmit: {name: string, price: number, sandwichConfig?: any, quantity: number}[]) => {
    if (!customerName.trim()) {
      setOrderError('Por favor, informe seu nome para identificar o pedido.');
      return;
    }

    if (!customerPhone.trim()) {
      setOrderError('Por favor, informe seu telefone / WhatsApp para continuar.');
      return;
    }

    const currentStatus = checkDeliveryOpeningStatus(getDeliverySettings());
    if (currentStatus.isBlocked) {
      setOrderError(`🚫 Recebimento de pedidos suspenso: ${currentStatus.reason}`);
      return;
    }

    if (storeDeliverySettings.pickupOnly && deliveryType === 'entrega') {
      setOrderError('No momento estamos aceitando apenas pedidos para Retirada no Balcão. O serviço de entrega (delivery) está indisponível.');
      return;
    }

    if (deliveryType === 'entrega') {
      if (!validateDeliveryAddressFields()) {
        return;
      }
    }

    setSubmitting(true);
    setOrderError('');

    const itemsPayload = itemsToSubmit.map(item => ({
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      productId: (item as any).id || (item as any).productId,
      sandwich: item.sandwichConfig || undefined,
      productName: item.name,
      isReadyProduct: !item.sandwichConfig,
      price: item.price,
      quantity: item.quantity
    }));

    const parsedChangeAmount = paymentMethod === 'dinheiro' && needChange 
      ? (parseFloat(changeForAmount.replace(',', '.')) || 0)
      : 0;

    const orderPayload = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      addressStreet: addressStreet.trim() || undefined,
      addressNumber: addressNumber.trim() || undefined,
      addressNeighborhood: addressNeighborhood.trim() || undefined,
      addressCity: addressCity.trim() || undefined,
      addressState: addressState.trim() || undefined,
      addressComplement: addressComplement.trim() || undefined,
      addressReference: addressReference.trim() || undefined,
      items: itemsPayload,
      deliveryType,
      deliveryAddress: deliveryType === 'entrega' ? getComputedDeliveryAddress() : undefined,
      deliveryFee: deliveryType === 'entrega' ? deliveryFee : 0,
      deliveryDistanceKm: deliveryType === 'entrega' ? deliveryDistanceKm : 0,
      deliveryLat: deliveryType === 'entrega' ? deliveryMapLat : undefined,
      deliveryLng: deliveryType === 'entrega' ? deliveryMapLng : undefined,
      paymentMethod,
      needChange: paymentMethod === 'dinheiro' ? needChange : false,
      changeForAmount: parsedChangeAmount > 0 ? parsedChangeAmount : undefined,
      cashReceived: parsedChangeAmount > 0 ? parsedChangeAmount : undefined,
      couponCode: appliedCoupon?.code || undefined,
      discountAmount: appliedCoupon?.discountAmount || undefined
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();

      if (res.ok) {
        const createdOrder = data.order || data;
        onOrderCreated(createdOrder);
        setQuickCart([]);
        setQuickBuyProduct(null);
        setIsCartOpen(false);
        setCustomerName('');
        setCustomerPhone('');
        setDeliveryType('retirada');
        setDeliveryAddress('');
        setAddressStreet('');
        setAddressNumber('');
        setAddressNeighborhood('');
        setAddressReference('');
        setPaymentMethod('debito');
        setNeedChange(false);
        setChangeForAmount('');
        setAppliedCoupon(null);
        setCouponInput('');
        setCouponError('');
        setCouponSuccess('');
        setView('tracker');
        // Prompt user to track order on company WhatsApp
        setWhatsappPromptOrder(createdOrder);
      } else {
        setOrderError(data?.error || 'Ocorreu um erro ao enviar o pedido.');
      }
    } catch (err) {
      setOrderError('Não foi possível conectar ao servidor para enviar o pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  // Builder State
  const [bagoFormat, setBagoFormat] = useState<'sandwich' | 'salad'>('sandwich');
  const [selectedBread, setSelectedBread] = useState<string>('Italiano Integral');
  const [selectedSize, setSelectedSize] = useState<string>('15cm');
  const [selectedProtein, setSelectedProtein] = useState<string>('Frango Teriyaki');
  const [selectedCheeses, setSelectedCheeses] = useState<string[]>(['Queijo Prato']);
  const [isToasted, setIsToasted] = useState<boolean>(true);
  const [selectedVeggies, setSelectedVeggies] = useState<string[]>([]);
  const [selectedSauces, setSelectedSauces] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedDrinksAndCookies, setSelectedDrinksAndCookies] = useState<string[]>([]);

  const selectedCheese = selectedCheeses.length > 0 ? selectedCheeses.join(', ') : 'Sem Queijo';

  // Track order polling
  useEffect(() => {
    if (!activeTrackingOrder?.id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${activeTrackingOrder.id}`);
        if (res.ok) {
          const updated = await res.json();
          setActiveTrackingOrder(updated);
        }
      } catch (err) {
        console.error('Erro ao buscar status do pedido:', err);
      }
    }, 4000); // Poll every 4s

    return () => clearInterval(interval);
  }, [activeTrackingOrder?.id]);

  // Helper to filter ingredients for a specific step
  const getStepIngredients = (stepId: number, defaultCategory: string) => {
    const stepConfig = stepsConfig.find(s => s.id === stepId);
    if (stepConfig && stepConfig.allowedItems && stepConfig.allowedItems.length > 0) {
      return ingredients.filter(i => 
        i.category !== 'kitchen' && (stepConfig.allowedItems?.includes(i.id) || stepConfig.allowedItems?.includes(i.name))
      );
    }
    return ingredients.filter(i => i.category === defaultCategory && i.category !== 'kitchen');
  };

  // Helper to get image URL for an ingredient, fallbacking if missing
  const getIngredientImage = (item: Ingredient) => {
    if (item.image && item.image.trim().length > 0) return item.image;
    switch (item.category) {
      case 'bread':
        return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=150&auto=format&fit=crop&q=80';
      case 'protein':
        return 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=150&auto=format&fit=crop&q=80';
      case 'cheese':
        return 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=150&auto=format&fit=crop&q=80';
      case 'vegetable':
        return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=150&auto=format&fit=crop&q=80';
      case 'sauce':
        return 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=150&auto=format&fit=crop&q=80';
      case 'extra':
        return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=150&auto=format&fit=crop&q=80';
      case 'drink_cookie':
        return 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=150&auto=format&fit=crop&q=80';
      default:
        return 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=150&auto=format&fit=crop&q=80';
    }
  };

  // Ingredients by categories / steps
  const breads = getStepIngredients(1, 'bread');
  const proteins = getStepIngredients(3, 'protein');
  const cheeses = getStepIngredients(4, 'cheese');
  const veggies = getStepIngredients(6, 'vegetable');
  const sauces = getStepIngredients(7, 'sauce');
  const extras = getStepIngredients(8, 'extra');
  const drinksAndCookies = getStepIngredients(9, 'drink_cookie');

  // Skip inactive steps when navigating
  const goToNextStep = () => {
    if (step === 1 && bagoFormat === 'sandwich') {
      if (!selectedBread || selectedBread.trim() === '' || selectedBread === 'Sem Pão (Tigela de Salada)') {
        alert('⚠️ A escolha do pão é OBRIGATÓRIA para montar o sanduíche!');
        return;
      }
    }
    let next = step + 1;
    while (next <= 10) {
      const config = stepsConfig.find(s => s.id === next);
      if (!config || config.active) {
        setStep(next);
        return;
      }
      next++;
    }
    setStep(10);
  };

  const goToPrevStep = () => {
    let prev = step - 1;
    while (prev >= 1) {
      const config = stepsConfig.find(s => s.id === prev);
      if (!config || config.active) {
        setStep(prev);
        return;
      }
      prev--;
    }
    setView('home');
  };

  // Pricing formula
  const calculateCurrentPrice = () => {
    let total = 12.00; // Base Price

    // Dynamic size additional price
    const step2Config = stepsConfig.find(s => s.id === 2);
    const sizeOpts = (step2Config?.options && step2Config.options.length > 0)
      ? step2Config.options
      : [
          { id: 'opt-15cm', label: 'Sub 15cm (Tamanho Padrão)', value: '15cm', description: 'Tamanho Individual Padrão', priceAdd: 0 }
        ];

    const chosenSizeOpt = sizeOpts.find(o => o.value === selectedSize || o.label === selectedSize);
    if (chosenSizeOpt) {
      total += chosenSizeOpt.priceAdd;
    }

    // Add bread price adjustment (e.g. 3 queijos is extra)
    const breadIng = ingredients.find(i => i.name === selectedBread && i.category === 'bread');
    if (breadIng) total += breadIng.price;

    // Add protein
    const proteinIng = ingredients.find(i => i.name === selectedProtein && i.category === 'protein');
    if (proteinIng) total += proteinIng.price;

    // Add assembly extras based on rules (1 cheese, 3/5 veggies, 2 sauces free)
    const assemblyExtras = calculateAssemblyExtras({
      format: bagoFormat,
      selectedCheeses,
      selectedVeggies,
      selectedSauces,
      ingredientsList: ingredients
    });
    total += assemblyExtras;

    // Add selected extras
    selectedExtras.forEach(extraName => {
      const extIng = ingredients.find(i => i.name === extraName && i.category === 'extra');
      if (extIng) total += extIng.price;
    });

    // Add selected drinks and cookies
    selectedDrinksAndCookies.forEach(dcName => {
      const dcIng = ingredients.find(i => i.name === dcName && i.category === 'drink_cookie');
      if (dcIng) total += dcIng.price;
    });

    return total;
  };

  const currentPrice = calculateCurrentPrice();

  const renderDeliveryAddressInputs = () => {
    if (deliveryType !== 'entrega') return null;

    const hasRegisteredAddress = Boolean(addressStreet && addressStreet.trim().length > 0);
    // Show address fields and map ONLY after GPS finds address OR if customer already has a registered address OR clicked manual fill
    const showAddressAndMap = hasRegisteredAddress || manualAddressEntry;

    return (
      <div className="pt-2 border-t border-slate-200/80 animate-in fade-in duration-200 space-y-3.5">
        {deliveryStatus.isBlocked && (
          <div className="bg-rose-50 border-2 border-rose-300 text-rose-900 p-3.5 rounded-xl text-xs font-bold space-y-1 animate-in fade-in">
            <div className="flex items-center gap-2 font-black text-sm text-rose-700">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Recebimento de Pedidos Suspenso (Delivery & Retirada)</span>
            </div>
            <p className="text-rose-800 text-xs">
              {deliveryStatus.reason}
            </p>
          </div>
        )}

        {/* 1. EM DESTAQUE: USAR MEU GPS (QUANDO NÃO TEM ENDEREÇO IDENTIFICADO) */}
        {!hasRegisteredAddress ? (
          <div className="bg-slate-900 border-2 border-emerald-500/80 p-4 sm:p-4.5 rounded-2xl text-white shadow-lg space-y-3 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 shadow-inner">
                <Navigation className="h-5 w-5 text-emerald-400 animate-pulse" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider shadow-xs">
                    📍 Mais Rápido & Preciso
                  </span>
                </div>
                <h4 className="text-sm font-black text-white leading-tight">
                  Localização Automática por GPS
                </h4>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  Toque no botão abaixo para capturar sua localização exata. O mapa e o endereço aparecerão assim que o GPS encontrar sua posição.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (orderError) setOrderError('');
                setGpsSearchError(null);
                setGpsTriggerSignal((prev) => prev + 1);
              }}
              disabled={isGpsSearching}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md active:scale-98 cursor-pointer disabled:opacity-75"
            >
              {isGpsSearching ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>Obtendo localização pelo GPS...</span>
                </>
              ) : (
                <>
                  <Navigation className="h-4.5 w-4.5 text-brand-yellow fill-brand-yellow" />
                  <span>📍 USAR MEU GPS</span>
                </>
              )}
            </button>

            {gpsSearchError && (
              <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>{gpsSearchError}</span>
                <button
                  type="button"
                  onClick={() => setManualAddressEntry(true)}
                  className="px-2.5 py-1 bg-white text-rose-950 font-bold rounded-lg text-[11px] shrink-0"
                >
                  Digitar manualmente
                </button>
              </div>
            )}

            {!showAddressAndMap && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setManualAddressEntry(true)}
                  className="text-[11px] text-slate-300 hover:text-white underline font-semibold transition-colors cursor-pointer"
                >
                  Ou preencher endereço manualmente sem GPS
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="truncate">
                <p className="font-extrabold text-emerald-950">Endereço Identificado</p>
                <p className="text-[11px] text-emerald-700 font-medium truncate">
                  {addressStreet}, {addressNumber || 'S/N'} - {addressNeighborhood}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (orderError) setOrderError('');
                setGpsSearchError(null);
                setGpsTriggerSignal((prev) => prev + 1);
              }}
              disabled={isGpsSearching}
              className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-black rounded-lg text-[11px] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-95"
              title="Atualizar localização com GPS"
            >
              <Navigation className="h-3 w-3 text-emerald-600" />
              <span>{isGpsSearching ? 'Buscando...' : 'Usar Meu GPS'}</span>
            </button>
          </div>
        )}

        {/* 2. MAPA E CAMPOS DO ENDEREÇO (APARECEM QUANDO O GPS ENCONTRA O ENDEREÇO OU NO PREENCHIMENTO MANUAL) */}
        <div className={showAddressAndMap ? "space-y-3.5 pt-1 animate-in fade-in slide-in-from-top-2 duration-300" : "hidden"}>
          {/* MAPA INTERATIVO PARA CONFERÊNCIA E AJUSTE FINO DO PONTO */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center justify-between">
              <span>🗺️ Mapa e Ponto de Entrega</span>
              <span className="text-[9px] text-slate-500 font-normal">Arraste o pino para ajustar se necessário</span>
            </label>
            <DeliveryMapPicker
              initialLat={deliveryMapLat}
              initialLng={deliveryMapLng}
              initialAddress={`${addressStreet} ${addressNumber} ${addressNeighborhood}`.trim()}
              height="200px"
              triggerGpsSignal={gpsTriggerSignal}
              isVisible={showAddressAndMap}
              onGpsStateChange={(loading, err) => {
                setIsGpsSearching(loading);
                setGpsSearchError(err);
              }}
              hideTopGpsButton={true}
              onLocationSelect={(loc) => {
                setDeliveryMapLat(loc.lat);
                setDeliveryMapLng(loc.lng);
                setDeliveryDistanceKm(loc.distanceKm);
                setDeliveryFee(loc.fee ?? (loc as any).deliveryFee ?? 3.00);
                setDeliveryTierDescription(loc.tierLabel ?? (loc as any).tierDescription ?? '');
                if (orderError) setOrderError('');

                // Auto fill street if provided
                if (loc.street) {
                  setAddressStreet(loc.street);
                  setManualAddressEntry(true);
                } else if (loc.address) {
                  const parts = loc.address.split(',');
                  if (parts.length > 0 && !addressStreet) {
                    setAddressStreet(parts[0].trim());
                  }
                  setManualAddressEntry(true);
                }

                if (loc.houseNumber) {
                  setAddressNumber(loc.houseNumber);
                }
                
                if (loc.city) {
                  setAddressCity(loc.city);
                }
                if (loc.state) {
                  setAddressState(loc.state);
                }

                // If GPS locate finished, ensure map & fields are revealed
                if (loc.isGpsLocate) {
                  setManualAddressEntry(true);
                  // Smooth scroll down to the Bairro/Number input field
                  setTimeout(() => {
                    if (neighborhoodInputRef.current) {
                      neighborhoodInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      neighborhoodInputRef.current.focus();
                    }
                  }, 250);
                }
              }}
            />
          </div>

          {/* CAMPOS DO ENDEREÇO PARA AJUSTE */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
              <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <span>🏠</span>
                <span>Endereço de Entrega (Ajuste e Conferência)</span>
                <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Preencha ou ajuste abaixo</span>
            </div>

            {/* Nome da Rua / Av. */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase">
                Nome da Rua / Av. <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addressStreet}
                onChange={(e) => { setAddressStreet(e.target.value); if (orderError) setOrderError(''); }}
                placeholder="Ex: Rua das Flores"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-xs font-semibold text-slate-800"
              />
            </div>

            {/* Número */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center justify-between">
                <span>Número <span className="text-red-500">*</span></span>
                {addressNeighborhood.trim().length > 0 && !addressNumber.trim() && (
                  <span className="text-[9px] text-red-700 font-extrabold bg-red-100 border border-red-200 px-1.5 py-0.5 rounded-md animate-pulse">
                    ⚠️ Falta o Nº!
                  </span>
                )}
              </label>
              <input
                type="text"
                required
                value={addressNumber}
                onChange={(e) => { setAddressNumber(e.target.value); if (orderError) setOrderError(''); }}
                placeholder="Ex: 123"
                className={`w-full px-3 py-2 rounded-xl focus:outline-hidden transition-all text-xs font-semibold ${
                  addressNeighborhood.trim().length > 0 && !addressNumber.trim()
                    ? 'bg-red-50 border-2 border-red-500 text-red-950 focus:ring-2 focus:ring-red-300 shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green'
                }`}
              />
            </div>

            {/* Bairro */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center justify-between">
                <span>Bairro <span className="text-red-500">*</span></span>
              </label>
              <input
                ref={neighborhoodInputRef}
                type="text"
                required
                value={addressNeighborhood}
                onChange={(e) => { setAddressNeighborhood(e.target.value); if (orderError) setOrderError(''); }}
                placeholder="Ex: Centro / Jardim América"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-xs font-semibold text-slate-800"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Cidade */}
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">
                  Cidade <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addressCity}
                  onChange={(e) => { setAddressCity(e.target.value); if (orderError) setOrderError(''); }}
                  placeholder="Ex: SAO MIGUEL"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-xs font-semibold text-slate-800"
                />
              </div>

              {/* UF */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">
                  UF <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addressState}
                  onChange={(e) => { setAddressState(e.target.value); if (orderError) setOrderError(''); }}
                  placeholder="Ex: RN"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-xs font-semibold text-slate-800 uppercase"
                />
              </div>
            </div>

            {/* Complemento */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase">
                Complemento <span className="text-slate-400 font-normal">(Opcional - Apt, Bloco, etc.)</span>
              </label>
              <input
                type="text"
                value={addressComplement}
                onChange={(e) => setAddressComplement(e.target.value)}
                placeholder="Ex: Apto 302, Bloco C"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-xs font-semibold text-slate-800"
              />
            </div>

            {/* Ponto de Referência */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase">
                Ponto de Referência <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={addressReference}
                onChange={(e) => setAddressReference(e.target.value)}
                placeholder="Ex: Próximo à padaria"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-xs font-semibold text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPaymentSection = () => (
    <div className="space-y-3 pt-3 border-t border-slate-100">
      {deliveryType === 'entrega' && (
        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🛵</span>
            <span>Taxa de Entrega {deliveryDistanceKm > 0 ? `(${(Number(deliveryDistanceKm) || 0).toFixed(1)} km)` : ''}:</span>
          </div>
          <span className="text-sm font-black text-emerald-700">
            {(Number(deliveryFee) || 0) === 0 ? 'GRÁTIS' : `+ R$ ${(Number(deliveryFee) || 0).toFixed(2)}`}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5 text-brand-green" />
          <span>Forma de Pagamento</span>
        </label>
        
        <div className="grid grid-cols-2 gap-2">
          {/* CARTÃO DÉBITO */}
          <button
            type="button"
            onClick={() => setPaymentMethod('debito')}
            className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              paymentMethod === 'debito'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <CreditCard className={`h-4 w-4 ${paymentMethod === 'debito' ? 'text-brand-yellow' : 'text-slate-500'}`} />
            <span>CARTÃO DÉBITO</span>
          </button>

          {/* CARTÃO CRÉDITO */}
          <button
            type="button"
            onClick={() => setPaymentMethod('credito')}
            className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              paymentMethod === 'credito'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <CreditCard className={`h-4 w-4 ${paymentMethod === 'credito' ? 'text-brand-yellow' : 'text-slate-500'}`} />
            <span>CARTÃO CRÉDITO</span>
          </button>

          {/* PIX */}
          <button
            type="button"
            onClick={() => setPaymentMethod('pix')}
            className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              paymentMethod === 'pix'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <QrCode className={`h-4 w-4 ${paymentMethod === 'pix' ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>PIX</span>
          </button>

          {/* DINHEIRO */}
          <button
            type="button"
            onClick={() => setPaymentMethod('dinheiro')}
            className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              paymentMethod === 'dinheiro'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Banknote className={`h-4 w-4 ${paymentMethod === 'dinheiro' ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>DINHEIRO</span>
          </button>
        </div>
      </div>

      {/* SE DINHEIRO: PERGUNTAR SE PRECISA DE TROCO */}
      {paymentMethod === 'dinheiro' && (
        <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950">Precisa de Troco?</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setNeedChange(false)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  !needChange
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Não (Exato)
              </button>
              <button
                type="button"
                onClick={() => setNeedChange(true)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  needChange
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Sim, preciso
              </button>
            </div>
          </div>

          {needChange && (
            <div className="space-y-2 pt-2 border-t border-amber-200/60 animate-in fade-in duration-150">
              <label className="text-[11px] font-bold text-amber-900 uppercase">
                Troco para quanto? (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-bold text-amber-700 text-xs">R$</span>
                <input
                  type="text"
                  value={changeForAmount}
                  onChange={(e) => setChangeForAmount(e.target.value)}
                  placeholder="Ex: 50,00 ou 100,00"
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {['20.00', '50.00', '100.00'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setChangeForAmount(val)}
                    className="px-2 py-0.5 bg-white border border-amber-300 rounded text-[10px] font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
                  >
                    Troco p/ R$ {parseFloat(val).toFixed(0)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Reset Builder
  const resetBuilder = () => {
    setStep(1);
    setBagoFormat('sandwich');
    setSelectedBread('Italiano Integral');
    setSelectedSize('15cm');
    setSelectedProtein('Frango Teriyaki');
    setSelectedCheeses(['Queijo Prato']);
    setIsToasted(true);
    setSelectedVeggies([]);
    setSelectedSauces([]);
    setSelectedExtras([]);
    setSelectedDrinksAndCookies([]);
    setCustomerName('');
    setOrderError('');
    setDeliveryType('retirada');
    setDeliveryAddress('');
    setAddressStreet('');
    setAddressNumber('');
    setAddressNeighborhood('');
    setAddressReference('');
    setPaymentMethod('debito');
    setNeedChange(false);
    setChangeForAmount('');
  };

  // Submit order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setOrderError('Por favor, informe seu nome para identificar o pedido.');
      return;
    }

    const currentStatus = checkDeliveryOpeningStatus(getDeliverySettings());
    if (currentStatus.isBlocked) {
      setOrderError(`🚫 Recebimento de pedidos suspenso: ${currentStatus.reason}`);
      return;
    }

    if (storeDeliverySettings.pickupOnly && deliveryType === 'entrega') {
      setOrderError('No momento estamos aceitando apenas pedidos para Retirada no Balcão. O serviço de entrega (delivery) está indisponível.');
      return;
    }

    if (deliveryType === 'entrega') {
      if (!validateDeliveryAddressFields()) {
        return;
      }
    }

    setOrderError('');
    setSubmitting(true);

    const parsedChangeAmount = paymentMethod === 'dinheiro' && needChange 
      ? (parseFloat(changeForAmount.replace(',', '.')) || 0)
      : 0;

    const orderPayload = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      addressStreet: addressStreet.trim() || undefined,
      addressNumber: addressNumber.trim() || undefined,
      addressNeighborhood: addressNeighborhood.trim() || undefined,
      addressCity: addressCity.trim() || undefined,
      addressState: addressState.trim() || undefined,
      addressComplement: addressComplement.trim() || undefined,
      addressReference: addressReference.trim() || undefined,
      deliveryType,
      deliveryAddress: deliveryType === 'entrega' ? getComputedDeliveryAddress() : undefined,
      deliveryFee: deliveryType === 'entrega' ? deliveryFee : 0,
      deliveryDistanceKm: deliveryType === 'entrega' ? deliveryDistanceKm : 0,
      deliveryLat: deliveryType === 'entrega' ? deliveryMapLat : undefined,
      deliveryLng: deliveryType === 'entrega' ? deliveryMapLng : undefined,
      paymentMethod,
      needChange: paymentMethod === 'dinheiro' ? needChange : false,
      changeForAmount: parsedChangeAmount > 0 ? parsedChangeAmount : undefined,
      cashReceived: parsedChangeAmount > 0 ? parsedChangeAmount : undefined,
      items: [
        {
          sandwich: {
            bread: selectedBread,
            size: selectedSize,
            protein: selectedProtein,
            cheese: selectedCheese,
            toasted: isToasted,
            veggies: selectedVeggies,
            sauces: selectedSauces,
            extras: selectedExtras,
            drinksAndCookies: selectedDrinksAndCookies
          },
          price: currentPrice,
          quantity: 1
        }
      ]
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();

      if (res.ok) {
        const createdOrder = data.order || data;
        onOrderCreated(createdOrder);
        resetBuilder();
        setView('tracker');
        // Prompt user to track order on company WhatsApp
        setWhatsappPromptOrder(createdOrder);
      } else {
        setOrderError(data.error || 'Ocorreu um erro ao enviar o pedido.');
      }
    } catch (err) {
      setOrderError('Não foi possível conectar ao servidor para enviar o pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  // Search existing order by code
  const handleSearchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    if (!searchCode.trim()) return;

    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const orders: Order[] = await res.json();
        const found = orders.find(o => o.code.toUpperCase() === searchCode.toUpperCase().trim());
        if (found) {
          setActiveTrackingOrder(found);
          setView('tracker');
        } else {
          setSearchError('Pedido não localizado. Verifique o código (ex: BG-34567890).');
        }
      }
    } catch (err) {
      setSearchError('Erro ao consultar o servidor.');
    }
  };

  const toggleCheese = (name: string) => {
    if (name === 'Sem Queijo') {
      setSelectedCheeses([]);
      return;
    }
    setSelectedCheeses(prev => 
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const toggleVeggie = (name: string) => {
    setSelectedVeggies(prev => 
      prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]
    );
  };

  const toggleSauce = (name: string) => {
    setSelectedSauces(prev => 
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const toggleExtra = (name: string) => {
    setSelectedExtras(prev => 
      prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name]
    );
  };

  const toggleDrinkCookie = (name: string) => {
    setSelectedDrinksAndCookies(prev => 
      prev.includes(name) ? prev.filter(d => d !== name) : [...prev, name]
    );
  };

  return (
    <div className="space-y-8 w-full" id="customer-site-root">
      {/* View: HOME */}
      {view === 'home' && (
        <div className="space-y-6 w-full animate-in fade-in duration-200" id="customer-home-view">
          {/* Store Info Bar above EXPRESSO */}
          {storeInfo && storeInfo.showOnHomePage !== false && (() => {
            const mapsUrl = (storeInfo.latitude && storeInfo.longitude)
              ? `https://www.google.com/maps?q=${encodeURIComponent(storeInfo.latitude.trim())},${encodeURIComponent(storeInfo.longitude.trim())}`
              : (storeInfo.address || storeInfo.city)
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([storeInfo.address, storeInfo.city].filter(Boolean).join(', '))}`
                : null;

            return (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-bold text-slate-700">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-800">
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Clique para abrir no Google Maps"
                      className="font-black text-slate-900 hover:text-brand-green uppercase tracking-wide flex items-center gap-1.5 transition-all cursor-pointer hover:underline decoration-amber-500 decoration-2 underline-offset-4"
                    >
                      <MapPin className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>{storeInfo.city || 'sao miguel - rn'}</span>
                    </a>
                  ) : (
                    <span className="font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>{storeInfo.city || 'sao miguel - rn'}</span>
                    </span>
                  )}
                  
                  <span className="text-slate-300 font-normal">|</span>

                  <button
                    type="button"
                    onClick={() => setIsStoreInfoModalOpen(true)}
                    className="font-extrabold text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300 underline-offset-4 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Info className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>mais informações</span>
                  </button>

                  <span className="text-slate-300 font-normal">|</span>

                  <span className="font-extrabold text-slate-600 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      {(() => {
                        const rawInfo = storeInfo.openingTime?.trim();
                        if (!deliveryStatus.isBlocked) {
                          if (!rawInfo || rawInfo.toLowerCase().includes('fechado')) {
                            return `🟢 Aberto • ${deliveryOpeningTime || '15:00'} às ${storeDeliverySettings.deliveryClosingTime || '23:00'}`;
                          }
                          return rawInfo;
                        } else {
                          if (!rawInfo || rawInfo.toLowerCase().includes('aberto')) {
                            return `🔴 Fechado • Abrimos às ${deliveryOpeningTime || '15:00'}`;
                          }
                          return rawInfo;
                        }
                      })()}
                    </span>
                  </span>

                  {storeDeliverySettings.pickupOnly && (
                    <>
                      <span className="text-slate-300 font-normal">|</span>
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wide flex items-center gap-1.5 shadow-2xs">
                        <span>🏪</span>
                        <span>Somente Retirada</span>
                      </span>
                    </>
                  )}
                </div>

                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-black text-brand-green hover:text-brand-green-dark bg-brand-green/10 hover:bg-brand-green/20 px-3 py-1.5 rounded-xl border border-brand-green/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <MapPin className="h-3.5 w-3.5 text-brand-green shrink-0" />
                    <span>Abrir no Google Maps</span>
                  </a>
                )}
              </div>
            );
          })()}

          {/* Banner Aviso Somente Retirada na Página Inicial */}
          {storeDeliverySettings.pickupOnly && (
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 border-2 border-amber-400/90 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-xl shrink-0 font-black shadow-xs">
                  🏪
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight">
                      Somente Retirada
                    </h4>
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                      Ativo
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 mt-0.5 whitespace-pre-line leading-relaxed">
                    {storeDeliverySettings.pickupOnlyMessage || 'Hoje é o dia de folga do nosso delivery! 🛵💨\nMas fique tranquilo: estamos com a loja aberta e também disponível para retirada de pedidos. 🥖'}
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 bg-white/90 border border-amber-300 px-3 py-1.5 rounded-xl text-xs font-black text-amber-900 shrink-0">
                <span>🏬 Retirada no Balcão</span>
              </div>
            </div>
          )}

          {/* Cardápio Expresso - Direct Purchases (Full width, no borders/bg box) */}
          <div className="space-y-6 w-full p-0 border-0 bg-transparent shadow-none" id="express-menu-section">
            
            {/* Header & Category Bar - Sticky at Top */}
            <div className="sticky top-0 z-30 bg-[#ffe3ba]/95 backdrop-blur-md -mx-3 px-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-2.5 transition-all border-b border-amber-900/10 shadow-xs" id="express-filter-sticky-bar">
              {/* Subcategory Menu Select, Search Input & Card/Table View Toggle Side-by-Side */}
              <div className="w-full">
                <div className="flex gap-2 items-center w-full">
                  {availableExpressSubcategories.length > 0 && (
                    <div className="relative min-w-[130px] sm:min-w-[180px] max-w-[210px] shrink-0">
                      <select
                        value={expressSubcategory}
                        onChange={(e) => setExpressSubcategory(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-extrabold text-slate-800 focus:outline-none focus:border-brand-green shadow-2xs appearance-none truncate cursor-pointer"
                      >
                        <option value="all">🏷️ Subcategorias (Todas)</option>
                        {availableExpressSubcategories.map(subcat => {
                          const count = expressCombinedItems.filter(i => i.subcategory === subcat).length;
                          return (
                            <option key={subcat} value={subcat}>
                              {subcat} ({count})
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown className="h-3.5 w-3.5 absolute right-2.5 top-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  )}

                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por produto..."
                      value={expressSearch}
                      onChange={(e) => setExpressSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-green shadow-2xs transition-all"
                    />
                    {expressSearch && (
                      <button 
                        onClick={() => setExpressSearch('')}
                        className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {quickCart.length > 0 && (
                    <button 
                      onClick={() => setIsCartOpen(true)}
                      className="bg-brand-green hover:bg-brand-green-dark text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
                    >
                      <ShoppingBag className="h-4 w-4 text-brand-yellow" />
                      <span className="hidden sm:inline">Ver Sacola</span> ({quickCart.reduce((sum, item) => sum + item.quantity, 0)})
                    </button>
                  )}

                  {/* Card vs Table View Toggle Buttons */}
                  <div className="flex items-center bg-slate-200/90 p-1 rounded-xl border border-slate-300/80 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpressViewMode('card')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                        expressViewMode === 'card'
                          ? 'bg-white text-slate-900 shadow-xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Exibir em Cards"
                    >
                      <LayoutGrid className="h-4 w-4" />
                      <span className="hidden md:inline">Cards</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpressViewMode('table')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                        expressViewMode === 'table'
                          ? 'bg-white text-slate-900 shadow-xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Exibir em Tabela"
                    >
                      <List className="h-4 w-4" />
                      <span className="hidden md:inline">Tabela</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* LISTA DE PRODUTOS E INSUMOS ORGANIZADA POR SUBCATEGORIA (UM ABAIXO DO OUTRO) */}
            <div className="space-y-8 pt-2">
              {Object.keys(groupedBySubcategory).length === 0 ? (
                <div className="bg-white p-8 text-center rounded-2xl border border-slate-200 shadow-2xs">
                  <p className="text-slate-500 text-xs font-semibold">Nenhum produto ou item de estoque encontrado para esta busca ou filtro.</p>
                </div>
              ) : (
                Object.entries(groupedBySubcategory).map(([subcatName, itemsList]) => {
                  const list = itemsList as typeof expressCombinedItems;
                  return (
                    <div 
                      key={subcatName} 
                      className="space-y-4 w-full border-0 bg-transparent shadow-none p-0"
                    >
                      {/* Subcategory Banner Header (Sticky Red Bar frozen at top on scroll) */}
                      <div 
                        className="sticky top-[60px] z-20 flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-[15px] text-white shadow-md transition-all"
                        style={{ backgroundColor: '#ab1a15' }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="bg-brand-yellow text-brand-green px-2.5 py-1 rounded-[15px] text-xs font-black shadow-xs">
                            🏷️
                          </span>
                          <div>
                            <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                              <span>{subcatName}</span>
                            </h3>
                          </div>
                        </div>
                      </div>

                      {/* Product View: CARD GRID or TABLE */}
                      {expressViewMode === 'card' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6">
                          {list.map((item) => {
                          const imgUrl = getItemImageUrl(item);
                          const numPrice = Number(item.price) || 0;
                          const numOrigPrice = Number(item.originalPrice) || 0;
                          const hasDiscount = Boolean(item.originalPrice && numOrigPrice > numPrice);
                          const isBuildItem = item.category === 'sandwich' || item.category === 'salad' || item.rawReadyProduct?.category === 'sandwich' || item.rawReadyProduct?.category === 'salad';

                          return (
                            <div 
                              key={item.id} 
                              className="bg-white rounded-[15px] border border-slate-200/90 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                            >
                              <div 
                                onClick={() => handleProductClick(item)}
                                className="p-2.5 sm:p-3 bg-slate-50/60 rounded-t-[15px] cursor-pointer group/img relative overflow-hidden"
                                title="Clique para ver detalhes / personalizar"
                              >
                                <img 
                                  src={imgUrl} 
                                  alt={item.name} 
                                  className="w-full h-36 sm:h-44 object-cover rounded-xl group-hover:scale-105 transition-transform duration-300 shadow-2xs"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-xl m-2.5 sm:m-3">
                                  <span className="bg-white/95 text-slate-800 text-[11px] font-black px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 transform translate-y-2 group-hover/img:translate-y-0 transition-transform">
                                    <Sparkles className="h-3.5 w-3.5 text-brand-green" /> Ver Opções
                                  </span>
                                </div>
                              </div>

                              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                                <div>
                                  <h4 
                                    onClick={() => handleProductClick(item)}
                                    className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug group-hover:text-brand-green transition-colors cursor-pointer"
                                    title="Clique para ver detalhes / personalizar"
                                  >
                                    {item.name}
                                  </h4>
                                  {!isBuildItem && item.description && !item.description.includes('Item de estoque') && (
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-1">
                                      {item.description}
                                    </p>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                                  <div className="flex flex-col">
                                    <span className="text-emerald-700 font-black text-sm sm:text-base">
                                      R$ {numPrice.toFixed(2).replace('.', ',')}
                                    </span>
                                    {hasDiscount && (
                                      <span className="text-slate-400 text-[11px] line-through">
                                        R$ {numOrigPrice.toFixed(2).replace('.', ',')}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {isBuildItem ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setBuildModalFormat(item.category === 'salad' || item.rawReadyProduct?.category === 'salad' ? 'salad' : 'sandwich');
                                          setBuildModalProduct(item.rawReadyProduct || null);
                                          setIsBuildModalOpen(true);
                                        }}
                                        className="bg-brand-yellow hover:bg-yellow-400 text-brand-green font-black text-xs px-3.5 py-2 rounded-[15px] transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 border border-yellow-300 shrink-0"
                                      >
                                        <Sparkles className="h-3.5 w-3.5 text-brand-green" />
                                        <span>Monte o seu</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => addToQuickCart({
                                          name: item.name,
                                          price: numPrice,
                                          image: item.image
                                        })}
                                        className="bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs px-3.5 py-2 rounded-[15px] transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5"
                                      >
                                        <ShoppingBag className="h-3.5 w-3.5 text-brand-yellow" />
                                        <span>Adicionar</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      ) : (
                        /* TABLE VIEW */
                        <div className="overflow-x-auto bg-white rounded-[15px] border border-slate-200 shadow-2xs">
                          <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-100/90 text-slate-800 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200">
                              <tr>
                                <th className="p-3 w-14">Item</th>
                                <th className="p-3">Produto / Insumo</th>
                                <th className="p-3 hidden md:table-cell">Descrição</th>
                                <th className="p-3 w-28 text-right">Preço</th>
                                <th className="p-3 w-28 text-center">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {list.map((item) => {
                                const imgUrl = getItemImageUrl(item);
                                const numPrice = Number(item.price) || 0;
                                const numOrigPrice = Number(item.originalPrice) || 0;
                                const hasDiscount = Boolean(item.originalPrice && numOrigPrice > numPrice);
                                const isBuildItem = item.category === 'sandwich' || item.category === 'salad' || item.rawReadyProduct?.category === 'sandwich' || item.rawReadyProduct?.category === 'salad';
                                const displayDesc = item.description && !item.description.includes('Item de estoque') ? item.description : '';

                                return (
                                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td 
                                      className="p-2.5 cursor-pointer" 
                                      onClick={() => handleProductClick(item)}
                                      title="Clique para ver detalhes / personalizar"
                                    >
                                      <img
                                        src={imgUrl}
                                        alt={item.name}
                                        className="w-11 h-11 object-cover rounded-[15px] border border-slate-200 hover:scale-105 transition-transform"
                                        referrerPolicy="no-referrer"
                                      />
                                    </td>
                                    <td 
                                      className="p-2.5 cursor-pointer" 
                                      onClick={() => handleProductClick(item)}
                                      title="Clique para ver detalhes / personalizar"
                                    >
                                      <span className="font-extrabold text-slate-900 block text-xs sm:text-sm hover:text-brand-green transition-colors">{item.name}</span>
                                      {isBuildItem ? (
                                        <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded-[15px] inline-block mt-0.5">
                                          ✨ Customizável
                                        </span>
                                      ) : (
                                        displayDesc ? <span className="text-[11px] text-slate-400 block md:hidden line-clamp-1">{displayDesc}</span> : null
                                      )}
                                    </td>
                                    <td className="p-2.5 hidden md:table-cell text-slate-500">
                                      {displayDesc || '-'}
                                    </td>
                                    <td className="p-2.5 text-right font-black text-emerald-700 whitespace-nowrap">
                                      <div>R$ {numPrice.toFixed(2).replace('.', ',')}</div>
                                      {hasDiscount && (
                                        <div className="text-slate-400 text-[10px] line-through font-normal">
                                          R$ {numOrigPrice.toFixed(2).replace('.', ',')}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-center whitespace-nowrap">
                                      {isBuildItem ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setBuildModalFormat(item.category === 'salad' || item.rawReadyProduct?.category === 'salad' ? 'salad' : 'sandwich');
                                            setBuildModalProduct(item.rawReadyProduct || null);
                                            setIsBuildModalOpen(true);
                                          }}
                                          className="bg-brand-yellow hover:bg-yellow-400 text-brand-green font-black text-[11px] px-3 py-1.5 rounded-[15px] transition-all cursor-pointer shadow-xs active:scale-95 inline-flex items-center gap-1 border border-yellow-300"
                                        >
                                          <Sparkles className="h-3 w-3 text-brand-green" />
                                          <span>Monte o seu</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => addToQuickCart({
                                            name: item.name,
                                            price: item.price,
                                            image: item.image
                                          })}
                                          className="bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-[11px] px-3 py-1.5 rounded-[15px] transition-all shadow-2xs cursor-pointer active:scale-95 inline-flex items-center gap-1"
                                        >
                                          <ShoppingBag className="h-3 w-3 text-brand-yellow" />
                                          <span>Adicionar</span>
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* Quick tracker lookup & info */}
          <div 
            className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2" 
            id="track-input-section"
          >
            {/* Tracking Search Card */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm md:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brand-green" />
                  <span>Já fez seu pedido?</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Digite o código do seu comprovante para rastrear o preparo na cozinha em tempo real.
                </p>
              </div>

              <form onSubmit={handleSearchOrder} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    placeholder="Ex: BG-34567890"
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-brand-green hover:bg-brand-green-dark text-white px-5 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                  id="search-order-btn"
                >
                  <span>Buscar</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>

              {searchError && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {searchError}
                </p>
              )}
            </div>

            {/* Quick Benefits Card */}
            <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl p-6 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="bg-brand-green/10 text-brand-green p-2 rounded-xl inline-block">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm mt-2">Nossos Compromissos</h4>
                <p className="text-xs text-slate-500">
                  Ingredientes sempre frescos, pães assados na hora e higiene impecável em toda nossa operação.
                </p>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase mt-4">100% Bagôway Garantido</span>
            </div>
          </div>
        </div>
      )}

      {/* View: SANDWICH BUILDER */}
      {view === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200" id="customer-builder-view">
          {/* Step customizer options - Left & Center columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step indicators / wizard banner */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="bg-brand-green text-white h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm">
                  {step}
                </span>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    {stepsConfig.find(s => s.id === step)?.name 
                      ? `Passo ${step}: ${stepsConfig.find(s => s.id === step)?.name}`
                      : (
                        step === 1 ? (bagoFormat === 'salad' ? "Passo 1: Tipo & Base (Salada na Tigela)" : "Passo 1: Escolha o Pão") :
                        step === 2 ? (bagoFormat === 'salad' ? "Passo 2: Escolha a Porção da Salada" : "Passo 2: Escolha o Tamanho") :
                        step === 3 ? "Passo 3: Escolha o Recheio principal" :
                        step === 4 ? "Passo 4: Escolha o Queijo" :
                        step === 5 ? (bagoFormat === 'salad' ? "Passo 5: Aquecer a Proteína / Recheio?" : "Passo 5: Tostar o Pão?") :
                        step === 6 ? "Passo 6: Saladas e Vegetais" :
                        step === 7 ? "Passo 7: Escolha os Molhos" :
                        step === 8 ? "Passo 8: Quer Adicionais?" :
                        step === 9 ? "Passo 9: Bebida & Cookie" :
                        "Resumo & Identificação"
                      )}
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                    {stepsConfig.find(s => s.id === step)?.description || `Etapa ${step} de 10`}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="hidden sm:block w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-yellow h-full transition-all duration-300"
                  style={{ width: `${(step / 10) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Step details select panel */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
              
              {/* STEP 1: BREAD / FORMAT */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Format selector card */}
                  <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-wider">O que você deseja montar?</p>
                      <span className="text-[10px] bg-brand-yellow text-brand-green font-extrabold px-2 py-0.5 rounded-md uppercase">
                        {bagoFormat === 'sandwich' ? 'Sanduíche' : 'Salada na Tigela'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setBagoFormat('sandwich');
                          if (selectedBread === 'Sem Pão (Tigela de Salada)') {
                            setSelectedBread('Italiano Integral');
                          }
                        }}
                        className={`p-3.5 rounded-xl border-2 text-left flex items-center gap-3 transition-all cursor-pointer ${
                          bagoFormat === 'sandwich'
                            ? 'border-brand-green bg-white shadow-xs font-bold text-slate-900 ring-2 ring-brand-green/20'
                            : 'border-slate-200 bg-slate-100/70 text-slate-600 hover:bg-white'
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl shrink-0 ${bagoFormat === 'sandwich' ? 'bg-brand-green text-white' : 'bg-slate-200 text-slate-600'}`}>
                          <ShoppingBag className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-extrabold text-sm">🥖 Sanduíche / Bagô</p>
                          <p className="text-[11px] text-slate-500 font-normal">Montado no pão quentinho assado na hora</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBagoFormat('salad');
                          setSelectedBread('Sem Pão (Tigela de Salada)');
                        }}
                        className={`p-3.5 rounded-xl border-2 text-left flex items-center gap-3 transition-all cursor-pointer ${
                          bagoFormat === 'salad'
                            ? 'border-brand-green bg-white shadow-xs font-bold text-slate-900 ring-2 ring-brand-green/20'
                            : 'border-slate-200 bg-slate-100/70 text-slate-600 hover:bg-white'
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl shrink-0 ${bagoFormat === 'salad' ? 'bg-brand-green text-white' : 'bg-slate-200 text-slate-600'}`}>
                          <Sparkles className="h-5 w-5 text-brand-yellow" />
                        </div>
                        <div>
                          <p className="font-extrabold text-sm">🥗 Salada Bagô</p>
                          <p className="text-[11px] text-slate-500 font-normal">Servida na tigela leve e saudável (sem pão)</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {bagoFormat === 'salad' ? (
                    <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-5 text-center space-y-2">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
                        <Sparkles className="h-6 w-6 text-emerald-600" />
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm">Salada Bagô Selecionada!</h4>
                      <p className="text-xs text-slate-600 max-w-md mx-auto">
                        Sua refeição será montada diretamente na tigela com base leve de vegetais selecionados. Nenhum pão será adicionado.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Section: Select registered sandwich */}
                      <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <ShoppingBag className="h-4 w-4 text-brand-green" />
                            <span>1. Escolha o Lanche Cadastrado:</span>
                          </p>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md">
                            ✔ {selectedProtein}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {readyProducts.filter(p => p.category === 'sandwich' || p.category === 'all' || !p.category).map((prod, pIdx) => {
                            const isSelected = selectedProtein === prod.name;
                            return (
                              <button
                                key={prod.id || pIdx}
                                type="button"
                                onClick={() => setSelectedProtein(prod.name)}
                                className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? 'border-brand-green bg-white shadow-xs ring-2 ring-brand-green/20'
                                    : 'border-amber-200/60 bg-white/80 hover:border-amber-300'
                                }`}
                              >
                                <div className="space-y-1">
                                  <p className="font-extrabold text-xs text-slate-900 line-clamp-1">{prod.name}</p>
                                  <p className="text-[10px] text-slate-500 line-clamp-1">{prod.description || 'Lanche artesanal'}</p>
                                </div>
                                <span className="text-[11px] font-black text-emerald-700 mt-1.5 inline-block">
                                  R$ {(Number(prod.price) || 0).toFixed(2).replace('.', ',')}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Section: Mandatory Bread Selection */}
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Wheat className="h-4 w-4 text-brand-green" />
                            <span>2. Escolha o Pão (Obrigatório):</span>
                          </p>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border ${
                            selectedBread && selectedBread !== 'Sem Pão (Tigela de Salada)'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                          }`}>
                            {selectedBread && selectedBread !== 'Sem Pão (Tigela de Salada)' ? `✔ ${selectedBread}` : '⚠️ Obrigatório'}
                          </span>
                        </div>

                        {(!selectedBread || selectedBread === 'Sem Pão (Tigela de Salada)') && (
                          <div className="p-3 bg-rose-100/90 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                            <span>Atenção: A escolha do tipo de pão é OBRIGATÓRIA para o seu sanduíche! Selecione uma opção abaixo:</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {breads.map((bread, idx) => {
                            const isOutOfStock = bread.stock <= 0;
                            const isSelected = selectedBread === bread.name;
                            return (
                              <button
                                key={bread.id ? `bread-${bread.id}` : `bread-${bread.name}-${idx}`}
                                disabled={isOutOfStock}
                                type="button"
                                onClick={() => setSelectedBread(bread.name)}
                                className={`p-3 rounded-xl border-2 text-left flex justify-between items-center transition-all cursor-pointer ${
                                  isOutOfStock 
                                    ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                                    : isSelected
                                      ? 'border-brand-green bg-emerald-50/80 shadow-2xs font-bold text-slate-900 ring-2 ring-brand-green/20'
                                      : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <img 
                                    src={getIngredientImage(bread)} 
                                    alt={bread.name} 
                                    className="w-14 h-14 object-cover rounded-xl border border-slate-100 shrink-0 shadow-2xs" 
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="min-w-0">
                                    <p className="font-bold text-gray-800 text-sm truncate">{bread.name}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                      {isOutOfStock ? 'Esgotado!' : 'Massa macia & assada na hora'}
                                    </p>
                                  </div>
                                </div>
                                {bread.price > 0 && (
                                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md shrink-0 ml-2">
                                    + R$ {bread.price.toFixed(2)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: SIZE */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">
                    {bagoFormat === 'salad' ? 'Tamanho da sua tigela de salada.' : 'Tamanho padrão do seu sanduíche.'}
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {(() => {
                      const sizeOpts = bagoFormat === 'salad'
                        ? [
                            { id: 'opt-salad-std', label: 'Tigela Padrão (500g)', value: '15cm', description: 'Porção perfeita para refeição leve', priceAdd: 0 }
                          ]
                        : [
                            { id: 'opt-15cm', label: 'Sub 15cm (Tamanho Padrão)', value: '15cm', description: 'Tamanho Individual Padrão (15cm)', priceAdd: 0 }
                          ];

                      return sizeOpts.map((opt, idx) => {
                        const isSelected = selectedSize === opt.value || selectedSize === opt.label;
                        return (
                          <button
                            type="button"
                            key={opt.id || opt.value || idx}
                            onClick={() => setSelectedSize(opt.value)}
                            className={`p-4 rounded-xl border-2 text-left flex justify-between items-center transition-all cursor-pointer ${
                              isSelected
                                ? 'border-brand-green bg-brand-green/5'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Ruler className={`h-6 w-6 text-slate-400 shrink-0 ${idx > 0 ? 'rotate-45' : ''}`} />
                              <div>
                                <p className="font-bold text-gray-800 text-sm">{opt.label}</p>
                                {opt.description && (
                                  <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                                )}
                              </div>
                            </div>
                            {opt.priceAdd > 0 && (
                              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md shrink-0 ml-2">
                                + R$ {(Number(opt.priceAdd) || 0).toFixed(2)}
                              </span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* STEP 3: PROTEIN */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">Selecione o sabor principal.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {proteins.map((prot, idx) => {
                      const isOutOfStock = prot.stock <= 0;
                      return (
                        <button
                          key={prot.id ? `prot-${prot.id}` : `prot-${prot.name}-${idx}`}
                          disabled={isOutOfStock}
                          onClick={() => setSelectedProtein(prot.name)}
                          className={`p-3 rounded-xl border-2 text-left flex justify-between items-center transition-all cursor-pointer ${
                            isOutOfStock 
                              ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                              : selectedProtein === prot.name
                                ? 'border-brand-green bg-brand-green/5'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img 
                              src={getIngredientImage(prot)} 
                              alt={prot.name} 
                              className="w-14 h-14 object-cover rounded-xl border border-slate-100 shrink-0 shadow-2xs" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{prot.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {isOutOfStock ? 'Esgotado!' : 'Proteína de alta qualidade'}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-brand-green bg-brand-green/5 px-2.5 py-1 rounded-md shrink-0 ml-2">
                            R$ {(Number(prot.price) || 0).toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4: CHEESE */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                        <span>🧀 Queijo Incluso:</span>
                        <span className="text-brand-green font-extrabold bg-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
                          1 Incluso (Grátis)
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        1 queijo incluso gratuitamente. A partir do 2º queijo, será cobrado como adicional.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {selectedCheeses.length} selecionado(s)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cheeses.map((cheese, idx) => {
                      const isOutOfStock = cheese.stock <= 0;
                      const status = getOptionStatus({
                        category: 'cheese',
                        itemName: cheese.name,
                        format: bagoFormat,
                        selectedItems: selectedCheeses,
                        itemPrice: cheese.price
                      });

                      return (
                        <button
                          key={cheese.id ? `cheese-${cheese.id}` : `cheese-${cheese.name}-${idx}`}
                          disabled={isOutOfStock}
                          onClick={() => toggleCheese(cheese.name)}
                          className={`p-3 rounded-xl border-2 text-left flex justify-between items-center transition-all cursor-pointer ${
                            isOutOfStock 
                              ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                              : status.isSelected
                                ? 'border-brand-green bg-brand-green/5'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img 
                              src={getIngredientImage(cheese)} 
                              alt={cheese.name} 
                              className="w-14 h-14 object-cover rounded-xl border border-slate-100 shrink-0 shadow-2xs" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{cheese.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {isOutOfStock ? 'Esgotado!' : status.isPaidExtra ? 'Adicional Pago' : 'Queijo cremoso'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${status.badgeColor}`}>
                              {status.badgeText}
                            </span>
                            <div className={`h-5 w-5 rounded-md flex items-center justify-center transition-all ${
                              status.isSelected ? 'bg-brand-green text-white' : 'border border-gray-300'
                            }`}>
                              {status.isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 5: TOASTED */}
              {step === 5 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">
                    {bagoFormat === 'salad' ? 'Prefere sua proteína/recheio aquecido na tigela?' : 'Você prefere seu lanche tostado na grelha?'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsToasted(true)}
                      className={`p-5 rounded-xl border-2 text-left flex items-center gap-4 transition-all cursor-pointer ${
                        isToasted === true
                          ? 'border-brand-green bg-brand-green/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="bg-brand-yellow/20 text-brand-green p-2.5 rounded-xl shrink-0">
                        <Flame className="h-6 w-6 text-brand-green" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">
                          {bagoFormat === 'salad' ? 'Proteína / Recheio Aquecido' : 'Quentinho e Tostado (Recomendado)'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {bagoFormat === 'salad' ? 'Recheio e queijo derretido por cima da salada' : 'Pão crocante e queijo derretido'}
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => setIsToasted(false)}
                      className={`p-5 rounded-xl border-2 text-left flex items-center gap-4 transition-all cursor-pointer ${
                        isToasted === false
                          ? 'border-brand-green bg-brand-green/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="bg-slate-100 text-slate-600 p-2.5 rounded-xl shrink-0">
                        <Coffee className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">Frio / Temperatura Ambiente</p>
                        <p className="text-xs text-gray-400">
                          {bagoFormat === 'salad' ? 'Salada totalmente fresca e fria' : 'Pão macio sem ir para a estufa'}
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 6: VEGGIES (MULTI SELECT) */}
              {step === 6 && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                        <span>🥗 Saladas e Vegetais:</span>
                        <span className="text-brand-green font-extrabold bg-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
                          {bagoFormat === 'salad' ? 'Até 5 Inclusas (Grátis)' : 'Até 3 Inclusas (Grátis)'}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {bagoFormat === 'salad' 
                          ? 'Até 5 opções inclusas sem custo. A partir da 6ª salada, o preço do adicional é exibido e cobrado.'
                          : 'Até 3 opções inclusas sem custo. A partir da 4ª salada, o preço do adicional é exibido e cobrado.'
                        }
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {selectedVeggies.length} selecionada(s)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {veggies.map((veg, idx) => {
                      const isOutOfStock = veg.stock <= 0;
                      const status = getOptionStatus({
                        category: 'vegetable',
                        itemName: veg.name,
                        format: bagoFormat,
                        selectedItems: selectedVeggies,
                        itemPrice: veg.price
                      });

                      return (
                        <button
                          key={veg.id ? `veg-${veg.id}` : `veg-${veg.name}-${idx}`}
                          disabled={isOutOfStock}
                          onClick={() => toggleVeggie(veg.name)}
                          className={`p-3 rounded-xl border-2 text-left flex justify-between items-center transition-all cursor-pointer ${
                            isOutOfStock 
                              ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                              : status.isSelected
                                ? 'border-brand-green bg-brand-green/5'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img 
                              src={getIngredientImage(veg)} 
                              alt={veg.name} 
                              className="w-14 h-14 object-cover rounded-xl border border-slate-100 shrink-0 shadow-2xs" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{veg.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {isOutOfStock ? 'Esgotado!' : status.isPaidExtra ? 'Adicional Excedente' : 'Sempre fresco'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${status.badgeColor}`}>
                              {status.badgeText}
                            </span>
                            <div className={`h-5 w-5 rounded-md flex items-center justify-center transition-all ${
                              status.isSelected ? 'bg-brand-green text-white' : 'border border-gray-300'
                            }`}>
                              {status.isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 7: SAUCES (MULTI SELECT) */}
              {step === 7 && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                        <span>🥣 Molhos Artesanais:</span>
                        <span className="text-brand-green font-extrabold bg-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
                          Até 2 Inclusos (Grátis)
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Até 2 opções inclusas sem custo. A partir do 3º molho, o preço do adicional é exibido e cobrado.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {selectedSauces.length} selecionado(s)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sauces.map((sauce, idx) => {
                      const isOutOfStock = sauce.stock <= 0;
                      const status = getOptionStatus({
                        category: 'sauce',
                        itemName: sauce.name,
                        format: bagoFormat,
                        selectedItems: selectedSauces,
                        itemPrice: sauce.price
                      });

                      return (
                        <button
                          key={sauce.id ? `sauce-${sauce.id}` : `sauce-${sauce.name}-${idx}`}
                          disabled={isOutOfStock}
                          onClick={() => toggleSauce(sauce.name)}
                          className={`p-3 rounded-xl border-2 text-left flex justify-between items-center transition-all cursor-pointer ${
                            isOutOfStock 
                              ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                              : status.isSelected
                                ? 'border-brand-green bg-brand-green/5'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img 
                              src={getIngredientImage(sauce)} 
                              alt={sauce.name} 
                              className="w-14 h-14 object-cover rounded-xl border border-slate-100 shrink-0 shadow-2xs" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{sauce.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {isOutOfStock ? 'Esgotado!' : status.isPaidExtra ? 'Adicional Excedente' : 'Molho artesanal'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${status.badgeColor}`}>
                              {status.badgeText}
                            </span>
                            <div className={`h-5 w-5 rounded-md flex items-center justify-center transition-all ${
                              status.isSelected ? 'bg-brand-green text-white' : 'border border-gray-300'
                            }`}>
                              {status.isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 8: EXTRAS */}
              {step === 8 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">Deseja dar um upgrade de sabor ao seu Bagô? (Opcional)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {extras.map((ext, idx) => {
                      const isSelected = selectedExtras.includes(ext.name);
                      const isOutOfStock = ext.stock <= 0;
                      return (
                        <button
                          key={ext.id ? `ext-${ext.id}` : `ext-${ext.name}-${idx}`}
                          disabled={isOutOfStock}
                          onClick={() => toggleExtra(ext.name)}
                          className={`p-3 rounded-xl border-2 text-left flex justify-between items-center transition-all cursor-pointer ${
                            isOutOfStock 
                              ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                              : isSelected
                                ? 'border-brand-green bg-brand-green/5'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img 
                              src={getIngredientImage(ext)} 
                              alt={ext.name} 
                              className="w-14 h-14 object-cover rounded-xl border border-slate-100 shrink-0 shadow-2xs" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{ext.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {isOutOfStock ? 'Esgotado!' : 'Sabor supremo'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md shrink-0">
                              + R$ {(Number(ext.price) || 0).toFixed(2)}
                            </span>
                            <div className={`h-5 w-5 rounded-md flex items-center justify-center transition-all ${
                              isSelected ? 'bg-brand-green text-white' : 'border border-gray-300'
                            }`}>
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 9: DRINKS AND COOKIES */}
              {step === 9 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">Para acompanhar: nossas bebidas geladas e cookies quentinhos.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {drinksAndCookies.map((dc, idx) => {
                      const isSelected = selectedDrinksAndCookies.includes(dc.name);
                      const isOutOfStock = dc.stock <= 0;
                      return (
                        <button
                          key={dc.id ? `dc-${dc.id}` : `dc-${dc.name}-${idx}`}
                          disabled={isOutOfStock}
                          onClick={() => toggleDrinkCookie(dc.name)}
                          className={`p-3 rounded-xl border-2 text-left flex justify-between items-center transition-all cursor-pointer ${
                            isOutOfStock 
                              ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                              : isSelected
                                ? 'border-brand-green bg-brand-green/5'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img 
                              src={getIngredientImage(dc)} 
                              alt={dc.name} 
                              className="w-14 h-14 object-cover rounded-xl border border-slate-100 shrink-0 shadow-2xs" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{dc.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {isOutOfStock ? 'Esgotado!' : 'Combina perfeitamente'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md shrink-0">
                              + R$ {(Number(dc.price) || 0).toFixed(2)}
                            </span>
                            <div className={`h-5 w-5 rounded-md flex items-center justify-center transition-all ${
                              isSelected ? 'bg-brand-green text-white' : 'border border-gray-300'
                            }`}>
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 10: PHONE & NAME & SUBMIT */}
              {step === 10 && (
                <form onSubmit={handlePlaceOrder} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                      <span>Telefone / WhatsApp</span>
                      {searchingCustomer && <span className="text-xs text-brand-green font-bold animate-pulse">Buscando cadastro...</span>}
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={customerPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onBlur={() => { if (customerPhone) lookupCustomerByPhone(customerPhone); }}
                      placeholder="Ex: 85 99999-9999"
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-sm font-semibold"
                    />
                    {customerFoundNotice && (
                      <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md mt-1 animate-in fade-in">
                        {customerFoundNotice}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Seu Nome</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-sm font-semibold"
                    />
                  </div>

                  {deliveryStatus.isBlocked && (
                    <div className="bg-rose-50 border-2 border-rose-300 text-rose-900 p-3 rounded-xl text-xs font-bold space-y-1">
                      <div className="flex items-center gap-2 font-black text-rose-700">
                        <Lock className="h-4 w-4 shrink-0" />
                        <span>Recebimento de Pedidos Suspenso (Delivery e Retirada)</span>
                      </div>
                      <p className="text-rose-800 text-[11px] leading-tight">
                        {deliveryStatus.reason}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-700">Forma de Recebimento</label>
                      {storeDeliverySettings.pickupOnly && (
                        <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                          Somente Retirada
                        </span>
                      )}
                    </div>

                    {storeDeliverySettings.pickupOnly ? (
                      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-950 flex items-start gap-2.5 text-xs font-bold shadow-2xs">
                        <span className="text-base shrink-0">🏪</span>
                        <div className="space-y-0.5">
                          <p className="font-black text-amber-900">Somente Retirada no Balcão</p>
                          <p className="text-slate-700 font-semibold whitespace-pre-line text-[11px] leading-relaxed">
                            {storeDeliverySettings.pickupOnlyMessage || 'Hoje é o dia de folga do nosso delivery! 🛵💨\nMas fique tranquilo: estamos com a loja aberta e também disponível para retirada de pedidos. 🥖'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliveryType('retirada')}
                          className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                            deliveryType === 'retirada'
                              ? 'bg-brand-green text-white border-brand-green'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Retirada na Loja
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryType('entrega')}
                          className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                            deliveryType === 'entrega'
                              ? 'bg-brand-green text-white border-brand-green'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Entrega em Casa
                        </button>
                      </div>
                    )}
                  </div>

                  {renderDeliveryAddressInputs()}

                  {/* PAYMENT SECTION */}
                  {renderPaymentSection()}

                  {/* Order Summary Confirmation Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 mt-2">
                    <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Resumo do Pedido:</p>
                    <div className="flex justify-between text-slate-600 font-bold">
                      <span>Subtotal do Pedido:</span>
                      <span>R$ {(Number(currentPrice) || 0).toFixed(2)}</span>
                    </div>
                    {deliveryType === 'entrega' && (
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>Taxa de Entrega ({(Number(deliveryDistanceKm) || 0) > 0 ? `${(Number(deliveryDistanceKm) || 0).toFixed(1)} km` : ''}):</span>
                        <span className="font-bold text-brand-green">
                          {(Number(deliveryFee) || 0) === 0 ? 'GRÁTIS' : `R$ ${(Number(deliveryFee) || 0).toFixed(2)}`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1 font-black text-sm">
                      <span>Total Final a Pagar:</span>
                      <span className="text-brand-green">
                        R$ {((Number(currentPrice) || 0) + (deliveryType === 'entrega' ? (Number(deliveryFee) || 0) : 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {orderError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-md flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                      <span>{orderError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-brand-green hover:bg-brand-green-dark text-white font-black py-4 rounded-md flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        <span>Confirmar e Enviar Pedido (R$ {((Number(currentPrice) || 0) + (deliveryType === 'entrega' ? (Number(deliveryFee) || 0) : 0)).toFixed(2)})</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Navigation buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPrevStep}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                    id="builder-back-btn"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Voltar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { resetBuilder(); setView('home'); }}
                    className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs rounded-md flex items-center gap-1.5 transition-all border border-red-200 cursor-pointer"
                    id="builder-cancel-btn"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancelar Pedido</span>
                  </button>
                </div>

                {step < 10 && (
                  <button
                    onClick={goToNextStep}
                    className="px-5 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-bold text-xs rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                    id="builder-next-btn"
                  >
                    <span>Avançar</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Sandwich / Salad Visualizer Mockup - Right Column */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  {bagoFormat === 'salad' ? '🥗 Sua Salada Bagô' : '🥖 Seu Bagô'}
                </h3>
                <p className="text-[11px] text-gray-400">
                  {bagoFormat === 'salad' ? 'Construindo sua salada na tigela passo a passo' : 'Construindo seu sanduíche ingrediente por ingrediente'}
                </p>
              </div>

              {/* Visual layers stack mockup */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 min-h-[220px] flex flex-col justify-center items-center relative overflow-hidden">
                <div className="space-y-1 w-full max-w-[180px] flex flex-col items-center">
                  
                  {/* Top Bread or Salad Bowl Top */}
                  {bagoFormat === 'salad' ? (
                    <div className="w-full bg-emerald-600 text-white font-extrabold text-[10px] text-center py-2 rounded-t-2xl shadow-xs transition-all border-b-2 border-emerald-700/30">
                      🥗 TIGELA DE SALADA (Padrão 500g)
                    </div>
                  ) : (
                    <div className="w-full bg-amber-500 text-white font-extrabold text-[10px] text-center py-2.5 rounded-t-3xl shadow-xs transition-all border-b-2 border-amber-600/30">
                      🍔 PÃO: {selectedBread} (15cm)
                    </div>
                  )}

                  {/* Cheese layer (if selected) */}
                  {selectedCheese !== 'Sem Queijo' && (
                    <div className="w-[95%] bg-yellow-300 text-yellow-900 font-bold text-[9px] text-center py-1.5 rounded-sm shadow-xs animate-in slide-in-from-top-1">
                      🧀 QUEIJO: {selectedCheese}
                    </div>
                  )}

                  {/* Protein Layer */}
                  <div className="w-[90%] bg-amber-800 text-white font-bold text-[10px] text-center py-2 rounded-sm shadow-xs transition-all animate-in slide-in-from-top-2">
                    🥩 RECHEIO: {selectedProtein}
                  </div>

                  {/* Veggies Layer */}
                  {selectedVeggies.length > 0 && (
                    <div className="w-[88%] bg-emerald-500 text-white font-bold text-[9px] text-center py-1.5 rounded-sm shadow-xs max-h-12 overflow-hidden truncate px-1 animate-in slide-in-from-top-2">
                      🥗 SALADAS: {selectedVeggies.join(', ')}
                    </div>
                  )}

                  {/* Sauces layer */}
                  {selectedSauces.length > 0 && (
                    <div className="w-[85%] bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[8px] text-center py-1 rounded-sm shadow-xs max-h-10 overflow-hidden truncate px-1 animate-in slide-in-from-top-1">
                      💧 MOLHOS: {selectedSauces.join(', ')}
                    </div>
                  )}

                  {/* Extras layer */}
                  {selectedExtras.length > 0 && (
                    <div className="w-[82%] bg-brand-yellow text-brand-green font-bold text-[8px] text-center py-1 rounded-sm shadow-xs animate-in slide-in-from-top-1">
                      🔥 EXTRAS: {selectedExtras.join(', ')}
                    </div>
                  )}

                  {/* Bottom Bread or Salad Bowl Bottom */}
                  {bagoFormat === 'salad' ? (
                    <div className="w-full bg-emerald-700 text-white font-extrabold text-[9px] text-center py-1.5 rounded-b-2xl shadow-xs transition-all">
                      🥗 BASE SAUDÁVEL {isToasted ? '🔥 PROTEÍNA AQUECIDA' : '❄️ FRESCA'}
                    </div>
                  ) : (
                    <div className="w-full bg-amber-500 text-white font-extrabold text-[10px] text-center py-2.5 rounded-b-3xl shadow-xs transition-all border-t-2 border-amber-600/30">
                      🍔 {selectedBread} {isToasted ? '🔥 TOSTADO' : '❄️'}
                    </div>
                  )}

                </div>
              </div>

              {/* Price Tag Details */}
              <div className="pt-4 border-t border-gray-100 space-y-2 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>Preço Base (15cm)</span>
                  <span>R$ 12,00</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Proteína ({selectedProtein})</span>
                  <span>R$ {(ingredients.find(i => i.name === selectedProtein)?.price || 0).toFixed(2)}</span>
                </div>
                {selectedCheese !== 'Sem Queijo' && (ingredients.find(i => i.name === selectedCheese)?.price || 0) > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Queijo ({selectedCheese})</span>
                    <span>R$ {(ingredients.find(i => i.name === selectedCheese)?.price || 0).toFixed(2)}</span>
                  </div>
                )}
                {selectedExtras.length > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Adicionais Extras</span>
                    <span>
                      R$ {selectedExtras.reduce((sum, item) => sum + (ingredients.find(i => i.name === item)?.price || 0), 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {selectedDrinksAndCookies.length > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Acompanhamentos</span>
                    <span>
                      R$ {selectedDrinksAndCookies.reduce((sum, item) => sum + (ingredients.find(i => i.name === item)?.price || 0), 0).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-dashed border-gray-200 flex justify-between items-center text-sm font-bold text-gray-800">
                  <span>Total Estimado</span>
                  <span className="text-xl text-brand-green">R$ {(Number(currentPrice) || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View: REAL-TIME TRACKER */}
      {view === 'tracker' && activeTrackingOrder && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden animate-in fade-in duration-200" id="customer-tracker-view">
          
          {/* Header Banner */}
          <div className="bg-brand-green px-6 py-8 text-white text-center space-y-3 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-yellow/10 rounded-full blur-2xl"></div>
            
            <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest">
              <span>Acompanhamento em Tempo Real</span>
            </div>
            
            <h2 className="text-2xl font-bold">Pedido {activeTrackingOrder.code}</h2>
            <div className="text-xs text-white/80 space-y-1">
              <p>Nome: <span className="font-semibold">{activeTrackingOrder.customerName}</span></p>
              <p>Forma de Recebimento: <span className="font-bold bg-white/20 px-2 py-0.5 rounded-sm capitalize">{activeTrackingOrder.deliveryType || 'retirada'}</span></p>
              {activeTrackingOrder.deliveryType === 'entrega' && activeTrackingOrder.deliveryAddress && (
                <div className="bg-black/15 p-2.5 rounded-lg text-white/95 max-w-sm mx-auto mt-2 text-left border border-white/10">
                  <span className="font-black text-brand-yellow">📍 Endereço de Entrega:</span>
                  <p className="mt-1 font-semibold leading-relaxed text-xs">{activeTrackingOrder.deliveryAddress}</p>
                </div>
              )}
            </div>

            {/* Large Code for Pickup */}
            <div className="bg-white text-slate-800 rounded-md p-4 max-w-xs mx-auto shadow-md border-2 border-brand-yellow/20">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Código de Retirada</p>
              <h3 className="text-3xl font-black text-brand-green tracking-wider mt-0.5 font-mono">{activeTrackingOrder.code}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Apresente no balcão quando estiver PRONTO</p>
            </div>
          </div>

          {/* Stepper Status Progress */}
          <div className="p-6 md:p-8 space-y-8">
            <div className="relative">
              {/* Line background */}
              <div className="absolute left-6 top-1.5 bottom-1.5 w-0.5 bg-slate-100 -z-10 md:left-1/2 md:-translate-x-1/2 md:top-1/2 md:-translate-y-1/2 md:w-full md:h-0.5 md:bottom-auto"></div>

              {/* Steps progression */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
                {/* Step 1: RECEBIDO / PENDENTE */}
                <div className="flex md:flex-col items-center gap-4 text-left md:text-center z-10">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-sm transition-all border-4 ${
                    ['pendente', 'preparo', 'finalizado', 'entregue'].includes(activeTrackingOrder.status)
                      ? 'bg-emerald-500 text-white border-emerald-100'
                      : 'bg-white text-slate-400 border-slate-100'
                  }`}>
                    📥
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Recebido</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Pedido registrado</p>
                  </div>
                </div>

                {/* Step 2: EM PREPARO */}
                <div className="flex md:flex-col items-center gap-4 text-left md:text-center z-10">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-sm transition-all border-4 ${
                    ['preparo', 'finalizado', 'entregue'].includes(activeTrackingOrder.status)
                      ? 'bg-emerald-500 text-white border-emerald-100'
                      : activeTrackingOrder.status === 'pendente'
                        ? 'bg-brand-yellow text-brand-green border-white animate-pulse'
                        : 'bg-white text-slate-400 border-slate-100'
                  }`}>
                    🔥
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Preparando</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Sendo montado</p>
                  </div>
                </div>

                {/* Step 3: PRONTO */}
                <div className="flex md:flex-col items-center gap-4 text-left md:text-center z-10">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-sm transition-all border-4 ${
                    ['finalizado', 'entregue'].includes(activeTrackingOrder.status)
                      ? 'bg-emerald-500 text-white border-emerald-100'
                      : activeTrackingOrder.status === 'preparo'
                        ? 'bg-brand-yellow text-brand-green border-white animate-pulse'
                        : 'bg-white text-slate-400 border-slate-100'
                  }`}>
                    🥡
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Pronto</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Retirar no balcão</p>
                  </div>
                </div>

                {/* Step 4: ENTREGUE */}
                <div className="flex md:flex-col items-center gap-4 text-left md:text-center z-10">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-sm transition-all border-4 ${
                    activeTrackingOrder.status === 'entregue'
                      ? 'bg-emerald-500 text-white border-emerald-100'
                      : 'bg-white text-slate-400 border-slate-100'
                  }`}>
                    🎉
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Entregue</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Bom apetite!</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Waiting Time Card */}
            <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl p-5 text-center space-y-1">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tempo Estimado Restante</p>
              <h3 className="text-2xl font-black text-slate-800">
                {activeTrackingOrder.status === 'pendente' && "~15 a 20 minutos"}
                {activeTrackingOrder.status === 'preparo' && "~5 a 8 minutos"}
                {activeTrackingOrder.status === 'finalizado' && "Pronto para retirar agora! 🥡"}
                {activeTrackingOrder.status === 'entregue' && "Entregue com sucesso! 🎉"}
              </h3>
              <p className="text-[10px] text-slate-400">Esta tela se atualiza automaticamente em tempo real.</p>
            </div>

            {/* Order details summary list */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Seu Pedido:</h4>
              <div className="space-y-3">
                {activeTrackingOrder.items.map((item, idx) => {
                  const itemKey = item.id ? `item-${item.id}` : `item-${idx}`;
                  const numPrice = Number(item.price) || 0;
                  if (!item.sandwich) {
                    return (
                      <div key={itemKey} className="bg-amber-50/40 rounded-xl p-4 border border-amber-100 text-xs space-y-2">
                        <div className="flex justify-between font-bold text-slate-700">
                          <span className="flex items-center gap-1">🥤 {item.productName || 'Produto'}</span>
                          <span>R$ {numPrice.toFixed(2)}</span>
                        </div>
                        <p className="text-[10px] text-amber-800 font-medium">Quantidade: {item.quantity}x</p>
                      </div>
                    );
                  }
                  return (
                    <div key={itemKey} className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span>Sanduíche #{idx + 1} ({item.sandwich.size})</span>
                        <span>R$ {numPrice.toFixed(2)}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1 text-slate-500 pl-2 border-l border-brand-green/30">
                        <p><strong>Pão:</strong> {item.sandwich.bread}</p>
                        <p><strong>Recheio:</strong> {item.sandwich.protein}</p>
                        <p><strong>Queijo:</strong> {item.sandwich.cheese} {item.sandwich.toasted ? '(Tostado)' : '(Frio)'}</p>
                        {item.sandwich.veggies.length > 0 && <p><strong>Saladas:</strong> {item.sandwich.veggies.join(', ')}</p>}
                        {item.sandwich.sauces.length > 0 && <p><strong>Molhos:</strong> {item.sandwich.sauces.join(', ')}</p>}
                        {item.sandwich.extras.length > 0 && <p><strong>Adicionais:</strong> {item.sandwich.extras.join(', ')}</p>}
                        {item.sandwich.drinksAndCookies.length > 0 && <p><strong>Bebidas/Cookies:</strong> {item.sandwich.drinksAndCookies.join(', ')}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Payment Details */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 my-2">
                <div className="flex justify-between text-slate-600">
                  <span>Tipo de Atendimento:</span>
                  <span className="font-bold text-slate-800 uppercase">{activeTrackingOrder.deliveryType === 'entrega' ? '🛵 ENTREGA' : '🏪 RETIRADA'}</span>
                </div>
                {activeTrackingOrder.deliveryType === 'entrega' && (
                  <div className="flex justify-between text-slate-600">
                    <span>Taxa de Entrega {(Number(activeTrackingOrder.deliveryDistanceKm) || 0) > 0 ? `(${(Number(activeTrackingOrder.deliveryDistanceKm) || 0).toFixed(1)} km)` : ''}:</span>
                    <span className="font-bold text-emerald-700">
                      {(Number(activeTrackingOrder.deliveryFee) || 0) === 0 ? 'GRÁTIS' : `+ R$ ${(Number(activeTrackingOrder.deliveryFee) || 0).toFixed(2).replace('.', ',')}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Forma de Pagamento:</span>
                  <span className="font-bold text-slate-800 uppercase">{activeTrackingOrder.paymentMethod || 'CARTÃO'}</span>
                </div>
                {activeTrackingOrder.needChange && activeTrackingOrder.changeForAmount != null && (
                  <div className="flex justify-between text-amber-800 font-medium">
                    <span>Troco para:</span>
                    <span className="font-bold">R$ {(Number(activeTrackingOrder.changeForAmount) || 0).toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                {activeTrackingOrder.printReceipt !== undefined && (
                  <div className="flex justify-between text-slate-600">
                    <span>Comprovante Impresso:</span>
                    <span className="font-bold text-emerald-700">{activeTrackingOrder.printReceipt ? 'Solicitado' : 'Não solicitado'}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2 font-bold text-sm text-slate-800">
                <span>Total Pago</span>
                <span className="text-lg text-brand-green">R$ {(Number(activeTrackingOrder.totalPrice) || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenWhatsAppCompany(activeTrackingOrder)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl text-center text-xs sm:text-sm transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer border border-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Acompanhar no WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setView('home')}
                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl text-center text-xs sm:text-sm transition-all active:scale-95 shadow-md cursor-pointer"
              >
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Bar */}
      {quickCart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 bg-brand-green text-white px-5 py-4 rounded-xl shadow-2xl border border-white/20 flex items-center gap-4 animate-in slide-in-from-bottom-4">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-black tracking-wider text-brand-yellow">Sua Sacola Expresso</p>
            <p className="text-xs font-bold text-white">
              {quickCart.reduce((sum, item) => sum + item.quantity, 0)} itens • R$ {quickCart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0).toFixed(2)}
            </p>
          </div>
          <button
            onClick={() => setIsCartOpen(true)}
            className="bg-brand-yellow hover:bg-brand-yellow-dark text-brand-green font-black px-4 py-2.5 rounded-lg text-xs transition-all active:scale-95 shadow-md"
          >
            Finalizar Pedido
          </button>
        </div>
      )}

      {/* Floating WhatsApp Button */}
      {storeDeliverySettings.whatsappEnabled !== false && (
        (() => {
          const rawPhone = (storeDeliverySettings.whatsappPhone || DEFAULT_DELIVERY_SETTINGS.whatsappPhone || '').replace(/\D/g, '');
          if (!rawPhone) return null;
          const cleanPhone = rawPhone.length === 10 || rawPhone.length === 11 ? `55${rawPhone}` : rawPhone;
          const defaultMsg = storeDeliverySettings.whatsappMessage || DEFAULT_DELIVERY_SETTINGS.whatsappMessage || 'Olá! Gostaria de tirar uma dúvida sobre a loja e o cardápio.';
          const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(defaultMsg)}`;

          return (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`fixed ${quickCart.length > 0 ? 'bottom-24' : 'bottom-6'} right-6 z-40 bg-emerald-500 hover:bg-emerald-600 text-white p-3.5 sm:px-4 sm:py-3.5 rounded-full sm:rounded-2xl shadow-2xl hover:shadow-emerald-500/30 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2.5 border-2 border-white/20 group`}
              title="Fale Conosco no WhatsApp"
            >
              <div className="relative flex items-center justify-center">
                <svg className="w-6 h-6 fill-current text-white" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
              </div>
              <span className="hidden sm:inline font-extrabold text-xs tracking-wide">
                Atendimento WhatsApp
              </span>
            </a>
          );
        })()
      )}

      {/* MODAL: QUICK BUY SINGLE ITEM CHECKOUT */}
      {quickBuyProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="bg-brand-green p-4 sm:p-5 text-white relative shrink-0">
              <button 
                onClick={() => { setQuickBuyProduct(null); setCheckoutStep(1); setOrderError(''); }}
                className="absolute top-3.5 right-3.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="bg-brand-yellow text-brand-green text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">Compra Expresso</span>
              <h3 className="text-lg sm:text-xl font-bold mt-1.5">Confirmar Seu Pedido</h3>
            </div>
            
            {/* Stepper Progress Bar Header */}
            <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-600 shrink-0">
              <div className={`flex items-center gap-1 ${checkoutStep === 1 ? 'text-brand-green font-extrabold' : ''}`}>
                <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] ${checkoutStep === 1 ? 'bg-brand-green text-white shadow-xs' : checkoutStep > 1 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  {checkoutStep > 1 ? '✓' : '1'}
                </span>
                <span>1. Item</span>
              </div>
              <span className="text-slate-300 font-normal">/</span>
              <div className={`flex items-center gap-1 ${checkoutStep === 2 ? 'text-brand-green font-extrabold' : ''}`}>
                <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] ${checkoutStep === 2 ? 'bg-brand-green text-white shadow-xs' : checkoutStep > 2 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  {checkoutStep > 2 ? '✓' : '2'}
                </span>
                <span>2. Nome</span>
              </div>
              <span className="text-slate-300 font-normal">/</span>
              <div className={`flex items-center gap-1 ${checkoutStep === 3 ? 'text-brand-green font-extrabold' : ''}`}>
                <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] ${checkoutStep === 3 ? 'bg-brand-green text-white shadow-xs' : checkoutStep > 3 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  {checkoutStep > 3 ? '✓' : '3'}
                </span>
                <span>3. Entrega</span>
              </div>
              <span className="text-slate-300 font-normal">/</span>
              <div className={`flex items-center gap-1 ${checkoutStep === 4 ? 'text-brand-green font-extrabold' : ''}`}>
                <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] ${checkoutStep === 4 ? 'bg-brand-green text-white shadow-xs' : 'bg-slate-300 text-slate-600'}`}>
                  4
                </span>
                <span>4. Pago</span>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* PASSO 1: ITEM E QUANTIDADE */}
              {checkoutStep === 1 && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Passo 1: Item Selecionado</span>
                    <button
                      onClick={() => { setQuickBuyProduct(null); setCheckoutStep(1); setOrderError(''); }}
                      className="text-[10px] text-red-600 hover:text-red-700 font-bold hover:bg-red-50 px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                      title="Cancelar produto"
                    >
                      <Trash2 className="h-3 w-3" /> Cancelar Produto
                    </button>
                  </div>

                  {/* Product Info Card */}
                  <div className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {quickBuyProduct.image && (
                      <img 
                        src={quickBuyProduct.image} 
                        alt={quickBuyProduct.name} 
                        className="w-14 h-14 object-cover rounded-lg border border-slate-100 shrink-0 bg-white"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-slate-800 truncate">{quickBuyProduct.name}</h4>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{quickBuyProduct.description}</p>
                      <p className="text-xs font-bold text-brand-green mt-1">R$ {(Number(quickBuyProduct.price) || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Quantity selector */}
                  <div className="flex items-center justify-between border-t border-b border-slate-100 py-3">
                    <span className="text-xs font-bold text-slate-700 uppercase">Quantidade</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setQuickBuyQty(prev => prev > 1 ? prev - 1 : 1)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 h-8 w-8 rounded-full flex items-center justify-center transition-all font-bold cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-bold text-sm text-slate-800 w-4 text-center">{quickBuyQty}</span>
                      <button 
                        onClick={() => setQuickBuyQty(prev => prev + 1)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 h-8 w-8 rounded-full flex items-center justify-center transition-all font-bold cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Total summary */}
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-800 uppercase">
                    <span>Total do Pedido</span>
                    <span className="text-base sm:text-lg text-brand-green font-black">
                      R$ {((Number(quickBuyProduct.price) || 0) * (Number(quickBuyQty) || 1)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* PASSO 2: TELEFONE E NOME */}
              {checkoutStep === 2 && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block pb-1">Passo 2: Seus Dados</span>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase flex items-center justify-between">
                      <span>Telefone / WhatsApp <span className="text-red-500">*</span></span>
                      {searchingCustomer && <span className="text-[10px] text-brand-green font-bold animate-pulse">Buscando cadastro...</span>}
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      value={customerPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onBlur={() => { if (customerPhone) lookupCustomerByPhone(customerPhone); }}
                      placeholder="Ex: 85 99999-9999"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-xs sm:text-sm font-semibold text-slate-800"
                    />
                    {customerFoundNotice && (
                      <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg mt-1 animate-in fade-in">
                        {customerFoundNotice}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Seu Nome <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => { setCustomerName(e.target.value); if (orderError) setOrderError(''); }}
                      placeholder="Ex: Clara Silva"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-xs sm:text-sm font-semibold text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* PASSO 3: FORMA DE RECEBIMENTO */}
              {checkoutStep === 3 && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block pb-1">Passo 3: Forma de Recebimento</span>

                  {deliveryStatus.isBlocked && (
                    <div className="bg-rose-50 border-2 border-rose-300 text-rose-900 p-3 rounded-xl text-xs font-bold space-y-1">
                      <div className="flex items-center gap-2 font-black text-rose-700">
                        <Lock className="h-4 w-4 shrink-0" />
                        <span>Recebimento de Pedidos Suspenso (Delivery e Retirada)</span>
                      </div>
                      <p className="text-rose-800 text-[11px] leading-tight">
                        {deliveryStatus.reason}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 uppercase">Como deseja receber?</label>
                      {storeDeliverySettings.pickupOnly && (
                        <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                          Somente Retirada
                        </span>
                      )}
                    </div>

                    {storeDeliverySettings.pickupOnly ? (
                      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-950 flex items-start gap-2.5 text-xs font-bold shadow-2xs mt-1">
                        <span className="text-base shrink-0">🏪</span>
                        <div className="space-y-0.5">
                          <p className="font-black text-amber-900">Somente Retirada no Balcão</p>
                          <p className="text-slate-700 font-semibold whitespace-pre-line text-[11px] leading-relaxed">
                            {storeDeliverySettings.pickupOnlyMessage || 'Hoje é o dia de folga do nosso delivery! 🛵💨\nMas fique tranquilo: estamos com a loja aberta e também disponível para retirada de pedidos. 🥖'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => { setDeliveryType('retirada'); if (orderError) setOrderError(''); }}
                          className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            deliveryType === 'retirada'
                              ? 'bg-brand-green text-white border-brand-green shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-base">🏬</span>
                          <span>Retirada na Loja</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeliveryType('entrega'); if (orderError) setOrderError(''); }}
                          className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            deliveryType === 'entrega'
                              ? 'bg-brand-green text-white border-brand-green shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-base">🛵</span>
                          <span>Entrega em Casa</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {renderDeliveryAddressInputs()}
                </div>
              )}

              {/* PASSO 4: FORMA DE PAGAMENTO & CONFIRMAÇÃO */}
              {checkoutStep === 4 && (() => {
                const itemSubtotal = ((Number(quickBuyProduct.price) || 0) * (Number(quickBuyQty) || 1));
                const currentDiscount = appliedCoupon ? Math.min(itemSubtotal, appliedCoupon.discountAmount) : 0;
                const finalTotal = Math.max(0, itemSubtotal + (deliveryType === 'entrega' ? (Number(deliveryFee) || 0) : 0) - currentDiscount);

                return (
                  <div className="space-y-3.5 animate-in fade-in duration-150">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider block pb-1">Passo 4: Forma de Pagamento</span>

                    {renderPaymentSection()}

                    {/* Adicionar Cupom de Desconto */}
                    {renderCouponSection(itemSubtotal)}

                    {/* Order Summary Confirmation Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 mt-2">
                      <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Resumo do Pedido:</p>
                      <div className="flex justify-between text-slate-600">
                        <span>Item:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[180px]">{quickBuyProduct.name} ({quickBuyQty}x)</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Cliente:</span>
                        <span className="font-bold text-slate-800">{customerName} {customerPhone ? `(${customerPhone})` : ''}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Recebimento:</span>
                        <span className="font-bold text-slate-800">{deliveryType === 'entrega' ? 'Entrega em Casa' : 'Retirada na Loja'}</span>
                      </div>
                      {deliveryType === 'entrega' && (
                        <>
                          <div className="flex justify-between text-slate-600 text-[11px]">
                            <span>Endereço:</span>
                            <span className="font-bold text-slate-800 text-right max-w-[200px] truncate" title={getComputedDeliveryAddress()}>
                              {addressStreet}, {addressNumber} - {addressNeighborhood}, {addressCity}/{addressState}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-600 text-[11px]">
                            <span>Taxa de Entrega ({(Number(deliveryDistanceKm) || 0) > 0 ? `${(Number(deliveryDistanceKm) || 0).toFixed(1)} km` : ''}):</span>
                            <span className="font-bold text-brand-green">
                              {(Number(deliveryFee) || 0) === 0 ? 'GRÁTIS' : `R$ ${(Number(deliveryFee) || 0).toFixed(2)}`}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1 font-bold">
                        <span>Subtotal Item:</span>
                        <span>R$ {itemSubtotal.toFixed(2)}</span>
                      </div>
                      {appliedCoupon && (
                        <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                          <span>Desconto Cupom ({appliedCoupon.code}):</span>
                          <span>- R$ {currentDiscount.toFixed(2).replace('.', ',')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1 font-black text-sm">
                        <span>Total Final:</span>
                        <span className="text-brand-green">
                          R$ {finalTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {orderError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex gap-2">
              {checkoutStep === 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setQuickBuyProduct(null); setCheckoutStep(1); setOrderError(''); }}
                    className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl text-center text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setOrderError('');
                      setCheckoutStep(2);
                    }}
                    className="flex-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-green font-black py-3 rounded-xl text-center text-xs transition-all active:scale-98 shadow-md flex justify-center items-center gap-1 cursor-pointer"
                  >
                    <span>Avançar para Seus Dados</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {checkoutStep === 2 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setOrderError(''); setCheckoutStep(1); }}
                    className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl text-center text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Voltar</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!customerName.trim()) {
                        setOrderError('Por favor, informe seu nome para continuar.');
                        return;
                      }
                      if (!customerPhone.trim()) {
                        setOrderError('Por favor, informe seu telefone / WhatsApp para continuar.');
                        return;
                      }
                      setOrderError('');
                      setCheckoutStep(3);
                    }}
                    className="flex-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-green font-black py-3 rounded-xl text-center text-xs transition-all active:scale-98 shadow-md flex justify-center items-center gap-1 cursor-pointer"
                  >
                    <span>Avançar para Recebimento</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {checkoutStep === 3 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setOrderError(''); setCheckoutStep(2); }}
                    className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl text-center text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Voltar</span>
                  </button>
                  <button
                    onClick={() => {
                      if (deliveryType === 'entrega' && !validateDeliveryAddressFields()) {
                        return;
                      }
                      setOrderError('');
                      setCheckoutStep(4);
                    }}
                    className="flex-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-green font-black py-3 rounded-xl text-center text-xs transition-all active:scale-98 shadow-md flex justify-center items-center gap-1 cursor-pointer"
                  >
                    <span>Avançar para Pagamento</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {checkoutStep === 4 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setOrderError(''); setCheckoutStep(3); }}
                    className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl text-center text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Voltar</span>
                  </button>
                  <button
                    onClick={() => handleQuickCheckout([{
                      name: quickBuyProduct.name,
                      price: quickBuyProduct.price,
                      sandwichConfig: quickBuyProduct.sandwichConfig,
                      quantity: quickBuyQty
                    }])}
                    disabled={submitting}
                    className="flex-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-green font-black py-3 rounded-xl text-center text-xs transition-all active:scale-98 shadow-md flex justify-center items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <span className="h-4 w-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin"></span>
                    ) : (() => {
                      const itemSubtotal = ((Number(quickBuyProduct.price) || 0) * (Number(quickBuyQty) || 1));
                      const currentDiscount = appliedCoupon ? Math.min(itemSubtotal, appliedCoupon.discountAmount) : 0;
                      const finalTotal = Math.max(0, itemSubtotal + (deliveryType === 'entrega' ? (Number(deliveryFee) || 0) : 0) - currentDiscount);
                      return <span>Pedir R$ {finalTotal.toFixed(2)}</span>;
                    })()}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CART BACKDROP CHECKOUT */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="bg-brand-green p-4 sm:p-5 text-white relative shrink-0">
              <button 
                onClick={() => { setIsCartOpen(false); setCheckoutStep(1); setOrderError(''); }}
                className="absolute top-3.5 right-3.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="bg-brand-yellow text-brand-green text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">Sua Sacola Expresso</span>
              <h3 className="text-lg sm:text-xl font-bold mt-1.5">Finalizar Pedido da Sacola</h3>
            </div>

            {/* Stepper Progress Bar Header */}
            <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-600 shrink-0">
              <div className={`flex items-center gap-1 ${checkoutStep === 1 ? 'text-brand-green font-extrabold' : ''}`}>
                <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] ${checkoutStep === 1 ? 'bg-brand-green text-white shadow-xs' : checkoutStep > 1 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  {checkoutStep > 1 ? '✓' : '1'}
                </span>
                <span>1. Itens</span>
              </div>
              <span className="text-slate-300 font-normal">/</span>
              <div className={`flex items-center gap-1 ${checkoutStep === 2 ? 'text-brand-green font-extrabold' : ''}`}>
                <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] ${checkoutStep === 2 ? 'bg-brand-green text-white shadow-xs' : checkoutStep > 2 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  {checkoutStep > 2 ? '✓' : '2'}
                </span>
                <span>2. Nome</span>
              </div>
              <span className="text-slate-300 font-normal">/</span>
              <div className={`flex items-center gap-1 ${checkoutStep === 3 ? 'text-brand-green font-extrabold' : ''}`}>
                <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] ${checkoutStep === 3 ? 'bg-brand-green text-white shadow-xs' : checkoutStep > 3 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  {checkoutStep > 3 ? '✓' : '3'}
                </span>
                <span>3. Entrega</span>
              </div>
              <span className="text-slate-300 font-normal">/</span>
              <div className={`flex items-center gap-1 ${checkoutStep === 4 ? 'text-brand-green font-extrabold' : ''}`}>
                <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] ${checkoutStep === 4 ? 'bg-brand-green text-white shadow-xs' : 'bg-slate-300 text-slate-600'}`}>
                  4
                </span>
                <span>4. Pago</span>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* PASSO 1: ITENS DA SACOLA E TOTAL */}
              {checkoutStep === 1 && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Passo 1: Itens na Sacola</span>
                    <div className="flex items-center gap-2">
                      {quickCart.length > 0 && (
                        <button
                          onClick={() => setQuickCart([])}
                          className="text-[10px] text-red-600 hover:text-red-700 font-bold hover:bg-red-50 px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                          title="Cancelar todos os produtos da sacola"
                        >
                          <Trash2 className="h-3 w-3" /> Esvaziar Sacola
                        </button>
                      )}
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">{quickCart.length} item(ns)</span>
                    </div>
                  </div>

                  {quickCart.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                      <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto" />
                      <p className="text-xs text-slate-400 font-medium">Sua sacola está vazia.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {quickCart.map((item, idx) => (
                        <div key={item.id ? `cart-${item.id}` : `cart-${idx}`} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              {item.image ? (
                                <img 
                                  src={item.image} 
                                  alt={item.name} 
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                  <Utensils className="h-4 w-4" />
                                </div>
                              )}
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <p className="font-extrabold text-slate-800 leading-snug">{item.name}</p>
                                <p className="text-[10px] text-slate-400 font-semibold">R$ {(Number(item.price) || 0).toFixed(2)} un.</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Qty Selector */}
                              <div className="flex items-center gap-1.5 bg-white px-1 py-0.5 rounded-lg border border-slate-200">
                                <button 
                                  onClick={() => updateCartQty(item.id, -1)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 h-5 w-5 rounded-md flex items-center justify-center font-bold cursor-pointer transition-colors"
                                >
                                  <Minus className="h-2 w-2" />
                                </button>
                                <span className="font-extrabold text-slate-800 text-xs text-center w-4">{item.quantity}</span>
                                <button 
                                  onClick={() => updateCartQty(item.id, 1)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 h-5 w-5 rounded-md flex items-center justify-center font-bold cursor-pointer transition-colors"
                                >
                                  <Plus className="h-2 w-2" />
                                </button>
                              </div>
                              <span className="font-extrabold text-emerald-700 text-xs w-16 text-right">R$ {((Number(item.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}</span>
                              <button 
                                onClick={() => removeFromQuickCart(item.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                                title="Cancelar / Remover produto da sacola"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Customization Details Breakdown (Pão, Recheio, Queijo, Saladas, Molhos, Extras, Bebidas) */}
                          {item.sandwichConfig && (
                            <div className="p-2 bg-white rounded-lg border border-slate-200/80 text-[11px] text-slate-600 space-y-1 shadow-2xs">
                              {item.sandwichConfig.bread && item.sandwichConfig.bread !== 'Sem Pão (Tigela de Salada)' && (
                                <p className="flex items-center gap-1"><span className="text-slate-400">🥖 Pão:</span> <span className="font-semibold text-slate-800">{item.sandwichConfig.bread}</span></p>
                              )}
                              {item.sandwichConfig.protein && (
                                <p className="flex items-center gap-1"><span className="text-slate-400">🍗 Recheio:</span> <span className="font-semibold text-slate-800">{item.sandwichConfig.protein}</span></p>
                              )}
                              {item.sandwichConfig.cheese && item.sandwichConfig.cheese !== 'Sem Queijo' && (
                                <p className="flex items-center gap-1"><span className="text-slate-400">🧀 Queijo:</span> <span className="font-semibold text-slate-800">{item.sandwichConfig.cheese}</span></p>
                              )}
                              {item.sandwichConfig.veggies && item.sandwichConfig.veggies.length > 0 && (
                                <p className="flex items-start gap-1"><span className="text-slate-400 shrink-0">🥗 Saladas:</span> <span className="font-medium text-slate-700">{item.sandwichConfig.veggies.join(', ')}</span></p>
                              )}
                              {item.sandwichConfig.sauces && item.sandwichConfig.sauces.length > 0 && (
                                <p className="flex items-start gap-1"><span className="text-slate-400 shrink-0">🥣 Molhos:</span> <span className="font-medium text-slate-700">{item.sandwichConfig.sauces.join(', ')}</span></p>
                              )}
                              {item.sandwichConfig.extras && item.sandwichConfig.extras.length > 0 && (
                                <p className="flex items-start gap-1"><span className="text-slate-400 shrink-0">✨ Extras:</span> <span className="font-medium text-slate-700">{item.sandwichConfig.extras.join(', ')}</span></p>
                              )}
                              {item.sandwichConfig.drinksAndCookies && item.sandwichConfig.drinksAndCookies.length > 0 && (
                                <div className="mt-1 pt-1 border-t border-emerald-100 flex items-center gap-1.5 text-emerald-900 bg-emerald-50/80 p-1.5 rounded-md font-bold">
                                  <span>🥤 Bebida(s) / Acompanhamento:</span>
                                  <span className="text-emerald-700 font-extrabold">{item.sandwichConfig.drinksAndCookies.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {quickCart.length > 0 && (
                    <div className="flex justify-between items-center border-t border-slate-200 pt-3 text-xs font-bold text-slate-800 uppercase bg-slate-50 p-3 rounded-xl">
                      <span>Total do Pedido</span>
                      <span className="text-base sm:text-lg text-brand-green font-black">
                        R$ {quickCart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* PASSO 2: TELEFONE E NOME */}
              {checkoutStep === 2 && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block pb-1">Passo 2: Seus Dados</span>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase flex items-center justify-between">
                      <span>Telefone / WhatsApp <span className="text-red-500">*</span></span>
                      {searchingCustomer && <span className="text-[10px] text-brand-green font-bold animate-pulse">Buscando cadastro...</span>}
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      value={customerPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onBlur={() => { if (customerPhone) lookupCustomerByPhone(customerPhone); }}
                      placeholder="Ex: 85 99999-9999"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-xs sm:text-sm font-semibold text-slate-800"
                    />
                    {customerFoundNotice && (
                      <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg mt-1 animate-in fade-in">
                        {customerFoundNotice}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Seu Nome <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => { setCustomerName(e.target.value); if (orderError) setOrderError(''); }}
                      placeholder="Ex: João Silva"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-xs sm:text-sm font-semibold text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* PASSO 3: FORMA DE RECEBIMENTO */}
              {checkoutStep === 3 && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block pb-1">Passo 3: Forma de Recebimento</span>

                  {deliveryStatus.isBlocked && (
                    <div className="bg-rose-50 border-2 border-rose-300 text-rose-900 p-3 rounded-xl text-xs font-bold space-y-1">
                      <div className="flex items-center gap-2 font-black text-rose-700">
                        <Lock className="h-4 w-4 shrink-0" />
                        <span>Recebimento de Pedidos Suspenso (Delivery e Retirada)</span>
                      </div>
                      <p className="text-rose-800 text-[11px] leading-tight">
                        {deliveryStatus.reason}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 uppercase">Como deseja receber?</label>
                      {storeDeliverySettings.pickupOnly && (
                        <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                          Somente Retirada
                        </span>
                      )}
                    </div>

                    {storeDeliverySettings.pickupOnly ? (
                      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-950 flex items-start gap-2.5 text-xs font-bold shadow-2xs mt-1">
                        <span className="text-base shrink-0">🏪</span>
                        <div className="space-y-0.5">
                          <p className="font-black text-amber-900">Somente Retirada no Balcão</p>
                          <p className="text-slate-700 font-semibold whitespace-pre-line text-[11px] leading-relaxed">
                            {storeDeliverySettings.pickupOnlyMessage || 'Hoje é o dia de folga do nosso delivery! 🛵💨\nMas fique tranquilo: estamos com a loja aberta e também disponível para retirada de pedidos. 🥖'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => { setDeliveryType('retirada'); if (orderError) setOrderError(''); }}
                          className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            deliveryType === 'retirada'
                              ? 'bg-brand-green text-white border-brand-green shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-base">🏬</span>
                          <span>Retirada na Loja</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeliveryType('entrega'); if (orderError) setOrderError(''); }}
                          className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            deliveryType === 'entrega'
                              ? 'bg-brand-green text-white border-brand-green shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-base">🛵</span>
                          <span>Entrega em Casa</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {renderDeliveryAddressInputs()}
                </div>
              )}

              {/* PASSO 4: FORMA DE PAGAMENTO & CONFIRMAÇÃO */}
              {checkoutStep === 4 && (() => {
                const cartSubtotal = quickCart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);
                const currentDiscount = appliedCoupon ? Math.min(cartSubtotal, appliedCoupon.discountAmount) : 0;
                const finalTotal = Math.max(0, cartSubtotal + (deliveryType === 'entrega' ? (Number(deliveryFee) || 0) : 0) - currentDiscount);

                return (
                  <div className="space-y-3.5 animate-in fade-in duration-150">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider block pb-1">Passo 4: Forma de Pagamento</span>

                    {renderPaymentSection()}

                    {/* Adicionar Cupom de Desconto */}
                    {renderCouponSection(cartSubtotal)}

                    {/* Order Summary Confirmation Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 mt-2">
                      <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Resumo do Pedido:</p>
                      <div className="flex justify-between text-slate-600">
                        <span>Cliente:</span>
                        <span className="font-bold text-slate-800">{customerName} {customerPhone ? `(${customerPhone})` : ''}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Recebimento:</span>
                        <span className="font-bold text-slate-800">{deliveryType === 'entrega' ? 'Entrega em Casa' : 'Retirada na Loja'}</span>
                      </div>
                      {deliveryType === 'entrega' && (
                        <>
                          <div className="flex justify-between text-slate-600 text-[11px]">
                            <span>Endereço:</span>
                            <span className="font-bold text-slate-800 text-right max-w-[200px] truncate" title={getComputedDeliveryAddress()}>
                              {addressStreet}, {addressNumber} - {addressNeighborhood}, {addressCity}/{addressState}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-600 text-[11px]">
                            <span>Taxa de Entrega ({(Number(deliveryDistanceKm) || 0) > 0 ? `${(Number(deliveryDistanceKm) || 0).toFixed(1)} km` : ''}):</span>
                            <span className="font-bold text-brand-green">
                              {(Number(deliveryFee) || 0) === 0 ? 'GRÁTIS' : `R$ ${(Number(deliveryFee) || 0).toFixed(2)}`}
                            </span>
                          </div>
                        </>
                      )}
                      {/* Detailed Items List in Passo 4 */}
                      <div className="border-t border-slate-200 pt-2 mt-2 space-y-1.5">
                        <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider">Itens do Pedido ({quickCart.length}):</p>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1 text-[11px]">
                          {quickCart.map((item, idx) => (
                            <div key={idx} className="bg-white p-1.5 rounded-lg border border-slate-200/80">
                              <div className="flex justify-between font-bold text-slate-800">
                                <span>{item.quantity}x {item.name}</span>
                                <span className="text-emerald-700">R$ {((Number(item.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}</span>
                              </div>
                              {item.sandwichConfig?.drinksAndCookies && item.sandwichConfig.drinksAndCookies.length > 0 && (
                                <p className="text-[10px] font-bold text-emerald-800 mt-0.5">
                                  🥤 Bebida: {item.sandwichConfig.drinksAndCookies.join(', ')}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1 font-bold">
                        <span>Subtotal Itens:</span>
                        <span>R$ {cartSubtotal.toFixed(2)}</span>
                      </div>
                      {appliedCoupon && (
                        <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                          <span>Desconto Cupom ({appliedCoupon.code}):</span>
                          <span>- R$ {currentDiscount.toFixed(2).replace('.', ',')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1 font-black text-sm">
                        <span>Total Final:</span>
                        <span className="text-brand-green">
                          R$ {finalTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {orderError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}
            </div>

            {/* Sticky Action Footer per Step */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex gap-2">
              {checkoutStep === 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setIsCartOpen(false); setCheckoutStep(1); setOrderError(''); }}
                    className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl text-center text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ShoppingBag className="h-4 w-4 text-slate-500" />
                    <span>Continuar Comprando</span>
                  </button>
                  <button
                    onClick={() => {
                      if (quickCart.length === 0) return;
                      setOrderError('');
                      setCheckoutStep(2);
                    }}
                    disabled={quickCart.length === 0}
                    className="flex-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-green font-black py-3 rounded-xl text-center text-xs transition-all active:scale-98 shadow-md flex justify-center items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    <span>Avançar para Seus Dados</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {checkoutStep === 2 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setOrderError(''); setCheckoutStep(1); }}
                    className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl text-center text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Voltar</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!customerName.trim()) {
                        setOrderError('Por favor, informe seu nome para continuar.');
                        return;
                      }
                      if (!customerPhone.trim()) {
                        setOrderError('Por favor, informe seu telefone / WhatsApp para continuar.');
                        return;
                      }
                      setOrderError('');
                      setCheckoutStep(3);
                    }}
                    className="flex-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-green font-black py-3 rounded-xl text-center text-xs transition-all active:scale-98 shadow-md flex justify-center items-center gap-1 cursor-pointer"
                  >
                    <span>Avançar para Recebimento</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {checkoutStep === 3 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setOrderError(''); setCheckoutStep(2); }}
                    className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl text-center text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Voltar</span>
                  </button>
                  <button
                    onClick={() => {
                      if (deliveryType === 'entrega' && !validateDeliveryAddressFields()) {
                        return;
                      }
                      setOrderError('');
                      setCheckoutStep(4);
                    }}
                    className="flex-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-green font-black py-3 rounded-xl text-center text-xs transition-all active:scale-98 shadow-md flex justify-center items-center gap-1 cursor-pointer"
                  >
                    <span>Avançar para Pagamento</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {checkoutStep === 4 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setOrderError(''); setCheckoutStep(3); }}
                    className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl text-center text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Voltar</span>
                  </button>
                  <button
                    onClick={() => handleQuickCheckout(quickCart)}
                    disabled={submitting || quickCart.length === 0}
                    className="flex-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-green font-black py-3 rounded-xl text-center text-xs transition-all active:scale-98 shadow-md flex justify-center items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <span className="h-4 w-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin"></span>
                    ) : (() => {
                      const cartSubtotal = quickCart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);
                      const currentDiscount = appliedCoupon ? Math.min(cartSubtotal, appliedCoupon.discountAmount) : 0;
                      const finalTotal = Math.max(0, cartSubtotal + (deliveryType === 'entrega' ? (Number(deliveryFee) || 0) : 0) - currentDiscount);
                      return <span>Pedir R$ {finalTotal.toFixed(2)}</span>;
                    })()}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modern Assembly Modal Window (Replicates uploaded mockup image layout) */}
      <BuildSandwichModal
        isOpen={isBuildModalOpen}
        onClose={() => setIsBuildModalOpen(false)}
        initialFormat={buildModalFormat}
        initialProduct={buildModalProduct}
        ingredients={ingredients}
        readyProducts={readyProducts}
        onAddToCart={handleAddFromBuildModal}
      />

      {/* Modal Window: Mais Informações */}
      {isStoreInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header using company top header colors */}
            <div className="bg-brand-green text-white p-5 flex items-center justify-between border-b-4 border-brand-yellow">
              <div className="flex items-center gap-2.5">
                <div className="bg-brand-yellow text-brand-green p-2 rounded-xl shadow-xs">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight text-white">Mais Informações</h3>
                  <p className="text-xs text-brand-yellow font-bold uppercase tracking-wide">
                    {storeInfo?.city || 'São Miguel - RN'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStoreInfoModalOpen(false)}
                className="text-white/80 hover:text-white bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* SOBRE */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-brand-green uppercase tracking-wider flex items-center gap-2 bg-brand-green/10 px-3 py-1.5 rounded-lg w-fit border border-brand-green/20">
                  <Store className="h-4 w-4 text-brand-green" />
                  <span>Sobre a Empresa</span>
                </h4>

                <div className="space-y-2.5 text-xs text-slate-700 font-medium">
                  {/* Phone */}
                  {storeInfo?.phone ? (
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-brand-green shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900 block">Telefone:</span>
                        <a
                          href={`tel:${storeInfo.phone.replace(/\D/g, '')}`}
                          className="text-brand-green font-bold hover:underline"
                        >
                          {storeInfo.phone}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 text-slate-400">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>Telefone não informado</span>
                    </div>
                  )}

                  {/* Instagram */}
                  {storeInfo?.instagram ? (
                    <div className="flex items-center gap-2.5">
                      <Instagram className="h-4 w-4 text-pink-600 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900 block">Instagram:</span>
                        <a
                          href={storeInfo.instagram.startsWith('http') ? storeInfo.instagram : `https://instagram.com/${storeInfo.instagram.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pink-600 font-bold hover:underline"
                        >
                          {storeInfo.instagram}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 text-slate-400">
                      <Instagram className="h-4 w-4 shrink-0" />
                      <span>Instagram não informado</span>
                    </div>
                  )}

                  {/* Address */}
                  {storeInfo?.address ? (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-slate-900 block">Endereço:</span>
                        <span className="text-slate-700 font-semibold block">{storeInfo.address}</span>
                        {(() => {
                          const modalMapsUrl = (storeInfo.latitude && storeInfo.longitude)
                            ? `https://www.google.com/maps?q=${encodeURIComponent(storeInfo.latitude.trim())},${encodeURIComponent(storeInfo.longitude.trim())}`
                            : (storeInfo.address || storeInfo.city)
                              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([storeInfo.address, storeInfo.city].filter(Boolean).join(', '))}`
                              : null;
                          if (!modalMapsUrl) return null;
                          return (
                            <a
                              href={modalMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-brand-green/10 hover:bg-brand-green/20 text-brand-green font-extrabold text-xs rounded-xl border border-brand-green/30 transition-all cursor-pointer shadow-2xs"
                            >
                              <MapPin className="h-3.5 w-3.5 text-brand-green shrink-0" />
                              <span>Abrir Localização no Google Maps</span>
                            </a>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 text-slate-400">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>Endereço não informado</span>
                    </div>
                  )}
                </div>
              </div>

              {/* HORARIOS */}
              <div className="space-y-3 border-t border-slate-100 pt-5">
                <h4 className="text-xs font-black text-brand-green uppercase tracking-wider flex items-center gap-2 bg-brand-green/10 px-3 py-1.5 rounded-lg w-fit border border-brand-green/20">
                  <Clock className="h-4 w-4 text-brand-green" />
                  <span>Horários</span>
                </h4>
                <div className="text-xs text-slate-700 font-semibold leading-relaxed whitespace-pre-line bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  {storeInfo?.openingHours || 'Segunda a Domingo: 15:00 às 23:00'}
                </div>
              </div>

              {/* PAGAMENTO */}
              <div className="space-y-3 border-t border-slate-100 pt-5">
                <h4 className="text-xs font-black text-brand-green uppercase tracking-wider flex items-center gap-2 bg-brand-green/10 px-3 py-1.5 rounded-lg w-fit border border-brand-green/20">
                  <CreditCard className="h-4 w-4 text-brand-green" />
                  <span>Formas de Pagamento</span>
                </h4>
                <div className="text-xs text-slate-700 font-semibold bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  {storeInfo?.paymentMethods || 'Pix, Cartão de Crédito, Cartão de Débito, Dinheiro'}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsStoreInfoModalOpen(false)}
                className="w-full sm:w-auto px-6 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-xs border border-brand-green/20"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Window: Acompanhar Pedido via WhatsApp */}
      {whatsappPromptOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-emerald-600 text-white p-5 flex items-center justify-between border-b-4 border-emerald-400">
              <div className="flex items-center gap-3">
                <div className="bg-white text-emerald-600 p-2.5 rounded-2xl shadow-sm">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight text-white flex items-center gap-1.5">
                    <span>Acompanhar via WhatsApp?</span>
                  </h3>
                  <p className="text-xs text-emerald-100 font-semibold">
                    Pedido #{whatsappPromptOrder.code} gerado com sucesso!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappPromptOrder(null)}
                className="text-white/80 hover:text-white bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-all cursor-pointer"
                title="Fechar"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-xs space-y-2">
                <p className="text-emerald-950 font-bold text-sm">
                  Você quer acompanhar seu pedido pelo WhatsApp da nossa empresa?
                </p>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Ao clicar em <strong>"Sim, acompanhar no WhatsApp"</strong>, abriremos uma conversa com o WhatsApp oficial da loja já contendo o resumo completo do seu pedido:
                </p>
              </div>

              {/* Order preview snippet */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs space-y-2 max-h-48 overflow-y-auto">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">Resumo do Pedido</span>
                  <span className="font-mono font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">#{whatsappPromptOrder.code}</span>
                </div>
                <div className="space-y-1 text-slate-600 text-[11px]">
                  <p><strong className="text-slate-700">Cliente:</strong> {whatsappPromptOrder.customerName}</p>
                  <p><strong className="text-slate-700">Atendimento:</strong> {whatsappPromptOrder.deliveryType === 'entrega' ? '🛵 Entrega em Casa' : '🏪 Retirada no Balcão'}</p>
                  <p><strong className="text-slate-700">Pagamento:</strong> {whatsappPromptOrder.paymentMethod ? whatsappPromptOrder.paymentMethod.toUpperCase() : 'N/A'}</p>
                  <p><strong className="text-slate-700">Itens:</strong> {whatsappPromptOrder.items?.length || 0} item(ns)</p>
                  <p className="font-bold text-slate-800 text-xs pt-1 border-t border-slate-200/60 flex justify-between">
                    <span>Total:</span>
                    <span className="text-emerald-700">R$ {Number(whatsappPromptOrder.totalPrice || 0).toFixed(2)}</span>
                  </p>
                </div>
              </div>

              {/* Number notice */}
              {(() => {
                const targetPhone = storeDeliverySettings.whatsappPhone || storeInfo.phone || DEFAULT_DELIVERY_SETTINGS.whatsappPhone;
                if (!targetPhone) return null;
                return (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 justify-center">
                    <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Número da empresa: <strong>{targetPhone}</strong></span>
                  </p>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setWhatsappPromptOrder(null)}
                className="w-full sm:flex-1 py-3 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer text-center"
              >
                Acompanhar só pelo site
              </button>
              <button
                type="button"
                onClick={() => handleOpenWhatsAppCompany(whatsappPromptOrder)}
                className="w-full sm:flex-1.5 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 border border-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Sim, acompanhar no WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
