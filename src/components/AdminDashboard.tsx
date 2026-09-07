import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  TrendingUp, 
  Package, 
  DollarSign, 
  ShoppingCart, 
  AlertTriangle, 
  Plus, 
  RefreshCw, 
  Layers, 
  BarChart as BarIcon,
  CheckCircle,
  FileText,
  Download,
  Edit,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  ListPlus,
  Search,
  Check,
  Camera,
  Image as ImageIcon,
  Users,
  UserPlus,
  Shield,
  Key,
  Lock,
  Unlock,
  UserCheck,
  CookingPot,
  Store,
  Filter,
  LayoutDashboard,
  History,
  Calendar,
  ReceiptText,
  Clock,
  FilePlus,
  Receipt,
  Eye,
  ShoppingBag,
  Printer,
  Table,
  LayoutGrid,
  Settings,
  Truck,
  MapPin,
  Map as MapIcon,
  Navigation,
  MessageCircle,
  Phone,
  Zap,
  Tag,
  Ticket,
  Gift,
  Share2,
  Copy,
  Percent,
  Send,
  Info,
  Instagram,
  Globe,
  CreditCard,
  Flame,
  Cpu,
  Server,
  Sparkles
} from 'lucide-react';
import { 
  APP_VERSION, 
  APP_VERSION_LABEL, 
  APP_LAST_UPDATE, 
  APP_LAST_UPDATE_TIME, 
  APP_RELEASE_NAME, 
  APP_CHANGELOG_HIGHLIGHTS 
} from '../version';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ClosedCashRegistersPanel } from './ClosedCashRegistersPanel';
import {
  getDeliverySettings,
  saveDeliverySettings,
  fetchDeliverySettingsFromApi,
  saveDeliverySettingsToDb,
  StoreDeliverySettings,
  DeliveryFeeTier
} from '../utils/deliverySettings';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart as RechartsBarChart, 
  Bar, 
  Cell,
  LabelList
} from 'recharts';
import { Ingredient, User, CustomizerStep, StepOption, ReadyProduct, PurchaseRecord, PurchaseInvoice, PurchaseInvoiceItem, Coupon, StoreInfo, DeliveryTableRow, CardMachine } from '../types';
import { formatDateBrasilia, formatTimeBrasilia, formatDateTimeBrasilia } from '../utils/dateUtils';

interface AdminDashboardProps {
  user: User;
  ingredients: Ingredient[];
  onRefreshStocks: () => void;
  onSaveIngredient?: (ingredient: Partial<Ingredient>) => void;
  onDeleteIngredient?: (ingredientId: string) => void;
  stepsConfig?: CustomizerStep[];
  onUpdateSteps?: (steps: CustomizerStep[]) => void;
  readyProducts?: ReadyProduct[];
  onUpdateReadyProduct?: (product: ReadyProduct) => void;
  onDeleteReadyProduct?: (productId: string) => void;
}

interface ReportData {
  summary: {
    totalRevenue: number;
    totalDeliveryFee?: number;
    totalOrdersCount: number;
    completedOrdersCount: number;
    averageTicket: number;
  };
  revenueChart: Array<{ name: string; Faturamento: number; Pedidos: number }>;
  sellerBreakdown?: Array<{
    sellerName: string;
    totalRevenue: number;
    ordersCount: number;
    paymentMethods: { [method: string]: number };
  }>;
  lowStockIngredients?: Array<{
    id: string;
    name: string;
    stock: number;
    unit: string;
    minStock: number;
    category?: string;
  }>;
  allSoldProducts?: Array<{
    name: string;
    category: string;
    quantity: number;
    totalRevenue: number;
  }>;
  topIngredients: Array<{ name: string; count: number }>;
  availableSellers?: string[];
  sandwichAndSaladStats?: {
    totalLanchesCount: number;
    totalLanchesRevenue: number;
    totalSaladasCount: number;
    totalSaladasRevenue: number;
    topLanches: Array<{ name: string; count: number; revenue: number }>;
    topSaladas: Array<{ name: string; count: number; revenue: number }>;
  };
}

export default function AdminDashboard({ 
  user, 
  ingredients, 
  onRefreshStocks,
  onSaveIngredient,
  onDeleteIngredient,
  stepsConfig = [],
  onUpdateSteps,
  readyProducts = [],
  onUpdateReadyProduct,
  onDeleteReadyProduct
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'sales' | 'cash-registers' | 'inventory' | 'steps' | 'ready-products' | 'users' | 'deliveries'>('sales');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [readyProductsSearch, setReadyProductsSearch] = useState<string>('');
  const [readyProductsCategory, setReadyProductsCategory] = useState<string>('all');
  const [readyProductsSubcategory, setReadyProductsSubcategory] = useState<string>('all');
  const [restockAmount, setRestockAmount] = useState<{ [key: string]: number }>({});
  const [submittingRestock, setSubmittingRestock] = useState<string | null>(null);

  // Deliveries Table State (Tabela do Banco de Dados: entregas_detalhadas)
  const [deliveriesList, setDeliveriesList] = useState<DeliveryTableRow[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [deliveriesSearch, setDeliveriesSearch] = useState('');
  const [deliveriesStartDate, setDeliveriesStartDate] = useState('');
  const [deliveriesEndDate, setDeliveriesEndDate] = useState('');
  const [deliveriesTypeFilter, setDeliveriesTypeFilter] = useState<'all' | 'entrega' | 'retirada'>('all');
  const [deliveriesStatusFilter, setDeliveriesStatusFilter] = useState<string>('all');

  // User Management & System Config States
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<{ id?: string; name: string; username: string; role: 'admin' | 'cozinha' | 'balcao'; password?: string }>({
    name: '',
    username: '',
    role: 'balcao',
    password: ''
  });
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [usersViewMode, setUsersViewMode] = useState<'table' | 'cards'>('table');

  // Store Logo Modal State
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [storeLogoInput, setStoreLogoInput] = useState(() => localStorage.getItem('bago_store_logo') || '');

  // System Config Sub-tabs & Delivery Fee State
  const [settingsSubTab, setSettingsSubTab] = useState<'users' | 'delivery' | 'schedule' | 'whatsapp' | 'coupons' | 'card-machines' | 'info' | 'system'>('users');
  const [deliveryConfig, setDeliveryConfig] = useState<StoreDeliverySettings>(() => getDeliverySettings());
  const [deliverySaveSuccess, setDeliverySaveSuccess] = useState<string | null>(null);
  const [savingDeliverySettings, setSavingDeliverySettings] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Store Information State
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({
    city: 'São Miguel - RN',
    phone: '',
    instagram: '',
    address: '',
    openingHours: 'Segunda a Sexta: 18:00 às 23:00 | Sáb e Dom: 18:00 às 00:00',
    paymentMethods: 'Pix, Cartão de Crédito, Cartão de Débito, Dinheiro',
    openingTime: 'Fechado • Abrimos às 12h00',
    showOnHomePage: true,
    latitude: '',
    longitude: ''
  });
  const [loadingStoreInfo, setLoadingStoreInfo] = useState(false);
  const [savingStoreInfo, setSavingStoreInfo] = useState(false);
  const [storeInfoFeedback, setStoreInfoFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStoreInfo = React.useCallback(async () => {
    setLoadingStoreInfo(true);
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
    } finally {
      setLoadingStoreInfo(false);
    }
  }, []);

  useEffect(() => {
    fetchStoreInfo();
  }, [fetchStoreInfo]);

  // Coupons Management State
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponDescInput, setCouponDescInput] = useState('');
  const [couponTypeInput, setCouponTypeInput] = useState<'fixed' | 'percentage'>('fixed');
  const [couponValueInput, setCouponValueInput] = useState<number | ''>(10);
  const [couponMinOrderInput, setCouponMinOrderInput] = useState<number | ''>(0);
  const [couponMaxUsesInput, setCouponMaxUsesInput] = useState<number | ''>('');
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);
  const [couponStatusFilter, setCouponStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  const fetchCoupons = React.useCallback(async () => {
    setLoadingCoupons(true);
    try {
      const res = await fetch('/api/coupons');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCoupons(data);
        }
      }
    } catch (err) {
      console.warn('Error fetching coupons:', err);
    } finally {
      setLoadingCoupons(false);
    }
  }, []);

  // Card Machines Management State
  const [cardMachines, setCardMachines] = useState<CardMachine[]>([]);
  const [loadingCardMachines, setLoadingCardMachines] = useState(false);
  const [savingCardMachine, setSavingCardMachine] = useState(false);
  const [cardMachineFeedback, setCardMachineFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [cardMachineNameInput, setCardMachineNameInput] = useState('');
  const [cardMachineModelInput, setCardMachineModelInput] = useState('');
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [cardMachineSearch, setCardMachineSearch] = useState('');
  const [machineToDelete, setMachineToDelete] = useState<CardMachine | null>(null);
  const [deletingMachineId, setDeletingMachineId] = useState<string | null>(null);

  const fetchCardMachines = React.useCallback(async () => {
    setLoadingCardMachines(true);
    try {
      const res = await fetch('/api/card-machines');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCardMachines(data);
        }
      }
    } catch (err) {
      console.warn('Error fetching card machines:', err);
    } finally {
      setLoadingCardMachines(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users' && settingsSubTab === 'card-machines') {
      fetchCardMachines();
    }
  }, [activeTab, settingsSubTab, fetchCardMachines]);

  useEffect(() => {
    if (activeTab === 'users' && settingsSubTab === 'coupons') {
      fetchCoupons();
    }
    if (activeTab === 'inventory') {
      onRefreshStocks();
    }
  }, [activeTab, settingsSubTab, fetchCoupons, onRefreshStocks]);

  const fetchDeliveriesTable = React.useCallback(async () => {
    setLoadingDeliveries(true);
    try {
      const params = new URLSearchParams();
      if (deliveriesSearch.trim()) params.append('search', deliveriesSearch.trim());
      if (deliveriesStartDate) params.append('startDate', deliveriesStartDate);
      if (deliveriesEndDate) params.append('endDate', deliveriesEndDate);
      if (deliveriesTypeFilter !== 'all') params.append('deliveryType', deliveriesTypeFilter);
      if (deliveriesStatusFilter !== 'all') params.append('status', deliveriesStatusFilter);

      const res = await fetch(`/api/deliveries-table?${params.toString()}`);
      if (res.ok) {
        const data: DeliveryTableRow[] = await res.json();
        setDeliveriesList(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.warn('Aviso ao carregar tabela de entregas:', err?.message || err);
    } finally {
      setLoadingDeliveries(false);
    }
  }, [deliveriesSearch, deliveriesStartDate, deliveriesEndDate, deliveriesTypeFilter, deliveriesStatusFilter]);

  useEffect(() => {
    if (activeTab === 'deliveries') {
      fetchDeliveriesTable();
    }
  }, [activeTab, fetchDeliveriesTable]);

  const handleGenerateRandomCode = () => {
    const prefixes = ['BAGO', 'PROMO', 'DESCONTO', 'LUNCH', 'VIP', 'ESPECIAL'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setCouponCodeInput(`${randomPrefix}${randomNum}`);
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) {
      setCouponFeedback({ type: 'error', message: 'Por favor, informe o código do cupom.' });
      return;
    }
    if (!couponValueInput || Number(couponValueInput) <= 0) {
      setCouponFeedback({ type: 'error', message: 'Por favor, informe um valor de desconto válido.' });
      return;
    }

    setSavingCoupon(true);
    setCouponFeedback(null);

    const newCoupon: Partial<Coupon> = {
      code: couponCodeInput.trim().toUpperCase(),
      description: couponDescInput.trim(),
      type: couponTypeInput,
      value: Number(couponValueInput),
      minOrderValue: Number(couponMinOrderInput) || 0,
      maxUses: couponMaxUsesInput !== '' ? Number(couponMaxUsesInput) : undefined,
      usedCount: 0,
      active: true,
      createdBy: user?.name || user?.username || 'Administrador'
    };

    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCoupon)
      });
      if (res.ok) {
        const data = await res.json();
        setCouponFeedback({
          type: 'success',
          message: data.message || `Cupom ${newCoupon.code} criado e salvo com sucesso no banco de dados!`
        });
        setCouponCodeInput('');
        setCouponDescInput('');
        setCouponValueInput(10);
        setCouponMinOrderInput(0);
        setCouponMaxUsesInput('');
        fetchCoupons();
      } else {
        const errData = await res.json();
        setCouponFeedback({ type: 'error', message: errData.error || 'Erro ao criar cupom.' });
      }
    } catch (err: any) {
      setCouponFeedback({ type: 'error', message: 'Erro ao salvar cupom: ' + (err.message || err) });
    } finally {
      setSavingCoupon(false);
      setTimeout(() => setCouponFeedback(null), 6000);
    }
  };

  const handleToggleCouponActive = async (coupon: Coupon) => {
    const updated = { ...coupon, active: !coupon.active };
    setCoupons(prev => prev.map(c => c.id === coupon.id ? updated : c));
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        fetchCoupons();
      } else {
        fetchCoupons();
      }
    } catch (err) {
      console.error('Error toggling coupon status:', err);
      fetchCoupons();
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este cupom de desconto?')) return;
    try {
      setCoupons(prev => prev.filter(c => String(c.id) !== String(id)));
      let res = await fetch(`/api/coupons/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        res = await fetch(`/api/coupons/${id}/delete`, { method: 'POST' });
      }
      fetchCoupons();
    } catch (err) {
      console.error('Error deleting coupon:', err);
      try {
        await fetch(`/api/coupons/${id}/delete`, { method: 'POST' });
      } catch (e) {}
      fetchCoupons();
    }
  };

  const handleSaveStoreInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStoreInfo(true);
    setStoreInfoFeedback(null);
    try {
      const res = await fetch('/api/settings/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeInfo)
      });
      if (res.ok) {
        const data = await res.json();
        setStoreInfoFeedback({
          type: 'success',
          message: data.message || 'Informações da loja salvas com sucesso no banco de dados!'
        });
      } else {
        setStoreInfoFeedback({
          type: 'error',
          message: 'Erro ao salvar informações da loja.'
        });
      }
    } catch (err) {
      console.error('Error saving store info:', err);
      setStoreInfoFeedback({
        type: 'error',
        message: 'Erro de conexão ao salvar informações da loja.'
      });
    } finally {
      setSavingStoreInfo(false);
      setTimeout(() => setStoreInfoFeedback(null), 6000);
    }
  };

  const handleSaveCardMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardMachineNameInput.trim()) {
      setCardMachineFeedback({ type: 'error', message: 'Por favor, informe a operadora/nome da maquininha.' });
      return;
    }

    setSavingCardMachine(true);
    setCardMachineFeedback(null);

    const machineData: Partial<CardMachine> = {
      id: editingMachineId || undefined,
      name: cardMachineNameInput.trim(),
      model: cardMachineModelInput.trim() || undefined,
      active: true
    };

    try {
      const res = await fetch('/api/card-machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(machineData)
      });
      if (res.ok) {
        const data = await res.json();
        setCardMachineFeedback({
          type: 'success',
          message: data.message || `Maquininha "${cardMachineNameInput.trim()}" salva com sucesso no banco de dados!`
        });
        setCardMachineNameInput('');
        setCardMachineModelInput('');
        setEditingMachineId(null);
        fetchCardMachines();
      } else {
        const errData = await res.json();
        setCardMachineFeedback({ type: 'error', message: errData.error || 'Erro ao salvar maquininha.' });
      }
    } catch (err: any) {
      setCardMachineFeedback({ type: 'error', message: 'Erro ao salvar maquininha: ' + (err.message || err) });
    } finally {
      setSavingCardMachine(false);
      setTimeout(() => setCardMachineFeedback(null), 6000);
    }
  };

  const handleToggleCardMachineActive = async (machine: CardMachine) => {
    const updated = { ...machine, active: !machine.active };
    setCardMachines(prev => prev.map(m => m.id === machine.id ? updated : m));
    try {
      await fetch('/api/card-machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      fetchCardMachines();
    } catch (err) {
      console.error('Error toggling card machine active status:', err);
      fetchCardMachines();
    }
  };

  const executeDeleteCardMachine = async (id: string, name: string) => {
    setDeletingMachineId(id);
    try {
      setCardMachines(prev => prev.filter(m => String(m.id) !== String(id)));
      if (editingMachineId === id) {
        setEditingMachineId(null);
        setCardMachineNameInput('');
        setCardMachineModelInput('');
      }

      let res = await fetch(`/api/card-machines/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        res = await fetch(`/api/card-machines/${id}/delete`, { method: 'POST' });
      }

      if (res.ok) {
        setCardMachineFeedback({
          type: 'success',
          message: `Maquininha "${name}" excluída com sucesso do banco de dados!`
        });
      } else {
        setCardMachineFeedback({
          type: 'error',
          message: 'Erro ao excluir maquininha no servidor.'
        });
      }
      fetchCardMachines();
    } catch (err: any) {
      console.error('Error deleting card machine:', err);
      setCardMachineFeedback({
        type: 'error',
        message: 'Erro ao excluir maquininha: ' + (err.message || err)
      });
      fetchCardMachines();
    } finally {
      setDeletingMachineId(null);
      setMachineToDelete(null);
      setTimeout(() => setCardMachineFeedback(null), 6000);
    }
  };

  const handleEditCardMachine = (machine: CardMachine) => {
    setEditingMachineId(machine.id);
    setCardMachineNameInput(machine.name);
    setCardMachineModelInput(machine.model || '');
  };

  const handleCancelEditMachine = () => {
    setEditingMachineId(null);
    setCardMachineNameInput('');
    setCardMachineModelInput('');
  };

  const handleDeliverCouponViaWhatsapp = (coupon: Coupon) => {
    const discountFormatted = coupon.type === 'percentage'
      ? `${coupon.value}% de desconto`
      : `R$ ${coupon.value.toFixed(2).replace('.', ',')} de desconto`;

    const minOrderText = coupon.minOrderValue && coupon.minOrderValue > 0
      ? ` (válido para pedidos acima de R$ ${coupon.minOrderValue.toFixed(2).replace('.', ',')})`
      : '';

    const text = `Olá! 🎉 A Baguncita Lanches preparou um cupom de desconto especial para você!\n\n🎟️ Cupom: *${coupon.code}*\n💰 Vantagem: *${discountFormatted}*${minOrderText}\n\nPeça agora mesmo pelo nosso cardápio online e aproveite! 🍔🍟🥤`;
    
    const encodedText = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  const handleCaptureStoreGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocalização não é suportada por este navegador.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        
        let newAddress = deliveryConfig.storeAddress;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data.address) {
              const road = data.address.road || data.address.pedestrian || data.address.suburb || '';
              const houseNumber = data.address.house_number || '';
              const neighbourhood = data.address.suburb || data.address.neighbourhood || data.address.city_district || '';
              const city = data.address.city || data.address.town || data.address.village || '';
              const parts = [road, houseNumber ? `nº ${houseNumber}` : '', neighbourhood, city].filter(Boolean);
              if (parts.length > 0) {
                newAddress = parts.join(', ');
              }
            }
          }
        } catch (e) {
          console.warn('Reverse geocode error:', e);
        }

        setDeliveryConfig(prev => ({
          ...prev,
          storeLat: lat,
          storeLng: lng,
          storeAddress: newAddress
        }));
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        setGpsError('Não foi possível obter a localização GPS. Verifique se deu permissão ao navegador.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    fetchDeliverySettingsFromApi().then(settings => {
      if (settings) {
        setDeliveryConfig(settings);
      }
    });

    fetch('/api/settings/logo')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.logoUrl === 'string') {
          setStoreLogoInput(data.logoUrl);
          localStorage.setItem('bago_store_logo', data.logoUrl);
          window.dispatchEvent(new Event('store_logo_updated'));
        }
      })
      .catch(err => console.warn('Aviso ao carregar logo do banco:', err));
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.warn('Aviso ao carregar usuários:', err?.message || err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const handleSaveUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);

    if (!editingUser.name || !editingUser.username || !editingUser.role) {
      setUserError('Preencha os campos obrigatórios (Nome, Usuário e Permissão).');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingUser,
          requesterRole: user.role
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setUserError(data.error || 'Erro ao salvar usuário.');
        return;
      }

      setUserSuccess(editingUser.id ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
      setIsEditingUser(false);
      setEditingUser({ name: '', username: '', role: 'balcao', password: '', logoUrl: '' });
      fetchUsers();
    } catch (err) {
      setUserError('Erro ao comunicar com o servidor.');
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!deletingUser) return;
    try {
      const res = await fetch(`/api/users/${deletingUser.id}?requesterRole=${user.role}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Erro ao excluir usuário.');
        return;
      }
      setDeletingUser(null);
      fetchUsers();
    } catch (err) {
      alert('Erro de conexão ao excluir usuário.');
    }
  };

  // States for ingredient/stock item management
  const [isEditingIngredient, setIsEditingIngredient] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Partial<Ingredient> | null>(null);
  const [deletingIngredient, setDeletingIngredient] = useState<Ingredient | null>(null);

  // States for ingredient photo management
  const [photoModalIngredient, setPhotoModalIngredient] = useState<Ingredient | null>(null);
  const [ingredientPhotoUrlInput, setIngredientPhotoUrlInput] = useState<string>('');

  // States for Quick Restock modal (Repor Rápido)
  const [quickRestockIngredient, setQuickRestockIngredient] = useState<Ingredient | null>(null);
  const [restockDate, setRestockDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [restockExpirationDate, setRestockExpirationDate] = useState<string>('');
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockUnitCost, setRestockUnitCost] = useState<number>(0);
  const [restockTotalCost, setRestockTotalCost] = useState<number>(0);

  // States for Purchase History modal
  const [historyIngredient, setHistoryIngredient] = useState<Ingredient | null>(null);
  const [historyRecords, setHistoryRecords] = useState<PurchaseRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // States for Launch Invoice Modal (Lançar Nota Fiscal em Lote)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceSupplier, setInvoiceSupplier] = useState<string>('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState<boolean>(false);
  const [invoiceDate, setInvoiceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');
  const [invoiceTotalPaid, setInvoiceTotalPaid] = useState<number>(0);
  const [invoiceItems, setInvoiceItems] = useState<PurchaseInvoiceItem[]>([
    { ingredientId: '', quantity: 1, unitPrice: 0, totalCost: 0, expirationDate: '' }
  ]);
  const [submittingInvoice, setSubmittingInvoice] = useState<boolean>(false);

  // States for Invoices History Modal (Notas Lançadas)
  const [isInvoicesListOpen, setIsInvoicesListOpen] = useState<boolean>(false);
  const [invoicesList, setInvoicesList] = useState<PurchaseInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);
  const [invoicesSearch, setInvoicesSearch] = useState<string>('');
  const [selectedDetailInvoice, setSelectedDetailInvoice] = useState<PurchaseInvoice | null>(null);

  const photoSuggestionsByCategory: { [key: string]: { label: string; url: string }[] } = {
    bread: [
      { label: 'Pão Italiano', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80' },
      { label: 'Pão 3 Queijos / Baguete', url: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&auto=format&fit=crop&q=80' },
      { label: 'Pão Parmesão & Ervas', url: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&auto=format&fit=crop&q=80' },
      { label: 'Pão Brioche / Artesanal', url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400&auto=format&fit=crop&q=80' }
    ],
    protein: [
      { label: 'Frango Grelhado / Teriyaki', url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&auto=format&fit=crop&q=80' },
      { label: 'Carne Defumada / Costela', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80' },
      { label: 'Bife / Hambúrguer', url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=400&auto=format&fit=crop&q=80' },
      { label: 'Atum / Pescado', url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&auto=format&fit=crop&q=80' },
      { label: 'Vegano / Falafel', url: 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=400&auto=format&fit=crop&q=80' }
    ],
    cheese: [
      { label: 'Queijo Prato / Fatiado', url: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&auto=format&fit=crop&q=80' },
      { label: 'Queijo Cheddar Derretido', url: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=400&auto=format&fit=crop&q=80' },
      { label: 'Queijo Suíço', url: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=400&auto=format&fit=crop&q=80' }
    ],
    vegetable: [
      { label: 'Alface Fresca', url: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=400&auto=format&fit=crop&q=80' },
      { label: 'Tomates Fatiados', url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&auto=format&fit=crop&q=80' },
      { label: 'Pepino Fresco', url: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=400&auto=format&fit=crop&q=80' },
      { label: 'Cebola Roxa', url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cf?w=400&auto=format&fit=crop&q=80' },
      { label: 'Azeitonas Pretas', url: 'https://images.unsplash.com/photo-1563822249510-04678c787311?w=400&auto=format&fit=crop&q=80' },
      { label: 'Picles', url: 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?w=400&auto=format&fit=crop&q=80' }
    ],
    sauce: [
      { label: 'Maionese / Molho Branco', url: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&auto=format&fit=crop&q=80' },
      { label: 'Mostarda & Mel / Amarela', url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80' },
      { label: 'Barbecue Defumado', url: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=400&auto=format&fit=crop&q=80' },
      { label: 'Azeite de Oliva Extra Virgem', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' }
    ],
    extra: [
      { label: 'Bacon Crocante', url: 'https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=400&auto=format&fit=crop&q=80' },
      { label: 'Cream Cheese / Requeijão', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80' },
      { label: 'Pepperoni / Salame', url: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=400&auto=format&fit=crop&q=80' },
      { label: 'Batata Frita / Porção', url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400&auto=format&fit=crop&q=80' }
    ],
    drink_cookie: [
      { label: 'Refrigerante Lata / Cola', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80' },
      { label: 'Lata Guaraná / Bebida', url: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&auto=format&fit=crop&q=80' },
      { label: 'Água Mineral', url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80' },
      { label: 'Cookie de Chocolate', url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&auto=format&fit=crop&q=80' },
      { label: 'Cookie Macadâmia', url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80' }
    ],
    juice: [
      { label: 'Suco de Laranja', url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&auto=format&fit=crop&q=80' },
      { label: 'Suco Detox Verde', url: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&auto=format&fit=crop&q=80' },
      { label: 'Suco de Limão / Limonada', url: 'https://images.unsplash.com/photo-1523371054106-bbf80586c38c?w=400&auto=format&fit=crop&q=80' },
      { label: 'Suco de Maracujá', url: 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=400&auto=format&fit=crop&q=80' }
    ],
    vitamin: [
      { label: 'Vitamina de Morango', url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80' },
      { label: 'Vitamina de Açaí', url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&auto=format&fit=crop&q=80' },
      { label: 'Vitamina de Banana / Mamão', url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80' }
    ],
    smoothie: [
      { label: 'Smoothie Tropical', url: 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=400&auto=format&fit=crop&q=80' },
      { label: 'Smoothie Frutas Vermelhas', url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=80' },
      { label: 'Smoothie Verde Fit', url: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&auto=format&fit=crop&q=80' }
    ],
    sandwich: [
      { label: 'Sub Frango Teriyaki', url: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&auto=format&fit=crop&q=80' },
      { label: 'Sub Carne BMT', url: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=400&auto=format&fit=crop&q=80' },
      { label: 'Sub Steak Cheddar', url: 'https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=400&auto=format&fit=crop&q=80' },
      { label: 'Sub Veggie Delite', url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&auto=format&fit=crop&q=80' }
    ],
    salad: [
      { label: 'Salada Caesar com Frango', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&auto=format&fit=crop&q=80' },
      { label: 'Salada Tropical Fit', url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&auto=format&fit=crop&q=80' }
    ],
    drink: [
      { label: 'Refrigerante Lata', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80' },
      { label: 'Suco Natural', url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&auto=format&fit=crop&q=80' }
    ],
    cookie: [
      { label: 'Cookie de Chocolate', url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&auto=format&fit=crop&q=80' },
      { label: 'Cookie Macadâmia', url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80' }
    ],
    kitchen: [
      { label: 'Açúcar Refinado', url: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400&auto=format&fit=crop&q=80' },
      { label: 'Sal Refinado', url: 'https://images.unsplash.com/photo-1518110168401-f2878ea56f91?w=400&auto=format&fit=crop&q=80' },
      { label: 'Óleo de Cozinha', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80' },
      { label: 'Temperos Especiais', url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80' },
      { label: 'Guardanapos / Embalagens', url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&auto=format&fit=crop&q=80' }
    ]
  };

  // States for step editing
  const [localSteps, setLocalSteps] = useState<CustomizerStep[]>([]);
  const [expandedStepId, setExpandedStepId] = useState<number | null>(null);
  const [stepItemSearch, setStepItemSearch] = useState<string>('');
  const [stepCategoryOverride, setStepCategoryOverride] = useState<{ [stepId: number]: string }>({});

  const getStepDefaultCategory = (stepId: number): string | null => {
    switch (stepId) {
      case 1: return 'bread';
      case 3: return 'protein';
      case 4: return 'cheese';
      case 6: return 'vegetable';
      case 7: return 'sauce';
      case 8: return 'extra';
      case 9: return 'drink_cookie';
      default: return null;
    }
  };

  const addStepOption = (stepId: number) => {
    setLocalSteps(prev => prev.map(step => {
      if (step.id !== stepId) return step;
      const currentOpts = step.options && step.options.length > 0 
        ? step.options 
        : (step.id === 2 ? [
            { id: 'opt-15cm', label: 'Sub 15cm (Tamanho Padrão)', value: '15cm', description: 'Tamanho Individual Padrão', priceAdd: 0 }
          ] : []);

      const newOpt: StepOption = {
        id: `opt-${Date.now()}`,
        label: step.id === 2 ? 'Nova Variante' : 'Nova Opção',
        value: step.id === 2 ? 'variante' : `opcao-${currentOpts.length + 1}`,
        description: step.id === 2 ? 'Descrição da variante' : 'Descrição da opção',
        priceAdd: 0
      };
      return { ...step, options: [...currentOpts, newOpt] };
    }));
  };

  const updateStepOption = (stepId: number, optIndex: number, field: keyof StepOption, value: any) => {
    setLocalSteps(prev => prev.map(step => {
      if (step.id !== stepId) return step;
      const baseOpts = step.options && step.options.length > 0
        ? step.options
        : (step.id === 2 ? [
            { id: 'opt-15cm', label: 'Sub 15cm (Tamanho Padrão)', value: '15cm', description: 'Tamanho Individual Padrão', priceAdd: 0 }
          ] : []);
      const currentOpts = [...baseOpts];
      if (currentOpts[optIndex]) {
        currentOpts[optIndex] = { ...currentOpts[optIndex], [field]: value };
      }
      return { ...step, options: currentOpts };
    }));
  };

  const removeStepOption = (stepId: number, optIndex: number) => {
    setLocalSteps(prev => prev.map(step => {
      if (step.id !== stepId) return step;
      const baseOpts = step.options && step.options.length > 0
        ? step.options
        : (step.id === 2 ? [
            { id: 'opt-15cm', label: 'Sub 15cm (Tamanho Padrão)', value: '15cm', description: 'Tamanho Individual Padrão', priceAdd: 0 }
          ] : []);
      const currentOpts = [...baseOpts];
      currentOpts.splice(optIndex, 1);
      return { ...step, options: currentOpts };
    }));
  };

  const toggleItemInStep = (stepId: number, itemId: string) => {
    setLocalSteps(prev => prev.map(step => {
      if (step.id !== stepId) return step;
      const currentAllowed = step.allowedItems || [];
      const exists = currentAllowed.includes(itemId);
      const updatedAllowed = exists 
        ? currentAllowed.filter(id => id !== itemId)
        : [...currentAllowed, itemId];
      return { ...step, allowedItems: updatedAllowed };
    }));
  };

  const selectAllCategoryForStep = (stepId: number, category: string) => {
    const categoryItemIds = ingredients.filter(i => i.category === category).map(i => i.id);
    setLocalSteps(prev => prev.map(step => {
      if (step.id !== stepId) return step;
      const currentAllowed = step.allowedItems || [];
      const newAllowed = Array.from(new Set([...currentAllowed, ...categoryItemIds]));
      return { ...step, allowedItems: newAllowed };
    }));
  };

  const clearStepItems = (stepId: number) => {
    setLocalSteps(prev => prev.map(step => {
      if (step.id !== stepId) return step;
      return { ...step, allowedItems: [] };
    }));
  };
  
  // States for ready product management
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<ReadyProduct> | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ReadyProduct | null>(null);
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [photoModalReadyProduct, setPhotoModalReadyProduct] = useState<ReadyProduct | null>(null);
  const [readyProductPhotoUrlInput, setReadyProductPhotoUrlInput] = useState<string>('');

  // States for Combo management
  const [comboItemSearch, setComboItemSearch] = useState<string>('');
  const [comboCategoryFilter, setComboCategoryFilter] = useState<string>('all');

  // List of beverages, juices, vitamins and addons available to assemble a combo
  const availableComboSourceItems = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      category: string;
      price: number;
      image?: string;
      type: 'juice' | 'vitamin' | 'drink' | 'addon' | 'other';
    }> = [];

    // 1. From ingredients
    ingredients.forEach(ing => {
      const cat = (ing.category || '').toLowerCase();
      const name = (ing.name || '').toLowerCase();
      const subcat = (ing.subcategory || '').toLowerCase();

      let type: 'juice' | 'vitamin' | 'drink' | 'addon' | 'other' = 'other';
      if (cat === 'juice' || subcat.includes('suco') || name.includes('suco')) {
        type = 'juice';
      } else if (cat === 'vitamin' || subcat.includes('vitamina') || name.includes('vitamina') || name.includes('shake')) {
        type = 'vitamin';
      } else if (cat === 'drink_cookie' || cat === 'drink' || name.includes('agua') || name.includes('água') || name.includes('coca') || name.includes('guarana') || name.includes('refrigerante') || subcat.includes('bebida')) {
        type = 'drink';
      } else if (cat === 'extra' || cat === 'addon' || subcat.includes('acompanhamento') || name.includes('batata') || name.includes('cookie')) {
        type = 'addon';
      }

      if (type !== 'other' || cat === 'drink_cookie' || cat === 'extra') {
        list.push({
          id: `ing-${ing.id}`,
          name: ing.name,
          category: ing.category,
          price: ing.price || 0,
          image: ing.image,
          type
        });
      }
    });

    // 2. From ready products that are drinks, cookies or addons
    (readyProducts || []).forEach(rp => {
      if (rp.category === 'drink' || rp.category === 'cookie' || rp.category === 'addon') {
        const name = (rp.name || '').toLowerCase();
        let type: 'juice' | 'vitamin' | 'drink' | 'addon' | 'other' = 'drink';
        if (name.includes('suco')) type = 'juice';
        else if (name.includes('vitamina')) type = 'vitamin';
        else if (rp.category === 'addon' || rp.category === 'cookie') type = 'addon';

        if (!list.some(l => l.name.toLowerCase() === rp.name.toLowerCase())) {
          list.push({
            id: `rp-${rp.id}`,
            name: rp.name,
            category: rp.category,
            price: rp.price || 0,
            image: rp.image,
            type
          });
        }
      }
    });

    return list;
  }, [ingredients, readyProducts]);

  // Helper to get today's date string formatted as YYYY-MM-DD
  const getTodayDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Sales Report Date & Hour & User Filter & Sold Modal States
  const [reportStartDate, setReportStartDate] = useState<string>(getTodayDateStr);
  const [reportEndDate, setReportEndDate] = useState<string>(getTodayDateStr);
  const [reportStartHour, setReportStartHour] = useState<string>('');
  const [reportEndHour, setReportEndHour] = useState<string>('');
  const [reportSelectedUser, setReportSelectedUser] = useState<string>('all');
  const [isAllSoldModalOpen, setIsAllSoldModalOpen] = useState<boolean>(false);
  const [soldProductsSearch, setSoldProductsSearch] = useState<string>('');
  const [soldProductsCategoryFilter, setSoldProductsCategoryFilter] = useState<string>('all');

  const reportAbortControllerRef = useRef<AbortController | null>(null);

  // Fetch report data
  const fetchReport = useCallback(async (isRetry = false) => {
    if (reportAbortControllerRef.current) {
      reportAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    reportAbortControllerRef.current = controller;

    setLoading(true);
    try {
      let url = `/api/reports/sales?role=admin`;
      if (reportStartDate) url += `&startDate=${reportStartDate}`;
      if (reportEndDate) url += `&endDate=${reportEndDate}`;
      if (reportStartHour) url += `&startHour=${reportStartHour}`;
      if (reportEndHour) url += `&endHour=${reportEndHour}`;
      if (reportSelectedUser && reportSelectedUser !== 'all') url += `&seller=${encodeURIComponent(reportSelectedUser)}`;
      
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn('[AdminDashboard] Resposta não-OK ao buscar relatório:', errData?.error || res.statusText);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Requisição anterior cancelada propositalmente por nova busca ou desmontagem
        return;
      }
      // Se houver instabilidade momentânea ou reinício do servidor, tenta novamente uma vez
      if (!isRetry) {
        setTimeout(() => {
          fetchReport(true);
        }, 1000);
        return;
      }
      console.warn('[AdminDashboard] Aviso ao buscar dados do relatório:', err?.message || err);
    } finally {
      if (reportAbortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [reportStartDate, reportEndDate, reportStartHour, reportEndHour, reportSelectedUser]);

  useEffect(() => {
    fetchReport();
    return () => {
      if (reportAbortControllerRef.current) {
        reportAbortControllerRef.current.abort();
      }
    };
  }, [fetchReport, ingredients?.length]);

  const handleExportSoldProductsPDF = () => {
    if (!report || !report.allSoldProducts) return;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setTextColor(0, 150, 64);
    doc.text('Relatório de Produtos e Insumos Vendidos', 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const dateRangeStr = reportStartDate || reportEndDate
      ? `Período: ${reportStartDate || 'Início'} até ${reportEndDate || 'Hoje'}`
      : 'Período: Todos os Registros';
    const timeRangeStr = reportStartHour || reportEndHour
      ? ` | Horário: ${reportStartHour || '00:00'} às ${reportEndHour || '23:59'}`
      : '';
    const userFilterStr = reportSelectedUser && reportSelectedUser !== 'all'
      ? ` | Vendedor: ${reportSelectedUser}`
      : '';
    doc.text(`${dateRangeStr}${timeRangeStr}${userFilterStr} | Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 25);

    const filteredItems = report.allSoldProducts.filter(p => {
      if (soldProductsCategoryFilter !== 'all' && p.category !== soldProductsCategoryFilter) return false;
      if (soldProductsSearch && !p.name.toLowerCase().includes(soldProductsSearch.toLowerCase())) return false;
      return true;
    });

    const totalQty = filteredItems.reduce((sum, p) => sum + p.quantity, 0);
    const totalVal = filteredItems.reduce((sum, p) => sum + p.totalRevenue, 0);
    doc.text(`Total de Itens: ${totalQty} un. | Faturamento Total: R$ ${totalVal.toFixed(2).replace('.', ',')}`, 14, 31);

    const tableData = filteredItems.map(p => [
      p.name,
      p.category === 'lanches' ? 'Lanches / Subs' : p.category === 'saladas' ? 'Saladas' : p.category === 'bebidas' ? 'Bebidas' : p.category === 'sobremesas' ? 'Sobremesas' : 'Outros',
      `${p.quantity} un.`,
      `R$ ${p.totalRevenue.toFixed(2).replace('.', ',')}`
    ]);

    autoTable(doc, {
      startY: 36,
      head: [['Produto / Insumo', 'Categoria', 'Qtd Vendida', 'Faturamento Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 150, 64], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    doc.save(`relatorio-produtos-vendidos-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  useEffect(() => {
    if (stepsConfig && stepsConfig.length > 0) {
      setLocalSteps(stepsConfig);
    }
  }, [stepsConfig]);

  const openQuickRestockModal = (ing: Ingredient) => {
    setQuickRestockIngredient(ing);
    setRestockDate(new Date().toISOString().split('T')[0]);
    setRestockExpirationDate('');
    const initialQty = restockAmount[ing.id] > 0 ? restockAmount[ing.id] : 10;
    setRestockQty(initialQty);
    const initialUnitCost = ing.purchasePrice || 0;
    setRestockUnitCost(initialUnitCost);
    setRestockTotalCost(Number((initialUnitCost * initialQty).toFixed(2)));
  };

  const handleConfirmQuickRestock = async () => {
    if (!quickRestockIngredient) return;
    const ingredientId = quickRestockIngredient.id;
    if (!restockQty || restockQty <= 0) return;

    setSubmittingRestock(ingredientId);
    try {
      const res = await fetch('/api/ingredients/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId,
          amount: restockQty,
          purchasePrice: restockUnitCost,
          restockDate,
          expirationDate: restockExpirationDate,
          role: 'admin'
        })
      });

      if (res.ok) {
        setRestockAmount(prev => ({ ...prev, [ingredientId]: 0 }));
        const currentIng = quickRestockIngredient;
        setQuickRestockIngredient(null);
        onRefreshStocks();
        fetchReport();

        if (historyIngredient && historyIngredient.id === ingredientId) {
          openPurchaseHistoryModal(currentIng);
        }
      }
    } catch (err) {
      console.error('Erro ao reabastecer estoque:', err);
    } finally {
      setSubmittingRestock(null);
    }
  };

  const openPurchaseHistoryModal = async (ing: Ingredient) => {
    setHistoryIngredient(ing);
    setLoadingHistory(true);
    setHistoryRecords([]);
    try {
      const res = await fetch(`/api/ingredients/history/${ing.id}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryRecords(data);
      }
    } catch (err) {
      console.error('Erro ao buscar histórico de compras:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Unique list of previously registered suppliers for auto-complete
  const uniqueSuppliers: string[] = Array.from(
    new Set(
      invoicesList
        .map(inv => inv.supplier?.trim())
        .filter((s): s is string => Boolean(s && s.length > 0))
    )
  );

  const filteredSupplierSuggestions = uniqueSuppliers.filter((s: string) =>
    s.toLowerCase().includes(invoiceSupplier.trim().toLowerCase())
  );

  // Invoice Batch Launch Helper Functions
  const openNewInvoiceModal = async () => {
    setInvoiceNumber('');
    setInvoiceSupplier('');
    setShowSupplierDropdown(false);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setInvoiceNotes('');
    setInvoiceTotalPaid(0);
    const defaultIng = ingredients[0];
    const defaultPrice = defaultIng?.purchasePrice || 0;
    setInvoiceItems([
      { ingredientId: defaultIng?.id || '', quantity: 1, unitPrice: defaultPrice, totalCost: defaultPrice, expirationDate: '' }
    ]);
    setIsInvoiceModalOpen(true);

    try {
      const res = await fetch('/api/invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoicesList(data);
      }
    } catch (err) {
      console.error('Erro ao buscar notas fiscais para fornecedores:', err);
    }
  };

  const addInvoiceItemRow = () => {
    const defaultIng = ingredients[0];
    const defaultPrice = defaultIng?.purchasePrice || 0;
    setInvoiceItems(prev => [
      ...prev,
      { ingredientId: defaultIng?.id || '', quantity: 1, unitPrice: defaultPrice, totalCost: defaultPrice, expirationDate: '' }
    ]);
  };

  const removeInvoiceItemRow = (index: number) => {
    if (invoiceItems.length <= 1) return;
    setInvoiceItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateInvoiceItem = (index: number, field: keyof PurchaseInvoiceItem, value: any) => {
    setInvoiceItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'ingredientId') {
        const ing = ingredients.find(i => i.id === value);
        if (ing) {
          item.ingredientName = ing.name;
          item.unit = ing.unit;
          item.unitPrice = ing.purchasePrice || 0;
          item.totalCost = Number((item.quantity * item.unitPrice).toFixed(2));
        }
      } else if (field === 'quantity') {
        const qty = Number(value) || 0;
        item.quantity = qty;
        item.totalCost = Number((qty * item.unitPrice).toFixed(2));
      } else if (field === 'unitPrice') {
        const price = Number(value) || 0;
        item.unitPrice = price;
        item.totalCost = Number((item.quantity * price).toFixed(2));
      } else if (field === 'totalCost') {
        const total = Number(value) || 0;
        item.totalCost = total;
        if (item.quantity > 0) {
          item.unitPrice = Number((total / item.quantity).toFixed(2));
        }
      }

      updated[index] = item;

      // Auto update total invoice paid
      const newItemsSum = updated.reduce((sum, it) => sum + Number(it.totalCost || 0), 0);
      setInvoiceTotalPaid(Number(newItemsSum.toFixed(2)));

      return updated;
    });
  };

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) {
      alert('Por favor, informe o número da nota fiscal ou cupom.');
      return;
    }

    const validItems = invoiceItems.filter(it => it.ingredientId && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      alert('Adicione pelo menos um item válido na nota.');
      return;
    }

    setSubmittingInvoice(true);
    try {
      const computedTotal = validItems.reduce((sum, it) => sum + Number(it.totalCost || 0), 0);
      const finalAmount = invoiceTotalPaid > 0 ? invoiceTotalPaid : computedTotal;

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber,
          supplier: invoiceSupplier,
          purchaseDate: invoiceDate,
          totalAmount: finalAmount,
          notes: invoiceNotes,
          items: validItems,
          role: 'admin'
        })
      });

      if (res.ok) {
        setIsInvoiceModalOpen(false);
        onRefreshStocks();
        fetchReport();
        alert(`Nota Fiscal ${invoiceNumber} lançada com sucesso! ${validItems.length} item(ns) atualizado(s) no estoque.`);
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao lançar nota fiscal.');
      }
    } catch (err) {
      console.error('Erro ao salvar nota fiscal:', err);
      alert('Erro de conexão ao salvar nota fiscal.');
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const openInvoicesListModal = async () => {
    setIsInvoicesListOpen(true);
    setLoadingInvoices(true);
    try {
      const res = await fetch('/api/invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoicesList(data);
      }
    } catch (err) {
      console.error('Erro ao buscar lista de notas:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);
  const [invoiceSuccessAlert, setInvoiceSuccessAlert] = useState<string | null>(null);

  const confirmDeleteInvoice = async (invoice: PurchaseInvoice) => {
    setDeletingInvoiceId(invoice.id);
    setDeleteErrorMsg(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' })
      });

      if (res.ok) {
        setInvoicesList(prev => prev.filter(inv => inv.id !== invoice.id));
        if (selectedDetailInvoice?.id === invoice.id) {
          setSelectedDetailInvoice(null);
        }
        onRefreshStocks();
        fetchReport();
        setInvoiceToDelete(null);
        setInvoiceSuccessAlert(`Nota Fiscal nº "${invoice.invoiceNumber}" excluída e itens descontados do estoque com sucesso!`);
        setTimeout(() => setInvoiceSuccessAlert(null), 6000);
      } else {
        const data = await res.json();
        setDeleteErrorMsg(data.error || 'Erro ao excluir nota fiscal.');
      }
    } catch (err) {
      console.error('Erro ao excluir nota fiscal:', err);
      setDeleteErrorMsg('Erro de conexão ao tentar excluir a nota fiscal.');
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  const allSubcategories = Array.from(
    new Set([
      'Insumos Básicos',
      'Temperos e Condimentos',
      'Óleos e Líquidos',
      'Grãos e Farinhas',
      'Embalagens e Descartáveis',
      'Limpeza e Higiene',
      ...ingredients
        .map(i => i.subcategory)
        .filter((s): s is string => Boolean(s && s.trim()))
    ])
  );

  const handleRestock = async (ingredientId: string) => {
    const amount = restockAmount[ingredientId];
    if (!amount || amount <= 0) return;

    setSubmittingRestock(ingredientId);
    try {
      const res = await fetch('/api/ingredients/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId,
          amount,
          role: 'admin'
        })
      });

      if (res.ok) {
        // Clear input state
        setRestockAmount(prev => ({ ...prev, [ingredientId]: 0 }));
        // Callback to parent to update general stock state
        onRefreshStocks();
        // Reload dashboard report stats
        fetchReport();
      }
    } catch (err) {
      console.error('Erro ao reabastecer estoque:', err);
    } finally {
      setSubmittingRestock(null);
    }
  };

  // Inventory view scope state: PDV ingredients vs Kitchen stock vs All
  const [inventoryTab, setInventoryTab] = useState<'pdv' | 'kitchen' | 'all'>('pdv');

  // Low stock ingredients list
  const lowStockIngredients = ingredients.filter(ing => (ing.trackStock !== false) && ing.stock <= ing.minStock && ing.id !== 'queijo-nenhum');

  const categories = [
    { id: 'all', label: 'Todos' },
    { id: 'bread', label: 'Pão' },
    { id: 'vegetable', label: 'Saladas' },
    { id: 'drink_cookie', label: 'Bebidas' },
    { id: 'juice', label: 'Sucos' },
    { id: 'vitamin', label: 'Vitaminas' },
    { id: 'smoothie', label: 'Smoothies' },
    { id: 'protein', label: 'Proteínas' },
    { id: 'cheese', label: 'Queijos' },
    { id: 'sauce', label: 'Molhos' },
    { id: 'extra', label: 'Adicionais' },
    { id: 'kitchen', label: 'Estoque da Cozinha' }
  ];

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'bread': return 'Pão';
      case 'protein': return 'Proteína';
      case 'cheese': return 'Queijo';
      case 'vegetable': return 'Salada';
      case 'sauce': return 'Molho';
      case 'extra': return 'Adicional';
      case 'drink_cookie': return 'Bebida';
      case 'juice': return 'Suco';
      case 'vitamin': return 'Vitamina';
      case 'smoothie': return 'Smoothie';
      case 'juice_smoothie': return 'Suco / Vitamina / Smoothie';
      case 'kitchen': return 'Estoque da Cozinha (Interno)';
      default: return cat;
    }
  };

  const filteredIngredients = ingredients.filter(ing => {
    if (ing.id === 'queijo-nenhum') return false;

    // Filter by stock scope (PDV vs Cozinha vs Todos)
    if (inventoryTab === 'pdv' && ing.category === 'kitchen') return false;
    if (inventoryTab === 'kitchen' && ing.category !== 'kitchen') return false;

    const matchesCategory = selectedCategory === 'all' || ing.category === selectedCategory;
    const matchesSearch = !inventorySearch || ing.name.toLowerCase().includes(inventorySearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const exportInventoryPDF = () => {
    const doc = new jsPDF();

    // Title & Header
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Relatório de Controle de Estoque e Insumos', 14, 20);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    const nowStr = new Date().toLocaleString('pt-BR');
    const catLabel = categories.find(c => c.id === selectedCategory)?.label || 'Todos';
    doc.text(`Data de Geração: ${nowStr} | Categoria: ${catLabel} | Total de Itens: ${filteredIngredients.length}`, 14, 27);

    // Group ingredients by category
    const categoryGroups: { [catKey: string]: typeof filteredIngredients } = {};
    filteredIngredients.forEach(ing => {
      const catKey = ing.category || 'other';
      if (!categoryGroups[catKey]) {
        categoryGroups[catKey] = [];
      }
      categoryGroups[catKey].push(ing);
    });

    // Preferred category order for sorting sections logically
    const preferredOrder = ['bread', 'protein', 'cheese', 'vegetable', 'sauce', 'extra', 'drink_cookie', 'juice', 'vitamin', 'smoothie', 'juice_smoothie', 'kitchen'];
    const presentCategories = Object.keys(categoryGroups).sort((a, b) => {
      let idxA = preferredOrder.indexOf(a);
      let idxB = preferredOrder.indexOf(b);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      return idxA - idxB;
    });

    const tableHeaders = [['Insumo', 'Categoria', 'Estoque', 'Mínimo', 'Unidade', 'Preço Extra', 'Status', 'Controle']];
    const tableData: any[] = [];

    presentCategories.forEach(catKey => {
      const items = categoryGroups[catKey];
      const catName = getCategoryLabel(catKey);

      // Section Header Row
      tableData.push([
        {
          content: `CATEGORIA: ${catName.toUpperCase()} (${items.length} ${items.length === 1 ? 'item' : 'itens'})`,
          colSpan: 8,
          styles: {
            fillColor: [241, 245, 249], // slate-100
            textColor: [15, 23, 42],    // slate-900
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'left'
          }
        }
      ]);

      // Items in this category
      items.forEach(ing => {
        const isLowStock = (ing.trackStock !== false) && ing.stock <= ing.minStock;
        const subCatStr = ing.subcategory ? ` [Sub: ${ing.subcategory}]` : '';
        const priceStr = ing.category === 'kitchen'
          ? (ing.purchasePrice ? `R$ ${ing.purchasePrice.toFixed(2).replace('.', ',')} (Compra)` : 'R$ 0,00')
          : (ing.price > 0 ? `R$ ${ing.price.toFixed(2).replace('.', ',')}` : 'Grátis');

        tableData.push([
          `${ing.name}${subCatStr}`,
          catName,
          `${ing.stock}`,
          `${ing.minStock}`,
          ing.unit,
          priceStr,
          ing.trackStock === false ? 'Livre' : (isLowStock ? 'Estoque Baixo' : 'OK'),
          ing.trackStock !== false ? 'Sim' : 'Não'
        ]);
      });
    });

    autoTable(doc, {
      startY: 32,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 150, 64], // Brand green
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          if (data.cell.raw === 'Estoque Baixo') {
            data.cell.styles.textColor = [180, 83, 9]; // Amber
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'OK') {
            data.cell.styles.textColor = [22, 101, 52]; // Green
          }
        }
      }
    });

    doc.save(`relatorio-estoque-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const filteredReadyProducts = readyProducts.filter(p => {
    const matchesCat = readyProductsCategory === 'all' || 
      p.category === readyProductsCategory || 
      (readyProductsCategory === 'combo' && (p.isCombo || p.showInComboSection || p.category === 'combo'));
    const matchesSubCat = readyProductsSubcategory === 'all' || p.subcategory === readyProductsSubcategory;
    const matchesSearch = !readyProductsSearch || 
      p.name.toLowerCase().includes(readyProductsSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(readyProductsSearch.toLowerCase()) ||
      (p.subcategory && p.subcategory.toLowerCase().includes(readyProductsSearch.toLowerCase())) ||
      (p.comboItems && p.comboItems.some(ci => ci.name.toLowerCase().includes(readyProductsSearch.toLowerCase())));
    return matchesCat && matchesSubCat && matchesSearch;
  });

  const exportReadyProductsPDF = () => {
    const doc = new jsPDF();

    // Title & Header
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Relatório do Cardápio de Produtos Prontos', 14, 20);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    const nowStr = new Date().toLocaleString('pt-BR');
    doc.text(`Data de Geração: ${nowStr} | Total de Produtos: ${filteredReadyProducts.length}`, 14, 27);

    // Table Data
    const tableHeaders = [['Produto', 'Categoria', 'Subcategoria', 'Preço', 'Selo / Destaque', 'Descrição']];
    const tableData = filteredReadyProducts.map(p => {
      const catName = p.category === 'sandwich' ? 'Lanche' : 
                      p.category === 'salad' ? 'Salada' : 
                      p.category === 'addon' ? 'Adicional' : 
                      p.category === 'drink' ? 'Bebida' : 
                      p.category === 'cookie' ? 'Cookie' : 
                      p.category === 'other' ? 'Outros' : p.category;
      const subCatName = p.subcategory || '-';
      const highlights = [
        (p.isPopular || p.displaySection === 'destaques' || p.displaySection === 'all') ? 'Destaque' : null,
        (p.isPromo || p.displaySection === 'promocao' || p.displaySection === 'all') ? 'Promoção' : null,
        p.badgeText ? `Selo: ${p.badgeText}` : null
      ].filter(Boolean).join(' | ') || 'Padrão';

      return [
        p.name,
        catName,
        subCatName,
        `R$ ${p.price.toFixed(2).replace('.', ',')}`,
        highlights,
        p.description
      ];
    });

    autoTable(doc, {
      startY: 32,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 150, 64], // Brand green
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 25 },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 35 },
        4: { cellWidth: 'auto' }
      }
    });

    doc.save(`relatorio-produtos-prontos-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Helper to generate jsPDF document for a Purchase Invoice
  const generateInvoicePDF = (invoice: {
    invoiceNumber: string;
    supplier?: string;
    purchaseDate: string;
    notes?: string;
    totalAmount: number;
    items: Array<{
      ingredientName?: string;
      ingredientId: string;
      quantity: number | string;
      unit?: string;
      unitPrice?: number | string;
      totalCost?: number | string;
      expirationDate?: string;
    }>;
  }) => {
    const doc = new jsPDF();

    // Title & Header
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Comprovante de Nota Fiscal / Compra Lançada', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Nº Nota Fiscal: ${invoice.invoiceNumber || 'S/N'}`, 14, 28);
    doc.text(`Fornecedor / Mercado: ${invoice.supplier || 'Não informado'}`, 14, 34);
    doc.text(`Data da Compra: ${invoice.purchaseDate || '-'}`, 14, 40);
    if (invoice.notes) {
      doc.text(`Observações: ${invoice.notes}`, 14, 46);
    }

    const startY = invoice.notes ? 52 : 46;

    // Table Data
    const tableHeaders = [['Item / Insumo', 'Quantidade', 'Preço Unit. (R$)', 'Total Item (R$)', 'Validade']];
    const tableData = invoice.items.map(it => [
      it.ingredientName || ingredients.find(i => i.id === it.ingredientId)?.name || it.ingredientId || 'Insumo',
      `${it.quantity} ${it.unit || ''}`,
      `R$ ${Number(it.unitPrice || 0).toFixed(2).replace('.', ',')}`,
      `R$ ${Number(it.totalCost || 0).toFixed(2).replace('.', ',')}`,
      it.expirationDate || '—'
    ]);

    autoTable(doc, {
      startY: startY,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 150, 64],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'center' }
      }
    });

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : startY + 50;

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`VALOR TOTAL DA NOTA: R$ ${Number(invoice.totalAmount || 0).toFixed(2).replace('.', ',')}`, 14, finalY);

    return doc;
  };

  const handleDownloadInvoicePDF = (invoice: {
    invoiceNumber: string;
    supplier?: string;
    purchaseDate: string;
    notes?: string;
    totalAmount: number;
    items: Array<{
      ingredientName?: string;
      ingredientId: string;
      quantity: number | string;
      unit?: string;
      unitPrice?: number | string;
      totalCost?: number | string;
      expirationDate?: string;
    }>;
  }) => {
    const doc = generateInvoicePDF(invoice);
    const num = invoice.invoiceNumber ? invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_') : 'compra';
    doc.save(`nota-fiscal-${num}.pdf`);
  };

  const handlePrintInvoice = (invoice: {
    invoiceNumber: string;
    supplier?: string;
    purchaseDate: string;
    notes?: string;
    totalAmount: number;
    items: Array<{
      ingredientName?: string;
      ingredientId: string;
      quantity: number | string;
      unit?: string;
      unitPrice?: number | string;
      totalCost?: number | string;
      expirationDate?: string;
    }>;
  }) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.');
      return;
    }

    const itemsRows = invoice.items.map(it => {
      const ingName = it.ingredientName || ingredients.find(i => i.id === it.ingredientId)?.name || it.ingredientId || 'Insumo';
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${ingName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${it.quantity} ${it.unit || ''}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">R$ ${Number(it.unitPrice || 0).toFixed(2).replace('.', ',')}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #047857;">R$ ${Number(it.totalCost || 0).toFixed(2).replace('.', ',')}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.expirationDate || '—'}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Nota Fiscal ${invoice.invoiceNumber || 'Compra'}</title>
          <style>
            * { font-weight: bold !important; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; margin: 0; font-weight: bold !important; }
            .header { border-bottom: 2px solid #009640; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: bold; color: #009640; margin: 0 0 4px 0; }
            .subtitle { font-size: 13px; color: #64748b; margin: 0; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
            .info-item { font-size: 13px; }
            .info-label { font-weight: bold; color: #475569; display: block; font-size: 11px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            th { background: #f1f5f9; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
            .total-box { text-align: right; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 16px; border-radius: 8px; font-size: 16px; font-weight: bold; color: #047857; }
            @media print {
              body { padding: 0; }
              @page { margin: 1.5cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Comprovante de Lançamento de Nota Fiscal</h1>
            <p class="subtitle">Relatório gerado em ${new Date().toLocaleString('pt-BR')}</p>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Nº Nota Fiscal</span>
              <strong>${invoice.invoiceNumber || 'Não Informado'}</strong>
            </div>
            <div class="info-item">
              <span class="info-label">Fornecedor / Mercado</span>
              <strong>${invoice.supplier || 'Não Informado'}</strong>
            </div>
            <div class="info-item">
              <span class="info-label">Data da Compra</span>
              <strong>${invoice.purchaseDate || '-'}</strong>
            </div>
            <div class="info-item">
              <span class="info-label">Observações</span>
              <strong>${invoice.notes || 'Sem observações'}</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item / Insumo</th>
                <th style="text-align: right;">Quantidade</th>
                <th style="text-align: right;">Preço Unit.</th>
                <th style="text-align: right;">Total Item</th>
                <th style="text-align: center;">Validade</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="total-box">
            Valor Total Pago da Nota: R$ ${Number(invoice.totalAmount || 0).toFixed(2).replace('.', ',')}
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6" id="admin-dashboard-root">
      {/* Navigation & Summary KPI Cards */}

      {/* Low Stock Banner Alert */}
      {lowStockIngredients.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-2xl p-4 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-amber-800 text-sm">Alerta de Estoque Baixo!</h4>
            <p className="text-xs text-amber-700 mt-1">
              {lowStockIngredients.length} {lowStockIngredients.length === 1 ? 'ingrediente está' : 'ingredientes estão'} com estoque abaixo do nível crítico. Reabasteça-os na aba de Controle de Estoque.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {lowStockIngredients.map(ing => (
                <span 
                  key={ing.id} 
                  className="bg-amber-100 border border-amber-200 text-amber-800 text-xs px-2.5 py-0.5 rounded-md font-medium"
                >
                  {ing.name} ({ing.stock} {ing.unit})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'sales' 
              ? 'bg-brand-green text-white font-black shadow-xs' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          id="tab-sales-btn"
        >
          <FileText className="h-4 w-4" />
          <span>Relatórios de Vendas</span>
        </button>
        <button
          onClick={() => setActiveTab('cash-registers')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'cash-registers' 
              ? 'bg-brand-green text-white font-black shadow-xs' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          id="tab-cash-registers-btn"
        >
          <Receipt className="h-4 w-4" />
          <span>Caixas Fechados</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'inventory' 
              ? 'bg-brand-green text-white font-black shadow-xs' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          id="tab-inventory-btn"
        >
          <Package className="h-4 w-4" />
          <span>Controle de Estoque</span>
        </button>
        <button
          onClick={() => setActiveTab('ready-products')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'ready-products' 
              ? 'bg-brand-green text-white font-black shadow-xs' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          id="tab-ready-products-btn"
        >
          <TrendingUp className="h-4 w-4" />
          <span>Produtos Prontos</span>
        </button>
        <button
          onClick={() => setActiveTab('deliveries')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'deliveries' 
              ? 'bg-brand-green text-white font-black shadow-xs' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          id="tab-deliveries-btn"
        >
          <Truck className="h-4 w-4" />
          <span>Tabela de Entregas</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'users' 
              ? 'bg-brand-green text-white font-black shadow-xs' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          id="tab-users-btn"
        >
          <Settings className="h-4 w-4" />
          <span>Configurações</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'sales' && (
        <div className="space-y-6" id="sales-reports-panel">
          {/* Date & User Filter Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-100 text-emerald-800 p-2 rounded-xl">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                    Filtros do Relatório de Vendas
                    {(reportStartDate || reportEndDate || reportStartHour || reportEndHour || reportSelectedUser !== 'all') && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                        Filtro Ativo
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Filtre o relatório por período de datas, horário (hora início/fim) e usuário/vendedor responsável.
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const todayStr = `${y}-${m}-${day}`;
                    setReportStartDate(todayStr);
                    setReportEndDate(todayStr);
                    setReportStartHour('');
                    setReportEndHour('');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const formatLocal = (dateObj: Date) => {
                      const y = dateObj.getFullYear();
                      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                      const day = String(dateObj.getDate()).padStart(2, '0');
                      return `${y}-${m}-${day}`;
                    };
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - 6);
                    setReportStartDate(formatLocal(start));
                    setReportEndDate(formatLocal(end));
                    setReportStartHour('');
                    setReportEndHour('');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  Últimos 7 dias
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const formatLocal = (dateObj: Date) => {
                      const y = dateObj.getFullYear();
                      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                      const day = String(dateObj.getDate()).padStart(2, '0');
                      return `${y}-${m}-${day}`;
                    };
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth(), 1);
                    setReportStartDate(formatLocal(start));
                    setReportEndDate(formatLocal(now));
                    setReportStartHour('');
                    setReportEndHour('');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  Este Mês
                </button>
                {(reportStartDate || reportEndDate || reportStartHour || reportEndHour || reportSelectedUser !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setReportStartDate('');
                      setReportEndDate('');
                      setReportStartHour('');
                      setReportEndHour('');
                      setReportSelectedUser('all');
                    }}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Limpar Filtros</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inputs Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                  Data de Fim
                </label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-600" />
                  Hora Início
                </label>
                <select
                  value={reportStartHour}
                  onChange={(e) => setReportStartHour(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  id="sales-report-start-hour-filter"
                >
                  <option value="">Todas (00h)</option>
                  {Array.from({ length: 24 }, (_, i) => {
                    const h = String(i).padStart(2, '0');
                    return (
                      <option key={h} value={`${h}:00`}>
                        {h}h ({h}:00)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-600" />
                  Hora Fim
                </label>
                <select
                  value={reportEndHour}
                  onChange={(e) => setReportEndHour(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  id="sales-report-end-hour-filter"
                >
                  <option value="">Todas (23h)</option>
                  {Array.from({ length: 24 }, (_, i) => {
                    const h = String(i).padStart(2, '0');
                    return (
                      <option key={h} value={`${h}:59`}>
                        {h}h ({h}:59)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Filtrar por Usuário
                </label>
                <select
                  value={reportSelectedUser}
                  onChange={(e) => setReportSelectedUser(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  id="sales-report-user-filter"
                >
                  <option value="all">Todos os Usuários / Vendedores</option>
                  {report?.availableSellers && report.availableSellers.length > 0 ? (
                    report.availableSellers.map((sellerName) => (
                      <option key={sellerName} value={sellerName}>
                        👤 {sellerName}
                      </option>
                    ))
                  ) : (
                    usersList.map((u) => (
                      <option key={u.id} value={u.name || u.username}>
                        👤 {u.name || u.username}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Scope Summary Banner */}
            <div className="text-xs text-slate-500 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-200 w-full flex items-center justify-between">
              <span className="text-[10px] uppercase font-black text-slate-400 shrink-0">Escopo do Relatório:</span>
              <strong className="text-slate-800 font-extrabold truncate text-right">
                {reportSelectedUser !== 'all' ? `👤 ${reportSelectedUser}` : 'Todos Vendedores'}
                {' • '}
                {reportStartDate || reportEndDate
                  ? `${reportStartDate || 'Início'} a ${reportEndDate || 'Hoje'}`
                  : 'Histórico Total'}
                {(reportStartHour || reportEndHour) && (
                  ` (${reportStartHour || '00:00'} às ${reportEndHour || '23:59'})`
                )}
              </strong>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex justify-center items-center">
              <div className="text-center">
                <span className="inline-block h-8 w-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin"></span>
                <p className="text-xs text-slate-400 mt-2">Carregando dados financeiros...</p>
              </div>
            </div>
          ) : report ? (
            <>
              {/* Cards Grid de Indicadores (KPIs) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Faturamento Total */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      Faturamento Total
                    </p>
                    <p className="text-lg sm:text-xl font-black text-emerald-700">
                      R$ {report.summary.totalRevenue.toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">Vendas no período</p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 p-2.5 sm:p-3 rounded-2xl border border-emerald-100 shrink-0">
                    <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                </div>

                {/* 2. Total Taxa de Entrega */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 to-white shadow-xs flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-[11px] font-black uppercase text-amber-700 tracking-wider flex items-center gap-1">
                      <Truck className="h-3 w-3 text-amber-600 inline" />
                      Total Taxa de Entrega
                    </p>
                    <p className="text-lg sm:text-xl font-black text-amber-600">
                      R$ {(report.summary.totalDeliveryFee || 0).toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-[10px] text-amber-600/80 font-medium">Taxas de entregas efetuadas</p>
                  </div>
                  <div className="bg-amber-100 text-amber-700 p-2.5 sm:p-3 rounded-2xl border border-amber-200 shrink-0 shadow-xs">
                    <Truck className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                </div>

                {/* 3. Total de Pedidos */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      Total de Pedidos
                    </p>
                    <p className="text-lg sm:text-xl font-black text-slate-800">
                      {report.summary.totalOrdersCount} ped.
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">Todos os pedidos</p>
                  </div>
                  <div className="bg-sky-50 text-sky-600 p-2.5 sm:p-3 rounded-2xl border border-sky-100 shrink-0">
                    <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                </div>

                {/* 4. Pedidos Concluídos */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      Pedidos Concluídos
                    </p>
                    <p className="text-lg sm:text-xl font-black text-emerald-600">
                      {report.summary.completedOrdersCount} ped.
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">Finalizados / Entregues</p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 p-2.5 sm:p-3 rounded-2xl border border-emerald-100 shrink-0">
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                </div>

                {/* 5. Ticket Médio */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      Ticket Médio
                    </p>
                    <p className="text-lg sm:text-xl font-black text-blue-700">
                      R$ {report.summary.averageTicket.toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">Média por pedido</p>
                  </div>
                  <div className="bg-blue-50 text-blue-600 p-2.5 sm:p-3 rounded-2xl border border-blue-100 shrink-0">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                </div>
              </div>

              {/* Report Summary Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Resumo Geral de Vendas
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/70 text-slate-500 font-black uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Faturamento Total</th>
                        <th className="px-5 py-3">Total Taxa de Entrega</th>
                        <th className="px-5 py-3">Total de Pedidos</th>
                        <th className="px-5 py-3">Pedidos Concluídos</th>
                        <th className="px-5 py-3">Ticket Médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 text-base font-black text-emerald-700">R$ {report.summary.totalRevenue.toFixed(2).replace('.', ',')}</td>
                        <td className="px-5 py-4 text-base font-black text-amber-600">R$ {(report.summary.totalDeliveryFee || 0).toFixed(2).replace('.', ',')}</td>
                        <td className="px-5 py-4 text-base font-black text-slate-800">{report.summary.totalOrdersCount}</td>
                        <td className="px-5 py-4 text-base font-black text-emerald-600">{report.summary.completedOrdersCount}</td>
                        <td className="px-5 py-4 text-base font-black text-blue-700">R$ {report.summary.averageTicket.toFixed(2).replace('.', ',')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Card 1 & Card 2 Row in Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1) Table Faturamento por Vendedor */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-sky-100 text-sky-800 p-2 rounded-xl">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">
                          Faturamento por Vendedor
                        </h3>
                        <p className="text-xs text-slate-400">Total vendido e formas de pagamento por atendente</p>
                      </div>
                    </div>
                  </div>

                  {!report.sellerBreakdown || report.sellerBreakdown.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 italic">
                      Nenhum registro de faturamento por vendedor para este período.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/80 text-slate-600 font-black uppercase text-[10px] border-b border-slate-200 sticky top-0 bg-slate-100 z-10">
                          <tr>
                            <th className="px-4 py-3">Vendedor</th>
                            <th className="px-4 py-3 text-center">Qtd. Pedidos</th>
                            <th className="px-4 py-3">Formas de Pagamento</th>
                            <th className="px-4 py-3 text-right">Faturamento Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800 font-semibold">
                          {report.sellerBreakdown.map((s, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 font-extrabold text-slate-800">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-black text-[10px] flex items-center justify-center">
                                    {s.sellerName.charAt(0).toUpperCase()}
                                  </span>
                                  <span>{s.sellerName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-slate-600">{s.ordersCount} ped.</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(s.paymentMethods).map(([pmKey, pmVal]) => (
                                    <span key={pmKey} className="bg-slate-100 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-700 border border-slate-200">
                                      <span className="uppercase">{pmKey}:</span> R$ {Number(pmVal).toFixed(2).replace('.', ',')}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-emerald-700">
                                R$ {s.totalRevenue.toFixed(2).replace('.', ',')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 2) Desempenho de Vendas (Gráfico de Barras) */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
                        <BarIcon className="h-4 w-4 text-brand-green" />
                        Desempenho de Vendas (Gráfico de Barras)
                      </h3>
                      <p className="text-xs text-slate-400">Faturamento diário registrado no período selecionado</p>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={report.revenueChart} margin={{ top: 22, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <Tooltip 
                          formatter={(value) => [`R$ ${Number(value).toFixed(2)}`, 'Faturamento']}
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="Faturamento" fill="#008938" radius={[6, 6, 0, 0]}>
                          <LabelList 
                            dataKey="Faturamento" 
                            position="top" 
                            formatter={(val: any) => Number(val) > 0 ? `R$ ${Number(val).toFixed(2).replace('.', ',')}` : ''} 
                            style={{ fontSize: '10px', fontWeight: 'bold', fill: '#1e293b' }} 
                          />
                          {report.revenueChart.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#008938' : '#047857'} />
                          ))}
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Card 5 & Card 6 Row: Lanches vs Saladas & Top 5 Tables */}
              {report.sandwichAndSaladStats && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Table: Total de Lanches vs Saladas Vendidos */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
                      <div className="bg-emerald-100 text-emerald-800 p-2 rounded-xl">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">
                          Total de Lanches e Saladas
                        </h3>
                        <p className="text-xs text-slate-400">Volume total de vendas por categoria</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3">Categoria</th>
                            <th className="px-4 py-3 text-center">Qtd. Vendida</th>
                            <th className="px-4 py-3 text-right">Faturamento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800 font-semibold">
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5 font-extrabold text-emerald-900 flex items-center gap-2">
                              <span>🍔</span> Lanches / Subs
                            </td>
                            <td className="px-4 py-3.5 text-center font-black text-slate-800">
                              {Number(report.sandwichAndSaladStats.totalLanchesCount || 0)} un.
                            </td>
                            <td className="px-4 py-3.5 text-right font-black text-emerald-700">
                              R$ {Number(report.sandwichAndSaladStats.totalLanchesRevenue || 0).toFixed(2).replace('.', ',')}
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5 font-extrabold text-amber-900 flex items-center gap-2">
                              <span>🥗</span> Saladas Frescas
                            </td>
                            <td className="px-4 py-3.5 text-center font-black text-slate-800">
                              {Number(report.sandwichAndSaladStats.totalSaladasCount || 0)} un.
                            </td>
                            <td className="px-4 py-3.5 text-right font-black text-amber-800">
                              R$ {Number(report.sandwichAndSaladStats.totalSaladasRevenue || 0).toFixed(2).replace('.', ',')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table: Top 5 Lanches e Top 5 Saladas */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
                      <div className="bg-brand-yellow/20 text-slate-800 p-2 rounded-xl">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">
                          Top 5 Lanches e Top 5 Saladas Mais Vendidos
                        </h3>
                        <p className="text-xs text-slate-400">Ranking dos produtos campeões de vendas</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                      {/* Top 5 Lanches Table */}
                      <div className="p-3 space-y-2">
                        <h4 className="text-xs font-black uppercase text-emerald-800 flex items-center gap-1.5 mb-1">
                          🍔 Top 5 Lanches / Subs
                        </h4>
                        {report.sandwichAndSaladStats.topLanches.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-4 text-center">Nenhum lanche no período</p>
                        ) : (
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-500 font-extrabold uppercase text-[10px]">
                              <tr>
                                <th className="px-2 py-1.5">Pos.</th>
                                <th className="px-2 py-1.5">Produto</th>
                                <th className="px-2 py-1.5 text-right">Qtd.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                              {report.sandwichAndSaladStats.topLanches.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-2 py-2 text-slate-400 font-black">#{i + 1}</td>
                                  <td className="px-2 py-2 font-extrabold text-slate-800 truncate max-w-[140px]">{item.name}</td>
                                  <td className="px-2 py-2 text-right font-black text-emerald-700">{Number(item.count ?? (item as any).quantity ?? 0)} un.</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Top 5 Saladas Table */}
                      <div className="p-3 space-y-2">
                        <h4 className="text-xs font-black uppercase text-amber-800 flex items-center gap-1.5 mb-1">
                          🥗 Top 5 Saladas
                        </h4>
                        {report.sandwichAndSaladStats.topSaladas.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-4 text-center">Nenhuma salada no período</p>
                        ) : (
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-500 font-extrabold uppercase text-[10px]">
                              <tr>
                                <th className="px-2 py-1.5">Pos.</th>
                                <th className="px-2 py-1.5">Produto</th>
                                <th className="px-2 py-1.5 text-right">Qtd.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                              {report.sandwichAndSaladStats.topSaladas.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-2 py-2 text-slate-400 font-black">#{i + 1}</td>
                                  <td className="px-2 py-2 font-extrabold text-slate-800 truncate max-w-[140px]">{item.name}</td>
                                  <td className="px-2 py-2 text-right font-black text-amber-800">{Number(item.count ?? (item as any).quantity ?? 0)} un.</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Requirement 4 (Alerta de Estoque Baixo Table) & Requirement 3 (Ingredientes Populares Table + Modal Button) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Alerta de Estoque Baixo */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0 lg:col-span-2 flex flex-col h-full">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-amber-100 text-amber-800 p-2 rounded-xl">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight flex items-center gap-2">
                          Alerta de Estoque Baixo
                          {report.lowStockIngredients && report.lowStockIngredients.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                              {report.lowStockIngredients.length}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-400">Insumos e produtos que necessitam de reposição imediata</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('inventory')}
                      className="text-xs font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-all cursor-pointer"
                    >
                      Ir para Estoque
                    </button>
                  </div>

                  {!report.lowStockIngredients || report.lowStockIngredients.length === 0 ? (
                    <div className="p-8 text-center text-xs text-emerald-700 bg-emerald-50/50 font-bold flex-1 flex items-center justify-center">
                      ✅ Todos os insumos estão com estoque em nível adequado!
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-64 overflow-y-auto flex-1">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-xs">
                          <tr>
                            <th className="px-4 py-3">Insumo / Produto</th>
                            <th className="px-4 py-3 text-center">Estoque Atual</th>
                            <th className="px-4 py-3 text-center">Mínimo</th>
                            <th className="px-4 py-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800 font-semibold">
                          {report.lowStockIngredients.map(ing => (
                            <tr key={ing.id} className="hover:bg-amber-50/50 transition-colors">
                              <td className="px-4 py-3 font-extrabold text-slate-800">{ing.name}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                                  {ing.stock} {ing.unit}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-slate-600 font-bold">
                                {ing.minStock} {ing.unit}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-[10px] font-black uppercase text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                                  {ing.stock === 0 ? 'Esgotado' : 'Abaixo do Limite'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 3) Ingredientes Populares Table + Modal All Products */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                      <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Ingredientes Populares</h3>
                      <p className="text-xs text-slate-400">Ingredientes mais pedidos nos lanches</p>
                    </div>

                    {report.topIngredients.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-center text-xs text-slate-400 p-4">
                        Nenhum ingrediente vendido ainda.
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-xs">
                            <tr>
                              <th className="px-4 py-2.5">Ingrediente</th>
                              <th className="px-4 py-2.5 text-right pr-6">Qtd. Solicitada</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                            {report.topIngredients.map((item) => (
                              <tr key={item.name} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2.5 font-extrabold text-slate-800 break-words">{item.name}</td>
                                <td className="px-4 py-2.5 text-right font-black text-emerald-800 pr-6 whitespace-nowrap">{item.count} un.</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Button to open All Sold Products Modal */}
                  <div className="p-3 bg-slate-50 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsAllSoldModalOpen(true)}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Ver Todos os Produtos Vendidos & Exportar PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-12 text-center text-gray-400">
              Nenhum dado de vendas disponível no momento.
            </div>
          )}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-5" id="inventory-stock-panel">
          {/* Painel Unificado de Filtros, Pesquisa e Ações */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            {/* Top Row: Search input + Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar insumo por nome, categoria ou subcategoria..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-green transition-all"
                  />
                  {inventorySearch && (
                    <button
                      onClick={() => setInventorySearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={openNewInvoiceModal}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 border border-emerald-700"
                  title="Lançar compra em lote (Nota Fiscal / Cupom) com múltiplos itens de uma vez"
                >
                  <FilePlus className="h-4 w-4" />
                  <span>Lançar Nota Fiscal</span>
                </button>

                <button
                  onClick={openInvoicesListModal}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-2 cursor-pointer active:scale-95"
                  title="Ver histórico de Notas Fiscais e compras lançadas"
                >
                  <Receipt className="h-4 w-4 text-amber-800" />
                  <span>Notas Lançadas</span>
                </button>

                <button
                  onClick={exportInventoryPDF}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 border border-slate-200"
                  title="Exportar a tabela de estoque atual em PDF"
                >
                  <Download className="h-4 w-4 text-brand-green" />
                  <span className="hidden sm:inline">PDF</span>
                </button>

                <button
                  onClick={() => {
                    setEditingIngredient({
                      name: '',
                      category: inventoryTab === 'kitchen' ? 'kitchen' : 'extra',
                      stock: 50,
                      minStock: 10,
                      unit: inventoryTab === 'kitchen' ? 'kg' : 'porções',
                      price: 0,
                      showOnHome: true
                    });
                    setIsEditingIngredient(true);
                  }}
                  className="bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>Novo Insumo</span>
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-100"></div>

            {/* Middle Row: Scope Tabs (Cardápio vs Cozinha vs Todos) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1 flex-wrap">
                <button
                  onClick={() => {
                    setInventoryTab('pdv');
                    if (selectedCategory === 'kitchen') setSelectedCategory('all');
                  }}
                  className={`px-3.5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    inventoryTab === 'pdv'
                      ? 'bg-white text-slate-800 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🍔 Cardápio / PDV</span>
                  <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold border border-slate-200">
                    {ingredients.filter(i => i.id !== 'queijo-nenhum' && i.category !== 'kitchen').length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setInventoryTab('kitchen');
                    setSelectedCategory('kitchen');
                  }}
                  className={`px-3.5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    inventoryTab === 'kitchen'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>🍳 Estoque Cozinha</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${inventoryTab === 'kitchen' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {ingredients.filter(i => i.category === 'kitchen').length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setInventoryTab('all');
                    setSelectedCategory('all');
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    inventoryTab === 'all'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todos os Itens ({ingredients.filter(i => i.id !== 'queijo-nenhum').length})
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span>Exibindo <strong className="text-slate-800">{filteredIngredients.length}</strong> itens</span>
                {lowStockIngredients.length > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-[11px] font-extrabold px-2 py-0.5 rounded-md border border-amber-300">
                    ⚠️ {lowStockIngredients.length} em nível crítico
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Row: Category Selector Pills */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex justify-between items-center text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                <span>Filtrar por Categoria:</span>
                {selectedCategory !== 'all' && (
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className="text-brand-green hover:underline cursor-pointer lowercase text-xs"
                  >
                    limpar filtro
                  </button>
                )}
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                      selectedCategory === cat.id
                        ? 'bg-brand-green text-white shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Stock Table */}
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[11px] tracking-wider">
                  <th className="p-3 w-12 text-center">Foto</th>
                  <th className="p-3 min-w-[180px]">Nome do Insumo</th>
                  <th className="p-3 min-w-[140px]">Categoria</th>
                  <th className="p-3 w-28 text-center">Estoque Atual</th>
                  <th className="p-3 w-28 text-center">Estoque Mín.</th>
                  <th className="p-3 w-28">Unidade</th>
                  <th className="p-3 w-28">{inventoryTab === 'kitchen' ? 'Preço Compra' : 'Preço Extra'}</th>
                  <th className="p-3 w-24 text-center">Status</th>
                  <th className="p-3 w-28 text-center">Controlar Estoque</th>
                  <th className="p-3 min-w-[130px] text-center">Histórico</th>
                  <th className="p-3 w-28 text-center">Pág. Inicial</th>
                  <th className="p-3 min-w-[110px] text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredIngredients.map(ing => {
                  const isLowStock = (ing.trackStock !== false) && ing.stock <= ing.minStock;

                  return (
                    <tr 
                      key={ing.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isLowStock ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Foto Thumbnail */}
                      <td className="p-2 text-center align-middle">
                        <button
                          onClick={() => {
                            setPhotoModalIngredient(ing);
                            setIngredientPhotoUrlInput(ing.image || '');
                          }}
                          className="relative group w-10 h-10 rounded-lg overflow-hidden bg-slate-100 inline-block border border-slate-200 shadow-2xs cursor-pointer"
                          title="Clique para alterar a foto"
                        >
                          {ing.image ? (
                            <img src={ing.image} alt={ing.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50">
                              <Camera className="h-4 w-4" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-amber-400">
                            <Camera className="h-3.5 w-3.5" />
                          </div>
                        </button>
                      </td>

                      {/* Nome do Insumo (Input inline) + Subcategoria Badge */}
                      <td className="p-2 align-middle">
                        <div className="space-y-1">
                          <input
                            type="text"
                            defaultValue={ing.name}
                            key={`name-${ing.id}-${ing.name}`}
                            onBlur={(e) => {
                              const newName = e.target.value.trim();
                              if (newName && newName !== ing.name && onSaveIngredient) {
                                onSaveIngredient({ ...ing, name: newName });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 focus:border-brand-green rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-brand-green"
                            title="Edite o nome e pressione Enter ou clique fora para salvar"
                          />
                          {ing.subcategory && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-900 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded-md w-fit">
                              🏷️ {ing.subcategory}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Categoria (Select inline) */}
                      <td className="p-2 align-middle">
                        <select
                          value={ing.category || 'extra'}
                          onChange={(e) => {
                            if (onSaveIngredient) {
                              onSaveIngredient({ ...ing, category: e.target.value as any });
                            }
                          }}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-brand-green"
                        >
                          <option value="bread">Pão</option>
                          <option value="vegetable">Saladas</option>
                          <option value="drink_cookie">Bebidas</option>
                          <option value="juice">Sucos</option>
                          <option value="vitamin">Vitaminas</option>
                          <option value="smoothie">Smoothies</option>
                          <option value="protein">Proteínas</option>
                          <option value="cheese">Queijos</option>
                          <option value="sauce">Molhos</option>
                          <option value="extra">Adicionais</option>
                          <option value="kitchen">Estoque da Cozinha (Uso Interno)</option>
                        </select>
                      </td>

                      {/* Estoque Atual (Bloqueado para edição direta, mas mantido visível na tela) */}
                      <td className="p-2 align-middle">
                        <div
                          className={`w-full px-2 py-1.5 border rounded-lg text-xs font-black text-center cursor-not-allowed select-none transition-all ${
                            isLowStock 
                              ? 'bg-amber-100/90 border-amber-300 text-amber-900 font-extrabold shadow-2xs' 
                              : 'bg-slate-100/90 border-slate-200 text-slate-800'
                          }`}
                          title="Estoque Atual"
                        >
                          {ing.stock} <span className="text-[10px] font-normal text-slate-500">{ing.unit}</span>
                        </div>
                      </td>

                      {/* Estoque Mínimo (Input inline) */}
                      <td className="p-2 align-middle">
                        <input
                          type="number"
                          min="0"
                          defaultValue={ing.minStock}
                          key={`minStock-${ing.id}-${ing.minStock}`}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            if (val !== ing.minStock && onSaveIngredient) {
                              onSaveIngredient({ ...ing, minStock: val });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-center focus:outline-hidden focus:ring-1 focus:ring-brand-green"
                          title="Edite o estoque mínimo"
                        />
                      </td>

                      {/* Unidade (Input inline) */}
                      <td className="p-2 align-middle">
                        <input
                          type="text"
                          defaultValue={ing.unit}
                          key={`unit-${ing.id}-${ing.unit}`}
                          onBlur={(e) => {
                            const newUnit = e.target.value.trim();
                            if (newUnit && newUnit !== ing.unit && onSaveIngredient) {
                              onSaveIngredient({ ...ing, unit: newUnit });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-brand-green"
                          title="Edite a unidade"
                        />
                      </td>

                      {/* Preço (Preço Extra p/ PDV ou Preço de Compra p/ Estoque da Cozinha) */}
                      <td className="p-2 align-middle">
                        {ing.category === 'kitchen' ? (
                          <div
                            className="w-full px-2.5 py-1.5 bg-amber-100/90 border border-amber-300 rounded-lg text-xs font-black text-amber-950 cursor-not-allowed select-none flex items-center justify-between shadow-2xs"
                            title="Preço de compra registrado. Utilize 'Editar' para alterar."
                          >
                            <span>R$ {ing.purchasePrice ? ing.purchasePrice.toFixed(2).replace('.', ',') : '0,00'}</span>
                            <Lock className="h-3 w-3 text-amber-800 shrink-0" />
                          </div>
                        ) : (
                          <div className="relative">
                            <span className="absolute left-2 top-1.5 text-slate-400 text-xs font-bold">R$</span>
                            <input
                              type="number"
                              step="0.50"
                              min="0"
                              defaultValue={ing.price}
                              key={`price-${ing.id}-${ing.price}`}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (val !== ing.price && onSaveIngredient) {
                                  onSaveIngredient({ ...ing, price: val });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-brand-green"
                              title="Preço Extra Cobrado no PDV"
                            />
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="p-2 text-center align-middle">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md whitespace-nowrap ${
                          ing.trackStock === false
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : isLowStock 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {ing.trackStock === false ? '♾️ Livre' : isLowStock ? '⚠️ Baixo' : '✓ OK'}
                        </span>
                      </td>

                      {/* Opção Controlar Estoque (Ao lado de Status) - Botão Sim/Não igual Pág. Inicial */}
                      <td className="p-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSaveIngredient) {
                              onSaveIngredient({ ...ing, trackStock: ing.trackStock === false ? true : false });
                            }
                          }}
                          className={`inline-flex items-center justify-center text-[11px] font-black px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                            ing.trackStock !== false
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
                          }`}
                          title="Clique para alternar o controle de estoque deste insumo (Sim ou Não)"
                        >
                          {ing.trackStock !== false ? 'Sim' : 'Não'}
                        </button>
                      </td>

                      {/* Histórico de Compras */}
                      <td className="p-2 align-middle">
                        <button
                          onClick={() => openPurchaseHistoryModal(ing)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[11px] py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs w-full"
                          title="Ver histórico de compras, datas, valores e vencimentos"
                        >
                          <ReceiptText className="h-3.5 w-3.5 text-amber-800" />
                          <span>Histórico</span>
                        </button>
                      </td>

                      {/* Pág. Inicial Toggle */}
                      <td className="p-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSaveIngredient) {
                              onSaveIngredient({ ...ing, showOnHome: ing.showOnHome === false ? true : false });
                            }
                          }}
                          className={`inline-flex items-center justify-center text-[11px] font-black px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                            ing.showOnHome !== false
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
                          }`}
                          title="Clique para alternar se este insumo aparece na Página Inicial"
                        >
                          {ing.showOnHome !== false ? 'Sim' : 'Não'}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="p-2 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingIngredient(ing);
                              setIsEditingIngredient(true);
                            }}
                            title="Editar Item"
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-extrabold text-[11px] py-1.5 px-2.5 rounded-xl flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs"
                          >
                            <Edit className="h-3.5 w-3.5 text-blue-600" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => setDeletingIngredient(ing)}
                            title="Excluir Item"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredIngredients.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 font-medium">
                      Nenhum ingrediente encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add / Edit Ingredient Modal */}
          {isEditingIngredient && editingIngredient && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-base">
                    {editingIngredient.id ? 'Editar Item do Estoque' : 'Adicionar Novo Item ao Estoque'}
                  </h3>
                  <button 
                    onClick={() => {
                      setIsEditingIngredient(false);
                      setEditingIngredient(null);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Item / Insumo *</label>
                    <input
                      type="text"
                      placeholder="Ex: Pão Australiano, Frango Teriyaki, Bacon, Coca-Cola..."
                      value={editingIngredient.name || ''}
                      onChange={(e) => setEditingIngredient(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Categoria *</label>
                      <select
                        value={editingIngredient.category || 'extra'}
                        onChange={(e) => setEditingIngredient(prev => ({ 
                          ...prev, 
                          category: e.target.value as any,
                          price: e.target.value === 'kitchen' ? 0 : (prev?.price || 0)
                        }))}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-medium bg-white"
                      >
                        <option value="bread">Pão</option>
                        <option value="vegetable">Saladas</option>
                        <option value="drink_cookie">Bebidas</option>
                        <option value="juice">Sucos</option>
                        <option value="vitamin">Vitaminas</option>
                        <option value="smoothie">Smoothies</option>
                        <option value="protein">Proteínas</option>
                        <option value="cheese">Queijos</option>
                        <option value="sauce">Molhos</option>
                        <option value="extra">Adicionais</option>
                        <option value="kitchen">Estoque da Cozinha (Uso Interno)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Unidade de Medida</label>
                      <input
                        type="text"
                        placeholder="porções, fatias, un, kg..."
                        value={editingIngredient.unit || ''}
                        onChange={(e) => setEditingIngredient(prev => ({ ...prev, unit: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                      />
                    </div>
                  </div>

                  {/* Subcategoria Field */}
                  <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-200 space-y-2">
                    <label className="block text-xs font-bold text-slate-700 flex justify-between items-center">
                      <span>🏷️ Subcategoria (Ex: Insumos Básicos, Temperos, Óleos...)</span>
                      <span className="text-[10px] text-amber-800 font-semibold">Opcional</span>
                    </label>
                    <input
                      type="text"
                      list="subcategory-list"
                      placeholder="Digite ou escolha uma subcategoria existente..."
                      value={editingIngredient.subcategory || ''}
                      onChange={(e) => setEditingIngredient(prev => ({ ...prev, subcategory: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                    />
                    <datalist id="subcategory-list">
                      {allSubcategories.map(sub => (
                        <option key={sub} value={sub} />
                      ))}
                    </datalist>

                    {allSubcategories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 self-center">Cadastrados:</span>
                        {allSubcategories.map(sub => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setEditingIngredient(prev => ({ ...prev, subcategory: sub }))}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              editingIngredient.subcategory === sub
                                ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            + {sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Photo URL & Presets Field */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Camera className="h-4 w-4 text-amber-500" />
                        <span>Foto do Produto / Insumo</span>
                      </label>
                      <span className="text-[11px] text-slate-500 font-medium">Link de Imagem (URL)</span>
                    </div>

                    <div className="flex gap-2.5 items-center">
                      <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden bg-white flex-shrink-0 flex items-center justify-center shadow-2xs">
                        {editingIngredient.image ? (
                          <img src={editingIngredient.image} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-slate-300" />
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="https://images.unsplash.com/photo-..."
                        value={editingIngredient.image || ''}
                        onChange={(e) => setEditingIngredient(prev => ({ ...prev, image: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                      />
                    </div>

                    {/* Category Photo Suggestions */}
                    {editingIngredient.category && photoSuggestionsByCategory[editingIngredient.category] && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <p className="text-[10px] font-bold text-slate-500 mb-1.5">Fotos Sugeridas para esta Categoria:</p>
                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                          {photoSuggestionsByCategory[editingIngredient.category].map((sug, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setEditingIngredient(prev => ({ ...prev, image: sug.url }))}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                                editingIngredient.image === sug.url
                                  ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <ImageIcon className="h-3 w-3" />
                              <span>{sug.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Qtd em Estoque</label>
                      <input
                        type="number"
                        min="0"
                        value={editingIngredient.stock ?? 50}
                        onChange={(e) => setEditingIngredient(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Estoque Mínimo</label>
                      <input
                        type="number"
                        min="0"
                        value={editingIngredient.minStock ?? 10}
                        onChange={(e) => setEditingIngredient(prev => ({ ...prev, minStock: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>

                    <div>
                      {editingIngredient.category === 'kitchen' ? (
                        <>
                          <label className="block text-xs font-bold text-amber-900 mb-1">Preço Compra (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={editingIngredient.purchasePrice ?? 0}
                            onChange={(e) => setEditingIngredient(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0, price: 0 }))}
                            className="w-full px-3 py-2.5 border border-amber-300 bg-amber-50/50 rounded-xl text-xs font-bold text-amber-900"
                          />
                        </>
                      ) : (
                        <>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Preço Extra (R$)</label>
                          <input
                            type="number"
                            step="0.50"
                            min="0"
                            placeholder="0.00"
                            value={editingIngredient.price ?? 0}
                            onChange={(e) => setEditingIngredient(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-medium"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Campo Controlar Estoque (Sim / Não) */}
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-xs font-extrabold text-slate-800 block">Controlar Estoque?</span>
                      <span className="text-[10px] text-slate-500 font-medium">Se "Não", as vendas não serão bloqueadas caso o estoque esteja baixo ou zerado.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingIngredient(prev => prev ? ({ ...prev, trackStock: true }) : null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          editingIngredient.trackStock !== false
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIngredient(prev => prev ? ({ ...prev, trackStock: false }) : null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          editingIngredient.trackStock === false
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </div>

                  {/* Campo Exibir na Página Inicial (Sim / Não) */}
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-xs font-extrabold text-slate-800 block">Exibir na Página Inicial?</span>
                      <span className="text-[10px] text-slate-500 font-medium">Se "Não", este insumo não aparecerá na página inicial.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingIngredient(prev => prev ? ({ ...prev, showOnHome: true }) : null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          editingIngredient.showOnHome !== false
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIngredient(prev => prev ? ({ ...prev, showOnHome: false }) : null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          editingIngredient.showOnHome === false
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setIsEditingIngredient(false);
                      setEditingIngredient(null);
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (!editingIngredient.name) return;
                      if (onSaveIngredient) {
                        onSaveIngredient(editingIngredient);
                      }
                      setIsEditingIngredient(false);
                      setEditingIngredient(null);
                    }}
                    className="px-5 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    Salvar Item
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Restock Modal (Repor Rápido com Data da Compra, Quantidade e Valor) */}
          {quickRestockIngredient && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-700">
                      <RefreshCw className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base">
                        Repor Estoque Rápido
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Item: <strong className="text-slate-800">{quickRestockIngredient.name}</strong>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setQuickRestockIngredient(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Info Stock Preview */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estoque Atual</span>
                    <span className="text-sm font-black text-slate-700">{quickRestockIngredient.stock} {quickRestockIngredient.unit}</span>
                  </div>
                  <div className="text-slate-300 font-bold">➔</div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Novo Estoque</span>
                    <span className="text-sm font-black text-emerald-700">
                      {(quickRestockIngredient.stock || 0) + (Number(restockQty) || 0)} {quickRestockIngredient.unit}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Data da Compra e Data de Vencimento */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        📅 Data da Compra *
                      </label>
                      <input
                        type="date"
                        required
                        value={restockDate}
                        onChange={(e) => setRestockDate(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex justify-between items-center">
                        <span>⏳ Data Vencimento</span>
                        <span className="text-[9px] text-amber-800 font-bold bg-amber-100/70 px-1 rounded">Opcional</span>
                      </label>
                      <input
                        type="date"
                        value={restockExpirationDate}
                        onChange={(e) => setRestockExpirationDate(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                      />
                    </div>
                  </div>

                  {/* Quantidade a Repor */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex justify-between">
                      <span>📦 Quantidade Adquirida *</span>
                      <span className="text-[11px] text-slate-400 font-medium">Unidade: {quickRestockIngredient.unit}</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={restockQty}
                      onChange={(e) => {
                        const qty = Math.max(1, parseInt(e.target.value) || 0);
                        setRestockQty(qty);
                        setRestockTotalCost(Number((qty * restockUnitCost).toFixed(2)));
                      }}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                    />
                  </div>

                  {/* Valores: Unitário e Total */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        💰 Preço Unitário (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={restockUnitCost}
                        onChange={(e) => {
                          const unitCost = Math.max(0, parseFloat(e.target.value) || 0);
                          setRestockUnitCost(unitCost);
                          setRestockTotalCost(Number((unitCost * restockQty).toFixed(2)));
                        }}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        🏷️ Valor Total da Compra (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={restockTotalCost}
                        onChange={(e) => {
                          const totalCost = Math.max(0, parseFloat(e.target.value) || 0);
                          setRestockTotalCost(totalCost);
                          if (restockQty > 0) {
                            setRestockUnitCost(Number((totalCost / restockQty).toFixed(2)));
                          }
                        }}
                        className="w-full px-3 py-2.5 border border-emerald-200 bg-emerald-50/50 rounded-xl text-xs font-black text-emerald-800 focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setQuickRestockIngredient(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmQuickRestock}
                    disabled={submittingRestock === quickRestockIngredient.id || !(restockQty > 0)}
                    className="px-5 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {submittingRestock === quickRestockIngredient.id ? (
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Confirmar Reposição</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Histórico de Compras e Reposições */}
          {historyIngredient && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-100 p-3 rounded-2xl text-amber-800 shadow-2xs">
                      <ReceiptText className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-800 text-lg">
                          Histórico de Compras
                        </h3>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                          {historyIngredient.category === 'kitchen' ? 'Estoque Cozinha' : 'Insumo PDV'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Item: <strong className="text-slate-800">{historyIngredient.name}</strong> • Unidade: <strong className="text-slate-800">{historyIngredient.unit}</strong>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setHistoryIngredient(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registros</span>
                    <span className="text-base font-black text-slate-800">{historyRecords.length} compras</span>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Total Comprado</span>
                    <span className="text-base font-black text-emerald-800">
                      {historyRecords.reduce((sum, r) => sum + Number(r.quantity || 0), 0)} {historyIngredient.unit}
                    </span>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Valor Investido</span>
                    <span className="text-base font-black text-amber-900">
                      R$ {historyRecords.reduce((sum, r) => sum + Number(r.totalCost || 0), 0).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                {/* History Table Container */}
                <div className="flex-1 overflow-y-auto min-h-[220px] border border-slate-200 rounded-xl bg-white">
                  {loadingHistory ? (
                    <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-amber-600" />
                      <span className="text-xs font-bold">Carregando histórico de compras...</span>
                    </div>
                  ) : historyRecords.length === 0 ? (
                    <div className="p-8 text-center space-y-3">
                      <div className="bg-slate-100 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                        <ReceiptText className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">Nenhuma compra registrada para este item</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Ao lançar notas fiscais e compras, os dados de data, valor, quantidade e validade serão guardados aqui.</p>
                      </div>
                      <button
                        onClick={() => {
                          setHistoryIngredient(null);
                          openNewInvoiceModal();
                        }}
                        className="px-4 py-2 bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 mx-auto"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Lançar Nota Fiscal</span>
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider sticky top-0 bg-slate-50 z-10">
                          <th className="p-2.5 pl-3">📅 Data Compra</th>
                          <th className="p-2.5 text-center">📦 Quantidade</th>
                          <th className="p-2.5 text-right">💰 Preço Un.</th>
                          <th className="p-2.5 text-right">🏷️ Valor Total</th>
                          <th className="p-2.5 pr-3 text-center">⏳ Vencimento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {historyRecords.map((rec) => {
                          const formattedDate = rec.date ? rec.date.split('-').reverse().join('/') : '-';
                          const formattedExp = rec.expirationDate ? rec.expirationDate.split('-').reverse().join('/') : null;
                          
                          return (
                            <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-2.5 pl-3 font-bold text-slate-800">
                                {formattedDate}
                              </td>
                              <td className="p-2.5 text-center font-black text-slate-700">
                                {rec.quantity} <span className="text-[10px] text-slate-400 font-normal">{rec.unit || historyIngredient.unit}</span>
                              </td>
                              <td className="p-2.5 text-right text-slate-600 font-medium">
                                R$ {rec.unitPrice ? Number(rec.unitPrice).toFixed(2).replace('.', ',') : '0,00'}
                              </td>
                              <td className="p-2.5 text-right font-black text-emerald-700">
                                R$ {rec.totalCost ? Number(rec.totalCost).toFixed(2).replace('.', ',') : '0,00'}
                              </td>
                              <td className="p-2.5 pr-3 text-center">
                                {formattedExp ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                                    <Calendar className="h-3 w-3 text-amber-700" />
                                    {formattedExp}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Não informada</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setHistoryIngredient(null);
                      openNewInvoiceModal();
                    }}
                    className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-extrabold text-xs rounded-xl border border-emerald-300 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4 text-emerald-800" />
                    <span>Lançar Nova Nota Fiscal</span>
                  </button>

                  <button
                    onClick={() => setHistoryIngredient(null)}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dedicated Quick Photo Modal for Stock Item */}
          {photoModalIngredient && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-amber-100 p-2 rounded-xl text-amber-700">
                      <Camera className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base">
                        Mudar Foto do Produto
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Item: <strong className="text-slate-800">{photoModalIngredient.name}</strong>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setPhotoModalIngredient(null);
                      setIngredientPhotoUrlInput('');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Photo Preview Box */}
                <div className="relative h-44 w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex flex-col items-center justify-center shadow-inner">
                  {ingredientPhotoUrlInput ? (
                    <>
                      <img 
                        src={ingredientPhotoUrlInput} 
                        alt="Pré-visualização" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as any).src = 'https://via.placeholder.com/400x300?text=Erro+no+Link';
                        }}
                      />
                      <div className="absolute top-2 right-2 bg-slate-900/70 text-white px-2 py-1 rounded-lg text-[10px] font-bold backdrop-blur-xs">
                        Pré-visualização
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-600">Nenhuma imagem selecionada</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Escolha uma foto da galeria abaixo ou cole uma URL</p>
                    </div>
                  )}
                </div>

                {/* URL Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Link da Imagem (URL da Foto)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://exemplo.com/foto.jpg..."
                      value={ingredientPhotoUrlInput}
                      onChange={(e) => setIngredientPhotoUrlInput(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                    />
                    {ingredientPhotoUrlInput && (
                      <button
                        type="button"
                        onClick={() => setIngredientPhotoUrlInput('')}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                {/* Photo Gallery Suggestions */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="text-xs font-extrabold text-slate-800 flex items-center justify-between">
                    <span>Galeria de Fotos Recomendadas:</span>
                    <span className="text-[10px] font-bold text-brand-green bg-green-50 px-2 py-0.5 rounded-full">
                      1 clique para selecionar
                    </span>
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {(photoSuggestionsByCategory[photoModalIngredient.category] || photoSuggestionsByCategory.extra).map((sug, idx) => (
                      <div
                        key={idx}
                        onClick={() => setIngredientPhotoUrlInput(sug.url)}
                        className={`group relative h-20 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                          ingredientPhotoUrlInput === sug.url
                            ? 'border-brand-green ring-2 ring-brand-green/30 shadow-md scale-[1.02]'
                            : 'border-slate-200 hover:border-amber-400 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img src={sug.url} alt={sug.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 p-1 text-center">
                          <p className="text-[10px] font-bold text-white truncate">{sug.label}</p>
                        </div>
                        {ingredientPhotoUrlInput === sug.url && (
                          <div className="absolute top-1.5 right-1.5 bg-brand-green text-white p-0.5 rounded-full shadow-xs">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setPhotoModalIngredient(null);
                      setIngredientPhotoUrlInput('');
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (photoModalIngredient && onSaveIngredient) {
                        onSaveIngredient({
                          ...photoModalIngredient,
                          image: ingredientPhotoUrlInput
                        });
                      }
                      setPhotoModalIngredient(null);
                      setIngredientPhotoUrlInput('');
                    }}
                    className="px-5 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    <span>Salvar Foto do Produto</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Ingredient Confirmation Modal */}
          {deletingIngredient && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
                <div className="flex items-center gap-3 text-red-600">
                  <div className="bg-red-100 p-2.5 rounded-xl">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-base">Excluir Item do Estoque</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tem certeza que deseja remover o item <strong>"{deletingIngredient.name}"</strong> do controle de estoque?
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setDeletingIngredient(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (onDeleteIngredient) {
                        onDeleteIngredient(deletingIngredient.id);
                      }
                      setDeletingIngredient(null);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Sim, Excluir
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Etapas do Construtor desativadas */}
      {false && (
        <div className="space-y-6 animate-in fade-in duration-200" id="steps-panel">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-500 tracking-tight">Etapas do Construtor & Itens das Etapas</h3>
              <p className="text-xs text-slate-400 mt-1">Configure o nome, descrição e escolha exatamente quais insumos e adicionais estarão disponíveis em cada etapa do montador.</p>
            </div>
            
            <div className="divide-y divide-gray-100">
              {localSteps.map((step, idx) => {
                const isExpanded = expandedStepId === step.id;
                const allowedCount = step.allowedItems ? step.allowedItems.length : 0;
                
                return (
                  <div key={step.id} className="py-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex-1 min-w-[240px]">
                        <div className="flex items-center gap-2">
                          <span className="bg-brand-green text-white font-black text-xs h-6 w-6 rounded-lg flex items-center justify-center shrink-0">
                            {step.id}
                          </span>
                          <input
                            type="text"
                            value={step.name}
                            onChange={(e) => {
                              const updated = [...localSteps];
                              updated[idx].name = e.target.value;
                              setLocalSteps(updated);
                            }}
                            className="font-bold text-sm text-slate-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-brand-green focus:outline-hidden py-0.5 px-1 rounded transition-all"
                            placeholder="Nome da Etapa"
                          />
                        </div>
                        <input
                          type="text"
                          value={step.description}
                          onChange={(e) => {
                            const updated = [...localSteps];
                            updated[idx].description = e.target.value;
                            setLocalSteps(updated);
                          }}
                          className="text-xs text-slate-400 mt-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-brand-green focus:outline-hidden py-0.5 w-full max-w-md font-medium px-1"
                          placeholder="Descrição orientativa da etapa..."
                        />
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Expand items selector button */}
                        <button
                          onClick={() => {
                            setExpandedStepId(isExpanded ? null : step.id);
                            setStepItemSearch('');
                          }}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isExpanded || allowedCount > 0
                              ? 'bg-brand-green/10 text-brand-green border-brand-green/30'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <ListPlus className="h-3.5 w-3.5" />
                          <span>
                            {allowedCount > 0 ? `${allowedCount} itens selecionados` : 'Itens da Etapa (Todos)'}
                          </span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          step.active 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {step.active ? 'Ativa' : 'Inativa'}
                        </span>
                        
                        {/* Toggle switch */}
                        <button
                          onClick={() => {
                            const updated = [...localSteps];
                            updated[idx].active = !updated[idx].active;
                            setLocalSteps(updated);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            step.active ? 'bg-brand-green' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              step.active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Step items & options selector panel */}
                    {isExpanded && (
                      <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-4 animate-in fade-in duration-150">
                        
                        {/* OPTIONS MANAGER SECTION (For Size - Step 2 or any step with options) */}
                        {(step.id === 2 || step.id === 5 || (step.options && step.options.length > 0)) && (
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div>
                                <h5 className="font-bold text-xs text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                                  <span>Opções & Tamanhos Personalizados da Etapa</span>
                                </h5>
                                <p className="text-[10px] text-slate-400">
                                  Gerencie os tamanhos disponíveis (15cm, 30cm, 45cm...) com preços adicionais e descrições.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => addStepOption(step.id)}
                                className="px-2.5 py-1 bg-brand-green/10 text-brand-green hover:bg-brand-green/20 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Adicionar Opção/Tamanho</span>
                              </button>
                            </div>

                            {/* List of options */}
                            {(() => {
                              const opts = step.options && step.options.length > 0
                                ? step.options
                                : (step.id === 2 ? [
                                    { id: 'opt-15cm', label: 'Sub 15cm (Tamanho Padrão)', value: '15cm', description: 'Tamanho Individual Padrão', priceAdd: 0 }
                                  ] : []);

                              if (opts.length === 0) {
                                return (
                                  <p className="text-xs text-slate-400 py-2 italic text-center">
                                    Nenhuma opção de tamanho/variante criada ainda. Clique em "Adicionar Opção/Tamanho" acima.
                                  </p>
                                );
                              }

                              return (
                                <div className="space-y-2">
                                  {opts.map((opt, optIdx) => (
                                    <div key={opt.id || optIdx} className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                                      <div className="sm:col-span-4">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Rótulo (ex: Sub 15cm)</label>
                                        <input
                                          type="text"
                                          value={opt.label}
                                          onChange={(e) => updateStepOption(step.id, optIdx, 'label', e.target.value)}
                                          className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-hidden focus:border-brand-green"
                                          placeholder="Ex: Sub 45cm"
                                        />
                                      </div>
                                      <div className="sm:col-span-3">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Código/Valor (ex: 45cm)</label>
                                        <input
                                          type="text"
                                          value={opt.value}
                                          onChange={(e) => updateStepOption(step.id, optIdx, 'value', e.target.value)}
                                          className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-hidden focus:border-brand-green"
                                          placeholder="Ex: 45cm"
                                        />
                                      </div>
                                      <div className="sm:col-span-3">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Preço Adicional (R$)</label>
                                        <input
                                          type="number"
                                          step="0.50"
                                          min="0"
                                          value={opt.priceAdd}
                                          onChange={(e) => updateStepOption(step.id, optIdx, 'priceAdd', parseFloat(e.target.value) || 0)}
                                          className="w-full text-xs font-bold text-amber-700 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-hidden focus:border-brand-green"
                                          placeholder="0.00"
                                        />
                                      </div>
                                      <div className="sm:col-span-2 flex items-end justify-end pt-3 sm:pt-0">
                                        <button
                                          type="button"
                                          onClick={() => removeStepOption(step.id, optIdx)}
                                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                          title="Excluir opção"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                      <div className="sm:col-span-12">
                                        <input
                                          type="text"
                                          value={opt.description || ''}
                                          onChange={(e) => updateStepOption(step.id, optIdx, 'description', e.target.value)}
                                          className="w-full text-[11px] text-slate-500 bg-white border border-slate-200 rounded px-2 py-0.5 focus:outline-hidden focus:border-brand-green"
                                          placeholder="Descrição da opção ao cliente (ex: Tamanho Família)..."
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* INGREDIENTS SELECTOR SECTION */}
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                            <div>
                              <h5 className="font-bold text-xs text-slate-700 uppercase tracking-tight">
                                Seleção de Insumos da Etapa
                              </h5>
                              <p className="text-[10px] text-slate-400">
                                {allowedCount === 0 
                                  ? 'Exibindo todos os itens da categoria correspondente.' 
                                  : `Exibindo ${allowedCount} item(ns) selecionados especificamente para esta etapa.`}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const defaultCat = getStepDefaultCategory(step.id);
                                  const currentCatFilter = stepCategoryOverride[step.id] ?? (defaultCat || 'all');
                                  const catItems = currentCatFilter === 'all' 
                                    ? ingredients 
                                    : ingredients.filter(i => i.category === currentCatFilter);
                                  
                                  const catItemIds = catItems.map(i => i.id);
                                  const updated = [...localSteps];
                                  const currentAllowed = updated[idx].allowedItems || [];
                                  const merged = Array.from(new Set([...currentAllowed, ...catItemIds]));
                                  updated[idx].allowedItems = merged;
                                  setLocalSteps(updated);
                                }}
                                className="text-[10px] font-bold text-slate-600 hover:text-brand-green bg-white border border-slate-200 px-2 py-1 rounded-lg cursor-pointer"
                              >
                                Marcar Desta Categoria
                              </button>
                              <button
                                onClick={() => clearStepItems(step.id)}
                                className="text-[10px] font-bold text-slate-500 hover:text-red-600 bg-white border border-slate-200 px-2 py-1 rounded-lg cursor-pointer"
                              >
                                Limpar Seleção
                              </button>
                            </div>
                          </div>

                          {/* Category Filter Pills bar */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Filtrar por:</span>
                            {(() => {
                              const defaultCat = getStepDefaultCategory(step.id);
                              const currentCatFilter = stepCategoryOverride[step.id] ?? (defaultCat || 'all');

                              const categoryOptions = [
                                { id: 'auto', label: defaultCat ? `Apenas ${
                                  defaultCat === 'bread' ? 'Pães' :
                                  defaultCat === 'protein' ? 'Proteínas' :
                                  defaultCat === 'cheese' ? 'Queijos' :
                                  defaultCat === 'vegetable' ? 'Saladas/Vegetais' :
                                  defaultCat === 'sauce' ? 'Molhos' :
                                  defaultCat === 'extra' ? 'Adicionais' :
                                  defaultCat === 'drink_cookie' ? 'Bebidas & Cookies' : defaultCat
                                } (Padrão da Etapa)` : 'Apenas Padrão' },
                                { id: 'all', label: 'Todos os Insumos' },
                                { id: 'bread', label: 'Pães' },
                                { id: 'protein', label: 'Proteínas' },
                                { id: 'cheese', label: 'Queijos' },
                                { id: 'vegetable', label: 'Vegetais' },
                                { id: 'sauce', label: 'Molhos' },
                                { id: 'extra', label: 'Adicionais' },
                                { id: 'drink_cookie', label: 'Bebidas/Cookies' }
                              ];

                              return categoryOptions.map(catOpt => {
                                const activeCat = catOpt.id === 'auto' ? (defaultCat || 'all') : catOpt.id;
                                const isSelected = (catOpt.id === 'auto' && stepCategoryOverride[step.id] === undefined) || stepCategoryOverride[step.id] === catOpt.id;

                                return (
                                  <button
                                    key={catOpt.id}
                                    type="button"
                                    onClick={() => {
                                      setStepCategoryOverride(prev => ({ ...prev, [step.id]: catOpt.id === 'auto' ? (defaultCat || 'all') : catOpt.id }));
                                    }}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-brand-green text-white shadow-2xs'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {catOpt.label}
                                  </button>
                                );
                              });
                            })()}
                          </div>

                          {/* Search input for ingredients */}
                          <div className="relative max-w-xs">
                            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                            <input
                              type="text"
                              placeholder="Buscar insumo pelo nome..."
                              value={stepItemSearch}
                              onChange={(e) => setStepItemSearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-brand-green"
                            />
                          </div>

                          {/* Items checkboxes grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                            {(() => {
                              const defaultCat = getStepDefaultCategory(step.id);
                              const activeCatFilter = stepCategoryOverride[step.id] ?? (defaultCat || 'all');

                              const stepIngredients = ingredients.filter(ing => {
                                if (activeCatFilter !== 'all' && ing.category !== activeCatFilter) return false;
                                if (stepItemSearch && !ing.name.toLowerCase().includes(stepItemSearch.toLowerCase())) return false;
                                return true;
                              });

                              if (stepIngredients.length === 0) {
                                return (
                                  <div className="col-span-full py-4 text-center text-slate-400 text-xs">
                                    Nenhum insumo encontrado nesta categoria. Alterne os filtros acima para ver mais insumos.
                                  </div>
                                );
                              }

                              return stepIngredients.map(ing => {
                                const isChecked = step.allowedItems?.includes(ing.id) || step.allowedItems?.includes(ing.name);
                                return (
                                  <button
                                    type="button"
                                    key={ing.id}
                                    onClick={() => toggleItemInStep(step.id, ing.id)}
                                    className={`p-2 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                                      isChecked
                                        ? 'bg-brand-green/10 border-brand-green text-brand-green font-bold'
                                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1 pr-2">
                                      <p className="text-xs font-semibold truncate">{ing.name}</p>
                                      <span className="text-[9px] uppercase font-bold text-slate-400">
                                        {ing.category}
                                      </span>
                                    </div>
                                    <div className={`h-4 w-4 rounded flex items-center justify-center shrink-0 ${
                                      isChecked ? 'bg-brand-green text-white' : 'border border-slate-300 bg-slate-50'
                                    }`}>
                                      {isChecked && <Check className="h-3 w-3" />}
                                    </div>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => onUpdateSteps && onUpdateSteps(localSteps)}
                className="bg-brand-green hover:bg-brand-green-dark text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Salvar Configuração de Etapas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ready-products' && (
        <div className="space-y-6 animate-in fade-in duration-200" id="ready-products-panel">
          
          {/* Header Action & Search */}
          <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-500 tracking-tight">Cardápio de Produtos Prontos</h3>
              <p className="text-xs text-slate-400 mt-1">Gerencie itens pré-configurados em tabela e baixe relatórios do cardápio em PDF.</p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={readyProductsSearch}
                  onChange={(e) => setReadyProductsSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium w-36 sm:w-48 focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                />
              </div>

              {/* Filtro por Categoria */}
              <select
                value={readyProductsCategory}
                onChange={(e) => setReadyProductsCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                title="Filtrar por Categoria"
              >
                <option value="all">📁 Todas as Categorias</option>
                <option value="sandwich">🥪 Lanches</option>
                <option value="salad">🥗 Saladas</option>
                <option value="addon">🍟 Adicionais</option>
                <option value="drink">🥤 Bebidas</option>
                <option value="cookie">🍪 Cookies</option>
                <option value="combo">🍟🥤 Combos</option>
                <option value="other">📦 Outros</option>
                {Array.from(new Set(readyProducts.map(p => p.category)))
                  .filter(c => Boolean(c) && !['sandwich', 'salad', 'addon', 'drink', 'cookie', 'other'].includes(c))
                  .map(c => (
                    <option key={c} value={c}>🏷️ {c}</option>
                  ))}
              </select>

              {/* Filtro por Subcategoria */}
              <select
                value={readyProductsSubcategory}
                onChange={(e) => setReadyProductsSubcategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                title="Filtrar por Subcategoria"
              >
                <option value="all">🏷️ Todas as Subcategorias</option>
                {Array.from(new Set(readyProducts.map(p => p.subcategory).filter(Boolean)))
                  .map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
              </select>
              <button
                onClick={exportReadyProductsPDF}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-2 cursor-pointer active:scale-95 border border-slate-200"
                title="Exportar cardápio em PDF"
              >
                <Download className="h-4 w-4 text-brand-green" />
                <span>Baixar PDF</span>
              </button>
              <button
                onClick={() => {
                  setEditingProduct({
                    name: '',
                    description: '',
                    price: 0,
                    category: 'sandwich',
                    displaySection: 'destaques',
                    isPopular: true,
                    showOnHome: true,
                    isCombo: false,
                    comboItems: [],
                    showInComboSection: false,
                    skipIngredients: false,
                    sandwichConfig: {
                      bread: '',
                      size: '15cm',
                      protein: '',
                      cheese: 'Sem Queijo',
                      toasted: true,
                      veggies: [],
                      sauces: [],
                      extras: [],
                      drinksAndCookies: []
                    }
                  });
                  setIsCustomCategoryMode(false);
                  setCustomCategoryInput('');
                  setIsEditingProduct(true);
                }}
                className="bg-brand-green hover:bg-brand-green-dark text-white font-black text-xs py-2 px-4 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Produto Pronto</span>
              </button>
            </div>
          </div>

          {/* Form Modal / Panel */}
          {isEditingProduct && editingProduct && (
            <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-lg space-y-5 animate-in slide-in-from-top-3">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h4 className="font-bold text-slate-800 text-sm">
                  {editingProduct.id ? 'Editar Produto Pronto' : 'Cadastrar Novo Produto Pronto'}
                </h4>
                <button 
                  onClick={() => { setIsEditingProduct(false); setEditingProduct(null); }}
                  className="text-gray-400 hover:text-gray-600 font-bold text-xs"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
                <div className="space-y-1.5">
                  <label>Nome do Produto *</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name || ''}
                    onChange={(e) => setEditingProduct(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Bagôway Double Bacon"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label>Preço (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingProduct.price || ''}
                    onChange={(e) => setEditingProduct(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="Ex: 29.90"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label>Descrição *</label>
                  <textarea
                    required
                    rows={2}
                    value={editingProduct.description || ''}
                    onChange={(e) => setEditingProduct(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Ex: Pão parmesão, carne artesanal, molho barbecue e queijo cheddar."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label>Link da Imagem (URL)</label>
                  <input
                    type="text"
                    value={editingProduct.image || ''}
                    onChange={(e) => setEditingProduct(prev => ({ ...prev, image: e.target.value }))}
                    placeholder="Ex: https://..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                {/* Category Selection with Custom Category Creation Option */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-700">Categoria do Produto *</label>
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !isCustomCategoryMode;
                        setIsCustomCategoryMode(nextState);
                        if (nextState) {
                          setCustomCategoryInput(editingProduct.category && !['sandwich','salad','addon','drink','cookie','other'].includes(editingProduct.category) ? editingProduct.category : '');
                        }
                      }}
                      className="text-brand-green text-[11px] font-bold hover:underline cursor-pointer"
                    >
                      {isCustomCategoryMode ? '← Selecionar da Lista' : '➕ Criar Nova Categoria'}
                    </button>
                  </div>

                  {isCustomCategoryMode ? (
                    <input
                      type="text"
                      required
                      placeholder="Nome da Nova Categoria (Ex: Sucos Naturais, Porções, Combos Família...)"
                      value={customCategoryInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomCategoryInput(val);
                        setEditingProduct(prev => ({ ...prev, category: val }));
                      }}
                      className="w-full px-3 py-2.5 border border-brand-green rounded-lg text-xs bg-emerald-50/30 focus:outline-hidden font-bold"
                    />
                  ) : (
                    <select
                      value={editingProduct.category || 'sandwich'}
                      onChange={(e) => {
                        const cat = e.target.value;
                        if (cat === '__CREATE_NEW__') {
                          setIsCustomCategoryMode(true);
                          setCustomCategoryInput('');
                          setEditingProduct(prev => ({ ...prev, category: '' }));
                        } else {
                          setIsCustomCategoryMode(false);
                          setEditingProduct(prev => ({ 
                            ...prev, 
                            category: cat,
                            sandwichConfig: (cat === 'sandwich' || cat === 'salad') ? (prev?.sandwichConfig || {
                              bread: '',
                              size: '15cm',
                              protein: '',
                              cheese: 'Sem Queijo',
                              toasted: true,
                              veggies: [],
                              sauces: [],
                              extras: [],
                              drinksAndCookies: []
                            }) : undefined,
                            linkedIngredientId: (cat !== 'sandwich' && cat !== 'salad') ? '' : undefined
                          }));
                        }
                      }}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                    >
                      <optgroup label="Categorias Padrão">
                        <option value="sandwich">🥪 Lanche / Sanduíche / Combo</option>
                        <option value="salad">🥗 Salada Fresh</option>
                        <option value="addon">🍟 Item Adicional / Porção</option>
                        <option value="drink">🥤 Bebida Gelada</option>
                        <option value="cookie">🍪 Cookie / Sobremesa</option>
                        <option value="other">📦 Outros</option>
                      </optgroup>
                      {Array.from(new Set(readyProducts.map(p => p.category)))
                        .filter(c => Boolean(c) && !['sandwich', 'salad', 'addon', 'drink', 'cookie', 'other'].includes(c))
                        .length > 0 && (
                          <optgroup label="Suas Categorias Criadas">
                            {Array.from(new Set(readyProducts.map(p => p.category)))
                              .filter(c => Boolean(c) && !['sandwich', 'salad', 'addon', 'drink', 'cookie', 'other'].includes(c))
                              .map(c => (
                                <option key={c} value={c}>🏷️ {c}</option>
                              ))}
                          </optgroup>
                        )}
                      <option value="__CREATE_NEW__">➕ Criar Nova Categoria...</option>
                    </select>
                  )}
                </div>

                {/* Campo Subcategoria do Produto Pró */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Subcategoria (Opcional)</label>
                  <input
                    type="text"
                    list="ready-subcategory-list"
                    placeholder="Ex: Combos, Artesanal, Sucos 500ml, Latinhas, Zero Açúcar..."
                    value={editingProduct.subcategory || ''}
                    onChange={(e) => setEditingProduct(prev => ({ ...prev, subcategory: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs font-medium"
                  />
                  <datalist id="ready-subcategory-list">
                    {Array.from(new Set(readyProducts.map(p => p.subcategory).filter(Boolean))).map(sub => (
                      <option key={sub} value={sub} />
                    ))}
                  </datalist>
                </div>

                {/* Display Location on Home Page (Onde deve aparecer na página inicial) */}
                <div className="md:col-span-2 bg-gradient-to-r from-emerald-50/80 to-amber-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="font-extrabold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                      <span>📍 Onde deve aparecer na Página Inicial?</span>
                    </h5>
                    <span className="text-[10px] font-bold text-slate-500">Marque as seções desejadas</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Checkbox Destaque */}
                    <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      editingProduct.isPopular || editingProduct.displaySection === 'destaques' || editingProduct.displaySection === 'all'
                        ? 'bg-emerald-100/70 border-emerald-400 text-emerald-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={Boolean(editingProduct.isPopular || editingProduct.displaySection === 'destaques' || editingProduct.displaySection === 'all')}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setEditingProduct(prev => ({
                            ...prev,
                            isPopular: isChecked,
                            displaySection: isChecked ? (prev?.isPromo || prev?.displaySection === 'promocao' ? 'all' : 'destaques') : (prev?.isPromo ? 'promocao' : 'cardapio')
                          }));
                        }}
                        className="mt-0.5 rounded border-gray-300 text-brand-green focus:ring-brand-green"
                      />
                      <div>
                        <span className="text-xs font-black block">⭐ Em Destaque</span>
                        <span className="text-[10px] text-slate-500 font-normal leading-tight block mt-0.5">Exibe no topo da Página Inicial em "Destaques".</span>
                      </div>
                    </label>

                    {/* Checkbox Promoção */}
                    <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      editingProduct.isPromo || editingProduct.displaySection === 'promocao' || editingProduct.displaySection === 'all'
                        ? 'bg-amber-100/70 border-amber-400 text-amber-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={Boolean(editingProduct.isPromo || editingProduct.displaySection === 'promocao' || editingProduct.displaySection === 'all')}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setEditingProduct(prev => ({
                            ...prev,
                            isPromo: isChecked,
                            displaySection: isChecked ? (prev?.isPopular || prev?.displaySection === 'destaques' ? 'all' : 'promocao') : (prev?.isPopular ? 'destaques' : 'cardapio')
                          }));
                        }}
                        className="mt-0.5 rounded border-gray-300 text-brand-green focus:ring-brand-green"
                      />
                      <div>
                        <span className="text-xs font-black block">🔥 Promoção</span>
                        <span className="text-[10px] text-slate-500 font-normal leading-tight block mt-0.5">Exibe no bloco especial de Promoções.</span>
                      </div>
                    </label>

                    {/* Checkbox Destaque "Combo" */}
                    <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      editingProduct.showInComboSection || editingProduct.displaySection === 'combo'
                        ? 'bg-purple-100/80 border-purple-400 text-purple-950 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={Boolean(editingProduct.showInComboSection || editingProduct.displaySection === 'combo')}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setEditingProduct(prev => ({
                            ...prev,
                            showInComboSection: isChecked,
                            isCombo: isChecked ? true : prev?.isCombo,
                            skipIngredients: isChecked ? true : prev?.skipIngredients,
                            displaySection: isChecked ? 'combo' : (prev?.isPopular ? 'destaques' : 'cardapio')
                          }));
                        }}
                        className="mt-0.5 rounded border-purple-400 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="text-xs font-black block">🍟🥤 Destaque "Combo"</span>
                        <span className="text-[10px] text-slate-500 font-normal leading-tight block mt-0.5">Exibe na vitrine de destaque "Combo" na Home.</span>
                      </div>
                    </label>

                    {/* Checkbox Nosso Cardápio */}
                    <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      editingProduct.displaySection === 'cardapio' || !editingProduct.displaySection || editingProduct.displaySection === 'all'
                        ? 'bg-blue-100/70 border-blue-400 text-blue-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={Boolean(editingProduct.displaySection === 'cardapio' || !editingProduct.displaySection || editingProduct.displaySection === 'all')}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setEditingProduct(prev => ({
                            ...prev,
                            displaySection: isChecked ? (prev?.displaySection ? prev.displaySection : 'cardapio') : 'destaques'
                          }));
                        }}
                        className="mt-0.5 rounded border-gray-300 text-brand-green focus:ring-brand-green"
                      />
                      <div>
                        <span className="text-xs font-black block">📖 Nosso Cardápio</span>
                        <span className="text-[10px] text-slate-500 font-normal leading-tight block mt-0.5">Exibe na listagem geral do cardápio.</span>
                      </div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Preço sem Desconto / De (R$) - Opcional p/ Promoção
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingProduct.originalPrice || ''}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev, originalPrice: parseFloat(e.target.value) || undefined }))}
                        placeholder="Ex: 38.00 (Calcula a % de desconto)"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Selo / Texto do Badge (Opcional)
                      </label>
                      <input
                        type="text"
                        value={editingProduct.badgeText || ''}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev, badgeText: e.target.value }))}
                        placeholder="Ex: MAIS PEDIDO, NOVIDADE, PROMOÇÃO, ESPECIAL..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* CONFIGURADOR DE COMBO (BEBIDAS, SUCOS, VITAMINAS E MAIS) */}
                <div className="md:col-span-2 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/15 p-5 rounded-2xl border-2 border-amber-300/80 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center text-xl font-black shadow-xs shrink-0">
                        🍟🥤
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-black text-slate-900 text-sm uppercase tracking-tight">
                            Formação de Combo (Bebidas, Sucos, Vitaminas, etc.)
                          </h5>
                          <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                            Configuração
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">
                          Monte combos com bebidas, sucos ou vitaminas. Ficarão salvos no banco de dados e irão direto para o fechamento.
                        </p>
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3.5 py-2 rounded-xl border border-amber-300 shadow-2xs">
                      <input
                        type="checkbox"
                        checked={Boolean(editingProduct.isCombo)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditingProduct(prev => ({
                            ...prev,
                            isCombo: checked,
                            showInComboSection: checked ? true : prev?.showInComboSection,
                            skipIngredients: checked ? true : prev?.skipIngredients
                          }));
                        }}
                        className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <span className="text-xs font-black text-slate-800">
                        Ativar Modo Combo
                      </span>
                    </label>
                  </div>

                  {editingProduct.isCombo ? (
                    <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                      {/* Opções de Comportamento do Combo */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Opção 1: Destaque na Página Inicial chamado "Combo" */}
                        <label className={`p-3.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                          editingProduct.showInComboSection
                            ? 'bg-amber-100/90 border-amber-400 text-amber-950 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}>
                          <input
                            type="checkbox"
                            checked={Boolean(editingProduct.showInComboSection)}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev, showInComboSection: e.target.checked }))}
                            className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <span className="text-xs font-black block flex items-center gap-1.5">
                              <span>⭐</span> Destaque na Página Inicial ("Combo")
                            </span>
                            <span className="text-[11px] text-slate-600 font-normal leading-tight block mt-0.5">
                              Exibe em uma vitrine de destaque especial chamada "Combo" no topo da loja virtual.
                            </span>
                          </div>
                        </label>

                        {/* Opção 2: Ir direto para o fechamento (sem escolha de insumos) */}
                        <label className={`p-3.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                          editingProduct.skipIngredients
                            ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}>
                          <input
                            type="checkbox"
                            checked={Boolean(editingProduct.skipIngredients)}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev, skipIngredients: e.target.checked }))}
                            className="mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <span className="text-xs font-black block flex items-center gap-1.5">
                              <span>⚡</span> Direto p/ Fechamento (Sem Insumos)
                            </span>
                            <span className="text-[11px] text-slate-600 font-normal leading-tight block mt-0.5">
                              O cliente clica e vai direto confirmar dados e pagamento, sem passar pela montagem de insumos.
                            </span>
                          </div>
                        </label>
                      </div>

                      {/* Itens Atualmente Selecionados no Combo */}
                      <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                            <span>📋</span> Bebidas / Itens Inclusos no Combo ({editingProduct.comboItems?.length || 0})
                          </span>

                          {editingProduct.comboItems && editingProduct.comboItems.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const comboDesc = `Combo acompanha: ${editingProduct.comboItems!.map(i => `${i.quantity || 1}x ${i.name}`).join(' + ')}`;
                                setEditingProduct(prev => ({
                                  ...prev,
                                  description: prev?.description ? `${prev.description} | ${comboDesc}` : comboDesc
                                }));
                              }}
                              className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              title="Copiar itens inclusos para a descrição do produto"
                            >
                              <span>✍️ Gerar Texto p/ Descrição</span>
                            </button>
                          )}
                        </div>

                        {(!editingProduct.comboItems || editingProduct.comboItems.length === 0) ? (
                          <div className="py-6 text-center text-xs text-slate-400 font-medium">
                            Nenhum item adicionado ao combo ainda. Selecione bebidas, sucos ou vitaminas abaixo! 👇
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {editingProduct.comboItems.map((item, idx) => (
                              <div
                                key={`${item.id}-${idx}`}
                                className="flex items-center justify-between gap-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs font-bold text-slate-900 block truncate" title={item.name}>
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] text-amber-800 font-semibold">
                                    {item.category || 'Bebida/Insumo'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <div className="flex items-center bg-white border border-amber-300 rounded-lg overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingProduct(prev => {
                                          const current = [...(prev?.comboItems || [])];
                                          if (current[idx].quantity && current[idx].quantity! > 1) {
                                            current[idx] = { ...current[idx], quantity: current[idx].quantity! - 1 };
                                          } else {
                                            current.splice(idx, 1);
                                          }
                                          return { ...prev, comboItems: current };
                                        });
                                      }}
                                      className="px-2 py-0.5 text-xs font-bold hover:bg-amber-100 text-slate-700 cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <span className="px-2 text-xs font-black text-slate-800">
                                      {item.quantity || 1}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingProduct(prev => {
                                          const current = [...(prev?.comboItems || [])];
                                          current[idx] = { ...current[idx], quantity: (current[idx].quantity || 1) + 1 };
                                          return { ...prev, comboItems: current };
                                        });
                                      }}
                                      className="px-2 py-0.5 text-xs font-bold hover:bg-amber-100 text-slate-700 cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingProduct(prev => ({
                                        ...prev,
                                        comboItems: (prev?.comboItems || []).filter((_, i) => i !== idx)
                                      }));
                                    }}
                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Remover do combo"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Catálogo de Bebidas, Sucos, Vitaminas e etc para Selecionar */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                            <span>🔍</span> Escolher Bebidas, Sucos, Vitaminas e Acompanhamentos
                          </span>

                          {/* Tabs / Filtros Rápidos */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {[
                              { id: 'all', label: 'Todos' },
                              { id: 'juice', label: '🧃 Sucos' },
                              { id: 'vitamin', label: '🥛 Vitaminas' },
                              { id: 'drink', label: '🥤 Bebidas/Geladas' },
                              { id: 'addon', label: '🍟 Acompanhamentos' },
                            ].map(tab => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setComboCategoryFilter(tab.id)}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                  comboCategoryFilter === tab.id
                                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Campo de Busca Rápida */}
                        <div className="relative">
                          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="Buscar bebida, suco, vitamina (ex: maracujá, coca, água, vitamina de morango)..."
                            value={comboItemSearch}
                            onChange={(e) => setComboItemSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        {/* Grade de Itens Disponíveis para Adicionar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                          {availableComboSourceItems
                            .filter(item => {
                              const matchesTab = comboCategoryFilter === 'all' || item.type === comboCategoryFilter;
                              const matchesSearch = !comboItemSearch || 
                                item.name.toLowerCase().includes(comboItemSearch.toLowerCase()) ||
                                item.category.toLowerCase().includes(comboItemSearch.toLowerCase());
                              return matchesTab && matchesSearch;
                            })
                            .map(item => {
                              const isAlreadyAdded = editingProduct.comboItems?.some(ci => ci.name === item.name);
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setEditingProduct(prev => {
                                      const current = [...(prev?.comboItems || [])];
                                      const foundIndex = current.findIndex(ci => ci.name === item.name);
                                      if (foundIndex >= 0) {
                                        current[foundIndex] = { ...current[foundIndex], quantity: (current[foundIndex].quantity || 1) + 1 };
                                      } else {
                                        current.push({
                                          id: item.id,
                                          name: item.name,
                                          category: item.category,
                                          quantity: 1,
                                          price: item.price,
                                          image: item.image
                                        });
                                      }
                                      return { ...prev, comboItems: current };
                                    });
                                  }}
                                  className={`p-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                    isAlreadyAdded
                                      ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold'
                                      : 'bg-slate-50/70 border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 text-slate-700'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs font-bold block truncate" title={item.name}>
                                      {item.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block">
                                      R$ {(item.price || 0).toFixed(2).replace('.', ',')}
                                    </span>
                                  </div>
                                  <span className={`h-6 w-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                    isAlreadyAdded ? 'bg-amber-500 text-slate-950' : 'bg-white border border-slate-200 text-slate-500'
                                  }`}>
                                    +
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/60 p-3 rounded-xl border border-amber-200/50 text-center text-xs text-slate-500">
                      💡 Marque <strong>"Ativar Modo Combo"</strong> acima para selecionar bebidas, sucos ou vitaminas que acompanham este produto e destacá-lo na Página Inicial.
                    </div>
                  )}
                </div>

                {editingProduct.category === 'sandwich' || editingProduct.category === 'salad' ? (
                  <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                    <h5 className="font-bold text-slate-700 text-xs uppercase border-b border-slate-200 pb-1 flex items-center justify-between">
                      <span>⚙️ Receita Pré-Configurada {editingProduct.category === 'salad' ? 'da Salada' : 'do Sanduíche'}</span>
                      <span className="text-[10px] font-normal text-slate-500 normal-case">
                        {editingProduct.category === 'salad' ? 'Monte os ingredientes e molhos padrão desta salada' : 'Monte os ingredientes do sanduíche pré-configurado'}
                      </span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500">
                          Pão / Acompanhamento {editingProduct.category === 'salad' && '(Opcional)'}
                        </label>
                        <select
                          value={editingProduct.sandwichConfig?.bread || ''}
                          onChange={(e) => setEditingProduct(prev => ({
                            ...prev,
                            sandwichConfig: {
                              ...(prev?.sandwichConfig || {
                                bread: '',
                                size: '15cm',
                                protein: '',
                                cheese: 'Sem Queijo',
                                toasted: true,
                                veggies: [],
                                sauces: [],
                                extras: [],
                                drinksAndCookies: []
                              }),
                              bread: e.target.value
                            }
                          }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"
                        >
                          <option value="">{editingProduct.category === 'salad' ? 'Nenhum pão (Somente salada)' : 'Selecione o pão...'}</option>
                          {ingredients.filter(i => i.category === 'bread').map(i => (
                            <option key={i.id} value={i.name}>{i.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500">
                          {editingProduct.category === 'salad' ? 'Proteína / Recheio Principal' : 'Recheio Padrão'}
                        </label>
                        <select
                          value={editingProduct.sandwichConfig?.protein || ''}
                          onChange={(e) => setEditingProduct(prev => ({
                            ...prev,
                            sandwichConfig: {
                              ...(prev?.sandwichConfig || {
                                bread: '',
                                size: '15cm',
                                protein: '',
                                cheese: 'Sem Queijo',
                                toasted: true,
                                veggies: [],
                                sauces: [],
                                extras: [],
                                drinksAndCookies: []
                              }),
                              protein: e.target.value
                            }
                          }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"
                        >
                          <option value="">Selecione o recheio/proteína...</option>
                          {ingredients.filter(i => i.category === 'protein').map(i => (
                            <option key={i.id} value={i.name}>{i.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500">Queijo Padrão</label>
                        <select
                          value={editingProduct.sandwichConfig?.cheese || 'Sem Queijo'}
                          onChange={(e) => setEditingProduct(prev => ({
                            ...prev,
                            sandwichConfig: {
                              ...(prev?.sandwichConfig || {
                                bread: '',
                                size: '15cm',
                                protein: '',
                                cheese: 'Sem Queijo',
                                toasted: true,
                                veggies: [],
                                sauces: [],
                                extras: [],
                                drinksAndCookies: []
                              }),
                              cheese: e.target.value
                            }
                          }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"
                        >
                          <option value="Sem Queijo">Sem Queijo</option>
                          {ingredients.filter(i => i.category === 'cheese').map(i => (
                            <option key={i.id} value={i.name}>{i.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-500 font-bold block">
                          {editingProduct.category === 'salad' ? 'Saladas e Vegetais Incluídos' : 'Saladas Incluídas'}
                        </label>
                        <div className="grid grid-cols-2 gap-1 bg-white p-2 rounded-lg border border-slate-200 max-h-28 overflow-y-auto">
                          {ingredients.filter(i => i.category === 'vegetable').map(v => {
                            const isChecked = editingProduct.sandwichConfig?.veggies.includes(v.name) || false;
                            return (
                              <label key={v.id} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const currentConfig = editingProduct.sandwichConfig || {
                                      bread: '',
                                      size: '15cm',
                                      protein: '',
                                      cheese: 'Sem Queijo',
                                      toasted: true,
                                      veggies: [],
                                      sauces: [],
                                      extras: [],
                                      drinksAndCookies: []
                                    };
                                    const nextV = e.target.checked
                                      ? [...(currentConfig.veggies || []), v.name]
                                      : (currentConfig.veggies || []).filter(name => name !== v.name);
                                    setEditingProduct(prev => ({
                                      ...prev,
                                      sandwichConfig: { ...currentConfig, veggies: nextV }
                                    }));
                                  }}
                                  className="rounded border-gray-300 text-brand-green focus:ring-brand-green shrink-0"
                                />
                                <span className="truncate">{v.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-500 font-bold block">Molhos Incluídos</label>
                        <div className="grid grid-cols-2 gap-1 bg-white p-2 rounded-lg border border-slate-200 max-h-28 overflow-y-auto">
                          {ingredients.filter(i => i.category === 'sauce').map(s => {
                            const isChecked = editingProduct.sandwichConfig?.sauces.includes(s.name) || false;
                            return (
                              <label key={s.id} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const currentConfig = editingProduct.sandwichConfig || {
                                      bread: '',
                                      size: '15cm',
                                      protein: '',
                                      cheese: 'Sem Queijo',
                                      toasted: true,
                                      veggies: [],
                                      sauces: [],
                                      extras: [],
                                      drinksAndCookies: []
                                    };
                                    const nextS = e.target.checked
                                      ? [...(currentConfig.sauces || []), s.name]
                                      : (currentConfig.sauces || []).filter(name => name !== s.name);
                                    setEditingProduct(prev => ({
                                      ...prev,
                                      sandwichConfig: { ...currentConfig, sauces: nextS }
                                    }));
                                  }}
                                  className="rounded border-gray-300 text-brand-green focus:ring-brand-green shrink-0"
                                />
                                <span className="truncate">{s.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  editingProduct.category !== 'other' && (
                    <div className="md:col-span-2 bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-2">
                      <h5 className="font-bold text-amber-900 text-xs uppercase flex items-center gap-1">
                        📦 Vinculação de Estoque
                      </h5>
                      <p className="text-[11px] text-amber-800">Selecione qual ingrediente representa esse produto para dedução de estoque automática quando vendido.</p>
                      <select
                        value={editingProduct.linkedIngredientId || ''}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev, linkedIngredientId: e.target.value }))}
                        className="w-full max-w-sm px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"
                      >
                        <option value="">Nenhum vínculo (estoque infinito / não monitorado)</option>
                        {ingredients.filter(i => i.category === 'drink_cookie').map(i => (
                          <option key={i.id} value={i.id}>{i.name} (Estoque: {i.stock} un)</option>
                        ))}
                      </select>
                    </div>
                  )
                )}
              </div>

              {/* Campo Exibir na Página Inicial (Sim / Não) */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-extrabold text-slate-800 block">Exibir na Página Inicial?</span>
                  <span className="text-[10px] text-slate-500 font-medium">Se "Não", este produto não aparecerá na página inicial.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(prev => prev ? ({ ...prev, showOnHome: true }) : null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      editingProduct.showOnHome !== false
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(prev => prev ? ({ ...prev, showOnHome: false }) : null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      editingProduct.showOnHome === false
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsEditingProduct(false); setEditingProduct(null); }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editingProduct.name && editingProduct.price && onUpdateReadyProduct) {
                      const payload: ReadyProduct = {
                        ...(editingProduct as ReadyProduct),
                        isCombo: Boolean(editingProduct.isCombo),
                        comboItems: editingProduct.comboItems || [],
                        showInComboSection: Boolean(editingProduct.showInComboSection),
                        skipIngredients: Boolean(editingProduct.skipIngredients)
                      };
                      onUpdateReadyProduct(payload);
                      setIsEditingProduct(false);
                      setEditingProduct(null);
                    }
                  }}
                  className="px-5 py-2 bg-brand-green hover:bg-brand-green-dark text-white rounded-lg text-xs font-black shadow-sm cursor-pointer"
                >
                  Salvar Produto
                </button>
              </div>
            </div>
          )}

          {/* Interactive Table of ready products */}
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[11px] tracking-wider">
                  <th className="p-3 w-14 text-center">Foto</th>
                  <th className="p-3 min-w-[170px]">Produto</th>
                  <th className="p-3 min-w-[120px]">Categoria</th>
                  <th className="p-3 min-w-[130px]">Subcategoria</th>
                  <th className="p-3 w-28 text-right">Preço</th>
                  <th className="p-3 min-w-[140px]">Destaques / Selos</th>
                  <th className="p-3 min-w-[200px]">Receita / Descrição</th>
                  <th className="p-3 w-28 text-center">Pág. Inicial</th>
                  <th className="p-3 w-28 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredReadyProducts.map(prod => (
                  <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Foto Thumbnail Button */}
                    <td className="p-2 text-center align-middle">
                      <button
                        onClick={() => {
                          setPhotoModalReadyProduct(prod);
                          setReadyProductPhotoUrlInput(prod.image || '');
                        }}
                        className="relative group w-10 h-10 rounded-lg overflow-hidden bg-slate-100 inline-block border border-slate-200 shadow-2xs cursor-pointer"
                        title="Clique para alterar a foto do produto"
                      >
                        {prod.image ? (
                          <img src={prod.image} alt={prod.name} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50">
                            <Camera className="h-4 w-4" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-amber-400">
                          <Camera className="h-3.5 w-3.5" />
                        </div>
                      </button>
                    </td>

                    {/* Nome do Produto (Input inline) */}
                    <td className="p-2 align-middle">
                      <input
                        type="text"
                        defaultValue={prod.name}
                        key={`ready-name-${prod.id}-${prod.name}`}
                        onBlur={(e) => {
                          const newName = e.target.value.trim();
                          if (newName && newName !== prod.name && onUpdateReadyProduct) {
                            onUpdateReadyProduct({ ...prod, name: newName });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 focus:border-brand-green rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-brand-green"
                        title="Edite o nome e pressione Enter ou clique fora para salvar"
                      />
                    </td>

                    {/* Categoria (Select inline) */}
                    <td className="p-2 align-middle">
                      <select
                        value={prod.category || 'sandwich'}
                        onChange={(e) => {
                          const newCat = e.target.value;
                          if (newCat !== prod.category && onUpdateReadyProduct) {
                            onUpdateReadyProduct({ ...prod, category: newCat });
                          }
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-brand-green"
                        title="Altere a categoria"
                      >
                        <option value="sandwich">Lanche</option>
                        <option value="salad">Salada</option>
                        <option value="drink">Bebida</option>
                        <option value="cookie">Cookie</option>
                        <option value="addon">Adicional</option>
                        <option value="combo">Combo</option>
                        <option value="other">Outros</option>
                        {!['sandwich', 'salad', 'drink', 'cookie', 'addon', 'other'].includes(prod.category) && (
                          <option value={prod.category}>{prod.category}</option>
                        )}
                      </select>
                    </td>

                    {/* Subcategoria (Input inline com datalist) */}
                    <td className="p-2 align-middle">
                      <input
                        type="text"
                        defaultValue={prod.subcategory || ''}
                        key={`ready-subcat-${prod.id}-${prod.subcategory || ''}`}
                        list="ready-table-subcat-list"
                        placeholder="Sem subcat"
                        onBlur={(e) => {
                          const newSub = e.target.value.trim();
                          if (newSub !== (prod.subcategory || '') && onUpdateReadyProduct) {
                            onUpdateReadyProduct({ ...prod, subcategory: newSub || undefined });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 focus:border-brand-green rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-brand-green"
                        title="Edite a subcategoria e pressione Enter"
                      />
                      <datalist id="ready-table-subcat-list">
                        {Array.from(new Set(readyProducts.map(p => p.subcategory).filter(Boolean))).map(s => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </td>

                    {/* Preço (Input inline) */}
                    <td className="p-2 text-right align-middle font-bold">
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-slate-400 text-xs font-bold">R$</span>
                        <input
                          type="number"
                          step="0.50"
                          min="0"
                          defaultValue={prod.price}
                          key={`ready-price-${prod.id}-${prod.price}`}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (val !== prod.price && onUpdateReadyProduct) {
                              onUpdateReadyProduct({ ...prod, price: val });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-brand-green text-right focus:outline-hidden focus:ring-1 focus:ring-brand-green"
                          title="Edite o preço e pressione Enter ou clique fora para salvar"
                        />
                      </div>
                    </td>

                    {/* Destaques / Selos */}
                    <td className="p-2.5 align-middle">
                      <div className="flex flex-wrap gap-1">
                        {(prod.isPopular || prod.displaySection === 'destaques' || prod.displaySection === 'all') && (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                            ⭐ Destaque
                          </span>
                        )}
                        {(prod.isPromo || prod.displaySection === 'promocao' || prod.displaySection === 'all') && (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                            🔥 Promoção
                          </span>
                        )}
                        {prod.badgeText && (
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                            {prod.badgeText}
                          </span>
                        )}
                        {prod.isCombo && (
                          <span className="bg-purple-100 text-purple-950 border border-purple-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            🍟 Combo
                          </span>
                        )}
                        {prod.showInComboSection && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                            ✨ Seção Combo
                          </span>
                        )}
                        {prod.skipIngredients && (
                          <span className="bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                            ⚡ Direto
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Receita / Descrição */}
                    <td className="p-2.5 align-middle text-[11px] text-slate-500">
                      {prod.comboItems && prod.comboItems.length > 0 ? (
                        <div className="line-clamp-2">
                          <span className="font-extrabold text-amber-800">🥤 Combo: </span>
                          <span className="text-slate-700">{prod.comboItems.map(i => `${i.quantity || 1}x ${i.name}`).join(' + ')}</span>
                        </div>
                      ) : prod.sandwichConfig ? (
                        <div className="line-clamp-2">
                          {prod.sandwichConfig.bread && <span><strong>Pão:</strong> {prod.sandwichConfig.bread} | </span>}
                          <span><strong>Recheio:</strong> {prod.sandwichConfig.protein || 'Nenhum'}</span>
                          {prod.sandwichConfig.veggies.length > 0 && <span> | <strong>Salada:</strong> {prod.sandwichConfig.veggies.join(', ')}</span>}
                        </div>
                      ) : (
                        <span className="italic text-slate-400 line-clamp-1">{prod.description || 'Produto Direto'}</span>
                      )}
                    </td>

                    {/* Pág. Inicial Toggle */}
                    <td className="p-2.5 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => {
                          if (onUpdateReadyProduct) {
                            onUpdateReadyProduct({ ...prod, showOnHome: prod.showOnHome === false ? true : false });
                          }
                        }}
                        className={`inline-flex items-center justify-center text-[11px] font-black px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                          prod.showOnHome !== false
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
                        }`}
                        title="Clique para alternar se este produto aparece na Página Inicial"
                      >
                        {prod.showOnHome !== false ? 'Sim' : 'Não'}
                      </button>
                    </td>

                    {/* Ações */}
                    <td className="p-2.5 text-center align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setEditingProduct(prod);
                            if (prod.category && !['sandwich','salad','addon','drink','cookie','other'].includes(prod.category)) {
                              setIsCustomCategoryMode(true);
                              setCustomCategoryInput(prod.category);
                            } else {
                              setIsCustomCategoryMode(false);
                              setCustomCategoryInput('');
                            }
                            setIsEditingProduct(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-brand-green hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                          title="Editar Produto"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingProduct(prod)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title="Excluir Produto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredReadyProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                      Nenhum produto encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Delete Product Modal */}
          {deletingProduct && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
                <div className="flex items-center gap-3 text-red-600">
                  <div className="bg-red-100 p-2.5 rounded-xl">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-base">Excluir Produto</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tem certeza que deseja remover <strong>"{deletingProduct.name}"</strong> do cardápio de produtos prontos? Essa ação removerá o produto do catálogo.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setDeletingProduct(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (onDeleteReadyProduct) {
                        onDeleteReadyProduct(deletingProduct.id);
                      }
                      setDeletingProduct(null);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Sim, Excluir
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Photo Change Modal for Ready Product */}
          {photoModalReadyProduct && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-amber-100 p-2 rounded-xl text-amber-700">
                      <Camera className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base">
                        Mudar Foto do Produto
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Produto: <strong className="text-slate-800">{photoModalReadyProduct.name}</strong>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setPhotoModalReadyProduct(null);
                      setReadyProductPhotoUrlInput('');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Photo Preview Box */}
                <div className="relative h-44 w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex flex-col items-center justify-center shadow-inner">
                  {readyProductPhotoUrlInput ? (
                    <>
                      <img 
                        src={readyProductPhotoUrlInput} 
                        alt="Pré-visualização" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as any).src = 'https://via.placeholder.com/400x300?text=Erro+no+Link';
                        }}
                      />
                      <div className="absolute top-2 right-2 bg-slate-900/70 text-white px-2 py-1 rounded-lg text-[10px] font-bold backdrop-blur-xs">
                        Pré-visualização
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-600">Nenhuma imagem selecionada</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Escolha uma foto da galeria abaixo ou cole uma URL</p>
                    </div>
                  )}
                </div>

                {/* URL Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Link da Imagem (URL da Foto)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://exemplo.com/foto.jpg..."
                      value={readyProductPhotoUrlInput}
                      onChange={(e) => setReadyProductPhotoUrlInput(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-green"
                    />
                    {readyProductPhotoUrlInput && (
                      <button
                        type="button"
                        onClick={() => setReadyProductPhotoUrlInput('')}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                {/* Photo Gallery Suggestions */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="text-xs font-extrabold text-slate-800 flex items-center justify-between">
                    <span>Galeria de Fotos Recomendadas:</span>
                    <span className="text-[10px] font-bold text-brand-green bg-green-50 px-2 py-0.5 rounded-full">
                      1 clique para selecionar
                    </span>
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {((photoSuggestionsByCategory[photoModalReadyProduct.category] || photoSuggestionsByCategory.sandwich || photoSuggestionsByCategory.extra)).map((sug, idx) => (
                      <div
                        key={idx}
                        onClick={() => setReadyProductPhotoUrlInput(sug.url)}
                        className={`group relative h-20 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                          readyProductPhotoUrlInput === sug.url
                            ? 'border-brand-green ring-2 ring-brand-green/30 shadow-md scale-[1.02]'
                            : 'border-slate-200 hover:border-amber-400 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img src={sug.url} alt={sug.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 p-1 text-center">
                          <p className="text-[10px] font-bold text-white truncate">{sug.label}</p>
                        </div>
                        {readyProductPhotoUrlInput === sug.url && (
                          <div className="absolute top-1.5 right-1.5 bg-brand-green text-white p-0.5 rounded-full shadow-xs">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setPhotoModalReadyProduct(null);
                      setReadyProductPhotoUrlInput('');
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (photoModalReadyProduct && onUpdateReadyProduct) {
                        onUpdateReadyProduct({
                          ...photoModalReadyProduct,
                          image: readyProductPhotoUrlInput
                        });
                      }
                      setPhotoModalReadyProduct(null);
                      setReadyProductPhotoUrlInput('');
                    }}
                    className="px-5 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    Salvar Foto
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users & Permissions Panel */}
      {activeTab === 'users' && (
        <div className="space-y-6" id="users-management-panel">
          {user.role !== 'admin' ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm max-w-xl mx-auto space-y-4 my-8">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <Lock className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Acesso Restrito às Configurações</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Somente usuários com perfil de <strong>Administrador</strong> têm permissão para acessar as Configurações do Sistema e gerenciar os usuários.
                </p>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">
                  Seu perfil atual: <strong className="uppercase text-slate-800">{user.role}</strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Bar */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-brand-green" />
                  <span>Configurações do Sistema e Entrega</span>
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Gerencie usuários do sistema, taxas de entrega por distância (km), mapa da loja, horários, maquininhas e dados da marca.
                </p>
              </div>

              {/* Version & Last Update Header Badge */}
              <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 border border-slate-200/90 px-3.5 py-2 rounded-xl shrink-0 self-start md:self-auto shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Versão:</span>
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-mono text-xs font-black border border-emerald-200/60">
                    {APP_VERSION_LABEL}
                  </span>
                </div>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Última Atualização:</span>
                  <span className="font-extrabold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-xs">
                    {APP_LAST_UPDATE}
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-Tab Selector - Responsive Navigation Bar */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => setSettingsSubTab('users')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-grow sm:flex-grow-0 ${
                  settingsSubTab === 'users'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Users className="h-4 w-4 text-brand-green" />
                <span>USUÁRIOS</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('delivery')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-grow sm:flex-grow-0 ${
                  settingsSubTab === 'delivery'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Truck className="h-4 w-4 text-amber-500" />
                <span>TAXA DE ENTREGA</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('schedule')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-grow sm:flex-grow-0 ${
                  settingsSubTab === 'schedule'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Clock className="h-4 w-4 text-blue-600" />
                <span>HORÁRIO</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('whatsapp')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-grow sm:flex-grow-0 ${
                  settingsSubTab === 'whatsapp'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                <span>WHATSAPP</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('coupons')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-grow sm:flex-grow-0 ${
                  settingsSubTab === 'coupons'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Tag className="h-4 w-4 text-purple-600" />
                <span>CUPOM DE DESCONTO</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('card-machines')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-grow sm:flex-grow-0 ${
                  settingsSubTab === 'card-machines'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <CreditCard className="h-4 w-4 text-emerald-600" />
                <span>MAQUININHA DE CARTÃO</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('info')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-grow sm:flex-grow-0 ${
                  settingsSubTab === 'info'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Info className="h-4 w-4 text-indigo-600" />
                <span>INFORMAÇÕES</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('system')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap flex-grow sm:flex-grow-0 ${
                  settingsSubTab === 'system'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Cpu className="h-4 w-4 text-teal-600" />
                <span>SISTEMA & VERSÃO</span>
              </button>
            </div>
          </div>

          {/* Global Alert Notification */}
          {deliverySaveSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>{deliverySaveSuccess}</span>
              </div>
              <button onClick={() => setDeliverySaveSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* TAB 1: TAXA DE ENTREGA */}
          {settingsSubTab === 'delivery' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Store Address & Map Box */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-brand-green" />
                      <span>Localização e Endereço da Loja (Ponto de Origem das Entregas)</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Este ponto no mapa serve como referência central para o cálculo da distância (km) e da taxa de entrega.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCaptureStoreGps}
                    disabled={gpsLoading}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50 active:scale-95"
                  >
                    {gpsLoading ? (
                      <span className="h-3.5 w-3.5 border-2 border-brand-green border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Navigation className="h-3.5 w-3.5 text-brand-green" />
                    )}
                    <span>Usar Meu GPS Atual como Ponto Inicial</span>
                  </button>
                </div>

                {gpsError && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2.5 rounded-xl flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{gpsError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">Endereço da Loja</label>
                    <input
                      type="text"
                      value={deliveryConfig.storeAddress}
                      onChange={(e) => setDeliveryConfig(prev => ({ ...prev, storeAddress: e.target.value }))}
                      placeholder="Ex: antonio leite rego leite"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green text-slate-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase">Latitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={deliveryConfig.storeLat}
                        onChange={(e) => setDeliveryConfig(prev => ({ ...prev, storeLat: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase">Longitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={deliveryConfig.storeLng}
                        onChange={(e) => setDeliveryConfig(prev => ({ ...prev, storeLng: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tiers Configuration Table */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <Truck className="h-4 w-4 text-brand-yellow" />
                      <span>Faixas de Distância e Valores da Taxa de Entrega</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure os valores cobrados conforme a distância percorrida até a casa do cliente. Ex: até 2km R$ 3,00, 3km R$ 5,00, 3 a 5km 7 reais.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const lastTier = deliveryConfig.tiers[deliveryConfig.tiers.length - 1];
                        const newMin = lastTier ? lastTier.maxKm : 0;
                        const newMax = newMin + 2;
                        const newFee = lastTier ? lastTier.fee + 2 : 3.00;
                        const newTier: DeliveryFeeTier = {
                          id: 'tier_' + Date.now(),
                          minKm: newMin,
                          maxKm: newMax,
                          fee: newFee
                        };
                        setDeliveryConfig(prev => ({ ...prev, tiers: [...prev.tiers, newTier] }));
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold px-3 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Adicionar Nova Faixa</span>
                    </button>

                    <button
                      type="button"
                      disabled={savingDeliverySettings}
                      onClick={async () => {
                        setSavingDeliverySettings(true);
                        setDeliverySaveSuccess(null);
                        try {
                          const result = await saveDeliverySettingsToDb(deliveryConfig);
                          if (result.success) {
                            setDeliverySaveSuccess(result.message || 'Faixas de taxa de entrega atualizadas e salvas com sucesso!');
                          } else {
                            saveDeliverySettings(deliveryConfig);
                            setDeliverySaveSuccess('Faixas de taxa de entrega salvas com sucesso!');
                          }
                        } catch (err) {
                          saveDeliverySettings(deliveryConfig);
                          setDeliverySaveSuccess('Faixas atualizadas e salvas com sucesso!');
                        } finally {
                          setSavingDeliverySettings(false);
                          setTimeout(() => setDeliverySaveSuccess(null), 5000);
                        }
                      }}
                      className="bg-brand-green hover:bg-brand-green-dark text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {savingDeliverySettings ? (
                        <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      <span>{savingDeliverySettings ? 'Atualizando...' : 'Atualizar Informações'}</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                        <th className="p-3">Distância Mín. (km)</th>
                        <th className="p-3">Distância Máx. (km)</th>
                        <th className="p-3">Valor da Taxa (R$)</th>
                        <th className="p-3">Exemplo de Descrição</th>
                        <th className="p-3 text-center w-20">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {deliveryConfig.tiers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 font-semibold">
                            Nenhuma faixa de distância configurada. Clique em "+ Adicionar Nova Faixa".
                          </td>
                        </tr>
                      ) : (
                        deliveryConfig.tiers.map((t, idx) => (
                          <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={t.minKm}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setDeliveryConfig(prev => ({
                                      ...prev,
                                      tiers: prev.tiers.map((item, i) => i === idx ? { ...item, minKm: val } : item)
                                    }));
                                  }}
                                  className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                                />
                                <span className="text-slate-400 font-bold">km</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0.1"
                                  value={t.maxKm}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setDeliveryConfig(prev => ({
                                      ...prev,
                                      tiers: prev.tiers.map((item, i) => i === idx ? { ...item, maxKm: val } : item)
                                    }));
                                  }}
                                  className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                                />
                                <span className="text-slate-400 font-bold">km</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 font-bold">R$</span>
                                <input
                                  type="number"
                                  step="0.50"
                                  min="0"
                                  value={t.fee}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setDeliveryConfig(prev => ({
                                      ...prev,
                                      tiers: prev.tiers.map((item, i) => i === idx ? { ...item, fee: val } : item)
                                    }));
                                  }}
                                  className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-brand-green"
                                />
                              </div>
                            </td>
                            <td className="p-3 text-slate-600 font-semibold text-[11px]">
                              {t.minKm === 0
                                ? `Até ${t.maxKm}km — R$ ${(Number(t.fee) || 0).toFixed(2).replace('.', ',')}`
                                : `De ${t.minKm}km a ${t.maxKm}km — R$ ${(Number(t.fee) || 0).toFixed(2).replace('.', ',')}`}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setDeliveryConfig(prev => ({
                                    ...prev,
                                    tiers: prev.tiers.filter((_, i) => i !== idx)
                                  }));
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                title="Remover esta faixa"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    disabled={savingDeliverySettings}
                    onClick={async () => {
                      setSavingDeliverySettings(true);
                      setDeliverySaveSuccess(null);
                      try {
                        const result = await saveDeliverySettingsToDb(deliveryConfig);
                        if (result.success) {
                          setDeliverySaveSuccess(result.message || 'Faixas de taxa de entrega atualizadas e salvas com sucesso!');
                        } else {
                          saveDeliverySettings(deliveryConfig);
                          setDeliverySaveSuccess('Faixas de taxa de entrega salvas com sucesso!');
                        }
                      } catch (err) {
                        saveDeliverySettings(deliveryConfig);
                        setDeliverySaveSuccess('Faixas atualizadas e salvas com sucesso!');
                      } finally {
                        setSavingDeliverySettings(false);
                        setTimeout(() => setDeliverySaveSuccess(null), 5000);
                      }
                    }}
                    className="bg-brand-green hover:bg-brand-green-dark text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {savingDeliverySettings ? (
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>{savingDeliverySettings ? 'Atualizando...' : 'Atualizar Informações das Faixas'}</span>
                  </button>
                </div>
              </div>

              {/* Extra Policies */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-3">
                  Regras Adicionais e Entrega Grátis
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">
                      Entrega Grátis para Pedidos acima de (R$):
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold text-xs">R$</span>
                      <input
                        type="number"
                        step="5"
                        min="0"
                        value={deliveryConfig.freeDeliveryMinOrder}
                        onChange={(e) => setDeliveryConfig(prev => ({ ...prev, freeDeliveryMinOrder: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block">Digite 0 para desativar a isenção por valor.</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">
                      Taxa para Endereços Fora do Raio Máximo (R$):
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold text-xs">R$</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={deliveryConfig.outOfRangeFee}
                        onChange={(e) => setDeliveryConfig(prev => ({ ...prev, outOfRangeFee: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block">Cobrado quando a distância excede a maior faixa.</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={savingDeliverySettings}
                    onClick={async () => {
                      setSavingDeliverySettings(true);
                      setDeliverySaveSuccess(null);
                      try {
                        const result = await saveDeliverySettingsToDb(deliveryConfig);
                        if (result.success) {
                          setDeliverySaveSuccess(result.message || 'Ponto inicial e configurações de taxa salvos no banco de dados!');
                        } else {
                          saveDeliverySettings(deliveryConfig);
                          setDeliverySaveSuccess('Configurações de taxa de entrega salvas com sucesso!');
                        }
                      } catch (err) {
                        saveDeliverySettings(deliveryConfig);
                        setDeliverySaveSuccess('Configurações salvas!');
                      } finally {
                        setSavingDeliverySettings(false);
                        setTimeout(() => setDeliverySaveSuccess(null), 5000);
                      }
                    }}
                    className="w-full sm:w-auto bg-brand-green hover:bg-brand-green-dark text-white font-black px-6 py-3 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                  >
                    {savingDeliverySettings ? (
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>{savingDeliverySettings ? 'Salvando no Banco...' : 'Salvar Ponto Inicial e Taxas no Banco de Dados'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HORARIO DE ATENDIMENTO & STATUS DO DELIVERY */}
          {settingsSubTab === 'schedule' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                        <span>Horário de Atendimento e Liberação do Delivery</span>
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-200">
                          Salvo no Banco de Dados
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Defina se o delivery funciona 24 horas por dia, bloqueie manualmente se necessário ou configure o horário diário de abertura e fechamento.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status & Manual Block / 24h / Somente Retirada Controls */}
                <div className={`p-4 rounded-xl border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 transition-all ${
                  deliveryConfig.isDeliveryBlocked
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : deliveryConfig.pickupOnly
                    ? 'bg-amber-50 border-amber-300 text-amber-950 ring-2 ring-amber-500/20'
                    : deliveryConfig.forceAlwaysOpen
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 ring-2 ring-emerald-500/20'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      deliveryConfig.isDeliveryBlocked
                        ? 'bg-rose-200 text-rose-800'
                        : deliveryConfig.pickupOnly
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-emerald-200 text-emerald-800'
                    }`}>
                      {deliveryConfig.isDeliveryBlocked ? (
                        <Lock className="h-5 w-5" />
                      ) : deliveryConfig.pickupOnly ? (
                        <Store className="h-5 w-5 text-amber-900" />
                      ) : (
                        <Unlock className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h5 className="font-black text-sm uppercase tracking-tight flex flex-wrap items-center gap-2">
                        <span>Status Atual da Loja:</span>
                        {deliveryConfig.isDeliveryBlocked ? (
                          <span className="bg-rose-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase">
                            🔴 BLOQUEADO MANUALMENTE
                          </span>
                        ) : deliveryConfig.pickupOnly ? (
                          <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase flex items-center gap-1 shadow-xs border border-amber-400">
                            <span>🏪</span>
                            <span>SOMENTE RETIRADA ATIVO (DELIVERY BLOQUEADO)</span>
                          </span>
                        ) : deliveryConfig.forceAlwaysOpen ? (
                          <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                            🟢 LIBERADO A QUALQUER MOMENTO (24H)
                          </span>
                        ) : (
                          <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase">
                            🟢 ABERTO (CONFORME HORÁRIO PROGRAMADO)
                          </span>
                        )}
                      </h5>
                      <p className="text-xs font-semibold mt-1 opacity-90">
                        {deliveryConfig.isDeliveryBlocked
                          ? 'O recebimento de novos pedidos online (para Entrega e Retirada) está bloqueado manualmente no momento.'
                          : deliveryConfig.pickupOnly
                          ? 'Modo Somente Retirada ativo! Clientes podem fazer pedidos exclusivamente para retirada no balcão da loja. O serviço de entrega via delivery está bloqueado e a página inicial exibe o aviso "Somente Retirada".'
                          : deliveryConfig.forceAlwaysOpen
                          ? 'Delivery Liberado a qualquer momento! A loja está aberta para receber pedidos 24 horas por dia, ignorando horários de abertura e fechamento.'
                          : `Loja ativa! Pedidos são aceitos e validados conforme o horário programado (${deliveryConfig.deliveryOpeningTime || '15:00'} às ${deliveryConfig.deliveryClosingTime || '23:00'}).`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
                    {/* Botão para Toggle Somente Retirada (Desativa Delivery) */}
                    <button
                      type="button"
                      disabled={savingDeliverySettings}
                      onClick={async () => {
                        const newPickupOnly = !deliveryConfig.pickupOnly;
                        const updatedConfig = {
                          ...deliveryConfig,
                          pickupOnly: newPickupOnly
                        };
                        setDeliveryConfig(updatedConfig);
                        setSavingDeliverySettings(true);
                        setDeliverySaveSuccess(null);
                        try {
                          const result = await saveDeliverySettingsToDb(updatedConfig);
                          if (result.success) {
                            setDeliverySaveSuccess(
                              newPickupOnly
                                ? '🏪 Modo SOMENTE RETIRADA ATIVADO no banco de dados! Delivery suspenso.'
                                : '🛵 Modo Somente Retirada desativado! Serviço de Delivery reativado com sucesso.'
                            );
                          } else {
                            saveDeliverySettings(updatedConfig);
                            setDeliverySaveSuccess(newPickupOnly ? 'Somente Retirada ativado localmente!' : 'Delivery reativado localmente!');
                          }
                        } catch (err) {
                          saveDeliverySettings(updatedConfig);
                          setDeliverySaveSuccess(newPickupOnly ? 'Somente Retirada ativado!' : 'Delivery reativado!');
                        } finally {
                          setSavingDeliverySettings(false);
                          setTimeout(() => setDeliverySaveSuccess(null), 5000);
                        }
                      }}
                      className={`font-extrabold px-3.5 py-2.5 rounded-xl border transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:opacity-50 ${
                        deliveryConfig.pickupOnly
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-600 shadow-sm'
                          : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-50'
                      }`}
                      title="Permite apenas pedidos para retirada na loja física, bloqueando a opção de entrega pelo delivery"
                    >
                      <Store className={`h-4 w-4 ${deliveryConfig.pickupOnly ? 'text-slate-950' : 'text-amber-600'}`} />
                      <span>
                        {deliveryConfig.pickupOnly
                          ? '✓ Somente Retirada (Ativo)'
                          : 'Habilitar Somente Retirada'}
                      </span>
                    </button>

                    {/* Botão para Toggle Liberar a Qualquer Momento (Ignorar Horários) */}
                    <button
                      type="button"
                      disabled={savingDeliverySettings}
                      onClick={async () => {
                        const newAlwaysOpen = !deliveryConfig.forceAlwaysOpen;
                        const updatedConfig = {
                          ...deliveryConfig,
                          forceAlwaysOpen: newAlwaysOpen,
                          isDeliveryBlocked: newAlwaysOpen ? false : deliveryConfig.isDeliveryBlocked
                        };
                        setDeliveryConfig(updatedConfig);
                        setSavingDeliverySettings(true);
                        setDeliverySaveSuccess(null);
                        try {
                          const result = await saveDeliverySettingsToDb(updatedConfig);
                          if (result.success) {
                            setDeliverySaveSuccess(
                              newAlwaysOpen
                                ? '🟢 Delivery LIBERADO A QUALQUER MOMENTO (24h) salvo no banco de dados!'
                                : 'ℹ️ Modo 24h desativado! Horário de funcionamento padrão reativado.'
                            );
                          } else {
                            saveDeliverySettings(updatedConfig);
                            setDeliverySaveSuccess(newAlwaysOpen ? 'Delivery liberado a qualquer momento (local)!' : 'Modo 24h desativado!');
                          }
                        } catch (err) {
                          saveDeliverySettings(updatedConfig);
                          setDeliverySaveSuccess(newAlwaysOpen ? 'Delivery liberado a qualquer momento!' : 'Modo 24h desativado!');
                        } finally {
                          setSavingDeliverySettings(false);
                          setTimeout(() => setDeliverySaveSuccess(null), 5000);
                        }
                      }}
                      className={`font-extrabold px-3.5 py-2.5 rounded-xl border transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:opacity-50 ${
                        deliveryConfig.forceAlwaysOpen
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      }`}
                      title="Permite que a loja receba pedidos online a qualquer hora, 24 horas por dia"
                    >
                      <Zap className={`h-4 w-4 ${deliveryConfig.forceAlwaysOpen ? 'text-amber-300 animate-bounce' : 'text-emerald-600'}`} />
                      <span>
                        {deliveryConfig.forceAlwaysOpen
                          ? '✓ Delivery Liberado 24h (Ativo)'
                          : 'Liberar Delivery a Qualquer Momento'}
                      </span>
                    </button>

                    {/* Botão de Bloquear / Desbloquear Manual */}
                    <button
                      type="button"
                      disabled={savingDeliverySettings}
                      onClick={async () => {
                        const newBlockedState = !deliveryConfig.isDeliveryBlocked;
                        const updatedConfig = {
                          ...deliveryConfig,
                          isDeliveryBlocked: newBlockedState,
                          forceAlwaysOpen: newBlockedState ? false : deliveryConfig.forceAlwaysOpen
                        };
                        setDeliveryConfig(updatedConfig);
                        setSavingDeliverySettings(true);
                        setDeliverySaveSuccess(null);
                        try {
                          const result = await saveDeliverySettingsToDb(updatedConfig);
                          if (result.success) {
                            setDeliverySaveSuccess(
                              newBlockedState
                                ? '🔴 Recebimento de pedidos (Delivery e Retirada) BLOQUEADO no banco de dados!'
                                : '🟢 Recebimento de pedidos (Delivery e Retirada) LIBERADO e DESBLOQUEADO no banco de dados!'
                            );
                          } else {
                            saveDeliverySettings(updatedConfig);
                            setDeliverySaveSuccess(newBlockedState ? 'Pedidos bloqueados localmente!' : 'Pedidos liberados localmente!');
                          }
                        } catch (err) {
                          saveDeliverySettings(updatedConfig);
                          setDeliverySaveSuccess(newBlockedState ? 'Pedidos bloqueados!' : 'Pedidos liberados!');
                        } finally {
                          setSavingDeliverySettings(false);
                          setTimeout(() => setDeliverySaveSuccess(null), 5000);
                        }
                      }}
                      className={`font-extrabold px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50 ${
                        deliveryConfig.isDeliveryBlocked
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      {savingDeliverySettings ? (
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : deliveryConfig.isDeliveryBlocked ? (
                        <Unlock className="h-4 w-4 text-white" />
                      ) : (
                        <Lock className="h-4 w-4 text-white" />
                      )}
                      <span>
                        {deliveryConfig.isDeliveryBlocked
                          ? 'Liberar Delivery Agora'
                          : 'Bloquear Delivery (Fechar Pedidos)'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Campo de Texto Personalizado para Somente Retirada */}
                <div className="bg-amber-50/80 border border-amber-300/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/70 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-amber-500 text-slate-950 p-2 rounded-xl text-base font-black shadow-2xs flex items-center justify-center shrink-0">
                        🏪
                      </span>
                      <div>
                        <label className="text-xs font-black text-amber-950 uppercase tracking-tight block">
                          Texto do Aviso "Somente Retirada" na Página Inicial
                        </label>
                        <p className="text-[11px] text-amber-900 font-medium">
                          Mensagem exibida aos clientes no topo da tela quando o modo <strong>Somente Retirada (Ativo)</strong> estiver habilitado.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const defaultMsg = 'Hoje é o dia de folga do nosso delivery! 🛵💨\nMas fique tranquilo: estamos com a loja aberta e também disponível para retirada de pedidos. 🥖';
                        setDeliveryConfig(prev => ({ ...prev, pickupOnlyMessage: defaultMsg }));
                      }}
                      className="text-[11px] font-bold text-amber-900 hover:text-amber-950 underline decoration-dotted self-start sm:self-auto cursor-pointer"
                      title="Restaurar mensagem padrão de folga do delivery"
                    >
                      Restaurar Mensagem Padrão
                    </button>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={deliveryConfig.pickupOnlyMessage ?? 'Hoje é o dia de folga do nosso delivery! 🛵💨\nMas fique tranquilo: estamos com a loja aberta e também disponível para retirada de pedidos. 🥖'}
                      onChange={(e) => setDeliveryConfig(prev => ({ ...prev, pickupOnlyMessage: e.target.value }))}
                      placeholder="Ex: Hoje é o dia de folga do nosso delivery! 🛵💨&#10;Mas fique tranquilo: estamos com a loja aberta e também disponível para retirada de pedidos. 🥖"
                      className="w-full px-4 py-3 bg-white border border-amber-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none leading-relaxed"
                    />

                    {/* Pré-visualização do Banner para o Cliente */}
                    <div className="bg-white/95 border border-amber-200 rounded-xl p-3 text-xs space-y-1.5 shadow-2xs">
                      <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1.5">
                        <span>👁️ Pré-visualização do Banner na Página Inicial:</span>
                      </span>
                      <p className="text-slate-800 font-bold whitespace-pre-line text-xs bg-amber-50/60 p-3 rounded-lg border border-amber-200/60 leading-relaxed">
                        {deliveryConfig.pickupOnlyMessage || 'Hoje é o dia de folga do nosso delivery! 🛵💨\nMas fique tranquilo: estamos com a loja aberta e também disponível para retirada de pedidos. 🥖'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Input Fields for Opening/Closing Times */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Horário de Início (Abertura do Delivery):
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="time"
                        value={deliveryConfig.deliveryOpeningTime || '15:00'}
                        onChange={(e) => setDeliveryConfig(prev => ({ ...prev, deliveryOpeningTime: e.target.value }))}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Horário de Encerramento (Fechamento):
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="time"
                        value={deliveryConfig.deliveryClosingTime || '23:00'}
                        onChange={(e) => setDeliveryConfig(prev => ({ ...prev, deliveryClosingTime: e.target.value }))}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      disabled={savingDeliverySettings}
                      onClick={async () => {
                        setSavingDeliverySettings(true);
                        setDeliverySaveSuccess(null);
                        try {
                          const result = await saveDeliverySettingsToDb(deliveryConfig);
                          if (result.success) {
                            setDeliverySaveSuccess(`Horários (${deliveryConfig.deliveryOpeningTime || '15:00'} às ${deliveryConfig.deliveryClosingTime || '23:00'}) e configurações de Somente Retirada salvos no banco de dados com sucesso!`);
                          } else {
                            saveDeliverySettings(deliveryConfig);
                            setDeliverySaveSuccess('Horários e configurações atualizados!');
                          }
                        } catch (err) {
                          saveDeliverySettings(deliveryConfig);
                          setDeliverySaveSuccess('Configurações salvas!');
                        } finally {
                          setSavingDeliverySettings(false);
                          setTimeout(() => setDeliverySaveSuccess(null), 5000);
                        }
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                    >
                      {savingDeliverySettings ? (
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span>{savingDeliverySettings ? 'Salvando...' : 'Salvar Horários e Mensagem no Banco'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WHATSAPP */}
          {settingsSubTab === 'whatsapp' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-emerald-600" />
                      <span>Atendimento via WhatsApp (Botão Flutuante e Canal Direto)</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure o número de WhatsApp, mensagem automática padrão e exiba o botão de suporte flutuante para seus clientes. Todos os dados são salvos no banco de dados.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryConfig(prev => ({
                        ...prev,
                        whatsappEnabled: prev.whatsappEnabled === undefined ? false : !prev.whatsappEnabled
                      }));
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                      deliveryConfig.whatsappEnabled !== false
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-slate-100 border-slate-300 text-slate-600'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${deliveryConfig.whatsappEnabled !== false ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    <span>{deliveryConfig.whatsappEnabled !== false ? 'Botão Flutuante: EXIBIR' : 'Botão Flutuante: OCULTO'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                      <Phone className="h-4 w-4 text-emerald-600" />
                      <span>Número do WhatsApp da Loja (com DDD)</span>
                    </label>
                    <input
                      type="text"
                      value={deliveryConfig.whatsappPhone || ''}
                      onChange={(e) => setDeliveryConfig(prev => ({ ...prev, whatsappPhone: e.target.value }))}
                      placeholder="Ex: 5511999999999 ou (11) 99999-9999"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                    />
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Digite o código do país (55) + DDD + número. Exemplo: <strong>5511999999999</strong>. Guardado de forma segura no banco de dados.
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase block">
                      Mensagem Padrão de Dúvidas (Botão Flutuante)
                    </label>
                    <textarea
                      rows={3}
                      value={deliveryConfig.whatsappMessage || ''}
                      onChange={(e) => setDeliveryConfig(prev => ({ ...prev, whatsappMessage: e.target.value }))}
                      placeholder="Ex: Olá! Gostaria de tirar uma dúvida sobre meu pedido ou cardápio."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none resize-none"
                    />
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Texto automático preenchido na conversa do cliente ao clicar no botão flutuante de atendimento.
                    </span>
                  </div>
                </div>

                {/* KDS WhatsApp Notifications Section */}
                <div className="pt-6 border-t border-slate-200/80 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4">
                    <div>
                      <h5 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                        <Flame className="h-4.5 w-4.5 text-orange-500" />
                        <span>Notificações da Cozinha (KDS) via WhatsApp</span>
                      </h5>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Ao avançar o pedido no KDS para <strong>"Em Preparação"</strong> ou <strong>"Pronto para Retirada"</strong>, abre uma janela para o operador enviar a mensagem ao cliente pelo WhatsApp.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryConfig(prev => ({
                          ...prev,
                          kdsNotifyWhatsAppEnabled: prev.kdsNotifyWhatsAppEnabled === false ? true : false
                        }));
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border shrink-0 ${
                        deliveryConfig.kdsNotifyWhatsAppEnabled !== false
                          ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                          : 'bg-slate-200 border-slate-300 text-slate-700'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${deliveryConfig.kdsNotifyWhatsAppEnabled !== false ? 'bg-white animate-pulse' : 'bg-slate-400'}`}></span>
                      <span>{deliveryConfig.kdsNotifyWhatsAppEnabled !== false ? 'Notificação KDS: HABILITADA' : 'Notificação KDS: DESABILITADA'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Mensagem Em Preparação */}
                    <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                          <span>1. Em Preparação</span>
                        </label>
                        <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">KDS ➔ Preparo</span>
                      </div>
                      <textarea
                        rows={3}
                        value={deliveryConfig.kdsMessagePreparing !== undefined ? deliveryConfig.kdsMessagePreparing : 'Segue pedido esta sendo preparado.'}
                        onChange={(e) => setDeliveryConfig(prev => ({ ...prev, kdsMessagePreparing: e.target.value }))}
                        placeholder="Ex: Segue pedido esta sendo preparado."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none resize-none"
                      />
                      <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] space-y-1">
                        <span className="font-extrabold text-slate-500 text-[10px] uppercase block tracking-wider">Prévia no WhatsApp:</span>
                        <p className="font-bold text-slate-800 font-mono">Pedido BG-30724246</p>
                        <p className="text-slate-600 font-medium">
                          {deliveryConfig.kdsMessagePreparing || 'Segue pedido esta sendo preparado.'}
                        </p>
                      </div>
                    </div>

                    {/* Mensagem Pronto para Retirada */}
                    <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                          <span>2. Pronto para Retirada</span>
                        </label>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">🏪 Retirada</span>
                      </div>
                      <textarea
                        rows={3}
                        value={deliveryConfig.kdsMessageReady !== undefined ? deliveryConfig.kdsMessageReady : 'Seu pedido está pronto para retirada!'}
                        onChange={(e) => setDeliveryConfig(prev => ({ ...prev, kdsMessageReady: e.target.value }))}
                        placeholder="Ex: Seu pedido está pronto para retirada!"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none resize-none"
                      />
                      <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] space-y-1">
                        <span className="font-extrabold text-slate-500 text-[10px] uppercase block tracking-wider">Prévia no WhatsApp:</span>
                        <p className="font-bold text-slate-800 font-mono">Pedido BG-30724246</p>
                        <p className="text-slate-600 font-medium">
                          {deliveryConfig.kdsMessageReady || 'Seu pedido está pronto para retirada!'}
                        </p>
                      </div>
                    </div>

                    {/* Mensagem Saiu para Entrega (Delivery) */}
                    <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                          <span>3. Saiu para Entrega</span>
                        </label>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">🛵 Delivery</span>
                      </div>
                      <textarea
                        rows={3}
                        value={deliveryConfig.kdsMessageDelivery !== undefined ? deliveryConfig.kdsMessageDelivery : 'Seu pedido saiu para entrega e está a caminho!'}
                        onChange={(e) => setDeliveryConfig(prev => ({ ...prev, kdsMessageDelivery: e.target.value }))}
                        placeholder="Ex: Seu pedido saiu para entrega e está a caminho!"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none resize-none"
                      />
                      <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] space-y-1">
                        <span className="font-extrabold text-slate-500 text-[10px] uppercase block tracking-wider">Prévia no WhatsApp:</span>
                        <p className="font-bold text-slate-800 font-mono">Pedido BG-30724246</p>
                        <p className="text-slate-600 font-medium">
                          {deliveryConfig.kdsMessageDelivery || 'Seu pedido saiu para entrega e está a caminho!'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-xs text-slate-500 font-medium">
                    Todas as mensagens e configurações são gravadas no Banco de Dados MySQL.
                  </span>
                  <button
                    type="button"
                    disabled={savingDeliverySettings}
                    onClick={async () => {
                      setSavingDeliverySettings(true);
                      setDeliverySaveSuccess(null);
                      try {
                        const result = await saveDeliverySettingsToDb(deliveryConfig);
                        if (result.success) {
                          setDeliverySaveSuccess('✅ Mensagens do KDS e configurações de WhatsApp salvas com sucesso no Banco de Dados!');
                        } else {
                          saveDeliverySettings(deliveryConfig);
                          setDeliverySaveSuccess('Configurações de WhatsApp salvas!');
                        }
                      } catch (err) {
                        saveDeliverySettings(deliveryConfig);
                        setDeliverySaveSuccess('Configurações de WhatsApp salvas!');
                      } finally {
                        setSavingDeliverySettings(false);
                        setTimeout(() => setDeliverySaveSuccess(null), 5000);
                      }
                    }}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-3 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {savingDeliverySettings ? (
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <CheckCircle className="h-4.5 w-4.5" />
                    )}
                    <span>{savingDeliverySettings ? 'Salvando no Banco...' : 'Salvar Alterações no Banco de Dados'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CUPOM DE DESCONTO */}
          {settingsSubTab === 'coupons' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Feedback Alert */}
              {couponFeedback && (
                <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between ${
                  couponFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {couponFeedback.type === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                    )}
                    <span>{couponFeedback.message}</span>
                  </div>
                  <button onClick={() => setCouponFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Coupon Generator Form Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-purple-100 text-purple-800 rounded-xl">
                      <Tag className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                        <span>Gerador e Cadastro de Cupom de Desconto</span>
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-200">
                          Salvo no Banco de Dados
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Defina o valor do desconto e gere um cupom promocional exclusivo para seus clientes.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCreateCoupon} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Descrição / Nome do Cupom */}
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-700 uppercase block">
                        Nome / Descrição do Cupom
                      </label>
                      <input
                        type="text"
                        value={couponDescInput}
                        onChange={(e) => setCouponDescInput(e.target.value)}
                        placeholder="Ex: Cupom do Cliente VIP"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                      />
                    </div>

                    {/* Código do Cupom */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-700 uppercase block">
                          Código do Cupom *
                        </label>
                        <button
                          type="button"
                          onClick={handleGenerateRandomCode}
                          className="text-[10px] text-purple-700 hover:text-purple-900 font-extrabold flex items-center gap-1 cursor-pointer"
                        >
                          <span>🎲 Gerar Código</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={couponCodeInput}
                        onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                        placeholder="Ex: BAGO10 ou FESTA20"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black tracking-wider text-purple-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none uppercase"
                        required
                      />
                    </div>

                    {/* Tipo de Desconto */}
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-700 uppercase block">
                        Tipo de Desconto
                      </label>
                      <select
                        value={couponTypeInput}
                        onChange={(e) => setCouponTypeInput(e.target.value as 'fixed' | 'percentage')}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                      >
                        <option value="fixed">R$ Valor Fixo (Reais)</option>
                        <option value="percentage">% Porcentagem (Porcento)</option>
                      </select>
                    </div>

                    {/* Valor do Desconto */}
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-700 uppercase block">
                        Valor do Desconto *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                          {couponTypeInput === 'fixed' ? 'R$' : '%'}
                        </span>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={couponValueInput}
                          onChange={(e) => setCouponValueInput(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder={couponTypeInput === 'fixed' ? '10' : '15'}
                          className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end pt-1">
                    {/* Pedido Mínimo */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase block">
                        Pedido Mínimo (R$) (Opcional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={couponMinOrderInput}
                          onChange={(e) => setCouponMinOrderInput(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="0 = Sem pedido mínimo"
                          className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                        />
                      </div>
                    </div>

                    {/* Limite de Usos */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase block">
                        Limite Máximo de Usos (Opcional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={couponMaxUsesInput}
                        onChange={(e) => setCouponMaxUsesInput(e.target.value === '' ? '' : parseInt(e.target.value))}
                        placeholder="Ilimitado"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                      />
                    </div>

                    {/* Botão Cadastrar */}
                    <div>
                      <button
                        type="submit"
                        disabled={savingCoupon}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                      >
                        {savingCoupon ? (
                          <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        <span>{savingCoupon ? 'Salvando...' : 'Gerar & Salvar Cupom no Banco'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Coupons Table List */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-purple-600" />
                      <span>Cupons de Desconto Cadastrados</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Lista de cupons salvos no banco de dados. Você pode copiar o código do cupom ou ativar/desativar.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Filter Buttons */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setCouponStatusFilter('active')}
                        className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                          couponStatusFilter === 'active'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        Ativos ({coupons.filter(c => Boolean(c.active)).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCouponStatusFilter('inactive')}
                        className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                          couponStatusFilter === 'inactive'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        Inativos ({coupons.filter(c => !c.active).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCouponStatusFilter('all')}
                        className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                          couponStatusFilter === 'all'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        Todos ({coupons.length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={fetchCoupons}
                      disabled={loadingCoupons}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingCoupons ? 'animate-spin text-purple-600' : ''}`} />
                      <span>Atualizar</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                        <th className="p-3">Código do Cupom</th>
                        <th className="p-3">Descrição</th>
                        <th className="p-3">Desconto / Vantagem</th>
                        <th className="p-3">Pedido Mínimo</th>
                        <th className="p-3">Utilizações</th>
                        <th className="p-3">Criado Por</th>
                        <th className="p-3">Data / Hora</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {loadingCoupons ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                            <span className="inline-block h-5 w-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mr-2 align-middle"></span>
                            Carregando cupons salvos no banco de dados...
                          </td>
                        </tr>
                      ) : coupons.filter(c => {
                        if (couponStatusFilter === 'active') return Boolean(c.active);
                        if (couponStatusFilter === 'inactive') return !c.active;
                        return true;
                      }).length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                            {couponStatusFilter === 'active'
                              ? 'Nenhum cupom ativo no momento.'
                              : couponStatusFilter === 'inactive'
                              ? 'Nenhum cupom inativo no momento.'
                              : 'Nenhum cupom de desconto cadastrado no momento.'}
                          </td>
                        </tr>
                      ) : (
                        coupons
                          .filter(c => {
                            if (couponStatusFilter === 'active') return Boolean(c.active);
                            if (couponStatusFilter === 'inactive') return !c.active;
                            return true;
                          })
                          .map((cpn) => (
                          <tr key={cpn.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-black text-purple-900">
                              <span className="bg-purple-100 border border-purple-200 text-purple-900 px-2.5 py-1 rounded-lg text-xs tracking-wider inline-block">
                                🎟️ {cpn.code}
                              </span>
                            </td>
                            <td className="p-3 text-slate-700 font-semibold">
                              {cpn.description || <span className="text-slate-400 italic">Sem descrição</span>}
                            </td>
                            <td className="p-3 font-black text-emerald-700">
                              {cpn.type === 'percentage' ? (
                                <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                                  {cpn.value}% OFF
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                                  R$ {cpn.value.toFixed(2).replace('.', ',')} OFF
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-600 font-semibold">
                              {cpn.minOrderValue && cpn.minOrderValue > 0 ? (
                                `R$ ${cpn.minOrderValue.toFixed(2).replace('.', ',')}`
                              ) : (
                                <span className="text-slate-400">Sem Mínimo</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-700 font-bold">
                              {cpn.usedCount || 0}
                              {cpn.maxUses ? ` / ${cpn.maxUses}` : ' usos'}
                            </td>
                            <td className="p-3 text-slate-700 font-semibold">
                              <span className="bg-purple-50 text-purple-900 px-2.5 py-1 rounded-lg border border-purple-200/60 text-[11px] font-bold inline-flex items-center gap-1">
                                👤 {cpn.createdBy || 'Administrador'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 whitespace-nowrap text-[11px]">
                              {cpn.createdAt ? (
                                <span className="bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded border border-slate-200">
                                  {formatDateTimeBrasilia(cpn.createdAt)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => handleToggleCouponActive(cpn)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase cursor-pointer border transition-all ${
                                  cpn.active
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                                    : 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200'
                                }`}
                              >
                                {cpn.active ? '🟢 Ativo' : '🔴 Inativo'}
                              </button>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Copiar Código */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(cpn.code);
                                    setCopiedCouponId(cpn.id);
                                    setTimeout(() => setCopiedCouponId(null), 2000);
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-purple-700 bg-slate-50 hover:bg-purple-50 rounded-lg transition-all cursor-pointer border border-slate-200 flex items-center gap-1"
                                  title="Copiar código do cupom"
                                >
                                  {copiedCouponId === cpn.id ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                      <span className="text-emerald-700">Copiado!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5" />
                                      <span>Copiar Código</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: MAQUININHA DE CARTÃO */}
          {settingsSubTab === 'card-machines' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Add / Edit Machine Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                        <span>{editingMachineId ? 'Editar Maquininha de Cartão' : 'Cadastrar Nova Maquininha de Cartão'}</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                          Salvo no Banco de Dados
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Cadastre as operadoras e modelos das maquininhas utilizadas na loja. Elas aparecerão automaticamente no Caixa / Atendimento Balcão.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={fetchCardMachines}
                    disabled={loadingCardMachines}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingCardMachines ? 'animate-spin text-emerald-600' : ''}`} />
                    <span>Atualizar</span>
                  </button>
                </div>

                {/* Feedback message */}
                {cardMachineFeedback && (
                  <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border ${
                    cardMachineFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      {cardMachineFeedback.type === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      )}
                      <span>{cardMachineFeedback.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCardMachineFeedback(null)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSaveCardMachine} className="space-y-4">
                  <div>
                    <div className="space-y-1">
                      <label className="text-xs font-extrabold text-slate-700 uppercase block">
                        Maquininha / Operadora <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={cardMachineNameInput}
                        onChange={(e) => setCardMachineNameInput(e.target.value)}
                        placeholder="Ex: Stone, Santander, Cielo, PagBank, Rede, Ton..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                      />
                      <p className="text-[10px] text-slate-500">
                        Nome da maquininha ou operadora que aparecerá no botão de seleção no balcão.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={savingCardMachine}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                    >
                      {savingCardMachine ? (
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      <span>{savingCardMachine ? 'Salvando no Banco...' : editingMachineId ? 'Salvar Alterações da Maquininha' : 'Cadastrar Maquininha no Banco de Dados'}</span>
                    </button>

                    {editingMachineId && (
                      <button
                        type="button"
                        onClick={handleCancelEditMachine}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-all text-xs cursor-pointer"
                      >
                        Cancelar Edição
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Informative Box */}
              <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0 mt-0.5">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h5 className="font-extrabold text-emerald-950 text-xs uppercase tracking-wide">
                    Integração Automática com o Caixa / Atendimento Balcão
                  </h5>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Todas as maquininhas ativas nesta lista estarão instantaneamente disponíveis para os operadores no PDV ("Atendimento Balcão"). Quando o atendente selecionar pagamento em Débito, Crédito ou VR/Alimentação, os botões das maquininhas cadastradas aqui serão exibidos para seleção com um clique.
                  </p>
                </div>
              </div>

              {/* List of Card Machines */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                      <span>Maquininhas Cadastradas ({cardMachines.length})</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Gerencie as maquininhas salvas no banco de dados. Ative ou desative conforme a disponibilidade na loja.
                    </p>
                  </div>

                  <div className="w-full sm:w-64">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={cardMachineSearch}
                        onChange={(e) => setCardMachineSearch(e.target.value)}
                        placeholder="Buscar por maquininha..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold text-slate-600 uppercase">
                        <th className="p-3 rounded-l-xl">Maquininha / Operadora</th>
                        <th className="p-3 text-center">Status no Balcão</th>
                        <th className="p-3 text-center rounded-r-xl">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {cardMachines.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-400 font-bold">
                            Nenhuma maquininha cadastrada no momento. Use o formulário acima para cadastrar.
                          </td>
                        </tr>
                      ) : cardMachines
                          .filter(m => {
                            if (!cardMachineSearch.trim()) return true;
                            const q = cardMachineSearch.toLowerCase();
                            return m.name.toLowerCase().includes(q);
                          })
                          .map((machine) => (
                            <tr key={machine.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3 font-extrabold text-slate-800 flex items-center gap-2">
                                <div className={`h-2.5 w-2.5 rounded-full ${machine.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                <span>{machine.name}</span>
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCardMachineActive(machine)}
                                  className={`px-3 py-1 text-xs font-black rounded-lg border transition-all cursor-pointer ${
                                    machine.active
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                      : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                  }`}
                                  title="Clique para ativar/desativar exibição no balcão"
                                >
                                  {machine.active ? '🟢 Ativa (Exibindo)' : '🔴 Inativa (Oculta)'}
                                </button>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditCardMachine(machine)}
                                    className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-all cursor-pointer"
                                    title="Editar maquininha"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMachineToDelete(machine)}
                                    className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 transition-all cursor-pointer"
                                    title="Excluir maquininha do banco"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal de Confirmação de Exclusão da Maquininha */}
              {machineToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
                        <Trash2 className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base">
                          Excluir Maquininha de Cartão?
                        </h4>
                        <p className="text-xs text-slate-500">
                          Esta ação removerá a maquininha do banco de dados.
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-600">Maquininha / Operadora:</span>
                        <span className="font-extrabold text-slate-900">{machineToDelete.name}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600">
                      Tem certeza que deseja excluir <strong>"{machineToDelete.name}"</strong>? Ela não estará mais disponível para seleção no caixa/balcão.
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setMachineToDelete(null)}
                        disabled={deletingMachineId !== null}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => executeDeleteCardMachine(machineToDelete.id, machineToDelete.name)}
                        disabled={deletingMachineId !== null}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-98 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {deletingMachineId === machineToDelete.id ? (
                          <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span>{deletingMachineId === machineToDelete.id ? 'Excluindo...' : 'Sim, Excluir'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {settingsSubTab === 'info' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                      <Info className="h-5 w-5 text-indigo-600" />
                      <span>Informações da Empresa e Loja</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Configure as informações exibidas na barra do topo da página inicial e na janela modal "Mais Informações".
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchStoreInfo}
                    disabled={loadingStoreInfo}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingStoreInfo ? 'animate-spin text-indigo-600' : ''}`} />
                    <span>Atualizar</span>
                  </button>
                </div>

                {storeInfoFeedback && (
                  <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                    storeInfoFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {storeInfoFeedback.type === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <span>{storeInfoFeedback.message}</span>
                  </div>
                )}

                {/* System Version & Last Update Info Banner */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-extrabold text-slate-700">Versão do Sistema:</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-mono font-black rounded-md border border-emerald-200">
                      {APP_VERSION_LABEL}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    <span className="font-semibold text-slate-600">Data da Última Atualização:</span>
                    <span className="font-extrabold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {APP_LAST_UPDATE} ({APP_LAST_UPDATE_TIME})
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSaveStoreInfo} className="space-y-6">
                  {/* Toggle Show on Home Page */}
                  <div className="bg-indigo-50/60 border border-indigo-200/80 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <label htmlFor="showOnHomePageToggle" className="text-xs font-extrabold text-indigo-950 flex items-center gap-2 cursor-pointer">
                        <Eye className="h-4 w-4 text-indigo-600" />
                        <span>Exibir barra de informações na Página Inicial</span>
                      </label>
                      <p className="text-[11px] text-indigo-700/80">
                        Quando ativado, exibe a barra acima de "EXPRESSO PEÇA SEM PASSOS!" com Cidade, Mais Informações e Horário de Abertura.
                      </p>
                    </div>
                    <input
                      id="showOnHomePageToggle"
                      type="checkbox"
                      checked={storeInfo.showOnHomePage}
                      onChange={(e) => setStoreInfo(prev => ({ ...prev, showOnHomePage: e.target.checked }))}
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Top Bar Basic Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-amber-500" />
                        <span>CIDADE (Exibida na barra da Home)</span>
                      </label>
                      <input
                        type="text"
                        value={storeInfo.city}
                        onChange={(e) => setStoreInfo(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="Ex: sao miguel - rn"
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-emerald-600" />
                        <span>HORÁRIO DE ABERTURA / STATUS (Exibido na Home)</span>
                      </label>
                      <input
                        type="text"
                        value={storeInfo.openingTime}
                        onChange={(e) => setStoreInfo(prev => ({ ...prev, openingTime: e.target.value }))}
                        placeholder="Ex: Fechado • Abrimos às 12h00"
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Modal Content Sections */}
                  <div className="border-t border-slate-100 pt-5 space-y-5">
                    <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs uppercase tracking-wider">
                      <Info className="h-4 w-4 text-purple-600" />
                      <span>Conteúdo da Janela Modal ("Mais Informações")</span>
                    </div>

                    {/* Section: SOBRE */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <Store className="h-4 w-4 text-indigo-600" />
                        <span>1. SOBRE (Telefone, Instagram e Endereço)</span>
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Telefone da Empresa</span>
                          </label>
                          <input
                            type="text"
                            value={storeInfo.phone}
                            onChange={(e) => setStoreInfo(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="Ex: (84) 99999-9999"
                            className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-semibold text-slate-800 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                            <Instagram className="h-3.5 w-3.5 text-pink-600" />
                            <span>Link ou Usuário do Instagram</span>
                          </label>
                          <input
                            type="text"
                            value={storeInfo.instagram}
                            onChange={(e) => setStoreInfo(prev => ({ ...prev, instagram: e.target.value }))}
                            placeholder="Ex: https://instagram.com/pizzariabago ou @pizzariabago"
                            className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-semibold text-slate-800 bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-rose-600" />
                          <span>Endereço da Empresa</span>
                        </label>
                        <textarea
                          rows={2}
                          value={storeInfo.address}
                          onChange={(e) => setStoreInfo(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="Ex: Rua Principal, 123 - Centro, São Miguel - RN"
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-semibold text-slate-800 bg-white"
                        />
                      </div>

                      {/* Coordenadas GPS (Latitude & Longitude) */}
                      <div className="border-t border-slate-200/60 pt-3.5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Localização GPS (Latitude e Longitude para o Google Maps)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if ('geolocation' in navigator) {
                                navigator.geolocation.getCurrentPosition(
                                  (pos) => {
                                    setStoreInfo(prev => ({
                                      ...prev,
                                      latitude: pos.coords.latitude.toFixed(6),
                                      longitude: pos.coords.longitude.toFixed(6)
                                    }));
                                  },
                                  (err) => {
                                    alert('Não foi possível obter a localização atual: ' + err.message);
                                  }
                                );
                              } else {
                                alert('Navegador não suporta geolocalização.');
                              }
                            }}
                            className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-100/70 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 w-fit cursor-pointer"
                          >
                            <MapPin className="h-3 w-3 text-indigo-600" />
                            <span>Capturar Minha Localização Atual</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="block text-[11px] font-bold text-slate-600 mb-1">Latitude</span>
                            <input
                              type="text"
                              value={storeInfo.latitude || ''}
                              onChange={(e) => setStoreInfo(prev => ({ ...prev, latitude: e.target.value }))}
                              placeholder="Ex: -6.211422"
                              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-slate-800 bg-white"
                            />
                          </div>
                          <div>
                            <span className="block text-[11px] font-bold text-slate-600 mb-1">Longitude</span>
                            <input
                              type="text"
                              value={storeInfo.longitude || ''}
                              onChange={(e) => setStoreInfo(prev => ({ ...prev, longitude: e.target.value }))}
                              placeholder="Ex: -38.498321"
                              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-slate-800 bg-white"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Ao preencher Latitude e Longitude, o link do Google Maps na página principal abrirá a localização exata da sua empresa.
                        </p>
                      </div>
                    </div>

                    {/* Section: HORARIOS */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span>2. HORÁRIOS (De Segunda a Sexta e Fim de Semana)</span>
                      </h5>
                      <textarea
                        rows={3}
                        value={storeInfo.openingHours}
                        onChange={(e) => setStoreInfo(prev => ({ ...prev, openingHours: e.target.value }))}
                        placeholder="Ex: Segunda a Sexta: 18:00 às 23:00&#10;Sábado e Domingo: 18:00 às 00:00"
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-semibold text-slate-800 bg-white"
                      />
                    </div>

                    {/* Section: PAGAMENTO */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4 text-emerald-600" />
                        <span>3. PAGAMENTO (Formas de pagamento aceitas)</span>
                      </h5>
                      <textarea
                        rows={2}
                        value={storeInfo.paymentMethods}
                        onChange={(e) => setStoreInfo(prev => ({ ...prev, paymentMethods: e.target.value }))}
                        placeholder="Ex: Pix, Cartão de Crédito, Cartão de Débito, Dinheiro, Vale Refeição"
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-semibold text-slate-800 bg-white"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingStoreInfo}
                      className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingStoreInfo ? (
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      <span>Salvar Informações no Banco de Dados</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 8: SISTEMA & VERSÃO */}
          {settingsSubTab === 'system' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Main Version Hero Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-teal-50 text-teal-700 rounded-2xl border border-teal-100 shrink-0">
                      <Cpu className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-900 text-lg">Bagô Food & Delivery</h4>
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-black rounded-lg border border-emerald-200">
                          {APP_VERSION_LABEL}
                        </span>
                        <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[11px] font-bold rounded-md border border-teal-200">
                          Estável
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Plataforma completa de Ponto de Venda (PDV), Atendimento Balcão, Cozinha KDS e Delivery.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shrink-0 active:scale-95"
                    title="Recarrega a aplicação para aplicar eventuais atualizações pendentes"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                    <span>Recarregar Sistema</span>
                  </button>
                </div>

                {/* Key Version & Update Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Versão Atual
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-black text-slate-900">{APP_VERSION_LABEL}</span>
                      <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Ativa
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">Release: {APP_RELEASE_NAME}</span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Última Atualização
                    </span>
                    <div className="flex items-center gap-1.5 text-slate-900">
                      <Calendar className="h-4 w-4 text-indigo-600" />
                      <span className="font-extrabold text-base">{APP_LAST_UPDATE}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">Horário: {APP_LAST_UPDATE_TIME}</span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Status dos Serviços
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">Operacional</span>
                    </div>
                    <span className="text-[11px] text-emerald-700 font-medium mt-1 block">Tempo real ativo (SSE)</span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Banco de Dados & Servidor
                    </span>
                    <div className="flex items-center gap-1.5 text-slate-900">
                      <Server className="h-4 w-4 text-emerald-600" />
                      <span className="font-extrabold text-sm">MySQL Relacional</span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">Porta 3000 (Produção)</span>
                  </div>
                </div>
              </div>

              {/* Release Highlights / Changelog Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>Destaques e Melhorias da Versão ({APP_VERSION_LABEL})</span>
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">Publicado em {APP_LAST_UPDATE}</span>
                </div>

                <div className="space-y-2.5">
                  {APP_CHANGELOG_HIGHLIGHTS.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <CheckCircle className="h-4 w-4 text-brand-green shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical System Overview */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Server className="h-4 w-4 text-indigo-600" />
                  <span>Informações Técnicas de Ambiente e Implantação</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Ambiente de Execução</span>
                    <span className="font-extrabold text-slate-800 text-xs mt-0.5 block">Docker / Easypanel / Cloud</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Porta Primária de Ingress</span>
                    <span className="font-extrabold text-slate-800 text-xs mt-0.5 block">Porta 3000 (HTTP / SSE)</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Persistência</span>
                    <span className="font-extrabold text-slate-800 text-xs mt-0.5 block">MySQL Transacional (InnoDB)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {settingsSubTab === 'users' && (
            <>
              {/* Role Explanations Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
              <div className="bg-amber-500 text-white p-2.5 rounded-xl shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wider">Administrador (admin)</h4>
                <p className="text-xs text-amber-700/90 mt-1 leading-relaxed">
                  Acesso total ao sistema: relatórios financeiros, controle de estoque, criação de cardápio e gestão de usuários.
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3">
              <div className="bg-blue-600 text-white p-2.5 rounded-xl shrink-0">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wider">Atendente / Balcão (balcao)</h4>
                <p className="text-xs text-blue-700/90 mt-1 leading-relaxed">
                  Acesso ao Terminal PDV/Caixa, abertura e fechamento de caixa, registro de vendas presenciais e retirada de pedidos.
                </p>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200/80 rounded-2xl p-4 flex items-start gap-3">
              <div className="bg-orange-500 text-white p-2.5 rounded-xl shrink-0">
                <CookingPot className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-orange-900 text-xs uppercase tracking-wider">Equipe de Cozinha (cozinha)</h4>
                <p className="text-xs text-orange-700/90 mt-1 leading-relaxed">
                  Acesso ao Painel KDS de Pedidos para acompanhamento em tempo real e atualização de status (Preparo, Finalizado).
                </p>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar usuário por nome ou login..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none font-medium"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium self-end sm:self-center flex items-center gap-3 flex-wrap">
              <span>Total: <strong>{usersList.length}</strong> usuários cadastrados</span>
              <button
                type="button"
                onClick={() => {
                  setEditingUser({ name: '', username: '', role: 'balcao', password: '' });
                  setUserError(null);
                  setUserSuccess(null);
                  setIsEditingUser(true);
                }}
                className="bg-brand-green hover:bg-emerald-700 text-white font-black px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
                id="add-new-user-btn"
              >
                <UserPlus className="h-4 w-4" />
                <span>Adicionar Usuário</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStoreLogoInput(localStorage.getItem('bago_store_logo') || '');
                  setIsLogoModalOpen(true);
                }}
                className="bg-brand-yellow hover:bg-yellow-400 text-brand-green font-black px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
                id="add-store-logo-btn"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Adicionar Logo</span>
              </button>
            </div>
          </div>

          {/* Users List Display */}
          {loadingUsers ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="inline-block h-8 w-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400 mt-2 font-medium">Carregando usuários do sistema...</p>
            </div>
          ) : usersViewMode === 'table' ? (
            /* Table View (Style matching Inventory Control) */
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[11px] tracking-wider">
                    <th className="p-3 w-12 text-center">Avatar</th>
                    <th className="p-3 min-w-[160px]">Nome Completo</th>
                    <th className="p-3 min-w-[140px]">Usuário (Login)</th>
                    <th className="p-3 min-w-[150px]">Perfil / Nível</th>
                    <th className="p-3 min-w-[220px]">Permissão & Escopo</th>
                    <th className="p-3 w-28 text-center">Status</th>
                    <th className="p-3 min-w-[130px] text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {usersList
                    .filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.username.toLowerCase().includes(userSearch.toLowerCase()))
                    .length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                          Nenhum usuário encontrado para "{userSearch}".
                        </td>
                      </tr>
                    ) : (
                      usersList
                        .filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.username.toLowerCase().includes(userSearch.toLowerCase()))
                        .map((u) => {
                          const isAdmin = u.role === 'admin';
                          const isCozinha = u.role === 'cozinha';

                          return (
                            <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Avatar */}
                              <td className="p-2 text-center align-middle">
                                <div className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center font-black text-xs uppercase shadow-2xs ${
                                  isAdmin 
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                    : isCozinha 
                                      ? 'bg-orange-100 text-orange-800 border border-orange-200' 
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}>
                                  {u.name.charAt(0)}
                                </div>
                              </td>

                              {/* Nome Completo */}
                              <td className="p-3 align-middle font-extrabold text-slate-800 text-xs">
                                {u.name}
                              </td>

                              {/* Login (@username) */}
                              <td className="p-3 align-middle">
                                <span className="font-mono text-xs text-slate-700 font-bold bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 inline-block">
                                  @{u.username}
                                </span>
                              </td>

                              {/* Perfil Badge */}
                              <td className="p-3 align-middle">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                  isAdmin 
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                    : isCozinha 
                                      ? 'bg-orange-100 text-orange-800 border border-orange-300' 
                                      : 'bg-blue-100 text-blue-800 border border-blue-300'
                                }`}>
                                  {isAdmin ? <Shield className="h-3 w-3" /> : isCozinha ? <CookingPot className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                                  <span>{isAdmin ? 'Administrador' : isCozinha ? 'Cozinha' : 'Atendente'}</span>
                                </span>
                              </td>

                              {/* Permissões / Escopo */}
                              <td className="p-3 align-middle text-xs font-medium">
                                {isAdmin ? (
                                  <span className="text-amber-900 font-bold">Acesso Total (Relatórios, Cardápio, Estoque, Usuários)</span>
                                ) : isCozinha ? (
                                  <span className="text-orange-900 font-bold">Painel KDS Cozinha (Acompanhamento e Status)</span>
                                ) : (
                                  <span className="text-blue-900 font-bold">Terminal PDV / Caixa (Vendas, Abertura/Fechamento)</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="p-3 align-middle text-center">
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Ativo
                                </span>
                              </td>

                              {/* Ações */}
                              <td className="p-3 align-middle text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingUser({
                                        id: u.id,
                                        name: u.name,
                                        username: u.username,
                                        role: u.role,
                                        password: ''
                                      });
                                      setUserError(null);
                                      setUserSuccess(null);
                                      setIsEditingUser(true);
                                    }}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                                    title="Editar Usuário"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                    <span>Editar</span>
                                  </button>
                                  {u.id !== 'usr-admin' && u.username !== 'admin' && (
                                    <button
                                      onClick={() => setDeletingUser(u)}
                                      className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                                      title="Remover Usuário"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span>Remover</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {usersList
                .filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.username.toLowerCase().includes(userSearch.toLowerCase()))
                .map((u) => {
                  const isAdmin = u.role === 'admin';
                  const isCozinha = u.role === 'cozinha';

                  return (
                    <div 
                      key={u.id}
                      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm uppercase shadow-xs shrink-0 ${
                            isAdmin 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : isCozinha 
                                ? 'bg-orange-100 text-orange-800 border border-orange-200' 
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm">{u.name}</h4>
                            <p className="text-slate-400 text-xs font-mono">@{u.username}</p>
                          </div>
                        </div>

                        {/* Role Badge */}
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${
                          isAdmin 
                            ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                            : isCozinha 
                              ? 'bg-orange-100 text-orange-800 border border-orange-300' 
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}>
                          {isAdmin ? 'Administrador' : isCozinha ? 'Cozinha' : 'Atendente'}
                        </span>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Perfil: <strong>{isAdmin ? 'Acesso Total' : isCozinha ? 'Painel KDS Cozinha' : 'Terminal PDV / Caixa'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Autenticação: <strong>Ativa</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setEditingUser({
                              id: u.id,
                              name: u.name,
                              username: u.username,
                              role: u.role,
                              password: ''
                            });
                            setUserError(null);
                            setUserSuccess(null);
                            setIsEditingUser(true);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </button>
                        {u.id !== 'usr-admin' && u.username !== 'admin' && (
                          <button
                            onClick={() => setDeletingUser(u)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remover</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* User Create / Edit Modal */}
          {isEditingUser && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-brand-green">
                    <UserPlus className="h-5 w-5" />
                    <h3 className="font-extrabold text-slate-800 text-base">
                      {editingUser.id ? 'Editar Usuário e Permissões' : 'Cadastrar Novo Usuário'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsEditingUser(false)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {userError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                    {userError}
                  </div>
                )}

                {userSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-medium">
                    {userSuccess}
                  </div>
                )}

                <form onSubmit={handleSaveUserSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos Silva"
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nome de Usuário (Login) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: carlossilva"
                      value={editingUser.username}
                      onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Senha {editingUser.id ? '(Deixe em branco para manter a atual)' : '*'}
                    </label>
                    <input
                      type="password"
                      placeholder={editingUser.id ? '••••••••' : 'Sua senha de acesso'}
                      value={editingUser.password || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                      required={!editingUser.id}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Perfil / Nível de Permissão *
                    </label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none font-bold text-slate-700"
                    >
                      <option value="balcao">🛒 Atendente / Balcão (Acesso ao PDV)</option>
                      <option value="cozinha">🍳 Cozinha (Acesso ao KDS Pedidos)</option>
                      <option value="admin">🛡️ Administrador (Acesso Total ao Gerenciador)</option>
                    </select>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingUser(false)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                    >
                      {editingUser.id ? 'Salvar Alterações' : 'Criar Usuário'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Confirm Delete User Modal */}
          {deletingUser && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
                <div className="flex items-center gap-3 text-red-600">
                  <div className="bg-red-100 p-2.5 rounded-xl">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-base">Remover Usuário</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tem certeza que deseja remover o usuário <strong>"{deletingUser.name}"</strong> (@{deletingUser.username})? Esse operador perderá o acesso ao sistema.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setDeletingUser(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteUserConfirm}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Sim, Remover
                  </button>
                </div>
              </div>
            </div>
          )}
          </>
          )}
          </div>
          )}
        </div>
      )}

      {/* Deliveries & Detailed Items Database Table Panel */}
      {activeTab === 'deliveries' && (
        <div className="space-y-6" id="deliveries-database-panel">
          {/* Header Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-green/10 text-brand-green rounded-2xl border border-brand-green/20">
                <Truck className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-slate-800 text-lg sm:text-xl">
                    Tabela de Entregas & Pedidos Detalhados
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200">
                    MySQL: entregas_detalhadas
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualização consolidada de cada item entregue: código do pedido, cliente, telefone, comanda, produtos e ingredientes.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={fetchDeliveriesTable}
                disabled={loadingDeliveries}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Atualizar dados do banco"
              >
                <RefreshCw className={`h-4 w-4 ${loadingDeliveries ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (deliveriesList.length === 0) return;
                  const headers = ['codigo_pedido', 'telefone', 'cliente', 'comanda', 'produto', 'quantidade', 'preco_unitario', 'subtotal', 'detalhes_ingredientes', 'tipo_entrega', 'status_pedido', 'data_hora'];
                  const rows = deliveriesList.map(r => [
                    `"${r.codigo_pedido}"`,
                    `"${r.telefone || ''}"`,
                    `"${r.cliente.replace(/"/g, '""')}"`,
                    `"${r.comanda || ''}"`,
                    `"${r.produto.replace(/"/g, '""')}"`,
                    r.quantidade,
                    r.preco_unitario.toFixed(2),
                    r.subtotal.toFixed(2),
                    `"${(r.detalhes_ingredientes || '').replace(/"/g, '""')}"`,
                    `"${r.tipo_entrega || ''}"`,
                    `"${r.status_pedido || ''}"`,
                    `"${r.data_hora ? formatDateTimeBrasilia(r.data_hora) : ''}"`
                  ]);
                  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement('a');
                  link.setAttribute('href', encodedUri);
                  link.setAttribute('download', `entregas_detalhadas_${new Date().toISOString().slice(0, 10)}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                disabled={deliveriesList.length === 0}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="h-4 w-4 text-slate-600" />
                <span>Exportar CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (deliveriesList.length === 0) return;
                  try {
                    const doc = new jsPDF('landscape');
                    doc.setFontSize(14);
                    doc.text('Relatório de Entregas & Pedidos Detalhados - BAGÔ', 14, 15);
                    doc.setFontSize(9);
                    doc.text(`Gerado em: ${formatDateTimeBrasilia(new Date())} | Total de Linhas: ${deliveriesList.length}`, 14, 22);

                    const tableHead = [['Data/Hora', 'Cód. Pedido', 'Telefone', 'Cliente', 'Comanda', 'Produto', 'Qtd', 'Unitário', 'Subtotal', 'Ingredientes']];
                    const tableData = deliveriesList.map(r => [
                      r.data_hora ? formatDateTimeBrasilia(r.data_hora) : '-',
                      r.codigo_pedido,
                      r.telefone || '-',
                      r.cliente,
                      r.comanda || '-',
                      r.produto,
                      String(r.quantidade),
                      `R$ ${r.preco_unitario.toFixed(2).replace('.', ',')}`,
                      `R$ ${r.subtotal.toFixed(2).replace('.', ',')}`,
                      r.detalhes_ingredientes || '-'
                    ]);

                    autoTable(doc, {
                      head: tableHead,
                      body: tableData,
                      startY: 26,
                      styles: { fontSize: 7, cellPadding: 2 },
                      headStyles: { fillColor: [24, 90, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
                      columnStyles: {
                        0: { cellWidth: 24 },
                        1: { cellWidth: 26 },
                        2: { cellWidth: 24 },
                        3: { cellWidth: 28 },
                        4: { cellWidth: 20 },
                        5: { cellWidth: 32 },
                        6: { cellWidth: 10, halign: 'center' },
                        7: { cellWidth: 20, halign: 'right' },
                        8: { cellWidth: 20, halign: 'right' },
                        9: { cellWidth: 'auto' }
                      }
                    });

                    doc.save(`tabela_entregas_${new Date().toISOString().slice(0, 10)}.pdf`);
                  } catch (e) {
                    console.error('Erro ao gerar PDF de entregas:', e);
                  }
                }}
                disabled={deliveriesList.length === 0}
                className="px-4 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>Salvar PDF</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Total de Linhas / Itens
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-800 mt-1 block">
                {deliveriesList.length}
              </span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Pedidos Únicos
              </span>
              <span className="text-xl sm:text-2xl font-black text-brand-green mt-1 block">
                {new Set(deliveriesList.map(r => r.codigo_pedido)).size}
              </span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Qtd. Total de Produtos
              </span>
              <span className="text-xl sm:text-2xl font-black text-amber-600 mt-1 block">
                {deliveriesList.reduce((acc, r) => acc + (Number(r.quantidade) || 0), 0)} un.
              </span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Subtotal Consolidado
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-700 mt-1 block">
                R$ {deliveriesList.reduce((acc, r) => acc + (Number(r.subtotal) || 0), 0).toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Search */}
              <div className="md:col-span-4 relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar código (ex: BG-34567890), cliente, telefone, comanda ou produto..."
                  value={deliveriesSearch}
                  onChange={(e) => setDeliveriesSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                />
              </div>

              {/* Data Início */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                  Data Início
                </label>
                <input
                  type="date"
                  value={deliveriesStartDate}
                  onChange={(e) => setDeliveriesStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                />
              </div>

              {/* Data Fim */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={deliveriesEndDate}
                  onChange={(e) => setDeliveriesEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                />
              </div>

              {/* Tipo de Entrega */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                  Tipo
                </label>
                <select
                  value={deliveriesTypeFilter}
                  onChange={(e) => setDeliveriesTypeFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                >
                  <option value="all">Todos os Tipos</option>
                  <option value="entrega">Delivery / Entrega</option>
                  <option value="retirada">Retirada / Balcão</option>
                </select>
              </div>

              {/* Status */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                  Status
                </label>
                <select
                  value={deliveriesStatusFilter}
                  onChange={(e) => setDeliveriesStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                >
                  <option value="all">Todos os Status</option>
                  <option value="pendente">Pendente</option>
                  <option value="preparando">Preparando</option>
                  <option value="pronto">Pronto</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            {(deliveriesSearch || deliveriesStartDate || deliveriesEndDate || deliveriesTypeFilter !== 'all' || deliveriesStatusFilter !== 'all') && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDeliveriesSearch('');
                    setDeliveriesStartDate('');
                    setDeliveriesEndDate('');
                    setDeliveriesTypeFilter('all');
                    setDeliveriesStatusFilter('all');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Limpar Filtros</span>
                </button>
              </div>
            )}
          </div>

          {/* Deliveries Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingDeliveries ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-brand-green" />
                <p className="text-xs font-bold text-slate-600">Carregando dados da tabela entregas_detalhadas...</p>
              </div>
            ) : deliveriesList.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                  <Truck className="h-7 w-7" />
                </div>
                <h4 className="font-extrabold text-slate-700 text-sm">Nenhum registro de entrega encontrado</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Os pedidos e entregas registrados na loja ou no PDV aparecerão aqui automaticamente com todos os seus ingredientes discriminados.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-3 whitespace-nowrap">Data / Hora</th>
                      <th className="px-3.5 py-3 whitespace-nowrap">Código Pedido</th>
                      <th className="px-3.5 py-3 whitespace-nowrap">Telefone</th>
                      <th className="px-3.5 py-3 whitespace-nowrap">Cliente</th>
                      <th className="px-3.5 py-3 whitespace-nowrap">Comanda / Local</th>
                      <th className="px-3.5 py-3 whitespace-nowrap">Produto</th>
                      <th className="px-3.5 py-3 text-center whitespace-nowrap">Qtd</th>
                      <th className="px-3.5 py-3 text-right whitespace-nowrap">Preço Unit.</th>
                      <th className="px-3.5 py-3 text-right whitespace-nowrap">Subtotal</th>
                      <th className="px-3.5 py-3 min-w-[220px]">Detalhes / Ingredientes</th>
                      <th className="px-3.5 py-3 text-center whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {deliveriesList.map((row) => {
                      const phoneDigits = (row.telefone || '').replace(/\D/g, '');
                      return (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                          {/* Data/Hora */}
                          <td className="px-3.5 py-3 text-slate-500 font-medium whitespace-nowrap text-[11px]">
                            {row.data_hora ? (
                              <>
                                <span className="block font-bold text-slate-700">
                                  {formatDateBrasilia(row.data_hora)}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {formatTimeBrasilia(row.data_hora)}
                                </span>
                              </>
                            ) : '-'}
                          </td>

                          {/* Código Pedido */}
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-mono font-black text-brand-green bg-brand-green/10 border border-brand-green/20 px-2.5 py-1 rounded-lg text-xs">
                              {row.codigo_pedido}
                            </span>
                          </td>

                          {/* Telefone */}
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            {row.telefone ? (
                              <a
                                href={`https://wa.me/55${phoneDigits}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] transition-colors"
                                title="Abrir conversa no WhatsApp"
                              >
                                <Phone className="h-3 w-3" />
                                <span>{row.telefone}</span>
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>

                          {/* Cliente */}
                          <td className="px-3.5 py-3 font-bold text-slate-800 whitespace-nowrap">
                            {row.cliente}
                          </td>

                          {/* Comanda */}
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <span className="inline-block bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md text-[11px]">
                              {row.comanda || (row.tipo_entrega === 'entrega' ? 'Delivery' : 'Balcão')}
                            </span>
                          </td>

                          {/* Produto */}
                          <td className="px-3.5 py-3 font-extrabold text-slate-900 whitespace-nowrap">
                            {row.produto}
                          </td>

                          {/* Quantidade */}
                          <td className="px-3.5 py-3 text-center font-black text-slate-900 bg-slate-50/50">
                            {row.quantidade}x
                          </td>

                          {/* Preço Unitário */}
                          <td className="px-3.5 py-3 text-right font-medium text-slate-600 whitespace-nowrap">
                            R$ {(Number(row.preco_unitario) || 0).toFixed(2).replace('.', ',')}
                          </td>

                          {/* Subtotal */}
                          <td className="px-3.5 py-3 text-right font-black text-emerald-700 whitespace-nowrap">
                            R$ {(Number(row.subtotal) || 0).toFixed(2).replace('.', ',')}
                          </td>

                          {/* Detalhes / Ingredientes */}
                          <td className="px-3.5 py-3 text-slate-600 text-[11px] leading-relaxed">
                            {row.detalhes_ingredientes ? (
                              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 max-w-sm">
                                {row.detalhes_ingredientes}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Sem detalhes</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3.5 py-3 text-center whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              row.status_pedido === 'pronto' || row.status_pedido === 'finalizado'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : row.status_pedido === 'preparando'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : row.status_pedido === 'cancelado'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              {row.status_pedido || 'pendente'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Closed Cash Registers (Caixas Fechados) Panel */}
      {activeTab === 'cash-registers' && (
        <ClosedCashRegistersPanel user={user} />
      )}

      {/* Lançar Nota Fiscal de Compra Modal (Batch Stock Launch) */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-7 space-y-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-2xl border border-emerald-200">
                  <FilePlus className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg sm:text-xl flex items-center gap-2">
                    Lançar Nota Fiscal de Compra
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Em Lote
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Adicione todos os itens comprados na nota para disponibilizá-los diretamente no estoque.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInvoiceModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleInvoiceSubmit} className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Top Metadata */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                    Nº da Nota / Cupom *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: NF-108293 ou Cupom 402"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>

                <div className="relative">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                    Fornecedor / Mercado
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Atacadão, Mercado Central..."
                    value={invoiceSupplier}
                    onChange={(e) => {
                      setInvoiceSupplier(e.target.value);
                      setShowSupplierDropdown(true);
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSupplierDropdown(false), 200);
                    }}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />

                  {/* Supplier Autocomplete Dropdown */}
                  {showSupplierDropdown && filteredSupplierSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100">
                      <div className="px-3.5 py-1.5 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Fornecedores Anteriores
                      </div>
                      {filteredSupplierSuggestions.map((sup, i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setInvoiceSupplier(sup);
                            setShowSupplierDropdown(false);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span>{sup}</span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Selecionar
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                    Data da Compra *
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                    Observações ou Detalhes da Compra (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Compra semanal de verduras e laticínios"
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-emerald-600" />
                    <span>Itens Comprados na Nota ({invoiceItems.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={addInvoiceItemRow}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer border border-emerald-200 flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Adicionar Outro Item</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-3.5 py-3">Insumo / Item</th>
                        <th className="px-3 py-3 w-28">Qtd Comprada</th>
                        <th className="px-3 py-3 w-28">Preço Unit. (R$)</th>
                        <th className="px-3 py-3 w-28">Total Item (R$)</th>
                        <th className="px-3 py-3 w-32">Validade (Opt)</th>
                        <th className="px-3 py-3 w-12 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {invoiceItems.map((item, idx) => {
                        const selectedIng = ingredients.find(ing => ing.id === item.ingredientId);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3.5 py-2.5">
                              <select
                                value={item.ingredientId}
                                onChange={(e) => updateInvoiceItem(idx, 'ingredientId', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20"
                              >
                                <option value="">-- Selecione o Insumo --</option>
                                {ingredients.map(ing => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.name} ({ing.unit}) {ing.category === 'kitchen' ? '[Cozinha]' : '[Cardápio]'}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  value={item.quantity}
                                  onChange={(e) => updateInvoiceItem(idx, 'quantity', e.target.value)}
                                  className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 text-right outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                                <span className="text-[10px] text-slate-500 font-bold shrink-0">
                                  {selectedIng?.unit || item.unit || ''}
                                </span>
                              </div>
                            </td>

                            <td className="px-3 py-2.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => updateInvoiceItem(idx, 'unitPrice', e.target.value)}
                                className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 text-right outline-none focus:ring-2 focus:ring-emerald-500/20"
                              />
                            </td>

                            <td className="px-3 py-2.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.totalCost}
                                onChange={(e) => updateInvoiceItem(idx, 'totalCost', e.target.value)}
                                className="w-24 px-2 py-1.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-black text-emerald-800 text-right outline-none focus:ring-2 focus:ring-emerald-500/20"
                              />
                            </td>

                            <td className="px-3 py-2.5">
                              <input
                                type="date"
                                value={item.expirationDate || ''}
                                onChange={(e) => updateInvoiceItem(idx, 'expirationDate', e.target.value)}
                                className="w-32 px-2 py-1 bg-slate-50 border border-slate-300 rounded-xl text-[11px] font-medium text-slate-700 outline-none"
                              />
                            </td>

                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeInvoiceItemRow(idx)}
                                disabled={invoiceItems.length <= 1}
                                className={`p-1.5 rounded-lg transition-all ${
                                  invoiceItems.length <= 1 
                                    ? 'text-slate-300 cursor-not-allowed' 
                                    : 'text-red-500 hover:bg-red-50 cursor-pointer'
                                }`}
                                title="Remover linha"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-emerald-900 block">Resumo do Lançamento:</span>
                  <span className="text-xs text-emerald-700">
                    Soma calculada dos itens: <strong>R$ {invoiceItems.reduce((sum, it) => sum + Number(it.totalCost || 0), 0).toFixed(2)}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs font-black text-emerald-900 uppercase shrink-0">
                    Valor Total Pago da Nota (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={invoiceTotalPaid}
                    onChange={(e) => setInvoiceTotalPaid(Number(e.target.value))}
                    className="w-32 px-3 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-black text-emerald-900 text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handlePrintInvoice({
                      invoiceNumber: invoiceNumber || 'Rascunho',
                      supplier: invoiceSupplier,
                      purchaseDate: invoiceDate,
                      notes: invoiceNotes,
                      totalAmount: invoiceTotalPaid || invoiceItems.reduce((sum, it) => sum + Number(it.totalCost || 0), 0),
                      items: invoiceItems
                    });
                  }}
                  className="px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs rounded-xl transition-all cursor-pointer border border-sky-200 flex items-center gap-1.5"
                  title="Imprimir esta nota fiscal"
                >
                  <Printer className="h-4 w-4 text-sky-600" />
                  <span>Imprimir Nota</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsInvoiceModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingInvoice}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-2"
                  >
                    {submittingInvoice ? (
                      <span>Salvando Nota...</span>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Confirmar e Disponibilizar no Estoque</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Histórico de Notas Lançadas Modal */}
      {isInvoicesListOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-7 space-y-5 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 text-amber-800 p-2.5 rounded-2xl border border-amber-200">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg sm:text-xl flex items-center gap-2">
                    Notas Fiscais e Compras Lançadas
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Histórico de notas fiscais e compras em lote inseridas no sistema.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsInvoicesListOpen(false);
                  setSelectedDetailInvoice(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {invoiceSuccessAlert && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
                <span>✅ {invoiceSuccessAlert}</span>
                <button onClick={() => setInvoiceSuccessAlert(null)} className="text-emerald-600 hover:text-emerald-900 font-black cursor-pointer px-1">✕</button>
              </div>
            )}

            {selectedDetailInvoice ? (
              /* Single Invoice Details */
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-amber-900 uppercase">
                        Nº Nota: {selectedDetailInvoice.invoiceNumber}
                      </span>
                      {selectedDetailInvoice.supplier && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-300">
                          {selectedDetailInvoice.supplier}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      Data da compra: <strong>{selectedDetailInvoice.purchaseDate}</strong>
                    </p>
                    {selectedDetailInvoice.notes && (
                      <p className="text-xs text-slate-500 italic mt-1">
                        "{selectedDetailInvoice.notes}"
                      </p>
                    )}
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Valor Total Pago</span>
                    <span className="text-xl font-black text-emerald-700">
                      R$ {(Number(selectedDetailInvoice.totalAmount) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-amber-600" />
                  <span>Itens Incluídos Nesta Nota ({selectedDetailInvoice.items.length})</span>
                </h4>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Item / Insumo</th>
                        <th className="px-4 py-2.5 text-right">Quantidade</th>
                        <th className="px-4 py-2.5 text-right">Preço Unit.</th>
                        <th className="px-4 py-2.5 text-right">Total Item</th>
                        <th className="px-4 py-2.5">Validade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedDetailInvoice.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="px-4 py-2.5 font-bold text-slate-800">
                            {it.ingredientName || it.ingredientId}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                            {it.quantity} {it.unit || ''}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            R$ {(it.unitPrice || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                            R$ {(it.totalCost || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                            {it.expirationDate ? (
                              <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200 font-mono">
                                {it.expirationDate}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedDetailInvoice(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>← Voltar para Lista de Notas</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handlePrintInvoice(selectedDetailInvoice)}
                      className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs rounded-xl transition-all cursor-pointer border border-sky-200 flex items-center gap-1.5"
                      title="Imprimir esta nota fiscal"
                    >
                      <Printer className="h-3.5 w-3.5 text-sky-600" />
                      <span>Imprimir</span>
                    </button>

                    <button
                      onClick={() => handleDownloadInvoicePDF(selectedDetailInvoice)}
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl transition-all cursor-pointer border border-emerald-200 flex items-center gap-1.5"
                      title="Baixar comprovante da nota em arquivo PDF"
                    >
                      <Download className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Baixar em PDF</span>
                    </button>

                    <button
                      onClick={() => setInvoiceToDelete(selectedDetailInvoice)}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-rose-200"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      <span>Excluir Nota e Descontar Estoque</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Invoices List Table */
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                <div className="relative">
                  <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar nota por número, fornecedor ou data..."
                    value={invoicesSearch}
                    onChange={(e) => setInvoicesSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                {loadingInvoices ? (
                  <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
                    Carregando notas lançadas...
                  </div>
                ) : invoicesList.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                    <FileText className="h-10 w-10 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">Nenhuma nota fiscal cadastrada ainda.</p>
                    <p className="text-[11px] text-slate-400">
                      Clique no botão "Lançar Nota Fiscal" no controle de estoque para registrar suas compras.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Nº Nota / Cupom</th>
                          <th className="px-4 py-3">Fornecedor</th>
                          <th className="px-4 py-3 text-center">Itens</th>
                          <th className="px-4 py-3 text-right">Valor Total</th>
                          <th className="px-4 py-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {invoicesList
                          .filter(inv => {
                            if (!invoicesSearch.trim()) return true;
                            const term = invoicesSearch.toLowerCase();
                            return (
                              inv.invoiceNumber.toLowerCase().includes(term) ||
                              (inv.supplier && inv.supplier.toLowerCase().includes(term)) ||
                              inv.purchaseDate.includes(term)
                            );
                          })
                          .map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">
                                {inv.purchaseDate}
                              </td>
                              <td className="px-4 py-3 font-extrabold text-slate-800">
                                {inv.invoiceNumber}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {inv.supplier || <span className="text-slate-400 italic">Não informado</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-md border border-slate-200">
                                  {inv.items?.length || 0} item(ns)
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-emerald-700 whitespace-nowrap">
                                R$ {(Number(inv.totalAmount) || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedDetailInvoice(inv)}
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] rounded-lg transition-all border border-amber-200 flex items-center gap-1 cursor-pointer"
                                    title="Ver itens lançados nesta nota"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    <span>Ver Itens</span>
                                  </button>
                                  <button
                                    onClick={() => handlePrintInvoice(inv)}
                                    className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-lg transition-all border border-sky-200 cursor-pointer"
                                    title="Imprimir nota fiscal"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadInvoicePDF(inv)}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition-all border border-emerald-200 cursor-pointer"
                                    title="Baixar nota em PDF"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setInvoiceToDelete(inv)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 font-bold rounded-lg transition-all border border-rose-200 cursor-pointer"
                                    title="Excluir nota e descontar do estoque"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal to Delete Invoice and deduct stock */}
      {invoiceToDelete && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-200">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-3 bg-rose-100 rounded-2xl border border-rose-200">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-base">Excluir Nota Fiscal?</h4>
                <p className="text-xs text-rose-800 font-bold">Nota nº {invoiceToDelete.invoiceNumber}</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-900 space-y-1.5 font-medium">
              <p className="font-bold flex items-center gap-1 text-rose-800">
                ⚠️ ATENÇÃO - O ESTOQUE SERÁ ATUALIZADO!
              </p>
              <p>
                Ao excluir esta nota fiscal, o sistema irá <strong>remover/descontar automaticamente do estoque</strong> a quantidade de todos os <strong>{invoiceToDelete.items?.length || 0} item(ns)</strong> lançados nesta compra.
              </p>
            </div>

            {invoiceToDelete.items && invoiceToDelete.items.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1 text-xs">
                <p className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Itens que serão descontados do estoque:</p>
                <ul className="divide-y divide-slate-200/60">
                  {invoiceToDelete.items.map((it, idx) => (
                    <li key={idx} className="py-1 flex justify-between items-center text-slate-700">
                      <span className="font-semibold text-slate-800 truncate mr-2">{it.ingredientName || it.ingredientId}</span>
                      <span className="font-bold text-rose-600 shrink-0">-{it.quantity} {it.unit || ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {deleteErrorMsg && (
              <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold">
                {deleteErrorMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setInvoiceToDelete(null);
                  setDeleteErrorMsg(null);
                }}
                disabled={deletingInvoiceId === invoiceToDelete.id}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmDeleteInvoice(invoiceToDelete)}
                disabled={deletingInvoiceId === invoiceToDelete.id}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{deletingInvoiceId === invoiceToDelete.id ? 'Excluindo...' : 'Sim, Excluir e Descontar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 3) Modal Ver Todos os Produtos Vendidos & Exportar PDF */}
      {isAllSoldModalOpen && report && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-7 space-y-5 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-2xl border border-emerald-200">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg sm:text-xl flex items-center gap-2">
                    Todos os Produtos Vendidos
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Relatório Completo
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Listagem detalhada de todos os lanches, saladas, bebidas e insumos vendidos no período.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAllSoldModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Controls Row: Search & Category Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 shrink-0">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar produto por nome..."
                  value={soldProductsSearch}
                  onChange={(e) => setSoldProductsSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {soldProductsSearch && (
                  <button
                    onClick={() => setSoldProductsSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category filter pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'lanches', label: '🍔 Lanches' },
                  { id: 'saladas', label: '🥗 Saladas' },
                  { id: 'bebidas', label: '🥤 Bebidas' },
                  { id: 'sobremesas', label: '🍪 Sobremesas' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSoldProductsCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      soldProductsCategoryFilter === cat.id
                        ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-2xl overflow-y-auto flex-1 shadow-xs max-h-[50vh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">Produto / Insumo</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3 text-center">Qtd Vendida</th>
                    <th className="px-4 py-3 text-right">Faturamento Total (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(!report.allSoldProducts || report.allSoldProducts.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                        Nenhum produto vendido registrado no período.
                      </td>
                    </tr>
                  ) : (
                    report.allSoldProducts
                      .filter(p => {
                        if (soldProductsCategoryFilter !== 'all' && p.category !== soldProductsCategoryFilter) return false;
                        if (soldProductsSearch && !p.name.toLowerCase().includes(soldProductsSearch.toLowerCase())) return false;
                        return true;
                      })
                      .map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 font-bold text-slate-800">{p.name}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              {p.category === 'lanches' ? 'Lanches / Subs' : p.category === 'saladas' ? 'Saladas' : p.category === 'bebidas' ? 'Bebidas' : p.category === 'sobremesas' ? 'Sobremesas' : 'Outros'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center font-black text-slate-900 bg-slate-50/50">
                            {p.quantity} un.
                          </td>
                          <td className="px-4 py-2.5 text-right font-black text-emerald-700">
                            R$ {(Number(p.totalRevenue) || 0).toFixed(2).replace('.', ',')}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Actions Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsAllSoldModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={handleExportSoldProductsPDF}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span>Salvar Relatório em PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configurar Logo do Sistema / Marca */}
      {isLogoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-brand-yellow/20 text-brand-green rounded-xl">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Logo do Sistema / Marca</h3>
                  <p className="text-xs text-slate-500">Adicione ou altere a logo exibida no topo do sistema</p>
                </div>
              </div>
              <button
                onClick={() => setIsLogoModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  URL da Imagem da Logo
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/sua-logo.png"
                  value={storeLogoInput}
                  onChange={(e) => setStoreLogoInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Insira o link direto de uma imagem (PNG, SVG, WebP ou JPG) para personalizar o topo do aplicativo.
                </p>
              </div>

              {/* Preview Box */}
              <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-2 min-h-[110px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pré-visualização no Cabeçalho</span>
                {storeLogoInput.trim() ? (
                  <div className="bg-brand-green p-3 rounded-xl flex items-center justify-center w-full shadow-inner min-h-[50px]">
                    <img
                      src={storeLogoInput.trim()}
                      alt="Preview Logo"
                      className="h-10 max-w-[200px] object-contain drop-shadow-xs"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="bg-white px-3 py-1.5 rounded-sm border border-slate-200 shadow-2xs">
                    <span className="text-brand-green font-black text-xl tracking-tighter italic">BAGÔ</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  setStoreLogoInput('');
                  localStorage.removeItem('bago_store_logo');
                  window.dispatchEvent(new Event('store_logo_updated'));
                  try {
                    await fetch('/api/settings/logo', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ logoUrl: '' })
                    });
                  } catch (err) {
                    console.error('Erro ao remover logo no banco:', err);
                  }
                  setIsLogoModalOpen(false);
                }}
                className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              >
                Remover Logo
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsLogoModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const finalLogo = storeLogoInput.trim();
                    localStorage.setItem('bago_store_logo', finalLogo);
                    window.dispatchEvent(new Event('store_logo_updated'));
                    try {
                      await fetch('/api/settings/logo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ logoUrl: finalLogo })
                      });
                    } catch (err) {
                      console.error('Erro ao salvar logo no banco:', err);
                    }
                    setIsLogoModalOpen(false);
                  }}
                  className="px-5 py-2 bg-brand-green hover:bg-brand-green-dark text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                >
                  Salvar Logo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
