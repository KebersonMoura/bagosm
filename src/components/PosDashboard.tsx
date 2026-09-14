import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  QrCode, 
  Banknote, 
  UserCheck, 
  Search, 
  CheckCircle2, 
  Printer, 
  RotateCcw,
  AlertCircle,
  Tag,
  DollarSign,
  Coffee,
  Cookie,
  Utensils,
  Salad,
  PlusCircle,
  Wheat,
  Flame,
  Shield,
  Droplet,
  Lock,
  Unlock,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Receipt,
  FileText,
  SlidersHorizontal,
  X,
  Sparkles,
  Edit,
  Pencil,
  Clock,
  Check,
  ListFilter,
  Eye,
  Zap,
  LayoutGrid,
  List,
  Calendar,
  Bike,
  Store,
  Truck
} from 'lucide-react';
import { ReadyProduct, Ingredient, Order, OrderStatus, User, CustomerType, PaymentMethod, CashRegisterSession, CashTransaction, CustomSandwich, PaymentSplit, OrderItem, Coupon, CardMachine } from '../types';
import { printThermalReceipt } from '../utils/printReceipt';
import { calculateAssemblyExtras, getOptionStatus } from '../utils/assemblyRules';
import { BuildSandwichModal } from './BuildSandwichModal';
import { 
  formatTimeBrasilia, 
  formatDateBrasilia, 
  formatDateTimeBrasilia, 
  getDateYMDInBrasilia, 
  getTodayBrasilia 
} from '../utils/dateUtils';

interface PosDashboardProps {
  user: User;
  readyProducts: ReadyProduct[];
  ingredients: Ingredient[];
  orders?: Order[];
  onOrderCreated: (order: Order) => void;
  onOrderUpdated?: (order: Order) => void;
  onOrderDeleted?: (orderId: string) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'alert') => void;
}

interface CartItem {
  id: string; // product id or unique cart item id
  name: string;
  price: number;
  quantity: number;
  category: string;
  image?: string;
  sandwichConfig?: CustomSandwich;
}

export default function PosDashboard({
  user,
  readyProducts,
  ingredients,
  orders = [],
  onOrderCreated,
  onOrderUpdated,
  onOrderDeleted,
  showToast
}: PosDashboardProps) {
  // Navigation sub-tab inside POS
  const [posTab, setPosTab] = useState<'venda' | 'pedidos'>('venda');

  // Re-editing existing order directly in the POS cart
  const [editingPosOrderId, setEditingPosOrderId] = useState<string | null>(null);

  // Delete order state
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);

  // Edit order modal states
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<CustomerType>('cliente');
  const [editTable, setEditTable] = useState('');
  const [editDeliveryType, setEditDeliveryType] = useState<'retirada' | 'entrega'>('retirada');
  const [editDeliveryFee, setEditDeliveryFee] = useState('0.00');
  const [editDeliveryAddress, setEditDeliveryAddress] = useState('');
  const [editPayment, setEditPayment] = useState<PaymentMethod>('debito');
  const [editProvider, setEditProvider] = useState('stone');
  const [editModel, setEditModel] = useState('');
  const [editStatus, setEditStatus] = useState<OrderStatus>('pendente');
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editCashReceived, setEditCashReceived] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Helper to get local YYYY-MM-DD
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Search & filter for counter orders list
  const [posOrdersSearch, setPosOrdersSearch] = useState('');
  const [posOrdersFilterStatus, setPosOrdersFilterStatus] = useState<string>('todos');
  const [posOrdersDateFilter, setPosOrdersDateFilter] = useState<string>(getTodayDateString);
  const [posOrdersChannelFilter, setPosOrdersChannelFilter] = useState<'online' | 'balcao' | 'todos'>('online');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('sandwich');
  const [productViewMode, setProductViewMode] = useState<'grid' | 'table'>('grid');

  // Build Sandwich / Salad Modal State for POS (Matches user mockup image)
  const [isPosBuildModalOpen, setIsPosBuildModalOpen] = useState<boolean>(false);
  const [posBuildModalFormat, setPosBuildModalFormat] = useState<'sandwich' | 'salad'>('sandwich');
  const [posBuildModalProduct, setPosBuildModalProduct] = useState<ReadyProduct | null>(null);

  // Quick Bread Selection Modal state for Lanches in PDV
  const [quickBreadModalProduct, setQuickBreadModalProduct] = useState<any | null>(null);
  const [selectedQuickBreadId, setSelectedQuickBreadId] = useState<string>('');
  const [isQuickBreadToasted, setIsQuickBreadToasted] = useState<boolean>(true);
  const [quickBreadQty, setQuickBreadQty] = useState<number>(1);
  const [quickBreadNotes, setQuickBreadNotes] = useState<string>('');

  const isLancheProduct = (product: { id: string; name: string; category?: string; subcategory?: string }) => {
    if (!product) return false;
    const cat = (product.category || '').toLowerCase();
    const nameLower = (product.name || '').toLowerCase();

    // Strictly exclude non-lanche categories: adicionais, sobremesas, bebidas, insumos avulsos, saladas, shakes
    if (
      cat === 'extra' ||
      cat === 'addon' ||
      cat === 'dessert' ||
      cat === 'sobremesa' ||
      cat === 'cookie' ||
      cat === 'drink' ||
      cat === 'drink_cookie' ||
      cat === 'juice' ||
      cat === 'vitamin' ||
      cat === 'smoothie' ||
      cat === 'salad' ||
      cat === 'bread' ||
      cat === 'protein' ||
      cat === 'cheese' ||
      cat === 'vegetable' ||
      cat === 'sauce' ||
      cat === 'kitchen' ||
      cat === 'other'
    ) {
      return false;
    }

    // Exclude by name if item is a shake, drink, dessert, salad, or additionals
    if (
      nameLower.includes('shake') ||
      nameLower.includes('mousse') ||
      nameLower.includes('brownie') ||
      nameLower.includes('cookie') ||
      nameLower.includes('brookie') ||
      nameLower.includes('cheesecake') ||
      nameLower.includes('pudim') ||
      nameLower.includes('adicional') ||
      nameLower.includes('bebida') ||
      nameLower.includes('suco') ||
      nameLower.includes('vitamina') ||
      nameLower.includes('smoothie') ||
      nameLower.includes('salada de frutas') ||
      nameLower.startsWith('salada ')
    ) {
      return false;
    }

    const matchedReady = readyProducts.find(rp => rp.id === product.id);
    const readyCat = (matchedReady?.category || '').toLowerCase();
    const subcat = (matchedReady?.subcategory || (product as any).subcategory || '').toLowerCase();

    if (readyCat === 'salad' || subcat === 'salada') {
      return false;
    }

    if (readyCat === 'sandwich' || subcat === 'bago' || subcat.includes('lanche') || subcat.includes('sanduiche')) {
      return true;
    }

    return (
      cat === 'sandwich' ||
      cat === 'sanduiche' ||
      cat === 'lanche' ||
      subcat.includes('lanche') ||
      subcat.includes('sanduiche') ||
      subcat.includes('hamburguer') ||
      nameLower.startsWith('sub ') ||
      ((nameLower.startsWith('bagô de ') || nameLower.startsWith('bago de ') || nameLower.startsWith('bagô ') || nameLower.startsWith('bago ')) && !nameLower.includes('shake') && !nameLower.includes('salada'))
    );
  };

  const handleOpenBreadSelection = (product: any) => {
    setQuickBreadModalProduct(product);
    setQuickBreadQty(1);
    setQuickBreadNotes('');
    
    // Find pre-configured bread or pick first in-stock bread
    const cfg = getSandwichConfig(product as ReadyProduct);
    const configuredBreadName = cfg?.bread;
    const availableBreads = ingredients.filter(i => (i.category || '').toLowerCase() === 'bread');
    
    let defaultBread = availableBreads.find(b => configuredBreadName && b.name.toLowerCase() === configuredBreadName.toLowerCase() && (b.trackStock === false || Number(b.stock) > 0));
    if (!defaultBread) {
      defaultBread = availableBreads.find(b => b.trackStock === false || Number(b.stock) > 0) || availableBreads[0];
    }
    
    setSelectedQuickBreadId(defaultBread ? defaultBread.id : (availableBreads[0]?.id || ''));
    setIsQuickBreadToasted(cfg?.toasted !== undefined ? cfg.toasted : true);
  };

  const handleConfirmQuickBread = () => {
    if (!quickBreadModalProduct) return;
    
    const availableBreads = ingredients.filter(i => (i.category || '').toLowerCase() === 'bread');
    const chosenBread = availableBreads.find(b => b.id === selectedQuickBreadId) || availableBreads[0];
    
    if (!chosenBread) {
      showToast('Por favor, selecione um pão.', 'alert');
      return;
    }

    if (chosenBread.trackStock !== false && Number(chosenBread.stock) <= 0) {
      showToast(`Atenção: O pão "${chosenBread.name}" está esgotado no estoque!`, 'alert');
      return;
    }

    const cfg = getSandwichConfig(quickBreadModalProduct as ReadyProduct) || {
      protein: quickBreadModalProduct.name,
      size: '15cm',
      cheese: 'Mussarela',
      veggies: ['Alface Americana', 'Tomate Fatiado'],
      sauces: ['Chipotle Picante'],
      extras: [],
      drinksAndCookies: []
    };

    const finalConfig: CustomSandwich = {
      ...cfg,
      bread: chosenBread.name,
      toasted: isQuickBreadToasted
    };

    // Bread is included in the sandwich price (no extra charge)
    const itemUnitPrice = Number(quickBreadModalProduct.price) || 0;
    const cartItemId = `cart-pos-${quickBreadModalProduct.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    let finalName = quickBreadModalProduct.name;
    if (quickBreadNotes.trim()) {
      finalName += ` (${quickBreadNotes.trim()})`;
    }

    setCart(prev => [
      ...prev,
      {
        id: cartItemId,
        productId: quickBreadModalProduct.id,
        name: finalName,
        productName: quickBreadModalProduct.name,
        price: itemUnitPrice,
        quantity: quickBreadQty,
        category: 'sandwich',
        image: quickBreadModalProduct.image,
        sandwichConfig: finalConfig,
        sandwich: finalConfig,
        notes: quickBreadNotes.trim() || undefined
      } as any
    ]);

    showToast(`🥪 ${quickBreadModalProduct.name} com ${chosenBread.name} adicionado ao pedido!`, 'success');
    setQuickBreadModalProduct(null);
  };

  const handleAddFromBuildModalPos = (item: {
    sandwichConfig?: CustomSandwich;
    productName?: string;
    isReadyProduct?: boolean;
    price: number;
    quantity: number;
    notes?: string;
  }) => {
    let nameTitle = item.productName;
    if (!nameTitle && item.sandwichConfig) {
      nameTitle = item.sandwichConfig.protein ? `BAGÔ ${item.sandwichConfig.protein}` : 'Monte seu Bagô';
    }
    if (!nameTitle) nameTitle = 'Sanduíche Customizado';
    if (item.notes) {
      nameTitle = `${nameTitle} (${item.notes})`;
    }

    setCart(prev => [
      ...prev,
      {
        id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: nameTitle,
        productName: nameTitle,
        price: item.price,
        sandwichConfig: item.sandwichConfig,
        sandwich: item.sandwichConfig,
        quantity: item.quantity,
        category: 'sandwich',
        isCustomSandwich: true
      } as any
    ]);
  };

  // Customer & Payment state
  const [customerType, setCustomerType] = useState<CustomerType>('cliente');
  const [customerName, setCustomerName] = useState<string>('');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [deliveryType, setDeliveryType] = useState<'retirada' | 'entrega'>('retirada');
  const [deliveryFeeInput, setDeliveryFeeInput] = useState<string>('0.00');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'single' | 'split'>('single');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | 'vr' | ''>('');
  const [cardProvider, setCardProvider] = useState<string>('');
  const [machineModel, setMachineModel] = useState<string>('');
  const [cashReceived, setCashReceived] = useState<string>('');

  // Dynamic Card Machines State (from DB)
  const [cardMachines, setCardMachines] = useState<CardMachine[]>([
    { id: 'mach-stone', name: 'Stone', model: 'Stone Smart POS', active: true },
    { id: 'mach-santander', name: 'Santander', model: 'Getnet Smart', active: true },
    { id: 'mach-cielo', name: 'Cielo', model: 'Cielo LIO / Smart', active: true },
    { id: 'mach-outro', name: 'Outra', model: 'POS Genérica', active: true }
  ]);

  const fetchCardMachines = React.useCallback(async () => {
    try {
      const res = await fetch('/api/card-machines');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCardMachines(data);
        }
      }
    } catch (err) {
      console.warn('Error fetching card machines in POS:', err);
    }
  }, []);

  useEffect(() => {
    fetchCardMachines();
  }, [fetchCardMachines]);

  // Split payment state for multiple cards / methods
  interface SplitItemState {
    id: string;
    method: PaymentMethod | 'vr' | '';
    amount: string;
    cardProvider: string;
    cashReceived: string;
  }

  const [paymentSplits, setPaymentSplits] = useState<SplitItemState[]>([
    { id: 'sp-1', method: '', amount: '', cardProvider: '', cashReceived: '' },
    { id: 'sp-2', method: '', amount: '', cardProvider: '', cashReceived: '' }
  ]);
  
  // Coupon state for POS
  const [posCouponCode, setPosCouponCode] = useState<string>('');
  const [appliedPosCoupon, setAppliedPosCoupon] = useState<Coupon | null>(null);
  const [posDiscountAmount, setPosDiscountAmount] = useState<number>(0);
  const [posCouponLoading, setPosCouponLoading] = useState<boolean>(false);
  const [posCouponFeedback, setPosCouponFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // UI states
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Recalculate POS coupon discount when cart changes
  useEffect(() => {
    if (!appliedPosCoupon) {
      setPosDiscountAmount(0);
      return;
    }
    const currentSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (currentSubtotal <= 0) {
      setPosDiscountAmount(0);
      return;
    }
    if (appliedPosCoupon.minOrderValue && currentSubtotal < appliedPosCoupon.minOrderValue) {
      setPosDiscountAmount(0);
      setPosCouponFeedback({
        type: 'error',
        message: `Mínimo para este cupom: R$ ${appliedPosCoupon.minOrderValue.toFixed(2).replace('.', ',')}.`
      });
      return;
    }
    let disc = 0;
    if (appliedPosCoupon.type === 'percentage') {
      disc = (currentSubtotal * appliedPosCoupon.value) / 100;
    } else {
      disc = appliedPosCoupon.value;
    }
    if (disc > currentSubtotal) disc = currentSubtotal;
    setPosDiscountAmount(disc);
  }, [cart, appliedPosCoupon]);

  const handleApplyPosCoupon = async () => {
    if (!posCouponCode.trim()) {
      setPosCouponFeedback({ type: 'error', message: 'Informe o código do cupom.' });
      return;
    }
    setPosCouponLoading(true);
    setPosCouponFeedback(null);
    try {
      const currentSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: posCouponCode.trim(), subtotal: currentSubtotal })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedPosCoupon(data.coupon);
        setPosDiscountAmount(data.discountAmount || 0);
        setPosCouponFeedback({ type: 'success', message: data.message || `Cupom ${data.coupon.code} aplicado!` });
        showToast(data.message || `Cupom ${data.coupon.code} aplicado com sucesso!`, 'success');
      } else {
        setAppliedPosCoupon(null);
        setPosDiscountAmount(0);
        setPosCouponFeedback({ type: 'error', message: data.message || 'Cupom inválido.' });
        showToast(data.message || 'Cupom inválido.', 'alert');
      }
    } catch (err) {
      console.error('Erro ao validar cupom POS:', err);
      setPosCouponFeedback({ type: 'error', message: 'Erro de conexão ao validar cupom.' });
      showToast('Erro ao validar cupom.', 'alert');
    } finally {
      setPosCouponLoading(false);
    }
  };

  const handleRemovePosCoupon = () => {
    setPosCouponCode('');
    setAppliedPosCoupon(null);
    setPosDiscountAmount(0);
    setPosCouponFeedback(null);
    showToast('Cupom removido.', 'info');
  };

  // Customization modal state for PDV
  const [customizingProduct, setCustomizingProduct] = useState<ReadyProduct | null>(null);
  const [customConfig, setCustomConfig] = useState<CustomSandwich | null>(null);

  const getSandwichConfig = (product: ReadyProduct | null): CustomSandwich | undefined => {
    if (!product) return undefined;
    let cfg = product.sandwichConfig || (product as any).sandwich_config_json;
    if (!cfg) return undefined;
    if (typeof cfg === 'string') {
      try {
        cfg = JSON.parse(cfg);
      } catch (e) {
        return undefined;
      }
    }
    return cfg;
  };

  const openCustomizer = (product: ReadyProduct) => {
    setPosBuildModalProduct(product);
    setPosBuildModalFormat(product.category === 'salad' ? 'salad' : 'sandwich');
    setIsPosBuildModalOpen(true);
  };

  const toggleCheesePos = (name: string) => {
    if (!customConfig) return;
    const currentArr = customConfig.cheese && customConfig.cheese !== 'Sem Queijo'
      ? customConfig.cheese.split(', ').map(s => s.trim())
      : [];
    let newArr: string[];
    if (name === 'Sem Queijo') {
      newArr = [];
    } else if (currentArr.includes(name)) {
      newArr = currentArr.filter(c => c !== name);
    } else {
      newArr = [...currentArr, name];
    }
    setCustomConfig({
      ...customConfig,
      cheese: newArr.length > 0 ? newArr.join(', ') : 'Sem Queijo'
    });
  };

  const toggleVeggiePos = (name: string) => {
    if (!customConfig) return;
    const current = customConfig.veggies || [];
    const updated = current.includes(name) ? current.filter(v => v !== name) : [...current, name];
    setCustomConfig({ ...customConfig, veggies: updated });
  };

  const toggleSaucePos = (name: string) => {
    if (!customConfig) return;
    const current = customConfig.sauces || [];
    const updated = current.includes(name) ? current.filter(s => s !== name) : [...current, name];
    setCustomConfig({ ...customConfig, sauces: updated });
  };

  const toggleExtraProteinPos = (proteinName: string) => {
    if (!customConfig) return;
    const tag = `Proteína Extra: ${proteinName}`;
    const currentExtras = customConfig.extras || [];
    const exists = currentExtras.includes(tag);
    const updated = exists ? currentExtras.filter(e => e !== tag) : [...currentExtras, tag];
    setCustomConfig({ ...customConfig, extras: updated });
  };

  const toggleExtraCheesePos = (cheeseName: string) => {
    if (!customConfig) return;
    const tag = `Queijo Extra: ${cheeseName}`;
    const currentExtras = customConfig.extras || [];
    const exists = currentExtras.includes(tag);
    const updated = exists ? currentExtras.filter(e => e !== tag) : [...currentExtras, tag];
    setCustomConfig({ ...customConfig, extras: updated });
  };

  const addCustomizedToCart = () => {
    if (!customizingProduct || !customConfig) return;

    if (customizingProduct.category !== 'salad') {
      if (!customConfig.bread || !customConfig.bread.trim()) {
        showToast('Escolha obrigatória: Por favor, selecione o pão do lanche!', 'alert');
        return;
      }
    }
    
    const cheesesArr = customConfig.cheese && customConfig.cheese !== 'Sem Queijo' 
      ? customConfig.cheese.split(', ').map(s => s.trim()) 
      : [];

    const extraProteins = (customConfig.extras || [])
      .filter(e => e.startsWith('Proteína Extra: '))
      .map(e => e.replace('Proteína Extra: ', ''));

    const extraCheeses = (customConfig.extras || [])
      .filter(e => e.startsWith('Queijo Extra: '))
      .map(e => e.replace('Queijo Extra: ', ''));

    const extraPrice = calculateAssemblyExtras({
      format: customizingProduct.category === 'salad' ? 'salad' : 'sandwich',
      selectedCheeses: cheesesArr,
      selectedVeggies: customConfig.veggies || [],
      selectedSauces: customConfig.sauces || [],
      selectedExtraProteins: extraProteins,
      selectedExtraCheeses: extraCheeses,
      selectedExtras: customConfig.extras || [],
      ingredientsList: ingredients
    });

    const finalPrice = customizingProduct.price + extraPrice;
    const cartItemId = `cart-${customizingProduct.id}-${Date.now()}`;

    const pName = `${customizingProduct.name}${extraPrice > 0 ? ' (c/ Adicionais)' : ''}`;
    setCart(prev => [...prev, {
      id: cartItemId,
      name: pName,
      productName: pName,
      price: finalPrice,
      quantity: 1,
      category: customizingProduct.category,
      image: customizingProduct.image,
      sandwichConfig: customConfig,
      sandwich: customConfig
    } as any]);

    showToast(`${customizingProduct.name} adicionado ao pedido!`, 'success');
    setCustomizingProduct(null);
    setCustomConfig(null);
  };

  // System users state for employee selection
  const [systemUsers, setSystemUsers] = useState<User[]>([]);

  // Fetch users list
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          setSystemUsers(data);
        }
      } catch (err) {
        console.error('Erro ao carregar lista de usuários:', err);
      }
    };
    fetchUsers();
  }, []);

  // Filter out system accounts (admin, balcao, cozinha) to show only actual registered employees
  const eligibleEmployees = React.useMemo(() => {
    return systemUsers.filter(u => {
      const un = (u.username || '').toLowerCase().trim();
      const id = (u.id || '').toLowerCase().trim();
      const name = (u.name || '').toLowerCase().trim();

      // Exclude generic admin, balcao, and cozinha system accounts
      if (un === 'admin' || un === 'balcao' || un === 'cozinha') return false;
      if (id === 'usr-admin' || id === 'usr-balcao' || id === 'usr-cozinha') return false;
      if (
        name === 'admin' ||
        name === 'administrador' ||
        name === 'administrador bagô' ||
        name === 'balcao' ||
        name === 'balcão' ||
        name === 'atendimento balcão' ||
        name === 'atendimento / balcão' ||
        name === 'cozinha' ||
        name === 'equipe da cozinha'
      ) return false;

      return true;
    });
  }, [systemUsers]);

  // Cash Register state
  const [cashRegister, setCashRegister] = useState<CashRegisterSession | null>(null);
  const [loadingRegister, setLoadingRegister] = useState(true);

  // Cash Register Modals & Forms
  const [showOpenRegisterModal, setShowOpenRegisterModal] = useState(false);
  const [showCloseRegisterModal, setShowCloseRegisterModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'suprimento' | 'sangria'>('suprimento');

  // Inputs
  const [openInitialCash, setOpenInitialCash] = useState<string>('100.00');
  const [openOperatorName, setOpenOperatorName] = useState<string>(user?.name || user?.username || 'Operador Balcão');
  const [openNotes, setOpenNotes] = useState<string>('');

  const [movementAmount, setMovementAmount] = useState<string>('');
  const [movementDescription, setMovementDescription] = useState<string>('');

  const [closeActualCash, setCloseActualCash] = useState<string>('');
  const [closeNotes, setCloseNotes] = useState<string>('');
  const [closedReportSession, setClosedReportSession] = useState<CashRegisterSession | null>(null);
  const [showPreCaixaModal, setShowPreCaixaModal] = useState(false);

  // Fetch Cash Register State
  const fetchCashRegister = async () => {
    try {
      const res = await fetch('/api/cash-register/current');
      if (res.ok) {
        const data = await res.json();
        setCashRegister(data.activeSession);
        if (!data.activeSession) {
          setShowOpenRegisterModal(true);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar status do caixa:', err);
    } finally {
      setLoadingRegister(false);
    }
  };

  useEffect(() => {
    fetchCashRegister();

    const handleCashRegisterEvent = (e: any) => {
      if (e?.detail) {
        setCashRegister(e.detail);
      } else {
        fetchCashRegister();
      }
    };

    window.addEventListener('bago_cash_register_update', handleCashRegisterEvent);
    return () => {
      window.removeEventListener('bago_cash_register_update', handleCashRegisterEvent);
    };
  }, []);

  const formatMachineName = (provider?: string, model?: string) => {
    if (!provider && !model) return '';
    let pName = provider ? provider.toUpperCase() : '';
    if (pName === 'STONE') pName = 'STONE';
    else if (pName === 'SANTANDER') pName = 'Santander';
    else if (pName === 'CIELO') pName = 'Cielo';
    else if (pName === 'PICPAY') pName = 'PicPay';
    else if (pName === 'OUTRO') pName = 'Outra Operadora';

    if (model && model.trim()) {
      if (pName) return `${pName} (${model.trim()})`;
      return model.trim();
    }
    return pName;
  };

  const normalizeCashPaymentMethod = (pm?: string): 'dinheiro' | 'debito' | 'credito' | 'pix' | 'vr' => {
    if (!pm) return 'debito';
    const clean = String(pm).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (clean.includes('dinheiro') || clean.includes('cash') || clean.includes('especie')) return 'dinheiro';
    if (clean.includes('pix')) return 'pix';
    if (clean.includes('credito') || clean.includes('credit')) return 'credito';
    if (clean.includes('refeicao') || clean.includes('vale') || clean.includes('vr') || clean.includes('alelo') || clean.includes('sodexo') || clean.includes('ticket')) return 'vr';
    if (clean.includes('debito') || clean.includes('debit')) return 'debito';
    return 'debito';
  };

  // Helper calculation for Cash Register Session Metrics (Separating Counter / Balcão and Delivery)
  const getCashSessionMetrics = (session: CashRegisterSession | null, ordersList: Order[] = orders) => {
    const empty = {
      initial: 0,
      counterSalesTotal: 0,
      counterSalesCount: 0,
      counterTxs: [] as CashTransaction[],
      counterCash: 0,
      counterDebito: 0,
      counterCredito: 0,
      counterPix: 0,
      counterVr: 0,
      counterMachineTotals: {} as Record<string, number>,
      counterDiscounts: 0,
      deliverySalesTotal: 0,
      deliverySalesCount: 0,
      deliveryTxs: [] as CashTransaction[],
      deliveryCash: 0,
      deliveryDebito: 0,
      deliveryCredito: 0,
      deliveryPix: 0,
      deliveryVr: 0,
      deliveryFeesTotal: 0,
      deliveryMachineTotals: {} as Record<string, number>,
      deliveryDiscounts: 0,
      totalTurnover: 0,
      totalOrdersCount: 0,
      totalSalesTxsCount: 0,
      cashSales: 0,
      debitoSales: 0,
      creditoSales: 0,
      pixSales: 0,
      vrSales: 0,
      machineTotals: {} as Record<string, number>,
      totalDiscounts: 0,
      totalDeliveryFees: 0,
      suprimentos: 0,
      sangrias: 0,
      expectedCashInDrawer: 0,
      actualCashInDrawer: 0,
      cashDifference: 0,
    };

    if (!session) return empty;

    const txs = session.transactions || [];
    const initial = session.initialCash || 0;

    const suprimentos = txs.filter(t => t.type === 'suprimento').reduce((s, t) => s + t.amount, 0);
    const sangrias = txs.filter(t => t.type === 'sangria').reduce((s, t) => s + t.amount, 0);

    // Calculate time bounds for orders belonging to this shift
    let minAllowedTime = session.openedAt ? new Date(session.openedAt).getTime() : 0;
    if (session.openedAt) {
      const openDateObj = new Date(session.openedAt);
      const dayStartObj = new Date(openDateObj.getFullYear(), openDateObj.getMonth(), openDateObj.getDate(), 0, 0, 0, 0);
      minAllowedTime = Math.min(minAllowedTime, dayStartObj.getTime());
    }
    const maxAllowedTime = session.closedAt ? new Date(session.closedAt).getTime() : (Date.now() + 86400000);

    // Identify all valid active orders and cancelled orders to strictly exclude from all financial totals and receipts
    const activeNonCancelledOrders = (ordersList || []).filter(o => o.status !== 'cancelado');
    const validActiveOrderIds = new Set(activeNonCancelledOrders.map(o => o.id));
    const validActiveOrderCodes = new Set(activeNonCancelledOrders.map(o => o.code).filter(Boolean));

    const cancelledOrders = (ordersList || []).filter(o => o.status === 'cancelado');
    const cancelledOrderIds = new Set(cancelledOrders.map(o => o.id));
    const cancelledOrderCodes = new Set(cancelledOrders.map(o => o.code).filter(Boolean));

    const sessionOrders = activeNonCancelledOrders.filter(o => {
      if (!session.openedAt) return true;
      const oDate = new Date(o.createdAt).getTime();
      return oDate >= minAllowedTime && oDate <= maxAllowedTime;
    });

    let counterSalesTotal = 0;
    let counterCash = 0, counterDebito = 0, counterCredito = 0, counterPix = 0, counterVr = 0;
    const counterTxs: CashTransaction[] = [];
    const counterMachineTotals: Record<string, number> = {};
    const counterOrderIds = new Set<string>();

    let deliverySalesTotal = 0;
    let deliveryCash = 0, deliveryDebito = 0, deliveryCredito = 0, deliveryPix = 0, deliveryVr = 0;
    const deliveryTxs: CashTransaction[] = [];
    const deliveryMachineTotals: Record<string, number> = {};
    const deliveryOrderIds = new Set<string>();

    const combinedMachineTotals: Record<string, number> = {};
    const processedOrderIds = new Set<string>();

    // 1. Process all active orders for this shift directly
    sessionOrders.forEach(order => {
      processedOrderIds.add(order.id);
      const isDelivery = order.deliveryType === 'entrega';
      const channel: 'delivery' | 'balcao' = isDelivery ? 'delivery' : 'balcao';
      const channelLabel = isDelivery ? 'Delivery' : (order.isPosOrder ? 'Balcão PDV' : 'Balcão/Retirada');

      if (isDelivery) {
        deliveryOrderIds.add(order.id);
      } else {
        counterOrderIds.add(order.id);
      }

      if (order.paymentSplits && order.paymentSplits.length > 0) {
        order.paymentSplits.forEach((split, idx) => {
          const splitAmount = Number(split.amount) || 0;
          const pm = normalizeCashPaymentMethod(split.method || order.paymentMethod);
          const mName = formatMachineName(split.cardProvider || order.cardProvider, split.machineModel || order.machineModel);

          const txObj: CashTransaction = {
            id: `tx-ord-${order.id}-${idx}`,
            type: 'sale',
            amount: splitAmount,
            description: `Venda ${channelLabel} - Pedido #${order.code}`,
            timestamp: order.createdAt,
            paymentMethod: pm,
            cardProvider: split.cardProvider || order.cardProvider,
            machineModel: split.machineModel || order.machineModel,
            orderId: order.id,
            orderCode: order.code,
            deliveryType: order.deliveryType,
            deliveryFee: isDelivery ? (Number(order.deliveryFee) || 0) : 0,
            isPosOrder: order.isPosOrder,
            channel: channel
          };

          if (pm !== 'dinheiro') {
            const mLabel = mName || 'Sem Maquininha Especificada';
            combinedMachineTotals[mLabel] = (combinedMachineTotals[mLabel] || 0) + splitAmount;
          }

          if (isDelivery) {
            deliveryTxs.push(txObj);
            deliverySalesTotal += splitAmount;
            if (pm === 'dinheiro') deliveryCash += splitAmount;
            else if (pm === 'debito') deliveryDebito += splitAmount;
            else if (pm === 'credito') deliveryCredito += splitAmount;
            else if (pm === 'pix') deliveryPix += splitAmount;
            else if (pm === 'vr') deliveryVr += splitAmount;
            else deliveryDebito += splitAmount;

            if (pm !== 'dinheiro') {
              const mLabel = mName || 'Sem Maquininha Especificada';
              deliveryMachineTotals[mLabel] = (deliveryMachineTotals[mLabel] || 0) + splitAmount;
            }
          } else {
            counterTxs.push(txObj);
            counterSalesTotal += splitAmount;
            if (pm === 'dinheiro') counterCash += splitAmount;
            else if (pm === 'debito') counterDebito += splitAmount;
            else if (pm === 'credito') counterCredito += splitAmount;
            else if (pm === 'pix') counterPix += splitAmount;
            else if (pm === 'vr') counterVr += splitAmount;
            else counterDebito += splitAmount;

            if (pm !== 'dinheiro') {
              const mLabel = mName || 'Sem Maquininha Especificada';
              counterMachineTotals[mLabel] = (counterMachineTotals[mLabel] || 0) + splitAmount;
            }
          }
        });
      } else {
        const orderAmount = Number(order.totalPrice) || 0;
        const pm = normalizeCashPaymentMethod(order.paymentMethod);
        const mName = formatMachineName(order.cardProvider, order.machineModel);

        const txObj: CashTransaction = {
          id: `tx-ord-${order.id}`,
          type: 'sale',
          amount: orderAmount,
          description: `Venda ${channelLabel} - Pedido #${order.code}`,
          timestamp: order.createdAt,
          paymentMethod: pm,
          cardProvider: order.cardProvider,
          machineModel: order.machineModel,
          orderId: order.id,
          orderCode: order.code,
          deliveryType: order.deliveryType,
          deliveryFee: isDelivery ? (Number(order.deliveryFee) || 0) : 0,
          isPosOrder: order.isPosOrder,
          channel: channel
        };

        if (pm !== 'dinheiro') {
          const mLabel = mName || 'Sem Maquininha Especificada';
          combinedMachineTotals[mLabel] = (combinedMachineTotals[mLabel] || 0) + orderAmount;
        }

        if (isDelivery) {
          deliveryTxs.push(txObj);
          deliverySalesTotal += orderAmount;
          if (pm === 'dinheiro') deliveryCash += orderAmount;
          else if (pm === 'debito') deliveryDebito += orderAmount;
          else if (pm === 'credito') deliveryCredito += orderAmount;
          else if (pm === 'pix') deliveryPix += orderAmount;
          else if (pm === 'vr') deliveryVr += orderAmount;
          else deliveryDebito += orderAmount;

          if (pm !== 'dinheiro') {
            const mLabel = mName || 'Sem Maquininha Especificada';
            deliveryMachineTotals[mLabel] = (deliveryMachineTotals[mLabel] || 0) + orderAmount;
          }
        } else {
          counterTxs.push(txObj);
          counterSalesTotal += orderAmount;
          if (pm === 'dinheiro') counterCash += orderAmount;
          else if (pm === 'debito') counterDebito += orderAmount;
          else if (pm === 'credito') counterCredito += orderAmount;
          else if (pm === 'pix') counterPix += orderAmount;
          else if (pm === 'vr') counterVr += orderAmount;
          else counterDebito += orderAmount;

          if (pm !== 'dinheiro') {
            const mLabel = mName || 'Sem Maquininha Especificada';
            counterMachineTotals[mLabel] = (counterMachineTotals[mLabel] || 0) + orderAmount;
          }
        }
      }
    });

    // 2. Process any manual sale transactions in session.transactions that are not linked to processed orders AND not cancelled or deleted
    const standaloneSalesTxs = txs.filter(t => {
      if (t.type !== 'sale') return false;
      // Skip if explicitly linked to an already processed order
      if (t.orderId && processedOrderIds.has(t.orderId)) return false;
      // If transaction was generated from an order (has orderId, orderCode, or tx-ord- id), verify that the order still exists and is not cancelled
      if (t.orderId && (!validActiveOrderIds.has(t.orderId) || cancelledOrderIds.has(t.orderId))) return false;
      if (t.orderCode && (!validActiveOrderCodes.has(t.orderCode) || cancelledOrderCodes.has(t.orderCode))) return false;
      if (t.id && t.id.startsWith('tx-ord-')) {
        const isMatched = Array.from(validActiveOrderIds).some(id => id && t.id.includes(id));
        if (!isMatched) return false;
      }
      if (t.id && Array.from(cancelledOrderIds).some(id => id && t.id.includes(id))) return false;
      if (t.description && Array.from(cancelledOrderCodes).some(code => code && t.description.includes(code))) return false;
      return true;
    });
    standaloneSalesTxs.forEach(t => {
      const isDelivery = t.channel === 'delivery' || t.deliveryType === 'entrega';
      const pm = normalizeCashPaymentMethod(t.paymentMethod);
      const mName = formatMachineName(t.cardProvider, t.machineModel);

      if (pm !== 'dinheiro') {
        const mLabel = mName || 'Sem Maquininha Especificada';
        combinedMachineTotals[mLabel] = (combinedMachineTotals[mLabel] || 0) + t.amount;
      }

      if (isDelivery) {
        deliveryTxs.push(t);
        deliverySalesTotal += t.amount;
        if (t.orderId) deliveryOrderIds.add(t.orderId);
        if (pm === 'dinheiro') deliveryCash += t.amount;
        else if (pm === 'debito') deliveryDebito += t.amount;
        else if (pm === 'credito') deliveryCredito += t.amount;
        else if (pm === 'pix') deliveryPix += t.amount;
        else if (pm === 'vr') deliveryVr += t.amount;
        else deliveryDebito += t.amount;

        if (pm !== 'dinheiro') {
          const mLabel = mName || 'Sem Maquininha Especificada';
          deliveryMachineTotals[mLabel] = (deliveryMachineTotals[mLabel] || 0) + t.amount;
        }
      } else {
        counterTxs.push(t);
        counterSalesTotal += t.amount;
        if (t.orderId) counterOrderIds.add(t.orderId);
        if (pm === 'dinheiro') counterCash += t.amount;
        else if (pm === 'debito') counterDebito += t.amount;
        else if (pm === 'credito') counterCredito += t.amount;
        else if (pm === 'pix') counterPix += t.amount;
        else if (pm === 'vr') counterVr += t.amount;
        else counterDebito += t.amount;

        if (pm !== 'dinheiro') {
          const mLabel = mName || 'Sem Maquininha Especificada';
          counterMachineTotals[mLabel] = (counterMachineTotals[mLabel] || 0) + t.amount;
        }
      }
    });

    let counterDiscounts = 0;
    let deliveryDiscounts = 0;
    let deliveryFeesTotal = 0;

    sessionOrders.forEach(o => {
      const isDel = o.deliveryType === 'entrega';
      const disc = Number(o.discountAmount) || 0;
      if (isDel) {
        deliveryDiscounts += disc;
        deliveryFeesTotal += Number(o.deliveryFee) || 0;
      } else {
        counterDiscounts += disc;
      }
    });

    const counterSalesCount = counterOrderIds.size;
    const deliverySalesCount = deliveryOrderIds.size;
    const totalOrdersCount = counterSalesCount + deliverySalesCount;

    const totalTurnover = counterSalesTotal + deliverySalesTotal;
    const cashSales = counterCash + deliveryCash;
    const debitoSales = counterDebito + deliveryDebito;
    const creditoSales = counterCredito + deliveryCredito;
    const pixSales = counterPix + deliveryPix;
    const vrSales = counterVr + deliveryVr;

    const expectedCashInDrawer = session.expectedCashInDrawer ?? (initial + cashSales + suprimentos - sangrias);
    const actualCashInDrawer = session.actualCashInDrawer ?? 0;
    const cashDifference = session.cashDifference ?? (actualCashInDrawer - expectedCashInDrawer);

    return {
      initial,
      counterSalesTotal,
      counterSalesCount,
      counterTxs,
      counterCash,
      counterDebito,
      counterCredito,
      counterPix,
      counterVr,
      counterMachineTotals,
      counterDiscounts,
      deliverySalesTotal,
      deliverySalesCount,
      deliveryTxs,
      deliveryCash,
      deliveryDebito,
      deliveryCredito,
      deliveryPix,
      deliveryVr,
      deliveryFeesTotal,
      deliveryMachineTotals,
      deliveryDiscounts,
      totalTurnover,
      totalOrdersCount,
      totalSalesTxsCount: counterTxs.length + deliveryTxs.length,
      cashSales,
      debitoSales,
      creditoSales,
      pixSales,
      vrSales,
      machineTotals: combinedMachineTotals,
      totalDiscounts: counterDiscounts + deliveryDiscounts,
      totalDeliveryFees: deliveryFeesTotal,
      suprimentos,
      sangrias,
      expectedCashInDrawer,
      actualCashInDrawer,
      cashDifference
    };
  };

  // Helper calculation for Cash Register (Active Session)
  const registerTotals = getCashSessionMetrics(cashRegister, orders);

  // Open Register Handler
  const handleOpenRegister = async () => {
    const num = parseFloat(openInitialCash.replace(',', '.'));
    if (isNaN(num) || num < 0) {
      showToast('Informe um valor válido para o fundo de caixa.', 'alert');
      return;
    }

    try {
      const res = await fetch('/api/cash-register/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialCash: num,
          openedBy: openOperatorName || user.name || user.username,
          notes: openNotes
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCashRegister(data.session);
        setShowOpenRegisterModal(false);
        showToast(`Caixa aberto com Fundo de R$ ${num.toFixed(2)}!`, 'success');
        printThermalOpeningReceipt(data.session);
      } else {
        showToast(data.error || 'Erro ao abrir caixa.', 'alert');
      }
    } catch (err) {
      showToast('Erro de conexão ao abrir o caixa.', 'alert');
    }
  };

  // Thermal Printer Print Handler - Abertura de Caixa
  const printThermalOpeningReceipt = (session: CashRegisterSession) => {
    if (!session) return;

    const openedDate = session.openedAt ? new Date(session.openedAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      showToast('Permita popups no navegador para imprimir o recibo de abertura.', 'alert');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo de Abertura de Caixa</title>
        <meta charset="utf-8" />
        <style>
          * { font-weight: bold !important; }
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace, sans-serif;
            width: 72mm;
            margin: 0 auto;
            padding: 8px 4px;
            font-size: 11px;
            color: #000;
            line-height: 1.25;
            font-weight: bold !important;
          }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .dashed { border-bottom: 1px dashed #000; margin: 6px 0; }
          .double-line { border-bottom: 2px double #000; margin: 6px 0; }
          .header-title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
          .tag-non-fiscal { font-size: 10px; font-weight: bold; border: 1px solid #000; padding: 2px 4px; display: inline-block; margin-top: 3px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="header-title">Sabor que marca. Experiência que fica.</div>
          <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">RECIBO DE ABERTURA DE CAIXA</div>
          <div class="tag-non-fiscal">DOCUMENTO NÃO FISCAL</div>
        </div>

        <div class="dashed"></div>

        <div style="font-size: 11px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Data/Hora Abertura:</span>
            <span class="font-bold">${openedDate}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span>Operador Abertura:</span>
            <span class="font-bold">${session.openedBy || 'Operador'}</span>
          </div>
        </div>

        <div class="dashed"></div>

        <div style="margin: 8px 0; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>FUNDO DE CAIXA INICIAL:</span>
            <span>R$ ${session.initialCash.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        ${session.notes ? `
          <div class="dashed"></div>
          <div style="font-size: 10px;">
            <span class="font-bold">Obs:</span> ${session.notes}
          </div>
        ` : ''}

        <div class="double-line"></div>

        <div class="text-center font-bold" style="font-size: 10px; margin-top: 6px;">
          *** CAIXA ABERTO E OPERACIONAL ***
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

  // Thermal Printer Print Handler - Fechamento / Pré-Caixa
  const printThermalClosingReport = (session: CashRegisterSession, isPreCaixa = false) => {
    if (!session) return;

    const m = getCashSessionMetrics(session, orders);

    const openedDate = session.openedAt ? formatDateTimeBrasilia(session.openedAt) : '-';
    const closedDate = session.closedAt ? formatDateTimeBrasilia(session.closedAt) : formatDateTimeBrasilia(new Date());

    // Build Balcão List HTML
    let counterDetailsHtml = '';
    if (m.counterTxs.length === 0) {
      counterDetailsHtml = `<div style="font-style: italic; color: #555; text-align: center; margin: 3px 0; font-size: 9px;">Nenhuma venda de balcão registrada</div>`;
    } else {
      counterDetailsHtml = m.counterTxs.map(t => {
        const pm = (t.paymentMethod || 'debito').toUpperCase();
        const mName = formatMachineName(t.cardProvider, t.machineModel);
        const timeStr = formatTimeBrasilia(t.timestamp);
        const amtStr = t.amount.toFixed(2).replace('.', ',');
        const mStr = mName ? ` [${mName}]` : '';

        const matchedOrder = orders.find(o => o.id === t.orderId || (t.orderCode && o.code === t.orderCode) || (t.id && o.id && t.id.includes(o.id)));
        const feeVal = t.deliveryFee !== undefined && Number(t.deliveryFee) > 0 
          ? Number(t.deliveryFee) 
          : (matchedOrder?.deliveryFee !== undefined && Number(matchedOrder.deliveryFee) > 0 ? Number(matchedOrder.deliveryFee) : 0);
        const feeStr = feeVal > 0 ? ` | Frete: R$ ${feeVal.toFixed(2).replace('.', ',')}` : '';

        return `
          <div style="margin-bottom: 3px; font-size: 10px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>${t.description || 'Venda Balcão'} (${timeStr})</span>
              <span>R$ ${amtStr}</span>
            </div>
            <div style="color: #000; font-size: 9.5px; font-weight: bold;">Pgto: ${pm}${mStr}${feeStr}</div>
          </div>
        `;
      }).join('');
    }

    // Build Delivery List HTML
    let deliveryDetailsHtml = '';
    if (m.deliveryTxs.length === 0) {
      deliveryDetailsHtml = `<div style="font-style: italic; color: #555; text-align: center; margin: 3px 0; font-size: 9px;">Nenhuma venda de delivery registrada</div>`;
    } else {
      deliveryDetailsHtml = m.deliveryTxs.map(t => {
        const pm = (t.paymentMethod || 'debito').toUpperCase();
        const mName = formatMachineName(t.cardProvider, t.machineModel);
        const timeStr = formatTimeBrasilia(t.timestamp);
        const amtStr = t.amount.toFixed(2).replace('.', ',');
        const mStr = mName ? ` [${mName}]` : '';

        // Find delivery fee
        const matchedOrder = orders.find(o => o.id === t.orderId || (t.orderCode && o.code === t.orderCode) || (t.id && o.id && t.id.includes(o.id)));
        const feeVal = t.deliveryFee !== undefined && Number(t.deliveryFee) > 0 
          ? Number(t.deliveryFee) 
          : (matchedOrder?.deliveryFee !== undefined ? Number(matchedOrder.deliveryFee) : 0);
        const feeStr = feeVal > 0 ? ` | Frete: R$ ${feeVal.toFixed(2).replace('.', ',')}` : '';

        return `
          <div style="margin-bottom: 3px; font-size: 10px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>${t.description || 'Pedido Delivery'} (${timeStr})</span>
              <span>R$ ${amtStr}</span>
            </div>
            <div style="color: #000; font-size: 9.5px; font-weight: bold;">Pgto: ${pm}${mStr}${feeStr}</div>
          </div>
        `;
      }).join('');
    }

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      showToast('Permita popups no navegador para imprimir o relatório térmico.', 'alert');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${isPreCaixa ? 'Comprovante Pré-Caixa (Conferência)' : 'Comprovante Fechamento de Caixa'}</title>
        <meta charset="utf-8" />
        <style>
          * { font-weight: bold !important; }
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace, sans-serif;
            width: 72mm;
            margin: 0 auto;
            padding: 8px 4px;
            font-size: 11px;
            color: #000;
            line-height: 1.25;
            font-weight: bold !important;
          }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .dashed { border-bottom: 1px dashed #000; margin: 6px 0; }
          .double-line { border-bottom: 2px double #000; margin: 6px 0; }
          .header-title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
          .tag-non-fiscal { font-size: 10px; font-weight: bold; border: 1px solid #000; padding: 2px 4px; display: inline-block; margin-top: 3px; }
          .sec-title { font-weight: bold; text-transform: uppercase; font-size: 11px; margin-bottom: 3px; }
          .channel-box { border: 1px solid #000; padding: 4px 6px; margin: 4px 0; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="header-title">BAGÔ - Submarine & Eats</div>
          <div style="font-size: 13px; font-weight: 900; margin-top: 2px;">${isPreCaixa ? 'PRÉ-CAIXA' : 'FECHAMENTO DE CAIXA - RELATÓRIO'}</div>
          ${isPreCaixa ? '<div style="font-size: 10px; font-weight: bold;">(CONFERÊNCIA DE TURNO PARCIAL)</div>' : ''}
          <div class="tag-non-fiscal">${isPreCaixa ? 'DOCUMENTO NÃO FISCAL - PRÉ-CAIXA' : 'DOCUMENTO NÃO FISCAL'}</div>
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
          <div style="color: #333; font-size: 9px;">
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
            ${m.totalDiscounts > 0 ? `<div style="display: flex; justify-content: space-between; color: #555;"><span>Descontos (Cupons):</span> <span>- R$ ${m.totalDiscounts.toFixed(2).replace('.', ',')}</span></div>` : ''}
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

        <div class="sec-title">5. MOVIMENTAÇÕES E CONFERÊNCIA DA GAVETA</div>
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
            <span>${isPreCaixa ? 'Data/Hora Prévia:' : 'Fechamento:'}</span> <span>${isPreCaixa ? new Date().toLocaleString('pt-BR') : closedDate}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>${isPreCaixa ? 'Operador Caixa:' : 'Op. Fechamento:'}</span> <span>${isPreCaixa ? (user?.name || user?.username || 'Operador') : (session.closedBy || 'Operador')}</span>
          </div>
          ${session.notes ? `<div style="margin-top: 3px;"><b>Obs:</b> ${session.notes}</div>` : ''}
        </div>

        <div class="double-line"></div>

        <div class="text-center font-bold" style="font-size: 10px; margin-top: 6px;">
          ${isPreCaixa ? '*** PRÉ-CAIXA / TURNO EM ANDAMENTO ***<br/><span style="font-size: 8px; font-weight: normal;">DOCUMENTO NÃO FISCAL DE CONFERÊNCIA PARCIAL</span>' : '*** FECHAMENTO CONCLUÍDO ***'}
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

  // PDF / A4 Printable Closure / Pre-Caixa Report Handler
  const printPdfClosingReport = (session: CashRegisterSession, isPreCaixa = false) => {
    if (!session) return;

    const m = getCashSessionMetrics(session, orders);

    const openedDate = session.openedAt ? new Date(session.openedAt).toLocaleString('pt-BR') : '-';
    const closedDate = session.closedAt ? new Date(session.closedAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');

    // Counter rows
    const counterRowsHtml = m.counterTxs.map((t, idx) => {
      const pm = (t.paymentMethod || 'debito').toUpperCase();
      const mName = formatMachineName(t.cardProvider, t.machineModel);
      const timeStr = formatTimeBrasilia(t.timestamp);
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 7px; text-align: center; font-weight: bold; font-size: 11px;">${idx + 1}</td>
          <td style="padding: 7px; font-weight: 700; font-size: 11px;">${t.description || 'Venda Balcão'}</td>
          <td style="padding: 7px; text-align: center; font-size: 11px;">${timeStr}</td>
          <td style="padding: 7px; text-align: center; font-weight: bold; font-size: 11px;">
            ${pm}
            ${mName ? `<br/><span style="font-size: 9px; color: #059669; font-weight: 800;">📟 ${mName}</span>` : ''}
          </td>
          <td style="padding: 7px; text-align: right; font-weight: 800; color: #0f172a; font-size: 11px;">R$ ${t.amount.toFixed(2).replace('.', ',')}</td>
        </tr>
      `;
    }).join('');

    // Delivery rows
    const deliveryRowsHtml = m.deliveryTxs.map((t, idx) => {
      const pm = (t.paymentMethod || 'debito').toUpperCase();
      const mName = formatMachineName(t.cardProvider, t.machineModel);
      const timeStr = formatTimeBrasilia(t.timestamp);
      const matchedOrder = orders.find(o => o.id === t.orderId || (t.orderCode && o.code === t.orderCode) || (t.id && o.id && t.id.includes(o.id)));
      const feeVal = t.deliveryFee !== undefined ? Number(t.deliveryFee) : (matchedOrder?.deliveryType === 'entrega' ? (Number(matchedOrder.deliveryFee) || 0) : 0);
      const feeStr = feeVal > 0 ? `<br/><span style="font-size: 9px; color: #b45309; font-weight: 800;">🛵 Frete: R$ ${feeVal.toFixed(2).replace('.', ',')}</span>` : '';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 7px; text-align: center; font-weight: bold; font-size: 11px;">${idx + 1}</td>
          <td style="padding: 7px; font-weight: 700; font-size: 11px;">${t.description || 'Pedido Delivery'}</td>
          <td style="padding: 7px; text-align: center; font-size: 11px;">${timeStr}</td>
          <td style="padding: 7px; text-align: center; font-weight: bold; font-size: 11px;">
            ${pm}
            ${mName ? `<br/><span style="font-size: 9px; color: #059669; font-weight: 800;">📟 ${mName}</span>` : ''}
            ${feeStr}
          </td>
          <td style="padding: 7px; text-align: right; font-weight: 800; color: #0f172a; font-size: 11px;">R$ ${t.amount.toFixed(2).replace('.', ',')}</td>
        </tr>
      `;
    }).join('');

    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (!printWindow) {
      showToast('Permita popups no navegador para visualizar/gerar o PDF.', 'alert');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${isPreCaixa ? 'Relatório de Pré-Caixa (Conferência) - BAGÔ' : 'Relatório de Fechamento de Caixa - BAGÔ'}</title>
        <meta charset="utf-8" />
        <style>
          * { font-weight: bold !important; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 840px; margin: 0 auto; line-height: 1.35; font-weight: bold !important; }
          .no-print { margin-bottom: 18px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; gap: 10px; align-items: center; justify-content: space-between; }
          .btn-print { background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
          .btn-print:hover { background: #047857; }
          .header { border-bottom: 2px solid #059669; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .brand-title { font-size: 20px; font-weight: 900; color: #059669; letter-spacing: -0.5px; }
          .brand-sub { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .section-head { font-size: 12px; font-weight: 800; color: #047857; text-transform: uppercase; margin-top: 18px; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
          .box-highlight-balcao { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px; }
          .box-highlight-delivery { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px; }
          .box-highlight-total { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px; }
          .box-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
          .box-value { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 3px; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
          th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; }
          .total-bar { background: #0f172a; color: white; padding: 12px 16px; border-radius: 12px; margin-top: 18px; display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 900; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <div>
            <span style="font-weight: bold; font-size: 13px;">${isPreCaixa ? 'Pré-Visualização do Caixa (PRÉ-CAIXA)' : 'Relatório de Fechamento de Caixa'}</span>
            <div style="font-size: 11px; color: #64748b;">${isPreCaixa ? 'Valores acumulados no turno até o momento (Balcão e Delivery separados).' : 'Valores de Atendimento Balcão e Delivery devidamente separados.'}</div>
          </div>
          <button class="btn-print" onclick="window.print()">
            🖨️ Imprimir ou Salvar em PDF
          </button>
        </div>

        <div class="header">
          <div>
            <div class="brand-title">BAGÔ - Submarine & Eats</div>
            <div class="brand-sub">${isPreCaixa ? 'PRÉ-CAIXA - RELATÓRIO PARCIAL (TURNO EM ANDAMENTO)' : 'Relatório de Fechamento de Caixa (Turno)'}</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #334155;">
            <div><b>Abertura:</b> ${openedDate}</div>
            <div><b>${isPreCaixa ? 'Emissão Pré-Caixa' : 'Fechamento'}:</b> ${isPreCaixa ? new Date().toLocaleString('pt-BR') : closedDate}</div>
          </div>
        </div>

        ${isPreCaixa ? `
        <div style="background: #fef3c7; border: 1.5px dashed #f59e0b; padding: 8px 12px; border-radius: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; font-size: 11px; color: #92400e;">⚠️ DOCUMENTO NÃO FISCAL - PRÉ-CAIXA / CONFERÊNCIA PARCIAL</span>
          <span style="font-weight: 800; font-size: 11px; color: #b45309; background: #fff; padding: 2px 8px; border-radius: 4px; border: 1px solid #fde68a;">STATUS: CAIXA ABERTO</span>
        </div>
        ` : ''}

        <div class="section-head">1. Fluxo de Abertura e Responsáveis</div>
        <div class="grid-4">
          <div class="box">
            <div class="box-label">Operador Abertura</div>
            <div class="box-value">${session.openedBy || 'Operador'}</div>
          </div>
          <div class="box">
            <div class="box-label">${isPreCaixa ? 'Operador Atual' : 'Operador Fechamento'}</div>
            <div class="box-value">${isPreCaixa ? (user?.name || user?.username || 'Operador') : (session.closedBy || 'Operador')}</div>
          </div>
          <div class="box">
            <div class="box-label">Fundo Inicial</div>
            <div class="box-value" style="color: #059669;">R$ ${m.initial.toFixed(2).replace('.', ',')}</div>
          </div>
          <div class="box">
            <div class="box-label">Total de Pedidos</div>
            <div class="box-value">${m.totalOrdersCount} pedidos</div>
          </div>
        </div>

        <div class="section-head">2. Resumo Comparativo dos Canais de Venda</div>
        <div class="grid-3">
          <div class="box-highlight-balcao">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="box-label" style="color: #1d4ed8;">🏪 Atendimento Balcão</span>
              <span style="font-size: 10px; background: #dbeafe; color: #1e40af; padding: 1px 6px; border-radius: 4px; font-weight: 800;">${m.counterSalesCount} pedidos</span>
            </div>
            <div class="box-value" style="color: #1e3a8a; font-size: 18px;">R$ ${m.counterSalesTotal.toFixed(2).replace('.', ',')}</div>
            <div style="font-size: 9px; color: #475569; margin-top: 6px; border-top: 1px solid #bfdbfe; padding-top: 4px;">
              <div>Dinheiro: R$ ${m.counterCash.toFixed(2).replace('.', ',')} | PIX: R$ ${m.counterPix.toFixed(2).replace('.', ',')}</div>
              <div>Débito: R$ ${m.counterDebito.toFixed(2).replace('.', ',')} | Crédito: R$ ${m.counterCredito.toFixed(2).replace('.', ',')}</div>
            </div>
          </div>

          <div class="box-highlight-delivery">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="box-label" style="color: #b45309;">🛵 Delivery / Entregas</span>
              <span style="font-size: 10px; background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 4px; font-weight: 800;">${m.deliverySalesCount} pedidos</span>
            </div>
            <div class="box-value" style="color: #78350f; font-size: 18px;">R$ ${m.deliverySalesTotal.toFixed(2).replace('.', ',')}</div>
            <div style="font-size: 9px; color: #475569; margin-top: 6px; border-top: 1px solid #fde68a; padding-top: 4px;">
              <div>Dinheiro: R$ ${m.deliveryCash.toFixed(2).replace('.', ',')} | PIX: R$ ${m.deliveryPix.toFixed(2).replace('.', ',')}</div>
              <div>Débito: R$ ${m.deliveryDebito.toFixed(2).replace('.', ',')} | Crédito: R$ ${m.deliveryCredito.toFixed(2).replace('.', ',')}</div>
              ${m.deliveryFeesTotal > 0 ? `<div>Taxas Entrega Inclusas: R$ ${m.deliveryFeesTotal.toFixed(2).replace('.', ',')}</div>` : ''}
            </div>
          </div>

          <div class="box-highlight-total">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="box-label" style="color: #047857;">💰 Total Faturado</span>
              <span style="font-size: 10px; background: #d1fae5; color: #065f46; padding: 1px 6px; border-radius: 4px; font-weight: 800;">Consolidado</span>
            </div>
            <div class="box-value" style="color: #064e3b; font-size: 18px;">R$ ${m.totalTurnover.toFixed(2).replace('.', ',')}</div>
            <div style="font-size: 9px; color: #475569; margin-top: 6px; border-top: 1px solid #a7f3d0; padding-top: 4px;">
              <div>Total de Pedidos no Turno: ${m.totalOrdersCount}</div>
              <div>Ticket Médio: R$ ${m.totalOrdersCount > 0 ? (m.totalTurnover / m.totalOrdersCount).toFixed(2).replace('.', ',') : '0,00'}</div>
            </div>
          </div>
        </div>

        <div class="section-head">
          <span>3. Detalhamento de Vendas - Atendimento Balcão / PDV</span>
          <span style="font-size: 11px; color: #1e40af;">Total: R$ ${m.counterSalesTotal.toFixed(2).replace('.', ',')}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 35px;">#</th>
              <th>Pedido / Descrição</th>
              <th style="text-align: center; width: 70px;">Horário</th>
              <th style="text-align: center; width: 140px;">Forma Pgto / Maquininha</th>
              <th style="text-align: right; width: 90px;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${counterRowsHtml || '<tr><td colspan="5" style="text-align:center; padding: 12px; color: #94a3b8;">Nenhum pedido de balcão registrado.</td></tr>'}
          </tbody>
        </table>

        <div class="section-head">
          <span>4. Detalhamento de Vendas - Delivery / Entregas</span>
          <span style="font-size: 11px; color: #92400e;">Total: R$ ${m.deliverySalesTotal.toFixed(2).replace('.', ',')}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 35px;">#</th>
              <th>Pedido / Descrição</th>
              <th style="text-align: center; width: 70px;">Horário</th>
              <th style="text-align: center; width: 140px;">Forma Pgto / Maquininha</th>
              <th style="text-align: right; width: 90px;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${deliveryRowsHtml || '<tr><td colspan="5" style="text-align:center; padding: 12px; color: #94a3b8;">Nenhum pedido de delivery registrado.</td></tr>'}
          </tbody>
        </table>

        <div class="section-head">5. Resumo Consolidado por Forma de Pagamento</div>
        <table>
          <thead>
            <tr>
              <th>Forma de Pagamento</th>
              <th style="text-align: right;">Balcão (R$)</th>
              <th style="text-align: right;">Delivery (R$)</th>
              <th style="text-align: right;">Total Geral (R$)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 8px; font-weight: 700;">💵 Dinheiro em Espécie</td>
              <td style="padding: 6px 8px; text-align: right;">R$ ${m.counterCash.toFixed(2).replace('.', ',')}</td>
              <td style="padding: 6px 8px; text-align: right;">R$ ${m.deliveryCash.toFixed(2).replace('.', ',')}</td>
              <td style="padding: 6px 8px; text-align: right; font-weight: 900; color: #0f172a;">R$ ${m.cashSales.toFixed(2).replace('.', ',')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 8px; font-weight: 700;">💳 Cartão de Débito</td>
              <td style="padding: 6px 8px; text-align: right;">R$ ${m.counterDebito.toFixed(2).replace('.', ',')}</td>
              <td style="padding: 6px 8px; text-align: right;">R$ ${m.deliveryDebito.toFixed(2).replace('.', ',')}</td>
              <td style="padding: 6px 8px; text-align: right; font-weight: 900; color: #0f172a;">R$ ${m.debitoSales.toFixed(2).replace('.', ',')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 8px; font-weight: 700;">💳 Cartão de Crédito</td>
              <td style="padding: 6px 8px; text-align: right;">R$ ${m.counterCredito.toFixed(2).replace('.', ',')}</td>
              <td style="padding: 6px 8px; text-align: right;">R$ ${m.deliveryCredito.toFixed(2).replace('.', ',')}</td>
              <td style="padding: 6px 8px; text-align: right; font-weight: 900; color: #0f172a;">R$ ${m.creditoSales.toFixed(2).replace('.', ',')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 8px; font-weight: 700;">📱 PIX</td>
              <td style="padding: 6px 8px; text-align: right;">R$ ${m.counterPix.toFixed(2).replace('.', ',')}</td>
              <td style="padding: 6px 8px; text-align: right;">R$ ${m.deliveryPix.toFixed(2).replace('.', ',')}</td>
              <td style="padding: 6px 8px; text-align: right; font-weight: 900; color: #0f172a;">R$ ${m.pixSales.toFixed(2).replace('.', ',')}</td>
            </tr>
            ${m.vrSales > 0 ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 8px; font-weight: 700;">🎟️ Vale Refeição (VR)</td>
              <td style="padding: 6px 8px; text-align: right;">R$ ${m.counterVr.toFixed(2).replace('.', ',')}</td>
              <td style="padding: 6px 8px; text-align: right;">R$ ${m.deliveryVr.toFixed(2).replace('.', ',')}</td>
              <td style="padding: 6px 8px; text-align: right; font-weight: 900; color: #0f172a;">R$ ${m.vrSales.toFixed(2).replace('.', ',')}</td>
            </tr>` : ''}
          </tbody>
        </table>

        ${Object.keys(m.machineTotals).length > 0 ? `
        <div class="section-head">5.1 Faturamento por Maquininha / Operadora</div>
        <div class="grid-4">
          ${Object.entries(m.machineTotals).map(([mach, amt]) => `
            <div class="box">
              <div class="box-label">${mach}</div>
              <div class="box-value" style="color: #059669; font-size: 13px;">R$ ${amt.toFixed(2).replace('.', ',')}</div>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="section-head">6. Movimentações de Gaveta & Conferência de Caixa</div>
        <div class="grid-4">
          <div class="box">
            <div class="box-label">Suprimentos (+)</div>
            <div class="box-value" style="color: #059669;">+ R$ ${m.suprimentos.toFixed(2).replace('.', ',')}</div>
          </div>
          <div class="box">
            <div class="box-label">Sangrias (-)</div>
            <div class="box-value" style="color: #d97706;">- R$ ${m.sangrias.toFixed(2).replace('.', ',')}</div>
          </div>
          <div class="box">
            <div class="box-label">Dinheiro Esperado</div>
            <div class="box-value">R$ ${m.expectedCashInDrawer.toFixed(2).replace('.', ',')}</div>
          </div>
          <div class="box">
            <div class="box-label">Dinheiro Contado</div>
            <div class="box-value">R$ ${m.actualCashInDrawer.toFixed(2).replace('.', ',')}</div>
          </div>
        </div>

        <div style="margin-top: 8px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; justify-content: space-between; font-weight: bold; font-size: 12px;">
          <span>Diferença / Quebra de Caixa:</span>
          <span style="color: ${m.cashDifference < 0 ? '#dc2626' : '#059669'}; font-weight: 800;">R$ ${m.cashDifference.toFixed(2).replace('.', ',')}</span>
        </div>

        ${session.notes ? `
        <div style="margin-top: 10px; font-size: 11px; color: #475569; font-style: italic; background: #f1f5f9; padding: 8px 12px; border-radius: 6px;">
          <b>Observações de Fechamento:</b> ${session.notes}
        </div>` : ''}

        <div class="total-bar">
          <span>FATURAMENTO TOTAL DO TURNO:</span>
          <span style="color: #34d399; font-size: 18px;">R$ ${m.totalTurnover.toFixed(2).replace('.', ',')}</span>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  // Movement (Suprimento / Sangria) Handler
  const handleRecordMovement = async () => {
    const num = parseFloat(movementAmount.replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      showToast('Informe um valor válido para a movimentação.', 'alert');
      return;
    }

    try {
      const res = await fetch('/api/cash-register/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: movementType,
          amount: num,
          description: movementDescription
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCashRegister(data.session);
        setShowMovementModal(false);
        setMovementAmount('');
        setMovementDescription('');
        showToast(`${movementType === 'suprimento' ? 'Suprimento' : 'Sangria'} de R$ ${num.toFixed(2)} registrado!`, 'success');
      } else {
        showToast(data.error || 'Erro ao registrar movimentação.', 'alert');
      }
    } catch (err) {
      showToast('Erro de conexão ao registrar movimentação.', 'alert');
    }
  };

  // Close Register Handler
  const handleCloseRegister = async () => {
    const actual = parseFloat(closeActualCash.replace(',', '.'));
    if (isNaN(actual) || actual < 0) {
      showToast('Informe o valor contado na gaveta.', 'alert');
      return;
    }

    try {
      const res = await fetch('/api/cash-register/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualCashInDrawer: actual,
          closedBy: user.name || user.username,
          notes: closeNotes
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCashRegister(null);
        setClosedReportSession(data.closedSession);
        setShowCloseRegisterModal(false);
        setCloseActualCash('');
        setCloseNotes('');
        showToast('Caixa fechado com sucesso!', 'success');
      } else {
        showToast(data.error || 'Erro ao fechar o caixa.', 'alert');
      }
    } catch (err) {
      showToast('Erro de conexão ao fechar o caixa.', 'alert');
    }
  };

  // Combine readyProducts and ingredients into available products for POS
  const availableProducts = React.useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      category: string;
      image?: string;
      stock?: number;
      unit?: string;
    }> = [];

    // Add ready products
    readyProducts.forEach(rp => {
      list.push({
        id: rp.id,
        name: rp.name,
        description: rp.description || 'Produto Pronto',
        price: rp.price,
        category: rp.category,
        image: rp.image
      });
    });

    // Add ingredients from stock/inventory (except 'queijo-nenhum' and kitchen category items)
    ingredients.forEach(ing => {
      if (ing.id === 'queijo-nenhum' || ing.category === 'kitchen') return;

      // Skip duplicate if already added by exact ID or name+category
      if (list.some(item => item.id === ing.id || (item.name.toLowerCase() === ing.name.toLowerCase() && item.category === ing.category))) return;

      const categoryLabelMap: Record<string, string> = {
        bread: 'Pão',
        protein: 'Proteína',
        cheese: 'Queijo',
        vegetable: 'Salada',
        sauce: 'Molho',
        extra: 'Adicional',
        drink_cookie: 'Bebida',
        juice: 'Suco',
        vitamin: 'Vitamina',
        smoothie: 'Smoothie'
      };

      const categoryLabel = categoryLabelMap[ing.category] || 'Insumo de Estoque';
      const desc = `Estoque: ${ing.stock} ${ing.unit || 'un.'} | ${categoryLabel}`;

      list.push({
        id: ing.id,
        name: ing.name,
        description: desc,
        price: ing.price,
        category: ing.category,
        image: ing.image,
        stock: ing.stock,
        unit: ing.unit
      });
    });

    return list;
  }, [readyProducts, ingredients]);

  // Helper to check if a product belongs to a category
  const isProductInCategory = React.useCallback((p: { id: string; name: string; category: string }, catId: string) => {
    if (catId === 'all') return true;
    const nameLower = p.name.toLowerCase();
    const isDessertItem = p.category === 'dessert' || p.category === 'sobremesa' || p.category === 'cookie' || nameLower.includes('cookie') || nameLower.includes('brownie') || nameLower.includes('brookie') || nameLower.includes('mousse') || nameLower.includes('cheesecake') || nameLower.includes('pudim') || nameLower.includes('salada de frutas');
    const isShakeItem = nameLower.includes('shake');

    if (catId === 'sandwich') {
      // ONLY actual sandwiches/lanches
      return (p.category === 'sandwich' || (readyProducts.some(rp => rp.id === p.id && rp.category === 'sandwich'))) && !nameLower.includes('shake') && !nameLower.includes('salada');
    } else if (catId === 'salad') {
      return p.category === 'salad' || p.category === 'vegetable';
    } else if (catId === 'drink') {
      return p.category === 'drink' || (p.category === 'drink_cookie' && !isDessertItem && !nameLower.includes('suco') && !nameLower.includes('vitamina') && !nameLower.includes('smoothie') && !isShakeItem);
    } else if (catId === 'juice') {
      return p.category === 'juice' || p.id.startsWith('suc-') || nameLower.includes('suco');
    } else if (catId === 'vitamin') {
      return p.category === 'vitamin' || p.id.startsWith('vit-') || nameLower.includes('vitamina');
    } else if (catId === 'smoothie') {
      return p.category === 'smoothie' || p.id.startsWith('smoothie-') || nameLower.includes('smoothie') || isShakeItem;
    } else if (catId === 'dessert') {
      return isDessertItem;
    } else if (catId === 'protein') {
      return p.category === 'protein';
    } else if (catId === 'cheese') {
      return p.category === 'cheese';
    } else if (catId === 'sauce') {
      return p.category === 'sauce';
    } else if (catId === 'extra') {
      return (p.category === 'extra' || p.category === 'addon' || p.category === 'bread' || p.category === 'other') && !isDessertItem && !isShakeItem;
    }
    return p.category === catId;
  }, [readyProducts]);

  // Filter products by category & search
  const filteredProducts = availableProducts.filter(p => {
    const matchesCategory = isProductInCategory(p, selectedCategory);
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate totals
  const deliveryFeeNum = deliveryType === 'entrega'
    ? (parseFloat((deliveryFeeInput || '0').replace(',', '.')) || 0)
    : 0;
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalAmount = Math.max(0, cartSubtotal + deliveryFeeNum - posDiscountAmount);

  // Cash calculations
  const numericCashReceived = parseFloat(cashReceived.replace(',', '.')) || 0;
  const changeAmount = paymentMethod === 'dinheiro' && numericCashReceived > totalAmount 
    ? numericCashReceived - totalAmount 
    : 0;

  // Cart operations
  const addDirectToCart = (product: { id: string; name: string; price: number; category: string; image?: string }) => {
    if (isLancheProduct(product)) {
      handleOpenBreadSelection(product);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && !item.sandwichConfig && !item.sandwich);
      if (existing) {
        return prev.map(item => (item.id === product.id && !item.sandwichConfig && !item.sandwich) ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        return [...prev, {
          id: product.id,
          name: product.name,
          productName: product.name,
          price: product.price,
          quantity: 1,
          category: product.category,
          image: product.image
        } as any];
      }
    });
  };

  const addToCart = (product: { id: string; name: string; price: number; category: string; image?: string }) => {
    if (isLancheProduct(product)) {
      handleOpenBreadSelection(product);
      return;
    }

    addDirectToCart(product);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setTableNumber('');
    setDeliveryType('retirada');
    setDeliveryFeeInput('0.00');
    setDeliveryAddress('');
    setPaymentMode('single');
    setPaymentMethod('');
    setCardProvider('');
    setMachineModel('');
    setCashReceived('');
    setPosCouponCode('');
    setAppliedPosCoupon(null);
    setPosDiscountAmount(0);
    setPosCouponFeedback(null);
    setPaymentSplits([
      { id: 'sp-1', method: '', amount: '', cardProvider: '', cashReceived: '' },
      { id: 'sp-2', method: '', amount: '', cardProvider: '', cashReceived: '' }
    ]);
    setEditingPosOrderId(null);
  };

  // Split payment helper methods
  const addSplitLine = () => {
    const currentSum = paymentSplits.reduce((sum, item) => sum + (parseFloat(item.amount.replace(',', '.')) || 0), 0);
    const rem = Math.max(0, totalAmount - currentSum);
    setPaymentSplits(prev => [
      ...prev,
      {
        id: `sp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        method: '',
        amount: rem > 0 ? rem.toFixed(2) : '',
        cardProvider: '',
        cashReceived: ''
      }
    ]);
  };

  const removeSplitLine = (id: string) => {
    if (paymentSplits.length <= 1) {
      showToast('O pedido deve ter ao menos 1 fração de pagamento.', 'alert');
      return;
    }
    setPaymentSplits(prev => prev.filter(item => item.id !== id));
  };

  const updateSplitLine = (id: string, field: keyof SplitItemState, value: string) => {
    setPaymentSplits(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const fillRemainingOnSplitLine = (id: string) => {
    const otherSum = paymentSplits
      .filter(item => item.id !== id)
      .reduce((sum, item) => sum + (parseFloat(item.amount.replace(',', '.')) || 0), 0);
    const rem = Math.max(0, totalAmount - otherSum);
    updateSplitLine(id, 'amount', rem.toFixed(2));
  };

  // Open order edit modal
  const handleOpenEditModal = (order: Order) => {
    setEditingOrder(order);
    setEditName(order.customerName);
    setEditType(order.customerType || 'cliente');
    setEditTable(order.tableNumber || '');
    const isEntrega = order.deliveryType === 'entrega' || (order.deliveryFee !== undefined && Number(order.deliveryFee) > 0);
    setEditDeliveryType(isEntrega ? 'entrega' : 'retirada');
    setEditDeliveryFee(order.deliveryFee !== undefined ? Number(order.deliveryFee).toFixed(2) : (isEntrega ? '5.00' : '0.00'));
    setEditDeliveryAddress(order.deliveryAddress || '');
    setEditPayment(order.paymentMethod as any || 'debito');
    setEditProvider(order.cardProvider || 'stone');
    setEditModel(order.machineModel || '');
    setEditStatus(order.status);
    const mappedItems = (order.items || []).map((item: any) => {
      let pName = item.productName || item.name;
      const sw = item.sandwich || item.sandwichConfig;
      if (!pName || pName === 'null' || pName.trim() === '') {
        if (sw) {
          pName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
        } else {
          pName = 'Item do Pedido';
        }
      }
      return {
        ...item,
        id: item.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productName: pName,
        name: pName,
        sandwich: sw,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1
      };
    });
    setEditItems(mappedItems);
    setEditCashReceived(order.cashReceived ? order.cashReceived.toString() : '');
  };

  // Load order into main POS cart for re-editing
  const handleLoadOrderIntoCart = (order: Order) => {
    const convertedItems: CartItem[] = (order.items || []).map((item: any) => {
      let pName = item.productName || item.name;
      const sw = item.sandwich || item.sandwichConfig;
      if (!pName || pName === 'null' || pName.trim() === '') {
        if (sw) {
          pName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
        } else {
          pName = 'Item do Pedido';
        }
      }
      return {
        id: item.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: pName,
        productName: pName,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        category: 'other',
        sandwichConfig: sw,
        sandwich: sw
      } as any;
    });
    setCart(convertedItems);
    setCustomerName(order.customerName);
    setCustomerType(order.customerType || 'cliente');
    setTableNumber(order.tableNumber || '');
    setMachineModel(order.machineModel || '');

    const isEntrega = order.deliveryType === 'entrega' || (order.deliveryFee !== undefined && Number(order.deliveryFee) > 0);
    setDeliveryType(isEntrega ? 'entrega' : 'retirada');
    setDeliveryFeeInput(order.deliveryFee !== undefined ? Number(order.deliveryFee).toFixed(2) : (isEntrega ? '5.00' : '0.00'));
    setDeliveryAddress(order.deliveryAddress || '');

    if (order.paymentSplits && order.paymentSplits.length > 1) {
      setPaymentMode('split');
      setPaymentSplits(order.paymentSplits.map((sp, i) => ({
        id: `sp-edit-${i}`,
        method: (sp.method as any) || '',
        amount: sp.amount.toString(),
        cardProvider: sp.cardProvider || '',
        cashReceived: sp.cashReceived ? sp.cashReceived.toString() : ''
      })));
      setPaymentMethod('');
      setCardProvider('');
    } else {
      setPaymentMode('single');
      setPaymentMethod((order.paymentMethod as any) || '');
      setCardProvider(order.cardProvider || '');
      setCashReceived(order.cashReceived ? order.cashReceived.toString() : '');
    }

    setEditingPosOrderId(order.id);
    setPosTab('venda');
    showToast(`Pedido #${order.code} de ${order.customerName} carregado no PDV para edição (itens e frete).`, 'info');
  };

  // Save changes from Edit Modal
  const handleSaveModalEdit = async () => {
    if (!editingOrder) return;
    if (!editName.trim()) {
      showToast('Obrigatório: Por favor, informe o Nome para chamada.', 'alert');
      return;
    }
    if (!editTable.trim()) {
      showToast('Obrigatório: Por favor, informe o Nº da comanda.', 'alert');
      return;
    }
    if (editItems.length === 0) {
      showToast('O pedido precisa ter pelo menos um item.', 'alert');
      return;
    }

    setSavingEdit(true);
    const cleanedEditItems = editItems.map((item: any, idx: number) => {
      let pName = item.productName || item.name;
      const sw = item.sandwich || item.sandwichConfig;
      if (!pName || pName === 'null' || pName.trim() === '') {
        if (sw) {
          pName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
        } else {
          pName = 'Item do Pedido';
        }
      }
      return {
        id: `item-edit-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
        productName: pName,
        isReadyProduct: item.isReadyProduct !== undefined ? Boolean(item.isReadyProduct) : !sw,
        sandwich: sw || undefined,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1
      };
    });
    const itemsTotal = cleanedEditItems.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0);
    const feeToApply = editDeliveryType === 'entrega' ? (parseFloat((editDeliveryFee || '0').replace(',', '.')) || 0) : 0;
    const newTotal = Math.max(0, itemsTotal + feeToApply);

    try {
      const res = await fetch(`/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: editName.trim(),
          customerType: editType,
          tableNumber: editTable.trim(),
          deliveryType: editDeliveryType,
          deliveryFee: feeToApply,
          deliveryAddress: editDeliveryType === 'entrega' && editDeliveryAddress.trim() ? editDeliveryAddress.trim() : undefined,
          paymentMethod: editPayment,
          cardProvider: editPayment !== 'dinheiro' ? editProvider : undefined,
          machineModel: editPayment !== 'dinheiro' && editModel.trim() ? editModel.trim() : undefined,
          status: editStatus,
          items: cleanedEditItems,
          totalPrice: newTotal,
          cashReceived: editPayment === 'dinheiro' && editCashReceived ? parseFloat(editCashReceived) : undefined
        })
      });

      const data = await res.json();
      if (res.ok && (data.success || data.order)) {
        const updatedOrder = data.order || { 
          ...editingOrder, 
          customerName: editName, 
          items: editItems, 
          status: editStatus, 
          deliveryType: editDeliveryType,
          deliveryFee: feeToApply,
          deliveryAddress: editDeliveryAddress,
          totalPrice: newTotal 
        };
        if (onOrderUpdated) onOrderUpdated(updatedOrder);
        showToast(`Pedido #${editingOrder.code} atualizado com sucesso!`, 'success');
        setEditingOrder(null);
      } else {
        showToast(data.error || 'Erro ao atualizar pedido.', 'alert');
      }
    } catch (err) {
      console.error('Erro ao salvar edição:', err);
      showToast('Erro ao atualizar pedido.', 'alert');
    } finally {
      setSavingEdit(false);
    }
  };

  // Confirm and execute order deletion with stock reversal
  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setDeletingOrder(true);
    try {
      const res = await fetch(`/api/orders/${orderToDelete.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onOrderDeleted) onOrderDeleted(orderToDelete.id);
        if (editingOrder && editingOrder.id === orderToDelete.id) {
          setEditingOrder(null);
        }
        showToast(data.message || `Pedido #${orderToDelete.code} excluído e itens retornados ao estoque!`, 'success');
        setOrderToDelete(null);
      } else {
        showToast(data.error || 'Erro ao excluir pedido.', 'alert');
      }
    } catch (err) {
      console.error('Erro ao excluir pedido:', err);
      showToast('Erro ao excluir pedido no servidor.', 'alert');
    } finally {
      setDeletingOrder(false);
    }
  };

  // Quick Status update for counter order
  const handleQuickStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        if (onOrderUpdated) onOrderUpdated(updated);
        showToast(`Status do pedido atualizado para ${newStatus}!`, 'success');
      } else {
        showToast('Erro ao atualizar status.', 'alert');
      }
    } catch (err) {
      showToast('Erro ao atualizar status.', 'alert');
    }
  };

  // Preset cash buttons
  const setQuickCash = (amount: number) => {
    setCashReceived(amount.toString());
  };

  // Submit POS Order
  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('Adicione produtos ao carrinho antes de finalizar.', 'alert');
      return;
    }

    // 1. Mandatory Name
    if (!customerName.trim()) {
      showToast('Obrigatório: Por favor, informe o NOME PARA CHAMADA!', 'alert');
      return;
    }

    // 2. Mandatory Comanda Number
    if (!tableNumber.trim()) {
      showToast('Obrigatório: Por favor, informe o Nº DA COMANDA!', 'alert');
      return;
    }

    let finalPaymentMethod: string = '';
    let finalCardProvider: string | undefined = undefined;
    let finalCashReceived: number | undefined = undefined;
    let finalChangeAmount: number | undefined = undefined;
    let finalSplits: PaymentSplit[] = [];

    if (paymentMode === 'single') {
      // 3. Mandatory Payment Method selection
      if (!paymentMethod) {
        showToast('Obrigatório: Por favor, selecione a FORMA DE PAGAMENTO!', 'alert');
        return;
      }

      // 4. Mandatory Card Provider selection if card or VR
      if (['debito', 'credito', 'vr'].includes(paymentMethod)) {
        if (!cardProvider || !cardProvider.trim()) {
          showToast('Obrigatório: Por favor, selecione a MAQUININHA / OPERADORA!', 'alert');
          return;
        }
      }

      if (paymentMethod === 'dinheiro') {
        if (!cashReceived || numericCashReceived < totalAmount) {
          showToast('O valor em dinheiro informado é insuficiente para o total.', 'alert');
          return;
        }
        finalCashReceived = numericCashReceived;
        finalChangeAmount = changeAmount;
      }

      const methodLabelMap: Record<string, string> = {
        debito: 'Débito',
        credito: 'Crédito',
        pix: 'PIX',
        dinheiro: 'Dinheiro',
        vr: 'Vale Refeição'
      };

      finalPaymentMethod = methodLabelMap[paymentMethod] || paymentMethod.toUpperCase();
      finalCardProvider = ['debito', 'credito', 'vr'].includes(paymentMethod) ? cardProvider : undefined;
      finalSplits = [{
        method: paymentMethod,
        amount: totalAmount,
        cardProvider: finalCardProvider,
        machineModel: machineModel.trim() || undefined,
        cashReceived: finalCashReceived,
        changeAmount: finalChangeAmount
      }];
    } else {
      // Split payment mode validation
      if (paymentSplits.length === 0) {
        showToast('Adicione pelo menos uma fração de pagamento para divisão.', 'alert');
        return;
      }

      let totalSplitAmount = 0;
      const formattedSplits: PaymentSplit[] = [];
      const methodsUsed: string[] = [];

      for (let i = 0; i < paymentSplits.length; i++) {
        const item = paymentSplits[i];
        const val = parseFloat((item.amount || '0').replace(',', '.'));

        if (!item.method) {
          showToast(`Obrigatório: Selecione a forma de pagamento da fração #${i + 1}!`, 'alert');
          return;
        }

        if (isNaN(val) || val <= 0) {
          showToast(`Obrigatório: Informe um valor válido para a fração #${i + 1}!`, 'alert');
          return;
        }

        if (['debito', 'credito', 'vr'].includes(item.method)) {
          if (!item.cardProvider || !item.cardProvider.trim()) {
            showToast(`Obrigatório: Selecione a operadora/maquininha da fração #${i + 1} (${item.method.toUpperCase()})!`, 'alert');
            return;
          }
        }

        let lineCashReceived: number | undefined = undefined;
        let lineChangeAmount: number | undefined = undefined;

        if (item.method === 'dinheiro') {
          const cashVal = parseFloat((item.cashReceived || item.amount || '0').replace(',', '.'));
          if (isNaN(cashVal) || cashVal < val) {
            showToast(`Valor em dinheiro da fração #${i + 1} é menor que R$ ${val.toFixed(2).replace('.', ',')}!`, 'alert');
            return;
          }
          lineCashReceived = cashVal;
          lineChangeAmount = cashVal - val;
        }

        totalSplitAmount += val;

        const methodLabelMap: Record<string, string> = {
          debito: 'Débito',
          credito: 'Crédito',
          pix: 'PIX',
          dinheiro: 'Dinheiro',
          vr: 'Vale Refeição'
        };

        const methodLabel = methodLabelMap[item.method] || item.method.toUpperCase();
        methodsUsed.push(item.cardProvider ? `${methodLabel} (${item.cardProvider.toUpperCase()})` : methodLabel);

        formattedSplits.push({
          method: item.method,
          amount: val,
          cardProvider: item.cardProvider || undefined,
          cashReceived: lineCashReceived,
          changeAmount: lineChangeAmount
        });
      }

      if (Math.abs(totalSplitAmount - totalAmount) > 0.02) {
        showToast(`A soma dos pagamentos (R$ ${totalSplitAmount.toFixed(2).replace('.', ',')}) deve ser exatamente igual ao total do pedido (R$ ${totalAmount.toFixed(2).replace('.', ',')})!`, 'alert');
        return;
      }

      finalPaymentMethod = 'Múltiplo (' + Array.from(new Set(methodsUsed)).join(' + ') + ')';
      finalCardProvider = formattedSplits.map(s => s.cardProvider).filter(Boolean).join(', ') || undefined;
      finalSplits = formattedSplits;
    }

    setSubmitting(true);

    const itemsPayload = cart.map((item: any, idx: number) => {
      let pName = item.productName || item.name;
      const sw = item.sandwichConfig || item.sandwich;
      if (!pName || pName === 'null' || pName.trim() === '') {
        if (sw) {
          pName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
        } else {
          pName = 'Item do Pedido';
        }
      }
      return {
        id: `item-pos-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
        productId: item.productId || item.id,
        productName: pName,
        isReadyProduct: item.isReadyProduct !== undefined ? Boolean(item.isReadyProduct) : !sw,
        sandwich: sw || undefined,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1
      };
    });

    const userName = user?.name || user?.username || 'Atendimento Balcão';
    const feeToSave = deliveryType === 'entrega' ? deliveryFeeNum : 0;
    const orderPayload = {
      customerName: customerName.trim(),
      items: itemsPayload,
      deliveryType: deliveryType,
      deliveryFee: feeToSave,
      deliveryAddress: deliveryType === 'entrega' && deliveryAddress.trim() ? deliveryAddress.trim() : undefined,
      customerType,
      paymentMethod: finalPaymentMethod,
      tableNumber: tableNumber.trim(),
      cardProvider: finalCardProvider,
      machineModel: machineModel.trim() || undefined,
      cashReceived: finalCashReceived,
      changeAmount: finalChangeAmount,
      paymentSplits: finalSplits,
      couponCode: appliedPosCoupon ? appliedPosCoupon.code : undefined,
      discountAmount: posDiscountAmount > 0 ? posDiscountAmount : undefined,
      totalPrice: totalAmount,
      isPosOrder: true,
      sellerName: userName,
      createdBy: userName,
      userName: userName
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      let res;
      if (editingPosOrderId) {
        res = await fetch(`/api/orders/${editingPosOrderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
          signal: controller.signal
        });
      } else {
        res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
          signal: controller.signal
        });
      }

      clearTimeout(timeoutId);
      const data = await res.json();

      if (res.ok && (data.success || data.id || data.order)) {
        const order = data.order || data;
        setCompletedOrder(order);
        if (editingPosOrderId) {
          if (onOrderUpdated) onOrderUpdated(order);
          showToast(`Pedido #${order.code} atualizado com sucesso!`, 'success');
        } else {
          onOrderCreated(order);
          showToast(`Venda concluída! Pedido: ${order.code}`, 'success');
        }
        clearCart();
        setCustomerName('Cliente Balcão');
        setEditingPosOrderId(null);
        fetchCashRegister();
      } else {
        showToast(data.error || 'Erro ao processar venda no PDV.', 'alert');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Erro ao finalizar venda no PDV:', err);
      if (err?.name === 'AbortError') {
        showToast('Tempo limite excedido ao comunicar com o servidor.', 'alert');
      } else {
        showToast('Erro de conexão ao enviar pedido.', 'alert');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Status Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-brand-yellow p-2.5 rounded-xl text-brand-green">
            <ShoppingBag className="h-6 w-6 font-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Atendimento no Balcão & PDV</h2>
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-emerald-500/30">
                Operacional
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Operador: <span className="text-white font-semibold">{user.name}</span> ({user.role.toUpperCase()})
            </p>
          </div>
        </div>

        {/* Cash Register Bar / Quick info */}
        <div className="flex flex-wrap items-center gap-2">
          {cashRegister && cashRegister.status === 'open' ? (
            <div className="flex flex-wrap items-center gap-2 bg-slate-800/90 p-2 rounded-2xl border border-slate-700 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 font-bold rounded-xl border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Caixa Aberto</span>
              </div>

              <div className="text-slate-300 font-medium px-2">
                Fundo: <span className="text-white font-bold">R$ {registerTotals.initial.toFixed(2)}</span>
              </div>

              <div className="text-slate-300 font-medium px-2 border-l border-slate-700">
                Gaveta (Est.): <span className="text-emerald-400 font-extrabold">R$ {registerTotals.expectedCashInDrawer.toFixed(2)}</span>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setMovementType('suprimento');
                    setShowMovementModal(true);
                  }}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  title="Entrada de troco/dinheiro"
                >
                  <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Suprimento</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMovementType('sangria');
                    setShowMovementModal(true);
                  }}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  title="Retirada de caixa"
                >
                  <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" />
                  <span>Sangria</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchCashRegister();
                    setShowPreCaixaModal(true);
                  }}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Pré-visualizar e imprimir relatório parcial do caixa (Pré-Caixa)"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Pré-Caixa</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCloseActualCash(registerTotals.expectedCashInDrawer.toFixed(2));
                    setShowCloseRegisterModal(true);
                  }}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Fechar Caixa</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-800/90 p-2 rounded-2xl border border-slate-700 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white font-bold rounded-xl border border-red-500 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                <span>Caixa Fechado</span>
              </div>
              <button
                type="button"
                onClick={() => setShowOpenRegisterModal(true)}
                className="px-3 py-1 bg-brand-green hover:bg-emerald-600 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Unlock className="h-3.5 w-3.5" />
                <span>Abrir Caixa (Fundo Inicial)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Warning banner if register is closed */}
      {(!cashRegister || cashRegister.status !== 'open') && (
        <div className="bg-red-600 border border-red-700 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-white text-xs font-semibold shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-white shrink-0" />
            <span>O caixa está fechado no momento. Abra o caixa informando o fundo de caixa inicial para concluir vendas no balcão.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowOpenRegisterModal(true)}
            className="px-3.5 py-1.5 bg-white text-red-700 font-black rounded-xl hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap shadow-xs"
          >
            Definir Fundo de Caixa
          </button>
        </div>
      )}

      {/* Sub-Navigation Bar: PDV Vendas vs Pedidos do Balcão */}
      <div className="flex items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPosTab('venda')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              posTab === 'venda'
                ? 'bg-brand-green text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Atendimento & Nova Venda (PDV)</span>
            {editingPosOrderId && (
              <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                EDITANDO PEDIDO
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setPosTab('pedidos')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              posTab === 'pedidos'
                ? 'bg-brand-green text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Pedidos do Balcão & Editar</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              posTab === 'pedidos' ? 'bg-white text-brand-green' : 'bg-slate-200 text-slate-800'
            }`}>
              {orders.length}
            </span>
          </button>
        </div>

        {editingPosOrderId && (
          <button
            type="button"
            onClick={clearCart}
            className="text-xs text-amber-700 font-bold bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl border border-amber-300 flex items-center gap-1 transition-all cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            <span>Cancelar Edição de Pedido</span>
          </button>
        )}
      </div>

      {/* Main Grid: Products (Left 65%) vs Cart/Checkout (Right 35%) */}
      {posTab === 'venda' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Products Catalog */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          
          {/* Search & Filter Header (Sticky at Top) */}
          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-md space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Search className="h-4 w-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar produtos por nome... [F2 para pesquisar]"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-full cursor-pointer transition-all"
                    title="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* View Toggle Buttons */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setProductViewMode('grid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    productViewMode === 'grid'
                      ? 'bg-white text-brand-green shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Visualizar em Cards"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    productViewMode === 'table'
                      ? 'bg-white text-brand-green shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Visualizar em Tabela"
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">Tabela</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'sandwich', label: 'Lanches', icon: Tag },
                { id: 'salad', label: 'Saladas', icon: Salad },
                { id: 'drink', label: 'Bebidas', icon: Coffee },
                { id: 'juice', label: 'Sucos', icon: Droplet },
                { id: 'vitamin', label: 'Vitaminas', icon: Sparkles },
                { id: 'smoothie', label: 'Smoothies & Shakes', icon: Flame },
                { id: 'dessert', label: 'Sobremesas', icon: Cookie },
                { id: 'extra', label: 'Adicionais', icon: PlusCircle },
                { id: 'protein', label: 'Proteínas', icon: Shield },
                { id: 'cheese', label: 'Queijos', icon: Wheat },
                { id: 'sauce', label: 'Molhos', icon: Droplet },
                { id: 'all', label: 'Todos Os Itens', icon: Utensils }
              ].map(cat => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                
                // Count items in category from available products (ready products + inventory)
                const catCount = availableProducts.filter(p => isProductInCategory(p, cat.id)).length;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-brand-green text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{cat.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {catCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Products Display: Table or Grid */}
          {productViewMode === 'table' ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3 text-right">Preço</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 font-semibold">
                    {filteredProducts.map(product => {
                      const inCart = cart.find(item => item.id === product.id);
                      const productImage = product.image || 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=80';
                      const pNameLower = product.name.toLowerCase();
                      const isCustomizable = (product.category === 'sandwich' || product.category === 'salad' || readyProducts.some(rp => rp.id === product.id && (rp.category === 'sandwich' || rp.category === 'salad'))) && !pNameLower.includes('shake') && !pNameLower.includes('brownie') && !pNameLower.includes('cookie') && !pNameLower.includes('mousse') && !pNameLower.includes('cheesecake') && !pNameLower.includes('pudim') && product.category !== 'extra' && product.category !== 'drink' && product.category !== 'drink_cookie' && product.category !== 'bread';

                      const getCategoryBadge = (cat: string, name: string, id: string) => {
                        const nameLower = name.toLowerCase();
                        if (cat === 'sandwich' || cat === 'lanche' || cat === 'sanduiche') return 'Lanche';
                        if (cat === 'salad' || cat === 'vegetable') return 'Salada';
                        if (cat === 'juice' || id.startsWith('suc-') || nameLower.includes('suco')) return 'Suco';
                        if (cat === 'vitamin' || id.startsWith('vit-') || nameLower.includes('vitamina')) return 'Vitamina';
                        if (cat === 'smoothie' || id.startsWith('smoothie-') || nameLower.includes('smoothie') || nameLower.includes('shake')) return nameLower.includes('shake') ? 'Shake' : 'Smoothie';
                        if (cat === 'dessert' || cat === 'sobremesa' || cat === 'cookie' || nameLower.includes('cookie') || nameLower.includes('brownie') || nameLower.includes('brookie') || nameLower.includes('mousse') || nameLower.includes('cheesecake') || nameLower.includes('pudim') || nameLower.includes('salada de frutas')) return 'Sobremesa';
                        if (cat === 'protein') return 'Proteína';
                        if (cat === 'cheese') return 'Queijo';
                        if (cat === 'sauce') return 'Molho';
                        if (cat === 'bread') return 'Pão';
                        if (cat === 'addon' || cat === 'extra') return 'Adicional';
                        if (cat === 'drink') return 'Bebida';
                        if (cat === 'drink_cookie') return nameLower.includes('cookie') ? 'Sobremesa' : 'Bebida';
                        return 'Item';
                      };

                      return (
                        <tr key={product.id} className={`hover:bg-slate-50 transition-colors ${inCart ? 'bg-emerald-50/40' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img 
                                src={productImage} 
                                alt={product.name}
                                className="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200"
                                onError={(e) => {
                                  (e.target as any).src = 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=80';
                                }}
                              />
                              <div>
                                <div className="font-extrabold text-slate-800 text-xs">{product.name}</div>
                                {product.description && (
                                  <div className="text-[11px] text-slate-400 font-medium line-clamp-1">{product.description}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-[10px] font-black uppercase text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              {getCategoryBadge(product.category, product.name, product.id)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-black text-brand-green text-xs">
                            R$ {product.price.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {inCart ? (
                              <div className="inline-flex items-center gap-2">
                                <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                  <button
                                    onClick={() => updateQuantity(product.id, -1)}
                                    className="p-1 bg-white text-slate-700 rounded-md shadow-xs hover:bg-slate-200 transition-all cursor-pointer"
                                    title="Diminuir"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="font-black text-xs text-brand-green px-1">
                                    {inCart.quantity}x
                                  </span>
                                  <button
                                    onClick={() => updateQuantity(product.id, 1)}
                                    className="p-1 bg-brand-green text-white rounded-md shadow-xs hover:bg-brand-green-dark transition-all cursor-pointer"
                                    title="Aumentar"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                                {isCustomizable && (
                                  <button
                                    type="button"
                                    onClick={() => openCustomizer(product as ReadyProduct)}
                                    className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-extrabold rounded-lg inline-flex items-center gap-1 transition-all cursor-pointer"
                                    title="Montar/Personalizar"
                                  >
                                    <SlidersHorizontal className="h-3 w-3" />
                                    <span>Montar</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              isCustomizable ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openCustomizer(product as ReadyProduct)}
                                    className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-extrabold uppercase tracking-wider rounded-xl inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                                    title="Montar/Personalizar"
                                  >
                                    <SlidersHorizontal className="h-3 w-3" />
                                    <span>Montar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => addDirectToCart(product)}
                                    className="px-2.5 py-1.5 bg-brand-green hover:bg-brand-green-dark text-white text-[10px] font-extrabold uppercase tracking-wider rounded-xl inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                                    title="Adicionar diretamente"
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span>Adicionar</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => addDirectToCart(product)}
                                  className="px-3 py-1.5 bg-brand-green hover:bg-brand-green-dark text-white text-[11px] font-bold rounded-xl inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>Adicionar</span>
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(product => {
                const inCart = cart.find(item => item.id === product.id);
                const productImage = product.image || 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=80';
                
                const pNameLower = product.name.toLowerCase();
                const getCategoryBadge = (cat: string, name: string, id: string) => {
                  const nameLower = name.toLowerCase();
                  if (cat === 'sandwich' || cat === 'lanche' || cat === 'sanduiche') return 'Lanche';
                  if (cat === 'salad' || cat === 'vegetable') return 'Salada';
                  if (cat === 'juice' || id.startsWith('suc-') || nameLower.includes('suco')) return 'Suco';
                  if (cat === 'vitamin' || id.startsWith('vit-') || nameLower.includes('vitamina')) return 'Vitamina';
                  if (cat === 'smoothie' || id.startsWith('smoothie-') || nameLower.includes('smoothie') || nameLower.includes('shake')) return nameLower.includes('shake') ? 'Shake' : 'Smoothie';
                  if (cat === 'dessert' || cat === 'sobremesa' || cat === 'cookie' || nameLower.includes('cookie') || nameLower.includes('brownie') || nameLower.includes('brookie') || nameLower.includes('mousse') || nameLower.includes('cheesecake') || nameLower.includes('pudim') || nameLower.includes('salada de frutas')) return 'Sobremesa';
                  if (cat === 'protein') return 'Proteína';
                  if (cat === 'cheese') return 'Queijo';
                  if (cat === 'sauce') return 'Molho';
                  if (cat === 'bread') return 'Pão';
                  if (cat === 'addon' || cat === 'extra') return 'Adicional';
                  if (cat === 'drink') return 'Bebida';
                  if (cat === 'drink_cookie') return nameLower.includes('cookie') ? 'Sobremesa' : 'Bebida';
                  return 'Item';
                };

                const isCustomizable = (product.category === 'sandwich' || product.category === 'salad' || readyProducts.some(rp => rp.id === product.id && (rp.category === 'sandwich' || rp.category === 'salad'))) && !pNameLower.includes('shake') && !pNameLower.includes('brownie') && !pNameLower.includes('cookie') && !pNameLower.includes('mousse') && !pNameLower.includes('cheesecake') && !pNameLower.includes('pudim') && product.category !== 'extra' && product.category !== 'drink' && product.category !== 'drink_cookie' && product.category !== 'bread';

                return (
                  <div 
                    key={product.id}
                    className={`bg-white p-3 rounded-2xl border transition-all flex flex-col justify-between hover:shadow-md ${
                      inCart ? 'border-brand-green ring-2 ring-brand-green/10' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Product Photo Banner */}
                      <div 
                        onClick={() => isCustomizable ? openCustomizer(product as ReadyProduct) : addDirectToCart(product)}
                        className="relative h-28 w-full rounded-xl overflow-hidden bg-slate-100 mb-2.5 border border-slate-100 group cursor-pointer"
                        title={isCustomizable ? "Clique para montar este item" : "Clique para adicionar ao carrinho"}
                      >
                        <img 
                          src={productImage} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as any).src = 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=80';
                          }}
                        />
                        {/* Hover Overlay Hint */}
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-bold text-xs backdrop-blur-[1px]">
                          {isCustomizable ? (
                            <>
                              <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
                              <span>Montar Item</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 text-emerald-400" />
                              <span>Adicionar Item</span>
                            </>
                          )}
                        </div>
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[85%]">
                          <span className="text-[10px] font-black uppercase text-white bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 rounded-md">
                            {getCategoryBadge(product.category, product.name, product.id)}
                          </span>
                          {product.subcategory && (
                            <span className="text-[10px] font-extrabold text-amber-300 bg-emerald-950/85 backdrop-blur-xs px-2 py-0.5 rounded-md">
                              🏷️ {product.subcategory}
                            </span>
                          )}
                        </div>
                        <span className="absolute bottom-2 right-2 text-xs font-black text-slate-900 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-lg shadow-xs">
                          R$ {product.price.toFixed(2).replace('.', ',')}
                        </span>
                      </div>

                      <h3 
                        onClick={() => isCustomizable ? openCustomizer(product as ReadyProduct) : addDirectToCart(product)}
                        className="font-bold text-slate-800 text-sm leading-snug cursor-pointer hover:text-brand-green transition-colors"
                        title={isCustomizable ? "Clique para montar" : "Clique para adicionar"}
                      >
                        {product.name}
                      </h3>
                    </div>

                    {/* Add to Cart / Qty Control */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      {inCart ? (
                        <div className="flex flex-col gap-1.5 w-full">
                          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full justify-between">
                            <button
                              onClick={() => updateQuantity(product.id, -1)}
                              className="p-1.5 bg-white text-slate-700 rounded-lg shadow-xs hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
                              title="Diminuir"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="font-black text-sm text-brand-green px-2">
                              {inCart.quantity}x
                            </span>
                            <button
                              onClick={() => updateQuantity(product.id, 1)}
                              className="p-1.5 bg-brand-green text-white rounded-lg shadow-xs hover:bg-brand-green-dark active:scale-95 transition-all cursor-pointer"
                              title="Aumentar"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {isCustomizable && (
                            <button
                              type="button"
                              onClick={() => openCustomizer(product as ReadyProduct)}
                              className="w-full py-1 text-[10px] font-extrabold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                              <SlidersHorizontal className="h-3 w-3 text-amber-600" />
                              <span>Montar Outro</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        isCustomizable ? (
                          <div className="grid grid-cols-2 gap-1.5 w-full">
                            <button
                              type="button"
                              onClick={() => openCustomizer(product as ReadyProduct)}
                              className="py-2 px-2 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-extrabold uppercase tracking-tight rounded-xl flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-98 cursor-pointer"
                              title="Montar/Personalizar"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                              <span>Montar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => addDirectToCart(product)}
                              className="py-2 px-2 bg-brand-green hover:bg-brand-green-dark text-white text-[11px] font-extrabold uppercase tracking-tight rounded-xl flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-98 cursor-pointer"
                              title="Adicionar diretamente"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Adicionar</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addDirectToCart(product)}
                            className="w-full py-2 bg-brand-green hover:bg-brand-green-dark text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98 cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Adicionar</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredProducts.length === 0 && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
              <Search className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-sm text-slate-700">Nenhum produto encontrado</p>
              <p className="text-xs text-slate-400 mt-1">Tente pesquisar com outro termo ou mudar de categoria.</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Cart & POS Checkout */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 flex flex-col justify-between min-h-[580px]">
            
            {/* Cart Header */}
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-brand-green" />
                  <h3 className="font-extrabold text-slate-800 text-base">Pedido no Balcão</h3>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Limpar</span>
                  </button>
                )}
              </div>

              {/* Items List */}
              <div className="my-4 space-y-2 max-h-60 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                    <Utensils className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-500">Seu carrinho está vazio</p>
                    <p className="text-[11px] text-slate-400">Clique nos produtos para adicionar ao pedido.</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div 
                      key={item.id}
                      className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex justify-between items-center text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {item.image ? (
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                            <Utensils className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 truncate">{item.name}</p>
                          {(item.sandwichConfig?.bread || item.sandwich?.bread) && (
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const prod = readyProducts.find(p => p.id === item.productId || p.name === item.productName) || {
                                    id: item.productId || item.id,
                                    name: item.productName || item.name,
                                    price: item.price,
                                    category: 'sandwich',
                                    image: item.image,
                                    sandwichConfig: item.sandwichConfig || item.sandwich
                                  };
                                  handleOpenBreadSelection(prod);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[10px] rounded-md border border-amber-300 transition-colors cursor-pointer"
                                title="Clique para alterar o pão"
                              >
                                <span>🥖 {item.sandwichConfig?.bread || item.sandwich?.bread}</span>
                                <span className="text-[9px] text-amber-800 underline ml-0.5">alterar</span>
                              </button>
                            </div>
                          )}
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            R$ {item.price.toFixed(2).replace('.', ',')} un.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="p-1 bg-white border border-slate-200 rounded-md hover:bg-slate-200 cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-black text-slate-800 w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="p-1 bg-brand-green text-white rounded-md hover:bg-brand-green-dark cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-1 text-slate-400 hover:text-red-600 ml-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Coupon Code Section */}
              <div className="my-3 p-3 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-amber-950 uppercase flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-amber-600" />
                    <span>Cupom de Desconto</span>
                  </label>
                  {appliedPosCoupon && (
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                      ATIVO
                    </span>
                  )}
                </div>

                {!appliedPosCoupon ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={posCouponCode}
                      onChange={(e) => setPosCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyPosCoupon();
                        }
                      }}
                      placeholder="Ex: CUPOM10"
                      disabled={cart.length === 0 || posCouponLoading}
                      className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-black tracking-wider uppercase text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPosCoupon}
                      disabled={cart.length === 0 || !posCouponCode.trim() || posCouponLoading}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      {posCouponLoading ? (
                        <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <span>Aplicar</span>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-300 flex items-center justify-between shadow-2xs">
                    <div className="space-y-0.5">
                      <div className="font-black text-xs text-emerald-900 flex items-center gap-1.5">
                        <span>🏷️ {appliedPosCoupon.code}</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          {appliedPosCoupon.type === 'percentage' ? `${appliedPosCoupon.value}% OFF` : `R$ ${appliedPosCoupon.value.toFixed(2)} OFF`}
                        </span>
                      </div>
                      <p className="text-[11px] font-extrabold text-emerald-800">
                        Desconto: - R$ {posDiscountAmount.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePosCoupon}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Remover cupom"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {posCouponFeedback && !appliedPosCoupon && (
                  <p className={`text-[11px] font-bold ${posCouponFeedback.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {posCouponFeedback.message}
                  </p>
                )}
              </div>

              {/* Total Display */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl mb-4 space-y-2">
                {(posDiscountAmount > 0 || (deliveryType === 'entrega' && deliveryFeeNum > 0)) && (
                  <div className="space-y-1 text-xs font-semibold border-b border-slate-800 pb-2">
                    <div className="flex justify-between text-slate-300">
                      <span>Subtotal Itens:</span>
                      <span>R$ {cartSubtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                    {deliveryType === 'entrega' && deliveryFeeNum > 0 && (
                      <div className="flex justify-between text-amber-400 font-bold">
                        <span className="flex items-center gap-1">🛵 Taxa de Entrega (Frete):</span>
                        <span>+ R$ {deliveryFeeNum.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    {posDiscountAmount > 0 && (
                      <div className="flex justify-between text-brand-yellow font-bold">
                        <span>Desconto Cupom ({appliedPosCoupon?.code}):</span>
                        <span>- R$ {posDiscountAmount.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Total a Pagar</span>
                    <div className="text-2xl font-black text-brand-yellow">
                      R$ {totalAmount.toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                  <span className="text-xs text-slate-300 font-semibold bg-slate-800 px-2.5 py-1 rounded-lg">
                    {cart.reduce((a, b) => a + b.quantity, 0)} itens
                  </span>
                </div>
              </div>

              {/* Customer Type & Name */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">Tipo de Cliente</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerType('cliente');
                        if (eligibleEmployees.some(e => e.name === customerName)) {
                          setCustomerName('Cliente Balcão');
                        }
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        customerType === 'cliente'
                          ? 'bg-brand-green text-white border-brand-green shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Cliente (Padrão)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerType('funcionario');
                        if (eligibleEmployees.length > 0 && (customerName === 'Cliente Balcão' || !customerName.trim())) {
                          setCustomerName(eligibleEmployees[0].name);
                        }
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        customerType === 'funcionario'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span>Funcionário</span>
                    </button>
                  </div>
                </div>

                {/* Name and Table inputs */}
                {customerType === 'funcionario' ? (
                  <div className="space-y-2.5 bg-amber-50/60 p-3 rounded-xl border border-amber-200/80">
                    <label className="text-xs font-bold text-amber-900 uppercase flex items-center justify-between">
                      <span>Selecionar Funcionário Cadastrado</span>
                      <span className="text-[10px] text-amber-800 font-extrabold bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200/60">
                        {eligibleEmployees.length} cadastrado(s)
                      </span>
                    </label>

                    {eligibleEmployees.length > 0 ? (
                      <div className="space-y-2">
                        {/* Dropdown Select */}
                        <select
                          value={eligibleEmployees.some(e => e.name === customerName) ? customerName : ''}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 cursor-pointer shadow-2xs"
                        >
                          <option value="" disabled>-- Selecione o Funcionário --</option>
                          {eligibleEmployees.map(emp => (
                            <option key={emp.id} value={emp.name}>
                              👤 {emp.name} ({emp.username})
                            </option>
                          ))}
                        </select>

                        {/* Quick Selection Chips */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {eligibleEmployees.map(emp => {
                            const isSelected = customerName === emp.name;
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => setCustomerName(emp.name)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs scale-102'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-100/60 hover:border-amber-300'
                                }`}
                              >
                                {emp.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-amber-100/60 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-medium">
                        Nenhum funcionário específico cadastrado no momento. Usuários de sistema (admin, balcão, cozinha) foram ocultados.
                      </div>
                    )}

                    {/* Manual name override field */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center justify-between">
                          <span>Nome p/ Chamada</span>
                          <span className="text-rose-600 font-extrabold">* Obrigatório</span>
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Digite o nome do funcionário"
                          className={`w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 ${
                            !customerName.trim() ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center justify-between">
                          <span>Nº da Comanda</span>
                          <span className="text-rose-600 font-extrabold">* Obrigatório</span>
                        </label>
                        <input
                          type="text"
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          placeholder="Ex: Comanda 04"
                          className={`w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 ${
                            !tableNumber.trim() ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1">
                            <span>Nome p/ Chamada</span>
                            <span className="text-rose-600 font-extrabold">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setCustomerName('Cliente Balcão')}
                            className="text-[10px] text-brand-green font-extrabold hover:underline"
                            title="Preencher rápido com 'Cliente Balcão'"
                          >
                            + Cliente Balcão
                          </button>
                        </div>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Ex: Cliente Balcão ou João"
                          className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green ${
                            !customerName.trim() ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1">
                            <span>Nº da Comanda</span>
                            <span className="text-rose-600 font-extrabold">*</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          placeholder="Ex: Comanda 04 ou Mesa 01"
                          className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green ${
                            !tableNumber.trim() ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Quick Comanda Selection Pills */}
                    <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Atalho Rápido de Comanda:</span>
                      <div className="flex flex-wrap gap-1">
                        {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', 'Mesa 01', 'Balcão'].map(c => {
                          const formatted = c === 'Balcão' ? 'Balcão #1' : c.startsWith('Mesa') ? c : `Comanda ${c}`;
                          const isSelected = tableNumber === formatted;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setTableNumber(formatted)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-brand-green text-white shadow-2xs scale-102'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tipo de Atendimento & Frete */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-brand-green" />
                      <span>Tipo de Atendimento & Frete</span>
                    </label>
                    {editingPosOrderId && (
                      <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                        Atualizar Frete
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryType('retirada');
                        setDeliveryFeeInput('0.00');
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        deliveryType === 'retirada'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>🛍️ Retirada / Balcão</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryType('entrega');
                        if (parseFloat((deliveryFeeInput || '0').replace(',', '.')) <= 0) {
                          setDeliveryFeeInput('5.00');
                        }
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        deliveryType === 'entrega'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Truck className="h-3.5 w-3.5" />
                      <span>🛵 Delivery / Entrega</span>
                    </button>
                  </div>

                  {/* If Delivery is selected, show Frete Input and Presets */}
                  {deliveryType === 'entrega' && (
                    <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-2.5 animate-in fade-in duration-150">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-amber-950 uppercase flex items-center gap-1">
                            <span>Valor do Frete (R$)</span>
                          </label>
                          <span className="text-[11px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                            {deliveryFeeNum === 0 ? 'Frete Grátis (R$ 0,00)' : `+ R$ ${deliveryFeeNum.toFixed(2).replace('.', ',')}`}
                          </span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-black text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.50"
                            min="0"
                            value={deliveryFeeInput}
                            onChange={(e) => setDeliveryFeeInput(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                      </div>

                      {/* Optional Delivery Address */}
                      <div className="space-y-1 pt-1 border-t border-amber-200/60">
                        <label className="text-[10px] font-bold text-amber-950 uppercase">
                          Endereço de Entrega (Opcional)
                        </label>
                        <input
                          type="text"
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Ex: Rua das Flores, 123 - Apto 101"
                          className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Header with Single vs Split Mode Selection */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1">
                      <span>Forma de Pagamento</span>
                      <span className="text-rose-600 font-bold text-[11px]">*</span>
                    </label>

                    <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setPaymentMode('single')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          paymentMode === 'single'
                            ? 'bg-white text-slate-900 shadow-2xs font-black'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Único
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMode('split');
                          if (paymentSplits.length === 0 || paymentSplits.every(s => !s.amount)) {
                            const half = (totalAmount / 2).toFixed(2);
                            setPaymentSplits([
                              { id: `sp-${Date.now()}-1`, method: '', amount: half, cardProvider: '', cashReceived: '' },
                              { id: `sp-${Date.now()}-2`, method: '', amount: half, cardProvider: '', cashReceived: '' }
                            ]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                          paymentMode === 'split'
                            ? 'bg-amber-500 text-white shadow-2xs font-black'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span>🔀 Múltiplo / Dividido</span>
                      </button>
                    </div>
                  </div>

                  {/* SINGLE PAYMENT MODE */}
                  {paymentMode === 'single' ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'debito', label: 'Débito', icon: CreditCard },
                          { id: 'credito', label: 'Crédito', icon: CreditCard },
                          { id: 'pix', label: 'PIX', icon: QrCode },
                          { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                          { id: 'vr', label: 'Vale Refeição', icon: CreditCard }
                        ].map(pm => {
                          const Icon = pm.icon;
                          const isActive = paymentMethod === pm.id;
                          return (
                            <button
                              key={pm.id}
                              type="button"
                              onClick={() => {
                                setPaymentMethod(pm.id as any);
                                if (pm.id === 'dinheiro') {
                                  setCardProvider('');
                                } else if (['debito', 'credito', 'vr'].includes(pm.id)) {
                                  if (!cardProvider) setCardProvider('stone');
                                }
                              }}
                              className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                isActive
                                  ? 'bg-slate-900 text-brand-yellow border-slate-900 shadow-xs scale-101'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span>{pm.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {!paymentMethod && (
                        <div className="text-[11px] text-rose-600 font-bold bg-rose-50 border border-rose-200 p-2 rounded-lg flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>Selecione a forma de pagamento acima.</span>
                        </div>
                      )}

                      {/* Machine / Provider details for Debit, Credit & VR */}
                      {['debito', 'credito', 'vr'].includes(paymentMethod) && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5 animate-in fade-in duration-200">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center justify-between">
                              <span>Maquininha / Operadora</span>
                              <span className="text-[10px] text-rose-600 font-extrabold">* Seleção Obrigatória</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {(cardMachines.filter(m => m.active).length > 0
                                ? cardMachines.filter(m => m.active)
                                : [
                                    { id: 'stone', name: 'Stone' },
                                    { id: 'santander', name: 'Santander' },
                                    { id: 'cielo', name: 'Cielo' },
                                    { id: 'outro', name: 'Outra' }
                                  ]
                              ).map(mach => {
                                const isSelected = cardProvider?.toLowerCase() === mach.name.toLowerCase() || cardProvider?.toLowerCase() === mach.id.toLowerCase();
                                return (
                                  <button
                                    key={mach.id}
                                    type="button"
                                    onClick={() => {
                                      setCardProvider(mach.name);
                                    }}
                                    className={`py-1.5 px-3 rounded-xl border text-xs font-black transition-all text-center cursor-pointer flex items-center gap-1.5 ${
                                      isSelected
                                        ? 'bg-brand-green text-white border-brand-green shadow-xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    <CreditCard className="h-3 w-3 shrink-0" />
                                    <span>{mach.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {!cardProvider && (
                            <div className="text-[10px] text-rose-600 font-bold">
                              * Por favor, selecione qual maquininha/operadora foi utilizada.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cash Options if Dinheiro selected */}
                      {paymentMethod === 'dinheiro' && (
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2 animate-in fade-in duration-200">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-amber-900">Valor Recebido (R$)</label>
                            <button
                              type="button"
                              onClick={() => setCashReceived(totalAmount.toFixed(2))}
                              className="text-[10px] text-amber-800 underline font-bold"
                            >
                              Valor Exato
                            </button>
                          </div>

                          <input
                            type="number"
                            step="0.01"
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                            placeholder="Ex: 50.00"
                            className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm font-black text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                          />

                          {/* Quick cash bill buttons */}
                          <div className="flex gap-1.5 flex-wrap">
                            {[10, 20, 50, 100].map(val => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setQuickCash(val)}
                                className="px-2 py-1 bg-white border border-amber-300 rounded text-[11px] font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
                              >
                                R$ {val}
                              </button>
                            ))}
                          </div>

                          {/* Calculated Troco display */}
                          {numericCashReceived >= totalAmount && totalAmount > 0 && (
                            <div className="bg-emerald-600 text-white p-2.5 rounded-lg flex justify-between items-center mt-2">
                              <span className="text-xs font-extrabold uppercase">Troco do Cliente:</span>
                              <span className="text-base font-black">
                                R$ {changeAmount.toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          )}

                          {numericCashReceived < totalAmount && numericCashReceived > 0 && (
                            <div className="text-xs text-red-600 font-bold flex items-center gap-1 mt-1">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>Faltam R$ {(totalAmount - numericCashReceived).toFixed(2).replace('.', ',')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* MULTI-SPLIT PAYMENT MODE */
                    <div className="space-y-3 bg-amber-50/40 p-3 rounded-2xl border border-amber-200 animate-in fade-in duration-200">
                      <div className="text-xs font-bold text-amber-950 flex items-center justify-between">
                        <span>Dividir Pagamento em Múltiplos Cartões / Meios</span>
                        <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded font-black">
                          {paymentSplits.length} parte(s)
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {paymentSplits.map((item, index) => {
                          const val = parseFloat((item.amount || '0').replace(',', '.')) || 0;
                          return (
                            <div key={item.id} className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                                <span>Fração #{index + 1}</span>
                                {paymentSplits.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSplitLine(item.id)}
                                    className="text-rose-600 hover:text-rose-800 p-0.5 rounded cursor-pointer"
                                    title="Remover fração"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Method Selector Chips */}
                              <div className="grid grid-cols-5 gap-1">
                                {[
                                  { id: 'debito', label: 'Débito' },
                                  { id: 'credito', label: 'Crédito' },
                                  { id: 'pix', label: 'PIX' },
                                  { id: 'dinheiro', label: 'Dinheiro' },
                                  { id: 'vr', label: 'VR' }
                                ].map(pm => {
                                  const isAct = item.method === pm.id;
                                  return (
                                    <button
                                      key={pm.id}
                                      type="button"
                                      onClick={() => updateSplitLine(item.id, 'method', pm.id)}
                                      className={`py-1 text-[10px] font-black rounded border transition-all cursor-pointer ${
                                        isAct
                                          ? 'bg-slate-900 text-brand-yellow border-slate-900'
                                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      {pm.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Amount input & fill remainder */}
                              <div className="flex items-center gap-1.5">
                                <div className="relative flex-1">
                                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.amount}
                                    onChange={(e) => updateSplitLine(item.id, 'amount', e.target.value)}
                                    placeholder="0,00"
                                    className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-green/20"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => fillRemainingOnSplitLine(item.id)}
                                  className="px-2 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-extrabold hover:bg-amber-200 shrink-0 cursor-pointer"
                                >
                                  Preencher Restante
                                </button>
                              </div>

                               {/* Machine Provider if card/VR */}
                              {['debito', 'credito', 'vr'].includes(item.method) && (
                                <div className="pt-1">
                                  <div className="text-[10px] font-bold text-slate-600 uppercase mb-1 flex items-center justify-between">
                                    <span>Operadora / Maquininha</span>
                                    <span className="text-rose-600 font-extrabold">* Obrigatório</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {(cardMachines.filter(m => m.active).length > 0
                                      ? cardMachines.filter(m => m.active)
                                      : [
                                          { id: 'stone', name: 'Stone' },
                                          { id: 'santander', name: 'Santander' },
                                          { id: 'cielo', name: 'Cielo' },
                                          { id: 'outro', name: 'Outra' }
                                        ]
                                    ).map(mach => {
                                      const isSelected = item.cardProvider?.toLowerCase() === mach.name.toLowerCase() || item.cardProvider?.toLowerCase() === mach.id.toLowerCase();
                                      return (
                                        <button
                                          key={mach.id}
                                          type="button"
                                          onClick={() => updateSplitLine(item.id, 'cardProvider', mach.name)}
                                          className={`py-1 px-2 text-[10px] font-bold rounded-lg border uppercase cursor-pointer transition-all ${
                                            isSelected
                                              ? 'bg-brand-green text-white border-brand-green font-black shadow-2xs'
                                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                          }`}
                                        >
                                          {mach.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Cash input if dinero */}
                              {item.method === 'dinheiro' && (
                                <div className="pt-1 space-y-1">
                                  <div className="text-[10px] font-bold text-amber-900 flex justify-between">
                                    <span>Valor Entregue em Dinheiro:</span>
                                    <span>Troco: R$ {Math.max(0, (parseFloat(item.cashReceived || '0') - val)).toFixed(2).replace('.', ',')}</span>
                                  </div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.cashReceived}
                                    onChange={(e) => updateSplitLine(item.id, 'cashReceived', e.target.value)}
                                    placeholder={`Ex: ${(val || 10).toFixed(2)}`}
                                    className="w-full px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-lg text-xs font-bold text-slate-800"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Split button */}
                      <button
                        type="button"
                        onClick={addSplitLine}
                        className="w-full py-2 bg-white border border-dashed border-amber-400 text-amber-900 rounded-xl text-xs font-extrabold hover:bg-amber-100/60 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Adicionar Outra Forma de Pagamento</span>
                      </button>

                      {/* Sum verification box */}
                      {(() => {
                        const sum = paymentSplits.reduce((acc, curr) => acc + (parseFloat((curr.amount || '0').replace(',', '.')) || 0), 0);
                        const diff = sum - totalAmount;
                        const isExact = Math.abs(diff) <= 0.02;

                        return (
                          <div className={`p-2.5 rounded-xl border text-xs font-bold space-y-1 ${
                            isExact
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                              : diff < 0
                                ? 'bg-amber-100 border-amber-300 text-amber-950'
                                : 'bg-rose-50 border-rose-300 text-rose-950'
                          }`}>
                            <div className="flex justify-between">
                              <span>Total do Pedido:</span>
                              <span className="font-extrabold">R$ {totalAmount.toFixed(2).replace('.', ',')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Soma dos Pagamentos:</span>
                              <span className="font-black">R$ {sum.toFixed(2).replace('.', ',')}</span>
                            </div>
                            <div className="pt-1 border-t border-slate-200/60 text-[11px] font-black flex items-center gap-1">
                              {isExact ? (
                                <span className="text-emerald-700">✅ Validação OK: Soma bate com o valor total!</span>
                              ) : diff < 0 ? (
                                <span className="text-amber-800">⚠️ Faltam R$ {Math.abs(diff).toFixed(2).replace('.', ',')} para atingir o total.</span>
                              ) : (
                                <span className="text-rose-700">⚠️ Excesso de R$ {diff.toFixed(2).replace('.', ',')} acima do total.</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Final Checkout Button & Live Guidance */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              {/* Validation helper status badge */}
              {(() => {
                const missingFields: string[] = [];
                if (!customerName.trim()) missingFields.push('Nome do Cliente');
                if (!tableNumber.trim()) missingFields.push('Nº da Comanda');
                if (paymentMode === 'single') {
                  if (!paymentMethod) missingFields.push('Forma de Pagamento');
                  else if (['debito', 'credito', 'vr'].includes(paymentMethod) && !cardProvider) {
                    missingFields.push('Maquininha/Operadora');
                  }
                } else {
                  const sum = paymentSplits.reduce((acc, curr) => acc + (parseFloat((curr.amount || '0').replace(',', '.')) || 0), 0);
                  if (Math.abs(sum - totalAmount) > 0.02) missingFields.push('Soma dos Pagamentos Múltiplos');
                }

                if (cart.length > 0 && missingFields.length > 0) {
                  return (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-extrabold flex items-center gap-1.5 animate-pulse">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>Pendente antes de finalizar: <strong className="underline">{missingFields.join(', ')}</strong></span>
                    </div>
                  );
                }
                return null;
              })()}

              <button
                onClick={handleCheckout}
                disabled={submitting || cart.length === 0}
                className="w-full py-4 bg-brand-green hover:bg-brand-green-dark text-white font-black text-base uppercase tracking-wide rounded-2xl flex items-center justify-center gap-2.5 shadow-lg hover:shadow-xl transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ring-2 ring-emerald-400/30"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 border-3 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Processando Pedido...</span>
                  </div>
                ) : (
                  <>
                    <Zap className="h-5 w-5 text-brand-yellow fill-brand-yellow animate-bounce" />
                    <span>{editingPosOrderId ? "Salvar e Atualizar Pedido" : `⚡ Concluir Venda (R$ ${totalAmount.toFixed(2).replace('.', ',')})`}</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>
      )}

      {/* COUNTER ORDERS LIST & EDIT VIEW */}
      {posTab === 'pedidos' && (
        <div className="space-y-4">
          {/* Search & Filter Header */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              {/* Text Search */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={posOrdersSearch}
                  onChange={(e) => setPosOrdersSearch(e.target.value)}
                  placeholder="Buscar por código (#BG-...), cliente ou comanda..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green font-medium"
                />
              </div>

              {/* Date Filter Control */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-xl shrink-0">
                <div className="flex items-center gap-1.5 pl-2 pr-1 text-xs font-bold text-slate-600">
                  <Calendar className="h-4 w-4 text-brand-green shrink-0" />
                  <span className="hidden xl:inline">Data:</span>
                </div>
                <input
                  type="date"
                  value={posOrdersDateFilter}
                  onChange={(e) => setPosOrdersDateFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 text-xs font-bold px-2 py-1.5 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-green cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setPosOrdersDateFilter(getTodayDateString())}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    posOrdersDateFilter === getTodayDateString()
                      ? 'bg-brand-green text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                  title="Selecionar Hoje"
                >
                  Hoje
                </button>
                {posOrdersDateFilter && (
                  <button
                    type="button"
                    onClick={() => setPosOrdersDateFilter('')}
                    className="px-2 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                    title="Exibir todas as datas"
                  >
                    Todas
                  </button>
                )}
              </div>
            </div>

            {/* Channel Filter Pills (Online vs Balcão) */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl text-xs shrink-0">
              <span className="text-[10px] font-black text-slate-500 uppercase px-2">Origem:</span>
              <button
                type="button"
                onClick={() => setPosOrdersChannelFilter('online')}
                className={`px-3 py-1.5 rounded-xl font-extrabold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                  posOrdersChannelFilter === 'online'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <span>📱 Pedidos Online</span>
              </button>
              <button
                type="button"
                onClick={() => setPosOrdersChannelFilter('balcao')}
                className={`px-3 py-1.5 rounded-xl font-extrabold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                  posOrdersChannelFilter === 'balcao'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <span>🖥️ Balcão / PDV</span>
              </button>
              <button
                type="button"
                onClick={() => setPosOrdersChannelFilter('todos')}
                className={`px-3 py-1.5 rounded-xl font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                  posOrdersChannelFilter === 'todos'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <span>🌐 Todos</span>
              </button>
            </div>

            {/* Status Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs shrink-0">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'pendente', label: 'Pendente' },
                { id: 'preparo', label: 'Preparo' },
                { id: 'finalizado', label: 'Pronto' },
                { id: 'entregue', label: 'Entregue' },
                { id: 'cancelado', label: 'Cancelado' }
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setPosOrdersFilterStatus(st.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    posOrdersFilterStatus === st.id
                      ? 'bg-slate-900 text-brand-yellow shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Cards List */}
          {(() => {
            const rawFiltered = orders.filter(o => {
              const searchLower = posOrdersSearch.toLowerCase();
              const matchesSearch = (o.code || '').toLowerCase().includes(searchLower) ||
                                    (o.customerName || '').toLowerCase().includes(searchLower) ||
                                    (o.tableNumber || '').toLowerCase().includes(searchLower);
              const matchesStatus = posOrdersFilterStatus === 'todos' || o.status === posOrdersFilterStatus;
              const matchesChannel = posOrdersChannelFilter === 'todos' ? true :
                                     posOrdersChannelFilter === 'online' ? !o.isPosOrder :
                                     Boolean(o.isPosOrder);
              if (!matchesChannel) return false;
              
              let matchesDate = true;
              if (posOrdersDateFilter && posOrdersDateFilter !== 'todos') {
                if (!o.createdAt) {
                  matchesDate = false;
                } else {
                  const orderDateStr = getDateYMDInBrasilia(o.createdAt);
                  matchesDate = orderDateStr === posOrdersDateFilter;
                }
              }

              return matchesSearch && matchesStatus && matchesDate;
            });

            // Ensure unique order keys
            const filteredOrders = Array.from(new Map(rawFiltered.map(o => [o.id, o])).values());

            if (filteredOrders.length === 0) {
              return (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
                  <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-base text-slate-700">Nenhum pedido encontrado</p>
                  <p className="text-xs text-slate-400 mt-1">Nenhum pedido atende aos filtros pesquisados.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map(order => {
                  const getStatusBadge = (status: OrderStatus) => {
                    switch (status) {
                      case 'pendente':
                        return <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase">Pendente</span>;
                      case 'preparo':
                        return <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase flex items-center gap-1"><Clock className="h-3 w-3 animate-spin" /> Em Preparo</span>;
                      case 'finalizado':
                        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase">Pronto</span>;
                      case 'entregue':
                        return <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase">Entregue</span>;
                      case 'cancelado':
                        return <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase">Cancelado</span>;
                      default:
                        return null;
                    }
                  };

                  return (
                    <div 
                      key={order.id} 
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                    >
                      {/* Order Header */}
                      <div>
                        <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                {order.code}
                              </span>
                              {getStatusBadge(order.status)}
                            </div>
                            <h4 className="font-extrabold text-slate-800 text-base mt-1.5 line-clamp-1">
                              {order.customerName}
                            </h4>
                            {order.createdAt && (
                              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3 text-slate-400" />
                                {formatDateTimeBrasilia(order.createdAt)}
                              </p>
                            )}
                            {order.customerType === 'funcionario' && (
                              <span className="inline-block text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded mt-0.5">
                                FUNCIONÁRIO
                              </span>
                            )}
                            {order.tableNumber && (
                              <p className="text-xs text-brand-green font-bold mt-0.5">
                                📍 {order.tableNumber}
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-base font-black text-brand-green block">
                              R$ {order.totalPrice.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-[10px] font-extrabold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block mt-1">
                              {order.paymentMethod || 'PDV'}
                            </span>
                          </div>
                        </div>

                        {/* Delivery Type & Frete Display on Card */}
                        {order.deliveryType === 'entrega' ? (
                          <div className="mt-2.5 bg-amber-50 border border-amber-200 rounded-xl p-2 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-extrabold text-amber-900">
                              <Truck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              <span>🛵 Delivery / Entrega</span>
                            </div>
                            <div className="font-black text-xs text-amber-950 bg-amber-200/80 px-2 py-0.5 rounded-lg border border-amber-300 shadow-2xs">
                              Frete: {Number(order.deliveryFee || 0) === 0 ? 'Grátis (R$ 0,00)' : `R$ ${Number(order.deliveryFee).toFixed(2).replace('.', ',')}`}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2.5 bg-slate-50 border border-slate-200 rounded-xl p-1.5 px-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                              <ShoppingBag className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                              <span>🛍️ Balcão / Retirada</span>
                            </div>
                            <div className="font-extrabold text-[11px] text-slate-600">
                              Frete: R$ {Number(order.deliveryFee || 0).toFixed(2).replace('.', ',')}
                            </div>
                          </div>
                        )}
                        {order.deliveryAddress && (
                          <p className="text-[11px] text-slate-600 font-medium truncate mt-1 px-0.5 flex items-center gap-1" title={order.deliveryAddress}>
                            📍 <span className="font-bold text-slate-700">End:</span> {order.deliveryAddress}
                          </p>
                        )}

                        {/* Order Items List */}
                        <div className="my-3 space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 max-h-36 overflow-y-auto text-xs">
                          {order.items && order.items.length > 0 ? (
                            order.items.map((item: any, idx: number) => {
                              let pName = item.productName || item.name;
                              const sw = item.sandwich || item.sandwichConfig;
                              if (!pName || pName === 'null' || pName.trim() === '') {
                                if (sw) {
                                  pName = sw.protein ? `BAGÔ ${sw.protein}` : 'Monte seu Bagô';
                                } else {
                                  pName = 'Item do Pedido';
                                }
                              }
                              return (
                                <div key={idx} className="flex justify-between items-start text-slate-700 py-1 border-b border-slate-100 last:border-0">
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="font-bold text-xs truncate">
                                      <strong className="text-brand-green">{item.quantity}x</strong> {pName}
                                    </span>
                                    {sw && (
                                      <span className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                                        Pão: {sw.bread || 'Padrão'} | Tam: {sw.size || '15cm'}
                                        {sw.cheese ? ` | Queijo: ${sw.cheese}` : ''}
                                        {sw.toasted ? ' | Tostado' : ''}
                                        {sw.extras && sw.extras.length > 0 ? ` | Adic: ${sw.extras.join(', ')}` : ''}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-extrabold text-xs shrink-0 text-slate-800">
                                    R$ {(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2).replace('.', ',')}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-slate-400 text-xs italic py-1">Nenhum item registrado neste pedido.</div>
                          )}
                        </div>
                      </div>

                      {/* Order Action Buttons */}
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        {/* Primary Action Row */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(order)}
                            className="py-2 px-3 bg-brand-yellow hover:bg-amber-400 text-slate-900 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                          >
                            <Pencil className="h-3.5 w-3.5 text-slate-900" />
                            <span>Editar Pedido</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleLoadOrderIntoCart(order)}
                            className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                            title="Carregar itens no carrinho do PDV para alterar"
                          >
                            <ShoppingBag className="h-3.5 w-3.5 text-brand-yellow" />
                            <span>Abrir no PDV</span>
                          </button>
                        </div>

                        {/* Status Progression buttons */}
                        <div className="flex items-center justify-between gap-1 pt-1">
                          {order.status === 'pendente' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusUpdate(order.id, 'preparo')}
                              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-extrabold rounded-lg transition-all text-center cursor-pointer"
                            >
                              ▶️ Iniciar Preparo
                            </button>
                          )}
                          {order.status === 'preparo' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusUpdate(order.id, 'finalizado')}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold rounded-lg transition-all text-center cursor-pointer"
                            >
                              ✅ Marcar Pronto
                            </button>
                          )}
                          {order.status === 'finalizado' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusUpdate(order.id, 'entregue')}
                              className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-extrabold rounded-lg transition-all text-center cursor-pointer"
                            >
                              🤝 Marcar Entregue
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCompletedOrder(order)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                            title="Ver / Imprimir Recibo"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setOrderToDelete(order)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer transition-colors"
                            title="Excluir Pedido (Devolver itens ao estoque)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Completed Order Modal / Receipt */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] flex flex-col">
            <div className="text-center space-y-1 pb-3 border-b border-slate-100 shrink-0">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-1">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-800">Venda Concluída com Sucesso!</h3>
              <p className="text-xs text-slate-500">O pedido foi registrado e enviado para a fila de preparo.</p>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto my-3 pr-1 space-y-3 flex-1">
              {/* Order Code Box */}
              <div className="bg-brand-green text-white p-3.5 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 block">Código para Chamada</span>
                <div className="text-3xl font-black text-brand-yellow tracking-tight my-0.5">#{completedOrder.code}</div>
                <p className="text-xs font-semibold">Cliente: {completedOrder.customerName}</p>
              </div>

              {/* Requested Items Section */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ShoppingBag className="h-4 w-4 text-brand-green" />
                    <span>Itens Solicitados ({(completedOrder.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0)})</span>
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-extrabold">
                    Não Fiscal
                  </span>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  {(completedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex justify-between items-start font-bold text-slate-800">
                        <span className="flex-1 pr-2">
                          <span className="text-brand-green font-black mr-1">{item.quantity}x</span>
                          {item.productName || 'Item'}
                        </span>
                        <span className="shrink-0 text-slate-900 font-black">
                          R$ {((item.price || 0) * (item.quantity || 1)).toFixed(2).replace('.', ',')}
                        </span>
                      </div>

                      {/* Adicionais if Sandwich or Salad */}
                      {item.sandwich && item.sandwich.extras && item.sandwich.extras.length > 0 && (
                        <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-100 bg-slate-50/70 p-1.5 rounded-md font-medium">
                          <p><strong className="text-slate-800 font-bold">➕ Adicionais:</strong> {item.sandwich.extras.join(', ')}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Receipt Summary Details */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Data e Horário:</span>
                  <span className="font-bold text-slate-800">
                    {formatDateTimeBrasilia(completedOrder.createdAt || new Date())}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tipo de Atendimento:</span>
                  <span className="font-bold text-slate-800 uppercase">{completedOrder.customerType || 'Cliente'}</span>
                </div>
                {completedOrder.tableNumber && (
                  <div className="flex justify-between text-slate-600">
                    <span>Comanda:</span>
                    <span className="font-extrabold text-brand-green">{completedOrder.tableNumber}</span>
                  </div>
                )}
                {completedOrder.paymentSplits && completedOrder.paymentSplits.length > 1 ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-slate-600 font-bold">
                      <span>Forma de Pagamento:</span>
                      <span className="text-brand-green font-black uppercase">MÚLTIPLO DIVIDIDO ({completedOrder.paymentSplits.length}x)</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] space-y-1">
                      {completedOrder.paymentSplits.map((sp, idx) => {
                        const mLabelMap: Record<string, string> = { debito: 'Débito', credito: 'Crédito', pix: 'PIX', dinheiro: 'Dinheiro', vr: 'Vale Refeição' };
                        const mL = mLabelMap[sp.method] || sp.method.toUpperCase();
                        return (
                          <div key={idx} className="flex justify-between items-center text-slate-800 border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                            <span className="font-semibold">
                              • {mL} {sp.cardProvider ? <span className="font-extrabold text-slate-900">({sp.cardProvider.toUpperCase()})</span> : ''}
                            </span>
                            <span className="font-extrabold text-slate-900">
                              R$ {sp.amount.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Forma de Pagamento:</span>
                      <span className="font-bold text-slate-800 uppercase">{completedOrder.paymentMethod || 'Não informado'}</span>
                    </div>
                    {completedOrder.cardProvider && completedOrder.paymentMethod !== 'dinheiro' && (
                      <div className="flex justify-between text-slate-600">
                        <span>Operadora / Maquininha:</span>
                        <span className="font-bold text-slate-800 uppercase">
                          {completedOrder.cardProvider}
                          {completedOrder.machineModel ? ` (${completedOrder.machineModel})` : ''}
                        </span>
                      </div>
                    )}
                    {completedOrder.paymentMethod === 'dinheiro' && completedOrder.cashReceived !== undefined && (
                      <>
                        <div className="flex justify-between text-slate-600">
                          <span>Valor Recebido em Dinheiro:</span>
                          <span className="font-bold text-slate-800">R$ {completedOrder.cashReceived.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 font-extrabold text-sm pt-1 border-t border-slate-200">
                          <span>Troco Devolvido:</span>
                          <span>R$ {(completedOrder.changeAmount || 0).toFixed(2).replace('.', ',')}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
                {completedOrder.discountAmount && Number(completedOrder.discountAmount) > 0 ? (
                  <div className="flex justify-between text-emerald-800 font-extrabold text-xs pt-1.5 border-t border-slate-200">
                    <span>🏷️ Desconto Cupom ({completedOrder.couponCode || 'CUPOM'}):</span>
                    <span>- R$ {Number(completedOrder.discountAmount).toFixed(2).replace('.', ',')}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>Total Pago:</span>
                  <span className="text-brand-green">R$ {completedOrder.totalPrice.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => printThermalReceipt(completedOrder, { isPosReceipt: true })}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Cupom Térmico (Não Fiscal)</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => printThermalReceipt(completedOrder, { isPosReceipt: true })}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  <span>Imprimir Recibo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCompletedOrder(null)}
                  className="flex-1 py-2 bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Próximo Atendimento</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ABERTURA DE CAIXA / FUNDO DE CAIXA */}
      {showOpenRegisterModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-green/10 text-brand-green rounded-2xl">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Abertura de Caixa</h3>
                <p className="text-xs text-slate-500 font-medium">Informe o Fundo de Caixa inicial para começar os atendimentos.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Fundo de Caixa Inicial (R$)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-black text-slate-400 text-sm">R$</span>
                  <input
                    type="text"
                    value={openInitialCash}
                    onChange={(e) => setOpenInitialCash(e.target.value)}
                    placeholder="100,00"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-green/30"
                  />
                </div>
                {/* Presets */}
                <div className="flex gap-1.5 pt-1">
                  {['50.00', '100.00', '150.00', '200.00', '300.00'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setOpenInitialCash(val)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all cursor-pointer"
                    >
                      R$ {parseFloat(val).toFixed(0)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase">Operador Responsável</label>
                <input
                  type="text"
                  value={openOperatorName}
                  onChange={(e) => setOpenOperatorName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
                  <span>Observações de Abertura</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                </label>
                <input
                  type="text"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  placeholder="Ex: Notas de 10 e moedas de 1 real"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOpenRegisterModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleOpenRegister}
                className="flex-1 py-2.5 bg-brand-green hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlock className="h-4 w-4" />
                <span>Confirmar e Abrir Caixa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SUPRIMENTO / SANGRIA */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${movementType === 'suprimento' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {movementType === 'suprimento' ? <ArrowDownLeft className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Movimentação de Caixa</h3>
                <p className="text-xs text-slate-500 font-medium">Registre entradas de troco ou retiradas em dinheiro.</p>
              </div>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setMovementType('suprimento')}
                className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  movementType === 'suprimento' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ArrowDownLeft className="h-4 w-4" />
                <span>Suprimento (Entrada)</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('sangria')}
                className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  movementType === 'sangria' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                <span>Sangria (Saída)</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase">Valor da Movimentação (R$)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-black text-slate-400 text-sm">R$</span>
                  <input
                    type="text"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder="50,00"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-green/30"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase">Motivo / Descrição</label>
                <input
                  type="text"
                  value={movementDescription}
                  onChange={(e) => setMovementDescription(e.target.value)}
                  placeholder={movementType === 'suprimento' ? 'Ex: Reforço de notas para troco' : 'Ex: Retirada de sangria para o cofre'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMovementModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRecordMovement}
                className={`flex-1 py-2.5 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-white ${
                  movementType === 'suprimento' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <span>Registrar {movementType === 'suprimento' ? 'Suprimento' : 'Sangria'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: FECHAMENTO DE CAIXA */}
      {showCloseRegisterModal && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 overflow-y-auto max-h-screen">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Fechamento de Caixa</h3>
                <p className="text-xs text-slate-500 font-medium">Conferência dos valores recebidos por canal e fechamento do turno.</p>
              </div>
            </div>

            {/* Financial Summary Separating Balcão and Delivery */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
              <div className="font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1.5 flex justify-between">
                <span>Resumo Financeiro do Turno</span>
                <span className="text-slate-400 font-normal">Aberto por: {cashRegister?.openedBy}</span>
              </div>

              {/* Channels Breakdown Cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 flex items-center gap-1">
                      <Store className="h-3.5 w-3.5 text-blue-600" />
                      <span>Balcão / PDV</span>
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded">
                      {registerTotals.counterSalesCount} ped.
                    </span>
                  </div>
                  <div className="text-base font-black text-blue-950 mt-1">
                    R$ {registerTotals.counterSalesTotal.toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-[10px] text-blue-800/80 mt-1 flex flex-wrap gap-x-2">
                    <span>💵 R$ {registerTotals.counterCash.toFixed(2).replace('.', ',')}</span>
                    <span>📱 R$ {registerTotals.counterPix.toFixed(2).replace('.', ',')}</span>
                    <span>💳 R$ {(registerTotals.counterDebito + registerTotals.counterCredito).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900 flex items-center gap-1">
                      <Bike className="h-3.5 w-3.5 text-amber-600" />
                      <span>Delivery</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                      {registerTotals.deliverySalesCount} ped.
                    </span>
                  </div>
                  <div className="text-base font-black text-amber-950 mt-1">
                    R$ {registerTotals.deliverySalesTotal.toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-[10px] text-amber-800/80 mt-1 flex flex-wrap gap-x-2">
                    <span>💵 R$ {registerTotals.deliveryCash.toFixed(2).replace('.', ',')}</span>
                    <span>📱 R$ {registerTotals.deliveryPix.toFixed(2).replace('.', ',')}</span>
                    <span>💳 R$ {(registerTotals.deliveryDebito + registerTotals.deliveryCredito).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>

              {/* Faturamento Consolidado */}
              <div className="p-2.5 bg-emerald-950 text-white rounded-xl flex items-center justify-between font-black text-xs">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  <span>FATURAMENTO TOTAL DO TURNO:</span>
                </span>
                <span className="text-emerald-400 text-sm">R$ {registerTotals.totalTurnover.toFixed(2).replace('.', ',')}</span>
              </div>

              {/* Movements & Drawer Info */}
              <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
                <div className="flex justify-between bg-white p-2 rounded-xl border border-slate-100">
                  <span>Fundo Inicial:</span>
                  <span className="font-bold">R$ {registerTotals.initial.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between bg-white p-2 rounded-xl border border-slate-100">
                  <span>Total em Espécie:</span>
                  <span className="font-bold text-emerald-700">+ R$ {registerTotals.cashSales.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between bg-white p-2 rounded-xl border border-slate-100">
                  <span>Suprimentos (+):</span>
                  <span className="font-bold text-emerald-700">+ R$ {registerTotals.suprimentos.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between bg-white p-2 rounded-xl border border-slate-100">
                  <span>Sangrias (-):</span>
                  <span className="font-bold text-amber-700">- R$ {registerTotals.sangrias.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between font-black text-sm">
                <span>Esperado na Gaveta (Dinheiro):</span>
                <span className="text-brand-yellow">R$ {registerTotals.expectedCashInDrawer.toFixed(2).replace('.', ',')}</span>
              </div>

              {/* Card / Pix Summary */}
              <div className="pt-2 border-t border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Total Cartão Débito:</span>
                  <span className="font-bold text-slate-800">R$ {registerTotals.debitoSales.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Cartão Crédito:</span>
                  <span className="font-bold text-slate-800">R$ {registerTotals.creditoSales.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total PIX:</span>
                  <span className="font-bold text-slate-800">R$ {registerTotals.pixSales.toFixed(2).replace('.', ',')}</span>
                </div>
                {registerTotals.vrSales > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Total Vale Refeição (VR):</span>
                    <span className="font-bold text-slate-800">R$ {registerTotals.vrSales.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                {registerTotals.totalDiscounts > 0 && (
                  <div className="flex justify-between text-amber-900 bg-amber-50/80 p-2 rounded-xl border border-amber-200/70 font-bold text-xs my-1">
                    <span>🏷️ Total Descontos (Cupons):</span>
                    <span className="font-black text-amber-700">- R$ {registerTotals.totalDiscounts.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}

                {/* Machine breakdown in closing modal */}
                {Object.keys(registerTotals.machineTotals).length > 0 && (
                  <div className="pt-2 border-t border-slate-200 space-y-1.5 mt-2">
                    <span className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider block">
                      💳 Vendas por Maquininha / Operadora:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(registerTotals.machineTotals).map(([mName, mAmt]) => (
                        <div key={mName} className="flex justify-between items-center bg-emerald-50/60 p-2 rounded-xl border border-emerald-100 text-[11px]">
                          <span className="font-bold text-slate-700 truncate">{mName}:</span>
                          <span className="font-black text-emerald-800 ml-1">R$ {mAmt.toFixed(2).replace('.', ',')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actual Cash Input */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 uppercase flex items-center justify-between">
                  <span>Valor Contado na Gaveta (Dinheiro)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Contagem física</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-black text-slate-400 text-sm">R$</span>
                  <input
                    type="text"
                    value={closeActualCash}
                    onChange={(e) => setCloseActualCash(e.target.value)}
                    placeholder={registerTotals.expectedCashInDrawer.toFixed(2)}
                    className="w-full pl-10 pr-4 py-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-base font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Difference feedback */}
              {(() => {
                const actual = parseFloat(closeActualCash.replace(',', '.')) || 0;
                const diff = actual - registerTotals.expectedCashInDrawer;
                if (closeActualCash.trim() === '') return null;
                if (Math.abs(diff) < 0.01) {
                  return (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Conferência perfeita! Valor contado é idêntico ao esperado.</span>
                    </div>
                  );
                } else if (diff < 0) {
                  return (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>Falta R$ {Math.abs(diff).toFixed(2).replace('.', ',')} na gaveta (Quebra de Caixa).</span>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>Sobra R$ {diff.toFixed(2).replace('.', ',')} a mais na gaveta.</span>
                    </div>
                  );
                }
              })()}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
                  <span>Observações de Fechamento</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ex: Diferença de troco para cliente, notas danificadas etc."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseRegisterModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCloseRegister}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="h-4 w-4" />
                <span>Confirmar e Fechar Caixa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRÉ-VISUALIZAÇÃO DO CAIXA (PRÉ-CAIXA) */}
      {showPreCaixaModal && cashRegister && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-amber-200 text-slate-800 my-8 max-h-[90vh] flex flex-col">
            <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3 shrink-0">
              <div className="inline-flex p-2.5 bg-amber-100 text-amber-800 rounded-2xl mb-1">
                <Printer className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-slate-900">BAGÔ - Submarine & Eats</h3>
                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full uppercase">
                  Pré-Caixa
                </span>
              </div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                Pré-Visualização e Impressão de Conferência Parcial
              </p>
              <div className="inline-block mt-1 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-900">
                ⚠️ DOCUMENTO NÃO FISCAL - O CAIXA CONTINUA ABERTO
              </div>
            </div>

            <div className="text-xs space-y-4 overflow-y-auto pr-1 flex-1">
              {/* 1. Fluxo de Abertura */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="font-extrabold text-slate-900 uppercase text-[11px] flex items-center justify-between border-b border-slate-200 pb-1">
                  <span>1. Abertura do Turno & Operador</span>
                  <span className="text-emerald-700 font-bold">Op: {cashRegister.openedBy || user?.name}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Data Abertura:</span>
                    <span className="font-bold text-slate-800">{cashRegister.openedAt ? formatDateTimeBrasilia(cashRegister.openedAt) : '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Hora Consulta:</span>
                    <span className="font-bold text-slate-800">{formatTimeBrasilia(new Date(), { includeSeconds: true })}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Status:</span>
                    <span className="font-extrabold text-emerald-700">TURNO EM ANDAMENTO</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Fundo Inicial:</span>
                    <span className="font-extrabold text-emerald-700">R$ {registerTotals.initial.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>

              {/* 2 & 3. Resumo por Canais (Balcão vs Delivery) */}
              {/* 2. Vendas Balcão */}
              <div className="space-y-1.5 bg-blue-50/40 p-3 rounded-2xl border border-blue-200/80">
                <div className="font-extrabold text-blue-950 uppercase text-[11px] flex justify-between items-center border-b border-blue-200/60 pb-1">
                  <span className="flex items-center gap-1.5">
                    <Store className="h-4 w-4 text-blue-600" />
                    <span>2. Atendimento Balcão / PDV ({registerTotals.counterSalesCount} pedidos)</span>
                  </span>
                  <span className="text-blue-700 font-black text-sm">
                    R$ {registerTotals.counterSalesTotal.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[11px]">
                  <div className="bg-white p-1.5 rounded-lg border border-blue-100 flex justify-between">
                    <span className="text-slate-500">Dinheiro:</span>
                    <span className="font-bold text-slate-900">R$ {registerTotals.counterCash.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-blue-100 flex justify-between">
                    <span className="text-slate-500">Débito:</span>
                    <span className="font-bold text-slate-900">R$ {registerTotals.counterDebito.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-blue-100 flex justify-between">
                    <span className="text-slate-500">Crédito:</span>
                    <span className="font-bold text-slate-900">R$ {registerTotals.counterCredito.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-blue-100 flex justify-between">
                    <span className="text-slate-500">PIX:</span>
                    <span className="font-bold text-slate-900">R$ {registerTotals.counterPix.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>

              {/* 3. Vendas Delivery */}
              <div className="space-y-1.5 bg-amber-50/40 p-3 rounded-2xl border border-amber-200/80">
                <div className="font-extrabold text-amber-950 uppercase text-[11px] flex justify-between items-center border-b border-amber-200/60 pb-1">
                  <span className="flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-amber-600" />
                    <span>3. Delivery / Entregas ({registerTotals.deliverySalesCount} pedidos)</span>
                  </span>
                  <span className="text-amber-700 font-black text-sm">
                    R$ {registerTotals.deliverySalesTotal.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[11px]">
                  <div className="bg-white p-1.5 rounded-lg border border-amber-100 flex justify-between">
                    <span className="text-slate-500">Dinheiro:</span>
                    <span className="font-bold text-slate-900">R$ {registerTotals.deliveryCash.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-amber-100 flex justify-between">
                    <span className="text-slate-500">Débito:</span>
                    <span className="font-bold text-slate-900">R$ {registerTotals.deliveryDebito.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-amber-100 flex justify-between">
                    <span className="text-slate-500">Crédito:</span>
                    <span className="font-bold text-slate-900">R$ {registerTotals.deliveryCredito.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-amber-100 flex justify-between">
                    <span className="text-slate-500">PIX:</span>
                    <span className="font-bold text-slate-900">R$ {registerTotals.deliveryPix.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>

                {registerTotals.deliveryFeesTotal > 0 && (
                  <div className="text-[10px] font-bold text-amber-800 bg-white p-1 rounded-md border border-amber-100 text-center">
                    🛵 Taxas de Entrega Inclusas: R$ {registerTotals.deliveryFeesTotal.toFixed(2).replace('.', ',')}
                  </div>
                )}
              </div>

              {/* 4. Total Consolidado */}
              <div className="p-3 bg-slate-900 text-white rounded-2xl space-y-2">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="font-extrabold uppercase text-xs">Faturamento Parcial Acumulado:</span>
                  <span className="text-emerald-400 font-black text-base">R$ {registerTotals.totalTurnover.toFixed(2).replace('.', ',')}</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 text-slate-300 font-medium">
                  <div className="flex justify-between bg-slate-800 p-2 rounded-xl border border-slate-700">
                    <span className="text-slate-400">Dinheiro:</span>
                    <span className="font-bold text-white">R$ {registerTotals.cashSales.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between bg-slate-800 p-2 rounded-xl border border-slate-700">
                    <span className="text-slate-400">Débito:</span>
                    <span className="font-bold text-white">R$ {registerTotals.debitoSales.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between bg-slate-800 p-2 rounded-xl border border-slate-700">
                    <span className="text-slate-400">Crédito:</span>
                    <span className="font-bold text-white">R$ {registerTotals.creditoSales.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between bg-slate-800 p-2 rounded-xl border border-slate-700">
                    <span className="text-slate-400">PIX:</span>
                    <span className="font-bold text-white">R$ {registerTotals.pixSales.toFixed(2).replace('.', ',')}</span>
                  </div>
                  {registerTotals.vrSales > 0 && (
                    <div className="flex justify-between bg-slate-800 p-2 rounded-xl border border-slate-700">
                      <span className="text-slate-400">VR:</span>
                      <span className="font-bold text-white">R$ {registerTotals.vrSales.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  {registerTotals.totalDiscounts > 0 && (
                    <div className="flex justify-between bg-amber-950/70 p-2 rounded-xl border border-amber-800 text-amber-200 font-bold text-xs col-span-2 sm:col-span-1">
                      <span>Descontos:</span>
                      <span className="font-black text-amber-400">- R$ {registerTotals.totalDiscounts.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                </div>

                {/* Maquininhas */}
                {Object.keys(registerTotals.machineTotals).length > 0 && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="font-extrabold text-slate-300 uppercase text-[10px] block mb-1">
                      💳 Por Maquininha / Operadora:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(registerTotals.machineTotals).map(([mName, mAmt]) => (
                        <div key={mName} className="flex justify-between bg-slate-800 p-1.5 rounded-lg border border-slate-700 text-xs">
                          <span className="font-bold text-slate-300 truncate">{mName}:</span>
                          <span className="font-black text-emerald-400">R$ {mAmt.toFixed(2).replace('.', ',')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Gaveta de Dinheiro Estimada */}
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 space-y-1.5">
                <div className="font-extrabold text-emerald-950 uppercase text-[11px] flex justify-between items-center border-b border-emerald-200 pb-1">
                  <span>5. Estimativa de Dinheiro Físico na Gaveta</span>
                  <span className="text-emerald-800 font-black text-sm">R$ {registerTotals.expectedCashInDrawer.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-slate-700 font-medium text-[11px]">
                  <div className="bg-white p-1.5 rounded-lg border border-emerald-100">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Fundo Inicial:</span>
                    <span className="font-bold text-slate-800">R$ {registerTotals.initial.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-emerald-100">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Vendas em Espécie:</span>
                    <span className="font-bold text-emerald-700">+ R$ {registerTotals.cashSales.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-emerald-100">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Suprimentos:</span>
                    <span className="font-bold text-emerald-700">+ R$ {registerTotals.suprimentos.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-emerald-100">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Sangrias:</span>
                    <span className="font-bold text-amber-700">- R$ {registerTotals.sangrias.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-200 shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => printThermalClosingReport(cashRegister, true)}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>Imprimir Térmica (Pré-Caixa)</span>
                </button>

                <button
                  type="button"
                  onClick={() => printPdfClosingReport(cashRegister, true)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-amber-400" />
                  <span>Gerar PDF / A4 (Pré-Caixa)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowPreCaixaModal(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Fechar Pré-Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RELATÓRIO / COMPROVANTE DE FECHAMENTO DE CAIXA */}
      {closedReportSession && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 text-slate-800 my-8 max-h-[90vh] flex flex-col">
            <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3 shrink-0">
              <div className="inline-flex p-2 bg-emerald-100 text-emerald-700 rounded-2xl mb-1">
                <Receipt className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">BAGÔ - Submarine & Eats</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Relatório Final de Fechamento de Caixa</p>
            </div>

            <div className="text-xs space-y-4 overflow-y-auto pr-1 flex-1">
              {/* 1. Fluxo de Abertura */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="font-extrabold text-slate-900 uppercase text-[11px] flex items-center justify-between border-b border-slate-200 pb-1">
                  <span>1. Fluxo de Abertura e Responsáveis</span>
                  <span className="text-emerald-700 font-bold">Aberto por: {closedReportSession.openedBy}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Data Abertura:</span>
                    <span className="font-bold text-slate-800">{closedReportSession.openedAt ? formatDateTimeBrasilia(closedReportSession.openedAt) : '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Data Fechamento:</span>
                    <span className="font-bold text-slate-800">{closedReportSession.closedAt ? formatDateTimeBrasilia(closedReportSession.closedAt) : '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Op. Fechamento:</span>
                    <span className="font-bold text-slate-800">{closedReportSession.closedBy || 'Operador'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Fundo Inicial:</span>
                    <span className="font-extrabold text-emerald-700">R$ {closedReportSession.initialCash.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>

              {/* 2 & 3. Resumo por Canais (Balcão vs Delivery) */}
              {(() => {
                const rep = getCashSessionMetrics(closedReportSession, orders);

                return (
                  <>
                    {/* 2. Vendas Atendimento Balcão */}
                    <div className="space-y-1.5 bg-blue-50/40 p-3 rounded-2xl border border-blue-200/80">
                      <div className="font-extrabold text-blue-950 uppercase text-[11px] flex justify-between items-center border-b border-blue-200/60 pb-1">
                        <span className="flex items-center gap-1.5">
                          <Store className="h-4 w-4 text-blue-600" />
                          <span>2. Atendimento Balcão / PDV ({rep.counterSalesCount} pedidos)</span>
                        </span>
                        <span className="text-blue-700 font-black text-sm">
                          R$ {rep.counterSalesTotal.toFixed(2).replace('.', ',')}
                        </span>
                      </div>

                      {/* Payment badges for Counter */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[11px]">
                        <div className="bg-white p-1.5 rounded-lg border border-blue-100 flex justify-between">
                          <span className="text-slate-500">Dinheiro:</span>
                          <span className="font-bold text-slate-900">R$ {rep.counterCash.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-blue-100 flex justify-between">
                          <span className="text-slate-500">Débito:</span>
                          <span className="font-bold text-slate-900">R$ {rep.counterDebito.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-blue-100 flex justify-between">
                          <span className="text-slate-500">Crédito:</span>
                          <span className="font-bold text-slate-900">R$ {rep.counterCredito.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-blue-100 flex justify-between">
                          <span className="text-slate-500">PIX:</span>
                          <span className="font-bold text-slate-900">R$ {rep.counterPix.toFixed(2).replace('.', ',')}</span>
                        </div>
                      </div>

                      {/* Detailed Counter List */}
                      {rep.counterTxs.length === 0 ? (
                        <div className="p-2 bg-white/70 border border-blue-100 rounded-xl text-center text-slate-400 italic text-[11px]">
                          Nenhuma venda de balcão registrada neste caixa.
                        </div>
                      ) : (
                        <div className="max-h-32 overflow-y-auto bg-white rounded-xl border border-blue-100 p-1.5 space-y-1">
                          {rep.counterTxs.map((st, i) => {
                            const timeStr = formatTimeBrasilia(st.timestamp);
                            const mName = formatMachineName(st.cardProvider, st.machineModel);

                            return (
                              <div key={st.id || i} className="bg-slate-50/70 p-1.5 rounded-lg border border-slate-100 flex items-center justify-between text-[11px]">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <span>#{i + 1} {st.description || 'Venda Balcão'}</span>
                                    <span className="text-[10px] text-slate-400 font-semibold">({timeStr})</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded font-bold uppercase">
                                      {st.paymentMethod || 'débito'}
                                    </span>
                                    {mName && (
                                      <span className="text-[9px] px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold">
                                        📟 {mName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="font-black text-blue-900">
                                  R$ {st.amount.toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 3. Vendas Delivery */}
                    <div className="space-y-1.5 bg-amber-50/40 p-3 rounded-2xl border border-amber-200/80">
                      <div className="font-extrabold text-amber-950 uppercase text-[11px] flex justify-between items-center border-b border-amber-200/60 pb-1">
                        <span className="flex items-center gap-1.5">
                          <Bike className="h-4 w-4 text-amber-600" />
                          <span>3. Delivery / Entregas ({rep.deliverySalesCount} pedidos)</span>
                        </span>
                        <span className="text-amber-700 font-black text-sm">
                          R$ {rep.deliverySalesTotal.toFixed(2).replace('.', ',')}
                        </span>
                      </div>

                      {/* Payment badges for Delivery */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[11px]">
                        <div className="bg-white p-1.5 rounded-lg border border-amber-100 flex justify-between">
                          <span className="text-slate-500">Dinheiro:</span>
                          <span className="font-bold text-slate-900">R$ {rep.deliveryCash.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-amber-100 flex justify-between">
                          <span className="text-slate-500">Débito:</span>
                          <span className="font-bold text-slate-900">R$ {rep.deliveryDebito.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-amber-100 flex justify-between">
                          <span className="text-slate-500">Crédito:</span>
                          <span className="font-bold text-slate-900">R$ {rep.deliveryCredito.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-amber-100 flex justify-between">
                          <span className="text-slate-500">PIX:</span>
                          <span className="font-bold text-slate-900">R$ {rep.deliveryPix.toFixed(2).replace('.', ',')}</span>
                        </div>
                      </div>

                      {rep.deliveryFeesTotal > 0 && (
                        <div className="text-[10px] font-bold text-amber-800 bg-white p-1 rounded-md border border-amber-100 text-center">
                          🛵 Taxas de Entrega Inclusas: R$ {rep.deliveryFeesTotal.toFixed(2).replace('.', ',')}
                        </div>
                      )}

                      {/* Detailed Delivery List */}
                      {rep.deliveryTxs.length === 0 ? (
                        <div className="p-2 bg-white/70 border border-amber-100 rounded-xl text-center text-slate-400 italic text-[11px]">
                          Nenhuma venda de delivery registrada neste caixa.
                        </div>
                      ) : (
                        <div className="max-h-32 overflow-y-auto bg-white rounded-xl border border-amber-100 p-1.5 space-y-1">
                          {rep.deliveryTxs.map((st, i) => {
                            const timeStr = formatTimeBrasilia(st.timestamp);
                            const mName = formatMachineName(st.cardProvider, st.machineModel);

                            return (
                              <div key={st.id || i} className="bg-slate-50/70 p-1.5 rounded-lg border border-slate-100 flex items-center justify-between text-[11px]">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <span>#{i + 1} {st.description || 'Pedido Delivery'}</span>
                                    <span className="text-[10px] text-slate-400 font-semibold">({timeStr})</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded font-bold uppercase">
                                      {st.paymentMethod || 'débito'}
                                    </span>
                                    {mName && (
                                      <span className="text-[9px] px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold">
                                        📟 {mName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="font-black text-amber-900">
                                  R$ {st.amount.toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 4. Resumo Geral Consolidado */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                      <div className="font-extrabold text-slate-900 uppercase text-[11px] border-b border-slate-200 pb-1 flex justify-between items-center">
                        <span>4. Resumo Geral Consolidado</span>
                        <span className="text-emerald-700 font-black text-sm">
                          Total: R$ {rep.totalTurnover.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 text-slate-700 font-medium">
                        <div className="flex justify-between bg-white p-2 rounded-xl border border-slate-100">
                          <span>Dinheiro Total:</span>
                          <span className="font-bold text-slate-900">R$ {rep.cashSales.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded-xl border border-slate-100">
                          <span>Débito Total:</span>
                          <span className="font-bold text-slate-900">R$ {rep.debitoSales.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded-xl border border-slate-100">
                          <span>Crédito Total:</span>
                          <span className="font-bold text-slate-900">R$ {rep.creditoSales.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded-xl border border-slate-100">
                          <span>PIX Total:</span>
                          <span className="font-bold text-slate-900">R$ {rep.pixSales.toFixed(2).replace('.', ',')}</span>
                        </div>
                        {rep.vrSales > 0 && (
                          <div className="flex justify-between bg-white p-2 rounded-xl border border-slate-100">
                            <span>VR Total:</span>
                            <span className="font-bold text-slate-900">R$ {rep.vrSales.toFixed(2).replace('.', ',')}</span>
                          </div>
                        )}
                        {rep.totalDiscounts > 0 && (
                          <div className="flex justify-between bg-amber-50 p-2 rounded-xl border border-amber-200 text-amber-900 font-bold text-xs col-span-2 sm:col-span-1">
                            <span>Descontos:</span>
                            <span className="font-black text-amber-700">- R$ {rep.totalDiscounts.toFixed(2).replace('.', ',')}</span>
                          </div>
                        )}
                      </div>

                      {/* Maquininhas */}
                      {Object.keys(rep.machineTotals).length > 0 && (
                        <div className="pt-1.5 border-t border-slate-200">
                          <span className="font-extrabold text-slate-800 uppercase text-[10px] block mb-1">
                            💳 Por Maquininha / Operadora:
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {Object.entries(rep.machineTotals).map(([mName, mAmt]) => (
                              <div key={mName} className="flex justify-between bg-white p-1.5 rounded-lg border border-slate-100 text-xs">
                                <span className="font-bold text-slate-700 truncate">{mName}:</span>
                                <span className="font-black text-emerald-700">R$ {mAmt.toFixed(2).replace('.', ',')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* 5. Movimentações da Gaveta & Conferência */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="font-extrabold text-slate-900 uppercase text-[11px] border-b border-slate-200 pb-1">
                  5. Movimentações & Conferência de Gaveta
                </div>
                <div className="space-y-1 text-slate-700 font-medium pt-1">
                  <div className="flex justify-between">
                    <span>Fundo Inicial:</span>
                    <span className="font-bold">R$ {closedReportSession.initialCash.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Esperado na Gaveta:</span>
                    <span className="font-bold text-slate-900">R$ {(closedReportSession.expectedCashInDrawer || 0).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contado na Gaveta:</span>
                    <span className="font-black text-emerald-700">R$ {(closedReportSession.actualCashInDrawer || 0).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1 font-extrabold">
                    <span>Diferença / Quebra:</span>
                    <span className={(closedReportSession.cashDifference || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      R$ {(closedReportSession.cashDifference || 0).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>

              {closedReportSession.notes && (
                <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <b>Obs:</b> {closedReportSession.notes}
                </p>
              )}
            </div>

            {/* Print & Action Buttons */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => printThermalClosingReport(closedReportSession)}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>Impressora Térmica</span>
                </button>

                <button
                  type="button"
                  onClick={() => printPdfClosingReport(closedReportSession)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-brand-yellow" />
                  <span>Gerar PDF / A4</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setClosedReportSession(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: POS ASSEMBLY CUSTOMIZATION & RULES */}
      {customizingProduct && customConfig && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-brand-green p-4 sm:p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-brand-yellow/20 p-2 rounded-2xl">
                  <SlidersHorizontal className="h-5 w-5 text-brand-yellow" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">{customizingProduct.name}</h3>
                  <p className="text-xs text-emerald-100">Personalize a montagem e regras de adicionais (PDV)</p>
                </div>
              </div>
              <button
                onClick={() => { setCustomizingProduct(null); setCustomConfig(null); }}
                className="p-1.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-800 text-xs">
              
              {/* Category Rules Summary Box */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-1 text-emerald-900">
                <p className="font-extrabold text-xs uppercase flex items-center gap-1.5 text-brand-green">
                  <Sparkles className="h-4 w-4" />
                  <span>Regras de Inclusão do Produto ({customizingProduct.category === 'salad' ? 'Salada' : 'Lanche'}):</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-semibold text-[11px]">
                  <div className="bg-white/80 p-2 rounded-xl border border-emerald-100 flex items-center gap-1.5">
                    <span>🧀 1 Queijo incluso</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-emerald-100 flex items-center gap-1.5">
                    <span>🥗 {customizingProduct.category === 'salad' ? 'Até 5 Saladas inclusas' : 'Até 3 Saladas inclusas'}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-emerald-100 flex items-center gap-1.5">
                    <span>🥣 Até 2 Molhos inclusos</span>
                  </div>
                </div>
              </div>

              {/* 1. Bread (Sandwiches / Lanches only) */}
              {customizingProduct.category !== 'salad' && (
                <div className="space-y-2.5 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80">
                  <div className="flex justify-between items-center">
                    <p className="font-extrabold text-slate-800 uppercase text-xs flex items-center gap-1.5">
                      <Wheat className="h-4 w-4 text-brand-green" />
                      <span>Escolha o Pão do Lanche:</span>
                    </p>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border ${
                      customConfig.bread 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                    }`}>
                      {customConfig.bread ? `✔ ${customConfig.bread}` : '⚠️ Obrigatório'}
                    </span>
                  </div>

                  {!customConfig.bread && (
                    <div className="p-2.5 bg-rose-100/90 border border-rose-300 rounded-xl text-rose-800 text-[11px] font-bold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>Atenção: É obrigatório selecionar o tipo de pão para adicionar este lanche ao pedido.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ingredients.filter(i => i.category === 'bread').map(bread => {
                      const isSelected = customConfig.bread === bread.name;
                      return (
                        <button
                          key={bread.id || bread.name}
                          type="button"
                          onClick={() => setCustomConfig({ ...customConfig, bread: bread.name })}
                          className={`p-2.5 rounded-xl border-2 text-left font-bold transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'border-brand-green bg-emerald-50 text-brand-green shadow-xs ring-2 ring-brand-green/20'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <span className="truncate">{bread.name}</span>
                          {isSelected && <Check className="h-4 w-4 text-brand-green shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Protein Selection */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-extrabold text-slate-800 uppercase text-xs flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-brand-green" />
                      <span>Proteína / Recheio Principal (Inclusa):</span>
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Proteína original inclusa no valor do produto.
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-50 border-2 border-brand-green p-3 rounded-xl flex items-center justify-between text-brand-green font-bold text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-brand-green" />
                    <span className="text-sm font-extrabold">{customConfig.protein || 'Proteína Padrão'}</span>
                  </div>
                  <span className="text-[10px] bg-brand-green text-white px-2 py-1 rounded-md font-extrabold uppercase tracking-wide">
                    Incluso
                  </span>
                </div>

                {/* Additional Protein Section */}
                <div className="pt-2 border-t border-dashed border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-extrabold text-slate-800 uppercase text-xs flex items-center gap-1.5 text-amber-900">
                        <span>➕ Adicionar Outra Proteína (Dobra de Proteína / Adicional Pago):</span>
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Caso queira uma 2ª proteína ou dobro, selecione abaixo para incluir como adicional pago.
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 shrink-0 ml-2">
                      {(customConfig.extras || []).filter(e => e.startsWith('Proteína Extra: ')).length} adicional(is)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ingredients.filter(i => i.category === 'protein').map((prot, idx) => {
                      const isPrimary = customConfig.protein === prot.name;
                      const tag = `Proteína Extra: ${prot.name}`;
                      const isExtraSelected = (customConfig.extras || []).includes(tag);
                      const price = prot.price > 0 ? prot.price : 6.50;

                      return (
                        <button
                          key={`extra-protein-${prot.id || idx}`}
                          onClick={() => toggleExtraProteinPos(prot.name)}
                          className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex justify-between items-center ${
                            isExtraSelected
                              ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold shadow-2xs'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{isPrimary ? `Dobra de ${prot.name}` : prot.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold border ${
                            isExtraSelected 
                              ? 'bg-amber-200 text-amber-900 border-amber-300' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            + R$ {price.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Cheese Selection */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-extrabold text-slate-800 uppercase text-xs flex items-center gap-1.5">
                      <span>🧀 Queijo Principal (Incluso):</span>
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Queijo original incluso no valor do produto.
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-50 border-2 border-brand-green p-3 rounded-xl flex items-center justify-between text-brand-green font-bold text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧀</span>
                    <span className="text-sm font-extrabold">
                      {(() => {
                        const productCfg = getSandwichConfig(customizingProduct);
                        if (productCfg?.cheese && productCfg.cheese.trim() !== '') {
                          return productCfg.cheese;
                        }
                        if (customConfig?.cheese && customConfig.cheese.trim() !== '') {
                          return customConfig.cheese;
                        }
                        return 'Sem Queijo';
                      })()}
                    </span>
                  </div>
                  <span className="text-[10px] bg-brand-green text-white px-2 py-1 rounded-md font-extrabold uppercase tracking-wide">
                    Incluso
                  </span>
                </div>

                {/* Additional Cheese Section */}
                <div className="pt-2 border-t border-dashed border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-extrabold text-slate-800 uppercase text-xs flex items-center gap-1.5 text-amber-900">
                        <span>➕ Adicionar Outro Queijo / Queijo Extra (Adicional Pago):</span>
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Adicione queijos extras se desejar. Cada opção selecionada possui o valor indicado.
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 shrink-0 ml-2">
                      {(customConfig.extras || []).filter(e => e.startsWith('Queijo Extra: ')).length} adicional(is)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ingredients.filter(i => i.category === 'cheese').map((cheese, idx) => {
                      const tag = `Queijo Extra: ${cheese.name}`;
                      const isExtraSelected = (customConfig.extras || []).includes(tag);
                      const price = cheese.price > 0 ? cheese.price : 4.50;

                      return (
                        <button
                          key={`extra-cheese-${cheese.id || idx}`}
                          onClick={() => toggleExtraCheesePos(cheese.name)}
                          className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex justify-between items-center ${
                            isExtraSelected
                              ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold shadow-2xs'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{cheese.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-extrabold ${
                            isExtraSelected 
                              ? 'bg-amber-200 text-amber-900 border-amber-300' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            + R$ {price.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Veggies Selection */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div>
                    <p className="font-extrabold text-slate-800 uppercase text-xs flex items-center gap-1.5">
                      <span>🥗 Saladas e Vegetais ({customizingProduct.category === 'salad' ? 'Até 5 Inclusos' : 'Até 3 Inclusos'}):</span>
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {customizingProduct.category === 'salad'
                        ? 'Até 5 saladas inclusas sem custo na salada.'
                        : 'Até 3 saladas inclusas sem custo no lanche.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const allVeggies = ingredients.filter(i => i.category === 'vegetable').map(i => i.name);
                        setCustomConfig({ ...customConfig, veggies: allVeggies });
                      }}
                      className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-lg text-[11px] transition-all cursor-pointer border border-emerald-300"
                      title="Selecionar todos os vegetais com 1 clique"
                    >
                      🌱 Com Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomConfig({ ...customConfig, veggies: [] })}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-[11px] transition-all cursor-pointer"
                      title="Limpar vegetais"
                    >
                      🧹 Sem Salada
                    </button>
                    <span className="text-[11px] font-bold text-slate-500 ml-1">
                      ({(customConfig.veggies || []).length})
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ingredients.filter(i => i.category === 'vegetable').map((veg, idx) => {
                    const status = getOptionStatus({
                      category: 'vegetable',
                      itemName: veg.name,
                      format: customizingProduct.category === 'salad' ? 'salad' : 'sandwich',
                      selectedItems: customConfig.veggies || [],
                      itemPrice: veg.price
                    });

                    return (
                      <button
                        key={veg.id || `veg-${idx}`}
                        onClick={() => toggleVeggiePos(veg.name)}
                        className={`p-2.5 rounded-xl border-2 text-left flex justify-between items-center transition-all cursor-pointer ${
                          status.isSelected
                            ? 'border-brand-green bg-emerald-50 text-slate-900'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-bold truncate">{veg.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-extrabold ${status.badgeColor}`}>
                          {status.badgeText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Sauce Selection */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div>
                    <p className="font-extrabold text-slate-800 uppercase text-xs flex items-center gap-1.5">
                      <span>🥣 Molhos Artesanais (Até 2 Inclusos):</span>
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Até 2 molhos inclusos sem custo {customizingProduct.category === 'salad' ? 'na salada' : 'no lanche'}.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const stdSauces = ['Maionese da Casa', 'Mostarda e Mel'];
                        setCustomConfig({ ...customConfig, sauces: stdSauces });
                      }}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-[11px] transition-all cursor-pointer border border-amber-300"
                      title="Selecionar Maionese + Mostarda e Mel"
                    >
                      🥣 Molhos Padrão
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomConfig({ ...customConfig, sauces: [] })}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-[11px] transition-all cursor-pointer"
                      title="Limpar molhos"
                    >
                      🧹 Sem Molho
                    </button>
                    <span className="text-[11px] font-bold text-slate-500 ml-1">
                      ({(customConfig.sauces || []).length})
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ingredients.filter(i => i.category === 'sauce').map((sauce, idx) => {
                    const status = getOptionStatus({
                      category: 'sauce',
                      itemName: sauce.name,
                      format: customizingProduct.category === 'salad' ? 'salad' : 'sandwich',
                      selectedItems: customConfig.sauces || [],
                      itemPrice: sauce.price
                    });

                    return (
                      <button
                        key={sauce.id || `sauce-${idx}`}
                        onClick={() => toggleSaucePos(sauce.name)}
                        className={`p-2.5 rounded-xl border-2 text-left flex justify-between items-center transition-all cursor-pointer ${
                          status.isSelected
                            ? 'border-brand-green bg-emerald-50 text-slate-900'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-bold truncate">{sauce.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-extrabold ${status.badgeColor}`}>
                          {status.badgeText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Toasting preference */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="font-extrabold text-slate-800 uppercase text-xs">Preparo e Aquecimento:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCustomConfig({ ...customConfig, toasted: true })}
                    className={`p-3 rounded-xl border-2 text-left font-bold flex items-center gap-2 cursor-pointer ${
                      customConfig.toasted
                        ? 'border-brand-green bg-emerald-50 text-brand-green'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <Flame className="h-4 w-4 shrink-0" />
                    <span>Quentinho / Tostado</span>
                  </button>
                  <button
                    onClick={() => setCustomConfig({ ...customConfig, toasted: false })}
                    className={`p-3 rounded-xl border-2 text-left font-bold flex items-center gap-2 cursor-pointer ${
                      !customConfig.toasted
                        ? 'border-brand-green bg-emerald-50 text-brand-green'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <Coffee className="h-4 w-4 shrink-0" />
                    <span>Frio / Temp. Ambiente</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              {(() => {
                const cheesesArr = customConfig.cheese && customConfig.cheese !== 'Sem Queijo' 
                  ? customConfig.cheese.split(', ').map(s => s.trim()) 
                  : [];
                const extraProteins = (customConfig.extras || [])
                  .filter(e => e.startsWith('Proteína Extra: '))
                  .map(e => e.replace('Proteína Extra: ', ''));

                const extraCheeses = (customConfig.extras || [])
                  .filter(e => e.startsWith('Queijo Extra: '))
                  .map(e => e.replace('Queijo Extra: ', ''));

                const extraPrice = calculateAssemblyExtras({
                  format: customizingProduct.category === 'salad' ? 'salad' : 'sandwich',
                  selectedCheeses: cheesesArr,
                  selectedVeggies: customConfig.veggies || [],
                  selectedSauces: customConfig.sauces || [],
                  selectedExtraProteins: extraProteins,
                  selectedExtraCheeses: extraCheeses,
                  selectedExtras: customConfig.extras || [],
                  ingredientsList: ingredients
                });
                const totalPrice = customizingProduct.price + extraPrice;

                return (
                  <>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Total do Item</p>
                      <p className="text-lg font-black text-brand-green">
                        R$ {totalPrice.toFixed(2)}
                        {extraPrice > 0 && (
                          <span className="text-xs text-amber-600 font-bold ml-1.5 bg-amber-100 px-2 py-0.5 rounded-md">
                            (+ R$ {extraPrice.toFixed(2)} extra)
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => { setCustomizingProduct(null); setCustomConfig(null); }}
                        className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={addCustomizedToCart}
                        disabled={customizingProduct.category !== 'salad' && (!customConfig.bread || !customConfig.bread.trim())}
                        className={`px-5 py-2.5 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 ${
                          customizingProduct.category !== 'salad' && (!customConfig.bread || !customConfig.bread.trim())
                            ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                            : 'bg-brand-yellow hover:bg-brand-yellow-dark text-brand-green active:scale-98'
                        }`}
                        title={customizingProduct.category !== 'salad' && (!customConfig.bread || !customConfig.bread.trim()) ? "Selecione o pão do lanche para habilitar" : "Adicionar ao pedido"}
                      >
                        <Plus className="h-4 w-4" />
                        <span>Adicionar ao Pedido</span>
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* EDIT ORDER MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="bg-brand-yellow p-2 rounded-xl text-slate-900">
                  <Pencil className="h-5 w-5 font-black" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">
                    Editar Pedido #{editingOrder.code}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Altere detalhes do cliente, pagamento, status ou itens do pedido.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              
              {/* 1. Customer Info */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                  1. Dados do Cliente e Mesa
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Nome do Cliente</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-green/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Nº da Mesa</label>
                    <input
                      type="text"
                      value={editTable}
                      onChange={(e) => setEditTable(e.target.value)}
                      placeholder="Ex: Mesa 04"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-green/20"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Tipo de Cliente</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditType('cliente')}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-bold cursor-pointer ${
                        editType === 'cliente'
                          ? 'bg-brand-green text-white border-brand-green'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      Cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditType('funcionario')}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-bold cursor-pointer ${
                        editType === 'funcionario'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      Funcionário
                    </button>
                  </div>
                </div>

                {/* Delivery & Frete section in Edit Modal */}
                <div className="pt-2 border-t border-slate-200 space-y-2.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-brand-green" />
                    <span>Tipo de Atendimento & Frete</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditDeliveryType('retirada');
                        setEditDeliveryFee('0.00');
                      }}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 ${
                        editDeliveryType === 'retirada'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>Retirada / Balcão</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditDeliveryType('entrega');
                        if (parseFloat((editDeliveryFee || '0').replace(',', '.')) <= 0) {
                          setEditDeliveryFee('5.00');
                        }
                      }}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 ${
                        editDeliveryType === 'entrega'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      <Truck className="h-3.5 w-3.5" />
                      <span>Entrega / Delivery</span>
                    </button>
                  </div>

                  {editDeliveryType === 'entrega' && (
                    <div className="space-y-2 pt-1 border-t border-slate-200 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-amber-950 uppercase">Valor do Frete (R$)</label>
                          <input
                            type="number"
                            step="0.50"
                            min="0"
                            value={editDeliveryFee}
                            onChange={(e) => setEditDeliveryFee(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-black text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-amber-950 uppercase">Endereço de Entrega</label>
                          <input
                            type="text"
                            value={editDeliveryAddress}
                            onChange={(e) => setEditDeliveryAddress(e.target.value)}
                            placeholder="Rua, Número, Bairro..."
                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Payment details */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                  2. Pagamento & Maquininha
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'debito', label: 'Débito' },
                    { id: 'credito', label: 'Crédito' },
                    { id: 'pix', label: 'PIX' },
                    { id: 'dinheiro', label: 'Dinheiro' }
                  ].map(pm => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setEditPayment(pm.id as PaymentMethod)}
                      className={`py-2 px-2 rounded-lg border text-xs font-extrabold cursor-pointer text-center ${
                        editPayment === pm.id
                          ? 'bg-slate-900 text-brand-yellow border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>

                {editPayment !== 'dinheiro' && (
                  <div className="pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Maquininha / Operadora</label>
                      <select
                        value={editProvider}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditProvider(val);
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                      >
                        {(cardMachines.filter(m => m.active).length > 0
                          ? cardMachines.filter(m => m.active)
                          : [
                              { id: 'stone', name: 'Stone' },
                              { id: 'santander', name: 'Santander' },
                              { id: 'cielo', name: 'Cielo' },
                              { id: 'outro', name: 'Outra' }
                            ]
                        ).map(mach => (
                          <option key={mach.id} value={mach.name}>
                            {mach.name}
                          </option>
                        ))}
                        {editProvider && !cardMachines.some(m => m.name.toLowerCase() === editProvider.toLowerCase()) && (
                          <option value={editProvider}>{editProvider}</option>
                        )}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Status selection */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                  3. Status do Pedido
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'pendente', label: 'Pendente' },
                    { id: 'preparo', label: 'Em Preparo' },
                    { id: 'finalizado', label: 'Pronto / Finalizado' },
                    { id: 'entregue', label: 'Entregue' },
                    { id: 'cancelado', label: 'Cancelado' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setEditStatus(st.id as OrderStatus)}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-extrabold cursor-pointer text-center ${
                        editStatus === st.id
                          ? 'bg-brand-green text-white border-brand-green shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Items in Order */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                    4. Itens do Pedido ({editItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const orderToLoad = editingOrder;
                      setEditingOrder(null);
                      handleLoadOrderIntoCart(orderToLoad);
                    }}
                    className="text-[11px] font-extrabold text-brand-green hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>Re-abrir tudo no Carrinho do PDV</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 truncate">{item.productName}</p>
                        <p className="text-slate-500 text-[11px]">R$ {Number(item.price).toFixed(2)} un.</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditItems(prev => prev.map((it, i) => {
                              if (i === idx) {
                                const newQty = it.quantity - 1;
                                return newQty > 0 ? { ...it, quantity: newQty } : null;
                              }
                              return it;
                            }).filter(Boolean));
                          }}
                          className="p-1 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                        >
                          <Minus className="h-3 w-3 text-slate-700" />
                        </button>
                        <span className="font-black text-slate-800 w-5 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditItems(prev => prev.map((it, i) => {
                              if (i === idx) {
                                return { ...it, quantity: it.quantity + 1 };
                              }
                              return it;
                            }));
                          }}
                          className="p-1 bg-brand-green text-white rounded-md hover:bg-brand-green-dark cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditItems(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 ml-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center bg-slate-900 text-white p-3 rounded-xl">
                  <div className="text-xs space-y-0.5">
                    <span className="uppercase font-extrabold text-slate-300 block">Novo Total Re-calculado:</span>
                    {editDeliveryType === 'entrega' && (
                      <span className="text-[11px] text-amber-400 font-bold block">
                        (Itens + Frete R$ {(parseFloat((editDeliveryFee || '0').replace(',', '.')) || 0).toFixed(2).replace('.', ',')})
                      </span>
                    )}
                  </div>
                  <span className="text-xl font-black text-brand-yellow">
                    R$ {(editItems.reduce((acc, it) => acc + (Number(it.price) * Number(it.quantity)), 0) + (editDeliveryType === 'entrega' ? (parseFloat((editDeliveryFee || '0').replace(',', '.')) || 0) : 0)).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const toDel = editingOrder;
                  setEditingOrder(null);
                  setOrderToDelete(toDel);
                }}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-rose-200"
                title="Excluir este pedido e devolver itens ao estoque"
              >
                <Trash2 className="h-4 w-4 text-rose-600" />
                <span>Excluir Pedido</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSaveModalEdit}
                  disabled={savingEdit}
                  className="px-5 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM DELETE ORDER MODAL (STOCK REVERSAL CONFIRMATION) */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95 duration-200 my-auto flex flex-col">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Excluir Pedido #{orderToDelete.code}?</h3>
                <p className="text-xs text-slate-500">Cliente: {orderToDelete.customerName || 'Não identificado'}</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3.5 my-2 text-xs text-rose-950 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Atenção: Devolução Automática ao Estoque</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Ao confirmar a exclusão deste pedido, todos os ingredientes e produtos vinculados (<strong>{orderToDelete.items?.length || 0} item(ns)</strong>) serão <strong>automaticamente devolvidos ao estoque</strong> no banco de dados e sincronizados em tempo real.
              </p>
              <div className="pt-1 text-[11px] text-slate-500">
                Valor Total: <strong className="text-slate-800">R$ {Number(orderToDelete.totalPrice || 0).toFixed(2).replace('.', ',')}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                disabled={deletingOrder}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOrder}
                disabled={deletingOrder}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingOrder ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Assembly Modal Window (Replicates uploaded mockup image layout) */}
      <BuildSandwichModal
        isOpen={isPosBuildModalOpen}
        onClose={() => setIsPosBuildModalOpen(false)}
        initialFormat={posBuildModalFormat}
        initialProduct={posBuildModalProduct}
        ingredients={ingredients}
        readyProducts={readyProducts}
        onAddToCart={handleAddFromBuildModalPos}
        isPos={true}
      />

      {/* Quick Bread Selection Modal for Lanches before checkout */}
      {quickBreadModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0 shadow-xs">
                  <Wheat className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-1.5">
                    <span>Qual é o Pão do Lanche?</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Selecione o pão para o pedido antes de finalizar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickBreadModalProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Product Info Banner */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 my-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={quickBreadModalProduct.image || 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=80'}
                  alt={quickBreadModalProduct.name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                  onError={(e) => {
                    (e.target as any).src = 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=80';
                  }}
                />
                <div className="min-w-0">
                  <div className="font-black text-sm text-slate-800 truncate">{quickBreadModalProduct.name}</div>
                  <div className="text-xs text-brand-green font-black">
                    R$ {Number(quickBreadModalProduct.price || 0).toFixed(2).replace('.', ',')}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 shrink-0">
                🥪 Lanche
              </span>
            </div>

            {/* Bread Selection Grid */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <label className="text-xs font-extrabold text-slate-700 uppercase flex items-center justify-between">
                <span>Escolha o Pão:</span>
                <span className="text-[10px] text-amber-600 font-bold">* Abate do estoque automático</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ingredients
                  .filter(i => (i.category || '').toLowerCase() === 'bread')
                  .map(bread => {
                    const isSelected = selectedQuickBreadId === bread.id;
                    const isOutOfStock = bread.trackStock !== false && Number(bread.stock) <= 0;
                    const hasExtraPrice = Number(bread.price) > 0;

                    return (
                      <button
                        key={bread.id}
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => setSelectedQuickBreadId(bread.id)}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                          isOutOfStock
                            ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                            : isSelected
                            ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={bread.image || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80'}
                            alt={bread.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                            onError={(e) => {
                              (e.target as any).src = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div className="min-w-0">
                            <div className={`text-xs font-black truncate ${isSelected ? 'text-amber-950' : 'text-slate-800'}`}>
                              {bread.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isOutOfStock ? (
                                <span className="text-[10px] font-extrabold text-rose-600">Esgotado</span>
                              ) : bread.trackStock === false ? (
                                <>
                                  <span className="text-[10px] font-bold text-slate-500">
                                    Estoque: <strong className="text-emerald-700">Livre</strong>
                                  </span>
                                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Incluso
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className={`text-[10px] font-bold ${Number(bread.stock) <= 10 ? 'text-amber-700' : 'text-slate-500'}`}>
                                    Estoque: <strong className={Number(bread.stock) <= 10 ? 'text-amber-800' : 'text-emerald-700'}>{bread.stock} un.</strong>
                                  </span>
                                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Incluso
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Quantity & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Quantidade:</label>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setQuickBreadQty(prev => Math.max(1, prev - 1))}
                      className="p-1.5 bg-white text-slate-700 rounded-lg shadow-xs hover:bg-slate-200 cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-black text-sm text-brand-green flex-1 text-center">{quickBreadQty}</span>
                    <button
                      type="button"
                      onClick={() => setQuickBreadQty(prev => prev + 1)}
                      className="p-1.5 bg-brand-green text-white rounded-lg shadow-xs hover:bg-brand-green-dark cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Observações (Opcional):</label>
                  <input
                    type="text"
                    value={quickBreadNotes}
                    onChange={(e) => setQuickBreadNotes(e.target.value)}
                    placeholder="Ex: Sem cebola, pão bem tostado..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 mt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const prod = quickBreadModalProduct;
                  setQuickBreadModalProduct(null);
                  openCustomizer(prod as ReadyProduct);
                }}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-extrabold rounded-xl border border-amber-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Montar ingredientes completos (queijos, saladas, molhos e adicionais)"
              >
                <SlidersHorizontal className="h-4 w-4 text-amber-600" />
                <span>Montar Completo</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setQuickBreadModalProduct(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmQuickBread}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Check className="h-4 w-4" />
                  <span>Adicionar ao Pedido</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
