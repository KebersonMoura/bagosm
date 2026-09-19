import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Users, 
  LogOut, 
  LayoutDashboard, 
  Utensils, 
  X, 
  Bell, 
  AlertCircle,
  HelpCircle,
  Maximize2,
  Minimize2,
  RefreshCw
} from 'lucide-react';
import CustomerSite from './components/CustomerSite';
import KitchenDashboard from './components/KitchenDashboard';
import AdminDashboard from './components/AdminDashboard';
import PosDashboard from './components/PosDashboard';
import LoginModal from './components/LoginModal';
import { Ingredient, Order, OrderStatus, User, CustomizerStep, ReadyProduct } from './types';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'alert';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<Order | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [mode, setMode] = useState<'cliente' | 'funcionario'>('cliente');
  const [staffSubView, setStaffSubView] = useState<'balcao' | 'cozinha' | 'admin'>('balcao');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [stepsConfig, setStepsConfig] = useState<CustomizerStep[]>([]);
  const [readyProducts, setReadyProducts] = useState<ReadyProduct[]>([]);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [isNativeFullScreen, setIsNativeFullScreen] = useState(false);
  const [storeLogoUrl, setStoreLogoUrl] = useState<string>(() => {
    return localStorage.getItem('bago_store_logo') || '';
  });

  useEffect(() => {
    const handleLogoUpdate = () => {
      setStoreLogoUrl(localStorage.getItem('bago_store_logo') || '');
    };
    window.addEventListener('store_logo_updated', handleLogoUpdate);
    window.addEventListener('storage', handleLogoUpdate);
    return () => {
      window.removeEventListener('store_logo_updated', handleLogoUpdate);
      window.removeEventListener('storage', handleLogoUpdate);
    };
  }, []);

  const toggleFullScreen = () => {
    setIsFullWidth(prev => !prev);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => {
        setIsNativeFullScreen(true);
      }).catch((err) => {
        console.warn("Fullscreen API block or unsupported in iframe:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsNativeFullScreen(false);
        }).catch(() => {});
      }
    }
  };

  // Play custom synthesized bell chime sound using Web Audio API (highly robust!)
  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Chime first note (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain1.gain.setValueAtTime(0.2, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.3);

      // Chime second note (A5) slightly delayed
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain2.gain.setValueAtTime(0.2, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.5);
      }, 120);

    } catch (e) {
      console.warn('AudioContext not allowed or not supported yet.', e);
    }
  };

  const showToast = (message: string, type: 'info' | 'success' | 'alert' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove toast after 6 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Helper to fetch with retries for initial data loading
  const fetchWithRetry = async (url: string, retries = 3, delay = 1000): Promise<Response> => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url);
        if (res.ok) return res;
      } catch (err) {
        if (i === retries - 1) throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return fetch(url);
  };

  // Keep a ref of active tracking order and orders for real-time listeners
  const activeTrackingOrderRef = useRef<Order | null>(activeTrackingOrder);
  useEffect(() => {
    activeTrackingOrderRef.current = activeTrackingOrder;
  }, [activeTrackingOrder]);

  const ordersRef = useRef<Order[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const fetchIngredients = async () => {
    try {
      const res = await fetchWithRetry('/api/ingredients');
      if (res.ok) {
        const data = await res.json();
        setIngredients(data);
      }
    } catch (err) {
      console.warn('Erro ao buscar ingredientes (usando fallback local):', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetchWithRetry('/api/orders');
      if (res.ok) {
        const data: Order[] = await res.json();
        if (Array.isArray(data)) {
          // Detect new orders for sound & toast alerts if arrived via background poll
          const prevOrderIds = new Set(ordersRef.current.map(o => o.id));
          const brandNewOrders = data.filter(o => !prevOrderIds.has(o.id));
          
          if (brandNewOrders.length > 0 && ordersRef.current.length > 0) {
            const hasNewPending = brandNewOrders.some(o => o.status === 'pendente');
            if (hasNewPending && modeRef.current === 'funcionario') {
              playNotificationSound();
              const latest = brandNewOrders[0];
              showToast(`Novo pedido recebido! #${latest.code} (${latest.customerName})`, 'success');
            }
          }

          setOrders(data);

          // Update active tracking order if currently tracking
          if (activeTrackingOrderRef.current) {
            const currentTrackingId = activeTrackingOrderRef.current.id;
            const updatedTracking = data.find(o => o.id === currentTrackingId);
            if (updatedTracking) {
              setActiveTrackingOrder(updatedTracking);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar pedidos (usando fallback local):', err);
    }
  };

  const fetchSteps = async () => {
    try {
      const res = await fetchWithRetry('/api/steps');
      if (res.ok) {
        const data = await res.json();
        setStepsConfig(data);
      }
    } catch (err) {
      console.warn('Erro ao buscar etapas (usando fallback local):', err);
    }
  };

  const fetchReadyProducts = async () => {
    try {
      const res = await fetchWithRetry('/api/ready-products');
      if (res.ok) {
        const data = await res.json();
        setReadyProducts(data);
      }
    } catch (err) {
      console.warn('Erro ao buscar produtos prontos (usando fallback local):', err);
    }
  };

  const fetchStoreLogo = async () => {
    try {
      const res = await fetchWithRetry('/api/settings/logo');
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.logoUrl === 'string') {
          setStoreLogoUrl(data.logoUrl);
          localStorage.setItem('bago_store_logo', data.logoUrl);
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar logo da loja (usando cache local):', err);
    }
  };

  useEffect(() => {
    fetchIngredients();
    fetchOrders();
    fetchSteps();
    fetchReadyProducts();
    fetchStoreLogo();

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isComponentMounted = true;

    const setupSSE = () => {
      if (!isComponentMounted) return;
      try {
        eventSource = new EventSource('/api/events');

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            
            if (parsed.type === 'NEW_ORDER') {
              const newOrder = parsed.data;
              setOrders(prev => {
                if (prev.some(o => o.id === newOrder.id)) {
                  return prev.map(o => o.id === newOrder.id ? newOrder : o);
                }
                return [newOrder, ...prev];
              });
              fetchIngredients();
              if (modeRef.current === 'funcionario') {
                playNotificationSound();
                showToast(`Novo pedido recebido! Cod: ${newOrder.code} (${newOrder.customerName})`, 'success');
              }
            } else if (parsed.type === 'ORDER_STATUS_UPDATE') {
              const updatedOrder = parsed.data;
              setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
              fetchIngredients();
              
              // Sync client-side tracking order state if active
              if (activeTrackingOrderRef.current && activeTrackingOrderRef.current.id === updatedOrder.id) {
                setActiveTrackingOrder(updatedOrder);
              }
            } else if (parsed.type === 'ORDER_DELETED') {
              const deletedData = parsed.data;
              const deletedId = deletedData?.id;
              if (deletedId) {
                setOrders(prev => prev.filter(o => o.id !== deletedId));
                if (activeTrackingOrderRef.current && activeTrackingOrderRef.current.id === deletedId) {
                  setActiveTrackingOrder(null);
                }
              }
              fetchIngredients();
            } else if (parsed.type === 'STOCK_UPDATE') {
              const { id, stock } = parsed.data;
              setIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, stock } : ing));
            } else if (parsed.type === 'STOCKS_REFRESH') {
              setIngredients(parsed.data);
            } else if (parsed.type === 'STEPS_REFRESH') {
              setStepsConfig(parsed.data);
            } else if (parsed.type === 'READY_PRODUCTS_REFRESH') {
              setReadyProducts(parsed.data);
            } else if (parsed.type === 'STORE_LOGO_UPDATED') {
              const newLogo = parsed.data?.logoUrl || '';
              setStoreLogoUrl(newLogo);
              localStorage.setItem('bago_store_logo', newLogo);
            }
          } catch (err) {
            console.error('Erro de decodificação de evento SSE:', err);
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (isComponentMounted && !reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
              reconnectTimeout = null;
              setupSSE();
            }, 3000);
          }
        };
      } catch (e) {
        console.warn('Erro ao inicializar SSE:', e);
      }
    };

    setupSSE();

    // High-frequency Background Poll (every 2.5 seconds) ensuring instant order arrival even without SSE
    const pollInterval = setInterval(() => {
      fetchOrders();
    }, 2500);

    return () => {
      isComponentMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, []);

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) {
        showToast('Falha ao atualizar status do pedido.', 'alert');
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setMode('cliente');
    showToast('Sessão encerrada com segurança.');
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col font-sans text-slate-800" id="app-root">
      
      {/* Dynamic Header */}
      <header className="bg-brand-green text-white shadow-lg border-b-4 border-brand-yellow relative z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          
          {/* Logo Brand Brand Area */}
          <div 
            onClick={() => { setMode('cliente'); }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            {storeLogoUrl ? (
              <img
                src={storeLogoUrl}
                alt="Logo Bagô"
                className="h-10 max-w-[180px] object-contain group-hover:scale-105 transition-all duration-300 drop-shadow-xs"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="bg-white px-2 py-1 rounded-sm group-hover:scale-105 transition-all duration-300">
                <span className="text-brand-green font-black text-xl tracking-tighter italic">BAGÔ</span>
              </div>
            )}
          </div>

          {/* Nav / Mode Toggle Controls */}
          <div className="flex items-center gap-2">
            

            {/* Funcionário Section Toggle */}
            {user ? (
              <button
                onClick={() => { 
                  setMode('funcionario'); 
                  if (user.role === 'admin') {
                    setStaffSubView('admin');
                  }
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all active:scale-95 border ${
                  mode === 'funcionario'
                    ? 'bg-brand-yellow text-brand-green border-brand-yellow shadow-sm font-black'
                    : 'text-white/90 hover:text-white hover:bg-white/10 border-white/20'
                }`}
                id="nav-funcionario-btn"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>{user.role === 'admin' ? 'Gerência' : 'Cozinha'}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="px-3 py-1.5 text-xs font-bold rounded-md text-white/90 hover:text-white hover:bg-white/10 border border-white/10 flex items-center gap-1.5 transition-all"
                id="nav-login-trigger"
              >
                <Users className="h-4 w-4" />
                <span>Área da Equipe</span>
              </button>
            )}

            {/* Fullscreen / Wide Screen Toggle Button */}
            <button
              onClick={toggleFullScreen}
              title={isFullWidth ? "Sair da Tela Toda" : "Visualizar em Toda Tela"}
              className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all active:scale-95 border ${
                isFullWidth
                  ? 'bg-amber-400 text-slate-900 border-amber-400 font-extrabold shadow-sm'
                  : 'text-white/90 hover:text-white hover:bg-white/10 border-white/20'
              }`}
            >
              {isFullWidth ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="hidden sm:inline">{isFullWidth ? "Restaurar" : "Toda Tela"}</span>
            </button>

            {/* Logout button (only if user logged in) */}
            {user && (
              <button
                onClick={handleLogout}
                title="Sair do sistema"
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-all"
                id="nav-logout-btn"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container Content */}
      <main className={`flex-1 w-full max-w-full mx-auto py-6 transition-all ${isFullWidth || mode === 'cliente' ? 'max-w-none px-3 sm:px-6 lg:px-8' : 'max-w-7xl px-4 sm:px-6 lg:px-8'}`}>
        
        {/* Customer Mode Render */}
        {mode === 'cliente' && (
          <CustomerSite 
            ingredients={ingredients}
            stepsConfig={stepsConfig}
            readyProducts={readyProducts}
            onOrderCreated={(newOrder) => {
              setActiveTrackingOrder(newOrder);
              setOrders(prev => {
                if (prev.some(o => o.id === newOrder.id)) {
                  return prev.map(o => o.id === newOrder.id ? newOrder : o);
                }
                return [newOrder, ...prev];
              });
              fetchIngredients();
            }}
            activeTrackingOrder={activeTrackingOrder}
            setActiveTrackingOrder={setActiveTrackingOrder}
          />
        )}

        {/* Staff Mode Render */}
        {mode === 'funcionario' && user && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Staff Sub-navigation Bar */}
            <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Greeting "Olá, Administrador {user.name}!" on the left */}
                <div className="flex items-center gap-2 bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-200 text-emerald-900">
                  <span className="text-xs font-extrabold">👋 Olá, {user.role === 'admin' ? 'Administrador' : 'Operador'} {user.name}!</span>
                </div>

                {/* "Atualizar Painel" button */}
                <button
                  onClick={() => {
                    fetchIngredients();
                    fetchOrders();
                    fetchSteps();
                    fetchReadyProducts();
                    showToast('Painel atualizado com sucesso!', 'info');
                  }}
                  className="bg-brand-green/10 hover:bg-brand-green/20 text-brand-green font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 border border-brand-green/20 cursor-pointer"
                  title="Atualizar dados do sistema"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Atualizar Painel</span>
                </button>

                <div className="h-4 w-px bg-slate-200 hidden md:block"></div>

                {/* Sub-view switches */}
                <button
                  onClick={() => setStaffSubView('balcao')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    staffSubView === 'balcao'
                      ? 'bg-brand-green text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Atendimento Balcão (PDV)</span>
                </button>

                <button
                  onClick={() => setStaffSubView('cozinha')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    staffSubView === 'cozinha'
                      ? 'bg-brand-green text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Utensils className="h-4 w-4" />
                  <span>Cozinha (KDS)</span>
                </button>

                {user.role === 'admin' && (
                  <button
                    onClick={() => setStaffSubView('admin')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      staffSubView === 'admin'
                        ? 'bg-brand-green text-white shadow-xs'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Gerência</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFullScreen}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    isFullWidth
                      ? 'bg-amber-400 text-slate-900 border-amber-400 font-extrabold shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                  }`}
                >
                  {isFullWidth ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  <span>{isFullWidth ? "Sair da Tela Toda" : "Ver em Toda Tela"}</span>
                </button>
              </div>
            </div>

            {/* Display active Subview */}
            {staffSubView === 'balcao' && (
              <PosDashboard
                user={user}
                readyProducts={readyProducts}
                ingredients={ingredients}
                orders={orders}
                onOrderCreated={(newOrder) => {
                  setOrders(prev => {
                    if (prev.some(o => o.id === newOrder.id)) {
                      return prev.map(o => o.id === newOrder.id ? newOrder : o);
                    }
                    return [newOrder, ...prev];
                  });
                  fetchIngredients();
                  showToast(`Venda concluída! Pedido ${newOrder.code} enviado para a cozinha.`, 'success');
                }}
                onOrderUpdated={(updatedOrder) => {
                  setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                  fetchIngredients();
                  showToast(`Pedido ${updatedOrder.code} atualizado com sucesso!`, 'success');
                }}
                onOrderDeleted={(orderId) => {
                  setOrders(prev => prev.filter(o => o.id !== orderId));
                  fetchIngredients();
                }}
                showToast={showToast}
              />
            )}

            {staffSubView === 'cozinha' && (
              <KitchenDashboard 
                orders={orders} 
                onUpdateStatus={handleUpdateStatus} 
                onRefreshOrders={fetchOrders}
              />
            )}

            {staffSubView === 'admin' && user.role === 'admin' && (
              <div className="grid grid-cols-1 gap-8">
                <AdminDashboard 
                  user={user} 
                  ingredients={ingredients} 
                  onRefreshStocks={fetchIngredients}
                  onSaveIngredient={async (ingredient) => {
                    try {
                      const res = await fetch('/api/ingredients', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ingredient, role: user.role })
                      });
                      if (res.ok) {
                        showToast('Item de estoque salvo com sucesso!', 'success');
                        fetchIngredients();
                      } else {
                        const data = await res.json().catch(() => ({}));
                        showToast(data.error || 'Erro ao salvar item no estoque.', 'alert');
                      }
                    } catch (err) {
                      console.error('Erro ao salvar ingrediente:', err);
                      showToast('Erro ao salvar item no estoque.', 'alert');
                    }
                  }}
                  onDeleteIngredient={async (ingredientId) => {
                    setIngredients(prev => prev.filter(i => i.id !== ingredientId));
                    try {
                      const res = await fetch(`/api/ingredients/${ingredientId}?role=${user?.role || 'admin'}`, {
                        method: 'DELETE'
                      });
                      if (res.ok) {
                        showToast('Item removido do estoque com sucesso!', 'success');
                        fetchIngredients();
                      } else {
                        const data = await res.json().catch(() => ({}));
                        showToast(data.error || 'Erro ao remover item.', 'alert');
                        fetchIngredients();
                      }
                    } catch (err) {
                      console.error('Erro ao deletar ingrediente:', err);
                      fetchIngredients();
                    }
                  }}
                  stepsConfig={stepsConfig}
                  onUpdateSteps={async (updatedSteps) => {
                    try {
                      const res = await fetch('/api/steps', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ steps: updatedSteps, role: user.role })
                      });
                      if (res.ok) {
                        showToast('Etapas do construtor atualizadas!', 'success');
                        fetchSteps();
                      }
                    } catch (err) {
                      console.error('Erro ao salvar etapas:', err);
                      showToast('Falha ao atualizar etapas.', 'alert');
                    }
                  }}
                  readyProducts={readyProducts}
                  onUpdateReadyProduct={async (product) => {
                    try {
                      const res = await fetch('/api/ready-products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ product, role: user.role })
                      });
                      if (res.ok) {
                        showToast('Produto salvo com sucesso!', 'success');
                        fetchReadyProducts();
                      }
                    } catch (err) {
                      console.error('Erro ao salvar produto:', err);
                      showToast('Erro ao salvar produto.', 'alert');
                    }
                  }}
                  onDeleteReadyProduct={async (productId) => {
                    // Optimistic local state removal
                    setReadyProducts(prev => prev.filter(p => p.id !== productId));
                    try {
                      const res = await fetch(`/api/ready-products/${productId}?role=${user?.role || 'admin'}`, {
                        method: 'DELETE'
                      });
                      if (res.ok) {
                        showToast('Produto removido com sucesso!', 'success');
                        fetchReadyProducts();
                      } else {
                        const data = await res.json().catch(() => ({}));
                        showToast(data.error || 'Erro ao remover produto.', 'alert');
                        fetchReadyProducts(); // restore if failed
                      }
                    } catch (err) {
                      console.error('Erro ao remover produto:', err);
                      showToast('Erro ao remover produto.', 'alert');
                      fetchReadyProducts();
                    }
                  }}
                />

                {/* End of Admin view */}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer Branding credits */}
      <footer className="bg-gray-900 text-gray-400 text-xs py-8 border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="space-y-1">
            <p className="font-bold text-white text-sm">Bagô S.A.</p>
            <p>© 2026 Bagô. Todos os direitos reservados.</p>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-400 font-medium">Desenvolvido por <strong className="text-gray-200">desenvolvatech</strong> em conformidade com as diretrizes da marca Bagô</span>
          </div>
        </div>
      </footer>

      {/* Floating Push Notification Toasts Stack (Staff Mode Only) */}
      {mode === 'funcionario' && (
        <div 
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none" 
          id="toasts-portal"
        >
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-2xl shadow-xl flex gap-3 justify-between items-start border text-xs font-semibold animate-in fade-in slide-in-from-right-5 duration-200 ${
                toast.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : toast.type === 'alert'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-white border-gray-200 text-gray-800'
              }`}
            >
              <div className="flex gap-2">
                <div className="mt-0.5">
                  <Bell className={`h-4 w-4 shrink-0 ${toast.type === 'success' ? 'text-emerald-600' : 'text-gray-500'}`} />
                </div>
                <p className="leading-relaxed">{toast.message}</p>
              </div>
              <button 
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 p-0.5 hover:bg-gray-100 rounded-md transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Authentication Login Modal */}
      <LoginModal 
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setMode('funcionario');
          if (loggedInUser.role === 'cozinha') {
            setStaffSubView('cozinha');
          } else if (loggedInUser.role === 'admin') {
            setStaffSubView('admin');
          } else {
            setStaffSubView('balcao');
          }
          showToast(`Bem-vindo, ${loggedInUser.name}! Sessão operacional autorizada.`, 'success');
        }}
      />

    </div>
  );
}
