import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Check, 
  Sparkles, 
  Truck, 
  Hourglass, 
  AlertCircle,
  BellRing,
  Volume2,
  VolumeX,
  AlertTriangle,
  Clock,
  UserCheck,
  Printer,
  Calendar,
  Filter,
  RotateCcw,
  MessageCircle,
  Send,
  X,
  Phone,
  User
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { printThermalReceipt } from '../utils/printReceipt';
import { 
  getDeliverySettings, 
  fetchDeliverySettingsFromApi, 
  StoreDeliverySettings 
} from '../utils/deliverySettings';
import { 
  formatTimeBrasilia, 
  getTodayBrasilia, 
  getYesterdayBrasilia, 
  getDateYMDInBrasilia as getOrderDateBrasilia 
} from '../utils/dateUtils';

interface KitchenDashboardProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
  onRefreshOrders?: () => void;
}

interface KdsWhatsAppPrompt {
  order: Order;
  type: 'preparo' | 'pronto_retirada' | 'saiu_entrega' | 'finalizado';
  customerPhone: string;
  messageText: string;
}

export default function KitchenDashboard({ orders, onUpdateStatus, onRefreshOrders }: KitchenDashboardProps) {
  // Date filter state preset with TODAY in Brasilia timezone
  const [selectedDate, setSelectedDate] = useState<string>(getTodayBrasilia());
  // KDS Alarm Sound mute control
  const [isAlarmMuted, setIsAlarmMuted] = useState<boolean>(false);
  // Order Source Filter (Default: 'online' as requested)
  const [orderSourceFilter, setOrderSourceFilter] = useState<'online' | 'balcao' | 'todos'>('online');
  // WhatsApp Notification Modal State
  const [whatsappPrompt, setWhatsappPrompt] = useState<KdsWhatsAppPrompt | null>(null);
  // Delivery Settings for WhatsApp notifications
  const [deliverySettings, setDeliverySettings] = useState<StoreDeliverySettings>(() => getDeliverySettings());

  // Fetch updated settings on mount and listen to changes
  useEffect(() => {
    fetchDeliverySettingsFromApi().then(settings => {
      if (settings) setDeliverySettings(settings);
    });

    const handleSettingsUpdated = () => {
      setDeliverySettings(getDeliverySettings());
    };

    window.addEventListener('deliverySettingsUpdated', handleSettingsUpdated);
    return () => window.removeEventListener('deliverySettingsUpdated', handleSettingsUpdated);
  }, []);

  // Automatic high-frequency refresh while Kitchen Dashboard is open
  useEffect(() => {
    if (onRefreshOrders) {
      onRefreshOrders();
      const interval = setInterval(() => {
        onRefreshOrders();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [onRefreshOrders]);

  // Filter orders by selected date (for channel counters and main list)
  const dateFilteredOrders = orders.filter(o => {
    if (!selectedDate) return true;
    const orderDate = getOrderDateBrasilia(o.createdAt);
    const today = getTodayBrasilia();
    // Guarantee active kitchen orders (pending/preparing) are always visible on today's view
    if (selectedDate === today && (o.status === 'pendente' || o.status === 'preparo')) {
      return true;
    }
    return orderDate === selectedDate;
  });

  // Filter orders by selected date AND order source (Online vs Balcão)
  const filteredOrders = dateFilteredOrders.filter(o => {
    if (orderSourceFilter === 'online') {
      return !o.isPosOrder;
    }
    if (orderSourceFilter === 'balcao') {
      return Boolean(o.isPosOrder);
    }
    return true;
  });

  // Filter orders by status
  const pendingOrders = filteredOrders.filter(o => o.status === 'pendente');
  const preppingOrders = filteredOrders.filter(o => o.status === 'preparo');
  const finishedOrders = filteredOrders.filter(o => o.status === 'finalizado');
  const deliveredOrders = filteredOrders.filter(o => o.status === 'entregue');

  const handleUpdate = (orderId: string, currentStatus: OrderStatus, order?: Order) => {
    let nextStatus: OrderStatus;
    if (currentStatus === 'pendente') {
      nextStatus = 'preparo';
      if (order) {
        printThermalReceipt(order, { isKitchenTicket: true });
      }
    } else if (currentStatus === 'preparo') {
      nextStatus = 'finalizado';
    } else {
      nextStatus = 'entregue';
    }

    // 1. Advance status immediately
    onUpdateStatus(orderId, nextStatus);

    // 2. Check if operator should be prompted to send WhatsApp to customer
    const activeSettings = { ...deliverySettings, ...getDeliverySettings() };
    if (order && activeSettings.kdsNotifyWhatsAppEnabled !== false) {
      if (nextStatus === 'preparo') {
        const customBody = (activeSettings.kdsMessagePreparing !== undefined && activeSettings.kdsMessagePreparing.trim() !== '')
          ? activeSettings.kdsMessagePreparing.trim()
          : 'Segue pedido esta sendo preparado.';
        const fullMsg = `Pedido ${order.code}\n${customBody}`;
        setWhatsappPrompt({
          order,
          type: 'preparo',
          customerPhone: order.customerPhone || '',
          messageText: fullMsg
        });
      } else if (nextStatus === 'finalizado') {
        const isDelivery = order.deliveryType === 'entrega';
        if (isDelivery) {
          const customBody = (activeSettings.kdsMessageDelivery !== undefined && activeSettings.kdsMessageDelivery.trim() !== '')
            ? activeSettings.kdsMessageDelivery.trim()
            : 'Seu pedido saiu para entrega e está a caminho!';
          const fullMsg = `Pedido ${order.code}\n${customBody}`;
          setWhatsappPrompt({
            order,
            type: 'saiu_entrega',
            customerPhone: order.customerPhone || '',
            messageText: fullMsg
          });
        } else {
          const customBody = (activeSettings.kdsMessageReady !== undefined && activeSettings.kdsMessageReady.trim() !== '')
            ? activeSettings.kdsMessageReady.trim()
            : 'Seu pedido está pronto para retirada!';
          const fullMsg = `Pedido ${order.code}\n${customBody}`;
          setWhatsappPrompt({
            order,
            type: 'pronto_retirada',
            customerPhone: order.customerPhone || '',
            messageText: fullMsg
          });
        }
      }
    }
  };

  const handleSendKdsWhatsApp = () => {
    if (!whatsappPrompt) return;
    const rawPhone = (whatsappPrompt.customerPhone || whatsappPrompt.order.customerPhone || '').replace(/\D/g, '');
    let cleanPhone = rawPhone;
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }
    const encodedText = encodeURIComponent(whatsappPrompt.messageText);
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    window.open(waUrl, '_blank');
    setWhatsappPrompt(null);
  };

  const playKitchenAlarmBeep = () => {
    // 1. Primary: Try playing the MP3 audio directly from MyInstants sound CDN
    let playedMp3 = false;
    try {
      const audioUrl = 'https://www.myinstants.com/media/sounds/google-very-alarmed.mp3';
      const audio = new Audio(audioUrl);
      audio.volume = 0.85;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            playedMp3 = true;
          })
          .catch(() => {
            // Audio autoplay blocked or network error, fallback to Web Audio Synth
            playGoogleAlarmSynth();
          });
      }
    } catch (e) {
      playGoogleAlarmSynth();
    }
  };

  // Web Audio synthesizer replicating the Google Very Alarmed tone signature
  const playGoogleAlarmSynth = () => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // "Google Very Alarmed" alarm pattern: 6 rapid high-urgency alternating pulses (1174Hz and 880Hz)
      const tones = [
        { freq: 1174, start: 0.00, duration: 0.08 },
        { freq: 880,  start: 0.09, duration: 0.08 },
        { freq: 1174, start: 0.18, duration: 0.08 },
        { freq: 880,  start: 0.27, duration: 0.08 },
        { freq: 1174, start: 0.36, duration: 0.08 },
        { freq: 880,  start: 0.45, duration: 0.12 }
      ];

      tones.forEach(({ freq, start, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Square/triangle wave gives the distinct digital alarm clock tone
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

        gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      });
    } catch (err) {
      console.error('Erro ao sintetizar alarme Google:', err);
    }
  };

  // Continuous alarm loop while there are pending orders
  useEffect(() => {
    if (pendingOrders.length === 0 || isAlarmMuted) return;

    // Beep immediately on state update / new order
    playKitchenAlarmBeep();

    // Repeat alarm sound every 5 seconds until orders are accepted (status moved to 'preparo')
    const intervalId = setInterval(() => {
      playKitchenAlarmBeep();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [pendingOrders.length, isAlarmMuted]);

  const testSound = () => {
    playKitchenAlarmBeep();
  };

  const handleAcceptAllPending = () => {
    pendingOrders.forEach(o => {
      handleUpdate(o.id, 'pendente', o);
    });
  };

  return (
    <div className="space-y-6" id="kitchen-dashboard-root">
      {/* Alarm Alert Banner when orders are pending */}
      {pendingOrders.length > 0 && (
        <div className="bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 text-white rounded-2xl p-4 shadow-xl border-2 border-amber-300 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl shrink-0 animate-bounce">
              <BellRing className="h-6 w-6 text-yellow-300" />
            </div>
            <div>
              <h4 className="font-black text-base uppercase tracking-wider flex items-center gap-2">
                <span>🚨 ATENÇÃO COZINHA!</span>
                <span className="bg-yellow-300 text-slate-900 text-xs px-2.5 py-0.5 rounded-full font-black">
                  {pendingOrders.length} {pendingOrders.length === 1 ? 'NOVO PEDIDO' : 'NOVOS PEDIDOS'}
                </span>
              </h4>
              <p className="text-xs font-extrabold opacity-95 mt-0.5">
                Alarme ativo bando até ser aceito! Clique em "Iniciar Preparo" para desligar o som deste pedido.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => setIsAlarmMuted(!isAlarmMuted)}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs border ${
                isAlarmMuted
                  ? 'bg-slate-800 text-amber-300 border-amber-400'
                  : 'bg-white/20 hover:bg-white/30 text-white border-white/40'
              }`}
            >
              {isAlarmMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-yellow-300" />}
              <span>{isAlarmMuted ? 'Alarme Silenciado' : 'Silenciar Alarme'}</span>
            </button>

            <button
              onClick={handleAcceptAllPending}
              className="flex-1 sm:flex-none bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border border-yellow-200"
            >
              <Check className="h-4 w-4" />
              <span>Aceitar Todos ({pendingOrders.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-brand-green rounded-xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in duration-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-brand-yellow rounded-full animate-ping"></span>
            <span className="text-xs uppercase font-black text-brand-yellow tracking-widest">Painel Operacional</span>
          </div>
          <h2 className="text-2xl font-black mt-1 italic uppercase">Atendimento & Cozinha (KDS)</h2>
          <p className="text-white/80 text-sm">
            Visualize, monte e libere os pedidos dos clientes da Bagôway em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAlarmMuted(!isAlarmMuted)}
            className={`font-bold px-3 py-2.5 rounded-md flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
              isAlarmMuted
                ? 'bg-rose-500/30 text-rose-200 border border-rose-400/50'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Alternar Som do Alarme"
          >
            {isAlarmMuted ? <VolumeX className="h-4 w-4 text-rose-300" /> : <Volume2 className="h-4 w-4 text-brand-yellow" />}
            <span>{isAlarmMuted ? 'Som Desativado' : 'Som Ativo'}</span>
          </button>
          <button
            onClick={testSound}
            className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-md flex items-center gap-2 text-xs transition-all cursor-pointer"
          >
            <Volume2 className="h-4 w-4 text-brand-yellow" />
            <span>Testar Bip de Alerta</span>
          </button>
        </div>
      </div>

      {/* Date Filter Toolbar (Brasília Timezone) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-green/10 text-brand-green rounded-xl">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
              <span>Filtro de Pedidos por Data</span>
              <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200">
                Fuso Horário de Brasília (GMT-3)
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedDate ? (
                <span>Exibindo pedidos do dia <strong className="text-slate-800 font-black">{selectedDate.split('-').reverse().join('/')}</strong> ({filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'})</span>
              ) : (
                <span>Exibindo <strong className="text-slate-800 font-black">todas as datas</strong> ({filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'})</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-3 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none cursor-pointer"
              id="kds-date-filter-input"
            />
          </div>

          <button
            onClick={() => setSelectedDate(getTodayBrasilia())}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              selectedDate === getTodayBrasilia()
                ? 'bg-brand-green text-white border-brand-green shadow-xs font-black'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
            }`}
            title="Marcar Hoje (Horário de Brasília)"
            id="kds-filter-today-btn"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Hoje (Brasília)</span>
          </button>

          <button
            onClick={() => setSelectedDate(getYesterdayBrasilia())}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              selectedDate === getYesterdayBrasilia()
                ? 'bg-brand-green text-white border-brand-green shadow-xs font-black'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
            }`}
            title="Ver pedidos de Ontem"
          >
            <span>Ontem</span>
          </button>

          {selectedDate && (
            <button
              onClick={() => setSelectedDate('')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-slate-200 cursor-pointer"
              title="Limpar filtro e ver todas as datas"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Ver Todos</span>
            </button>
          )}
        </div>
      </div>

      {/* Origem do Pedido Filter (Online vs Balcão) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-brand-green/10 text-brand-green rounded-xl">
            <Filter className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
              <span>Filtro de Origem (Cozinha PDV)</span>
              <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200">
                Padrão: Pedidos Online
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Filtre os pedidos entre <strong>Pedidos Online</strong> ou <strong>Balcão (PDV)</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setOrderSourceFilter('online')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              orderSourceFilter === 'online'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <span>📱 Pedidos Online</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              orderSourceFilter === 'online' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {dateFilteredOrders.filter(o => !o.isPosOrder).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOrderSourceFilter('balcao')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              orderSourceFilter === 'balcao'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <span>🖥️ Balcão / PDV</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              orderSourceFilter === 'balcao' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {dateFilteredOrders.filter(o => Boolean(o.isPosOrder)).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOrderSourceFilter('todos')}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              orderSourceFilter === 'todos'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <span>🌐 Todos</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              orderSourceFilter === 'todos' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {dateFilteredOrders.length}
            </span>
          </button>
        </div>
      </div>

      {/* Quick Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Novos Pedidos</p>
          <h3 className="text-2xl font-black text-brand-yellow-dark mt-1">{pendingOrders.length}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Em Preparação</p>
          <h3 className="text-2xl font-black text-blue-600 mt-1">{preppingOrders.length}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Pronto p/ Retirar</p>
          <h3 className="text-2xl font-black text-brand-green mt-1">{finishedOrders.length}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Concluídos {selectedDate === getTodayBrasilia() ? 'Hoje' : 'no Dia'}</p>
          <h3 className="text-2xl font-black text-slate-700 mt-1">{deliveredOrders.length}</h3>
        </div>
      </div>

      {/* Kitchen Board columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: PENDENTES */}
        <div className="space-y-4">
          <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-brand-yellow/20 text-brand-yellow-dark p-2 rounded-md">
                <BellRing className="h-4 w-4 animate-bounce" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Novos Pedidos</h3>
                <p className="text-[10px] text-slate-500">Aguardando início do preparo</p>
              </div>
            </div>
            <span className="bg-brand-yellow text-brand-green text-xs font-black px-2.5 py-1 rounded-sm">
              {pendingOrders.length}
            </span>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {pendingOrders.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
                Nenhum novo pedido na fila.
              </div>
            ) : (
              pendingOrders.map(order => (
                <div 
                  key={order.id} 
                  className="bg-white border-2 border-brand-yellow/20 rounded-xl p-5 shadow-sm hover:shadow-md transition-all space-y-4 animate-in fade-in"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                        {order.code}
                      </span>
                      <h4 className="font-bold text-gray-800 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{order.customerName}</span>
                        {order.customerPhone && (
                          <span className="text-[11px] font-normal text-slate-500">({order.customerPhone})</span>
                        )}
                      </h4>
                      <div className="flex flex-wrap gap-1.5 items-center mt-1.5">
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm ${
                          order.isPosOrder 
                            ? 'bg-purple-100 text-purple-900 border border-purple-200' 
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}>
                          {order.isPosOrder ? '🖥️ Balcão / PDV' : '📱 Pedido Online'}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm ${
                          order.deliveryType === 'entrega' 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {order.deliveryType === 'entrega' ? '🛵 Entrega' : '🏪 Retirada'}
                        </span>
                        {order.deliveryType === 'entrega' && order.deliveryAddress && (
                          <span className="text-[10px] text-amber-900 font-bold bg-amber-50 px-2 py-0.5 rounded-sm" title={order.deliveryAddress}>
                            Dir: {order.deliveryAddress}
                          </span>
                        )}
                        {order.tableNumber && (
                          <span className="text-[10px] text-indigo-900 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-sm">
                            Comanda: {order.tableNumber}
                          </span>
                        )}
                        {order.cardProvider && (
                          <span className="text-[10px] text-slate-700 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-sm uppercase">
                            Maq: {order.cardProvider} {order.machineModel ? `(${order.machineModel})` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {formatTimeBrasilia(order.createdAt)}
                    </span>
                  </div>

                  {/* Sandwiches in this order */}
                  <div className="space-y-3.5 pt-2">
                    {order.items.map((item, idx) => {
                      const kKey = item.id ? `kitem-${item.id}` : `kitem-${idx}`;
                      if (!item.sandwich) {
                        return (
                          <div key={kKey} className="text-xs bg-amber-50/50 p-3 rounded-xl space-y-1 border border-amber-100">
                            <div className="flex justify-between font-bold text-gray-700">
                              <span className="flex items-center gap-1">🥤 {item.productName || 'Produto'}</span>
                              <span>x{item.quantity}</span>
                            </div>
                            <p className="text-[10px] text-amber-800 font-medium">Produto Pronto para Entrega (Sem Preparo)</p>
                          </div>
                        );
                      }
                      return (
                        <div key={kKey} className="text-xs bg-gray-50 p-3 rounded-xl space-y-2 border border-gray-100">
                          <div className="flex justify-between font-bold text-gray-700">
                            <span>Sanduíche #{idx + 1} ({item.sandwich.size})</span>
                            <span>x{item.quantity}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-1 text-gray-600">
                            <p><strong className="text-gray-700">Pão:</strong> {item.sandwich.bread}</p>
                            <p><strong className="text-gray-700">Recheio:</strong> {item.sandwich.protein}</p>
                            <p><strong className="text-gray-700">Queijo:</strong> {item.sandwich.cheese} {item.sandwich.toasted ? '🔥 (Tostado)' : '❄️ (Frio)'}</p>
                            
                            {item.sandwich.veggies.length > 0 && (
                              <p><strong className="text-gray-700">Vegetais:</strong> {item.sandwich.veggies.join(', ')}</p>
                            )}
                            {item.sandwich.sauces.length > 0 && (
                              <p><strong className="text-gray-700">Molhos:</strong> {item.sandwich.sauces.join(', ')}</p>
                            )}
                            {item.sandwich.extras.length > 0 && (
                              <p><strong className="text-gray-700">Adicionais:</strong> <span className="text-brand-green font-semibold">{item.sandwich.extras.join(', ')}</span></p>
                            )}
                            {item.sandwich.drinksAndCookies.length > 0 && (
                              <p><strong className="text-gray-700">Bebidas/Sobremesa:</strong> <span className="text-brand-green font-semibold">{item.sandwich.drinksAndCookies.join(', ')}</span></p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => printThermalReceipt(order, { isKitchenTicket: true })}
                      title="Imprimir Pedido"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl flex items-center justify-center transition-all text-xs border border-slate-200 cursor-pointer shrink-0"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleUpdate(order.id, 'pendente', order)}
                      className="flex-1 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-green font-black py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-95 shadow-sm border border-brand-yellow cursor-pointer"
                    >
                      <Play className="h-4 w-4" />
                      <span>Iniciar Preparo</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: EM PREPARO */}
        <div className="space-y-4">
          <div className="bg-blue-50/70 border border-blue-200/50 rounded-xl p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 text-blue-800 p-2 rounded-md">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-blue-900 text-sm">Em Preparação</h3>
                <p className="text-[10px] text-blue-700 font-medium">Sendo montados e tostados</p>
              </div>
            </div>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-sm">
              {preppingOrders.length}
            </span>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {preppingOrders.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
                Nenhum sanduíche sendo montado no momento.
              </div>
            ) : (
              preppingOrders.map(order => (
                <div 
                  key={order.id} 
                  className="bg-white border-2 border-blue-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all space-y-4 animate-in fade-in"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                        {order.code}
                      </span>
                      <h4 className="font-bold text-gray-800 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{order.customerName}</span>
                        {order.customerPhone && (
                          <span className="text-[11px] font-normal text-slate-500">({order.customerPhone})</span>
                        )}
                      </h4>
                      <div className="flex flex-wrap gap-1.5 items-center mt-1.5">
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm ${
                          order.isPosOrder 
                            ? 'bg-purple-100 text-purple-900 border border-purple-200' 
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}>
                          {order.isPosOrder ? '🖥️ Balcão / PDV' : '📱 Pedido Online'}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm ${
                          order.deliveryType === 'entrega' 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {order.deliveryType === 'entrega' ? '🛵 Entrega' : '🏪 Retirada'}
                        </span>
                        {order.deliveryType === 'entrega' && order.deliveryAddress && (
                          <span className="text-[10px] text-amber-900 font-bold bg-amber-50 px-2 py-0.5 rounded-sm" title={order.deliveryAddress}>
                            Dir: {order.deliveryAddress}
                          </span>
                        )}
                        {order.tableNumber && (
                          <span className="text-[10px] text-indigo-900 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-sm">
                            Comanda: {order.tableNumber}
                          </span>
                        )}
                        {order.cardProvider && (
                          <span className="text-[10px] text-slate-700 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-sm uppercase">
                            Maq: {order.cardProvider} {order.machineModel ? `(${order.machineModel})` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        <Hourglass className="h-3 w-3 animate-spin text-blue-500" />
                        Preparando...
                      </span>
                      <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {formatTimeBrasilia(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Sandwiches list */}
                  <div className="space-y-3.5 pt-2">
                    {order.items.map((item, idx) => {
                      const kKey = item.id ? `kitem-prep-${item.id}` : `kitem-prep-${idx}`;
                      if (!item.sandwich) {
                        return (
                          <div key={kKey} className="text-xs bg-amber-50/50 p-3 rounded-xl space-y-1 border border-amber-100">
                            <div className="flex justify-between font-bold text-gray-700">
                              <span className="flex items-center gap-1">🥤 {item.productName || 'Produto'}</span>
                              <span>x{item.quantity}</span>
                            </div>
                            <p className="text-[10px] text-amber-800 font-medium">Produto Pronto para Entrega (Sem Preparo)</p>
                          </div>
                        );
                      }
                      return (
                        <div key={kKey} className="text-xs bg-gray-50 p-3 rounded-xl space-y-2 border border-gray-100">
                          <div className="flex justify-between font-bold text-gray-700">
                            <span>Sanduíche #{idx + 1} ({item.sandwich.size})</span>
                            <span>x{item.quantity}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-1 text-gray-600">
                            <p><strong className="text-gray-700">Pão:</strong> {item.sandwich.bread}</p>
                            <p><strong className="text-gray-700">Recheio:</strong> {item.sandwich.protein}</p>
                            <p><strong className="text-gray-700">Queijo:</strong> {item.sandwich.cheese} {item.sandwich.toasted ? '🔥 (Tostado)' : '❄️ (Frio)'}</p>
                            
                            {item.sandwich.veggies.length > 0 && (
                              <p><strong className="text-gray-700">Vegetais:</strong> {item.sandwich.veggies.join(', ')}</p>
                            )}
                            {item.sandwich.sauces.length > 0 && (
                              <p><strong className="text-gray-700">Molhos:</strong> {item.sandwich.sauces.join(', ')}</p>
                            )}
                            {item.sandwich.extras.length > 0 && (
                              <p><strong className="text-gray-700">Adicionais:</strong> <span className="text-brand-green font-semibold">{item.sandwich.extras.join(', ')}</span></p>
                            )}
                            {item.sandwich.drinksAndCookies.length > 0 && (
                              <p><strong className="text-gray-700">Bebidas/Sobremesa:</strong> <span className="text-brand-green font-semibold">{item.sandwich.drinksAndCookies.join(', ')}</span></p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => printThermalReceipt(order, { isKitchenTicket: true })}
                      title="Imprimir Pedido"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl flex items-center justify-center transition-all text-xs border border-slate-200 cursor-pointer shrink-0"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleUpdate(order.id, 'preparo', order)}
                      className="flex-1 bg-brand-green hover:bg-brand-green-dark text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-95 shadow-sm cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      <span>Pronto para Retirada</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: PRONTO PARA RETIRADA */}
        <div className="space-y-4">
          <div className="bg-brand-green/5 border border-brand-green/20 rounded-xl p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-brand-green/10 text-brand-green p-2 rounded-md">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-brand-green text-sm">Pronto para Retirada</h3>
                <p className="text-[10px] text-brand-green/80 font-medium">Aguardando o cliente chamar</p>
              </div>
            </div>
            <span className="bg-brand-green text-white text-xs font-black px-2.5 py-1 rounded-sm">
              {finishedOrders.length}
            </span>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {finishedOrders.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
                Nenhum pedido finalizado aguardando retirada.
              </div>
            ) : (
              finishedOrders.map(order => (
                <div 
                  key={order.id} 
                  className="bg-white border-2 border-brand-green/20 rounded-xl p-5 shadow-sm hover:shadow-md transition-all space-y-4 animate-in fade-in"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                        {order.code}
                      </span>
                      <h4 className="font-bold text-gray-800 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{order.customerName}</span>
                        {order.customerPhone && (
                          <span className="text-[11px] font-normal text-slate-500">({order.customerPhone})</span>
                        )}
                      </h4>
                      <div className="flex flex-wrap gap-1.5 items-center mt-1.5">
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm ${
                          order.isPosOrder 
                            ? 'bg-purple-100 text-purple-900 border border-purple-200' 
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}>
                          {order.isPosOrder ? '🖥️ Balcão / PDV' : '📱 Pedido Online'}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-sm ${
                          order.deliveryType === 'entrega' 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {order.deliveryType === 'entrega' ? '🛵 Entrega' : '🏪 Retirada'}
                        </span>
                        {order.deliveryType === 'entrega' && order.deliveryAddress && (
                          <span className="text-[10px] text-amber-900 font-bold bg-amber-50 px-2 py-0.5 rounded-sm" title={order.deliveryAddress}>
                            Dir: {order.deliveryAddress}
                          </span>
                        )}
                        {order.tableNumber && (
                          <span className="text-[10px] text-indigo-900 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-sm">
                            Comanda: {order.tableNumber}
                          </span>
                        )}
                        {order.cardProvider && (
                          <span className="text-[10px] text-slate-700 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-sm uppercase">
                            Maq: {order.cardProvider} {order.machineModel ? `(${order.machineModel})` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-emerald-600 text-xs font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg">
                        Pronto! 🥡
                      </span>
                      <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {formatTimeBrasilia(order.createdAt)}
                      </span>
                    </div>
                  </div>

                   {/* Sandwiches and details */}
                  <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="font-semibold text-gray-700">Itens do Pedido:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {order.items.map((item, idx) => (
                        <li key={item.id ? `fin-item-${item.id}` : `fin-item-${idx}`} className="text-gray-600">
                          {item.quantity}x {item.sandwich ? `Sanduíche ${item.sandwich.size} (${item.sandwich.protein})` : (item.productName || 'Produto Pronto')}
                        </li>
                      ))}
                    </ul>
                    <p className="pt-2 font-bold text-gray-700">Faturamento: R$ {(Number(order.totalPrice) || 0).toFixed(2)}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => printThermalReceipt(order, { isKitchenTicket: true })}
                      title="Imprimir Pedido"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl flex items-center justify-center transition-all text-xs border border-slate-200 cursor-pointer shrink-0"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleUpdate(order.id, 'finalizado', order)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-95 shadow-sm cursor-pointer"
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>Entregar ao Cliente</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Notification Prompt Modal */}
      {whatsappPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Notificar Cliente via WhatsApp?
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    {whatsappPrompt.type === 'preparo' 
                      ? 'Status alterado para: Em Preparação 🥪' 
                      : whatsappPrompt.type === 'saiu_entrega'
                      ? 'Status alterado para: Saiu para Entrega 🛵'
                      : 'Status alterado para: Pronto para Retirada 🥡'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappPrompt(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Order & Customer Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-brand-green text-white text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                    {whatsappPrompt.order.code}
                  </span>
                  <span className="font-bold text-slate-800 text-sm">
                    {whatsappPrompt.order.customerName}
                  </span>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                  whatsappPrompt.order.deliveryType === 'entrega' 
                    ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                    : 'bg-blue-100 text-blue-900 border border-blue-200'
                }`}>
                  {whatsappPrompt.order.deliveryType === 'entrega' ? '🛵 Entrega' : '🏪 Retirada'}
                </span>
              </div>

              {/* Phone input / confirmation */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-600 uppercase flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Telefone / WhatsApp do Cliente:</span>
                </label>
                <input
                  type="text"
                  value={whatsappPrompt.customerPhone}
                  onChange={(e) => setWhatsappPrompt(prev => prev ? ({ ...prev, customerPhone: e.target.value }) : null)}
                  placeholder="Ex: 5511999999999 ou (11) 99999-9999"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                />
              </div>
            </div>

            {/* Message Preview & Edit */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-600 uppercase flex items-center justify-between">
                <span>Mensagem que será enviada:</span>
                <span className="text-[10px] text-slate-400 font-bold">Editável</span>
              </label>
              <textarea
                rows={3}
                value={whatsappPrompt.messageText}
                onChange={(e) => setWhatsappPrompt(prev => prev ? ({ ...prev, messageText: e.target.value }) : null)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none resize-none font-mono"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setWhatsappPrompt(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer"
              >
                Não Enviar / Fechar
              </button>
              <button
                type="button"
                onClick={handleSendKdsWhatsApp}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl text-xs shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Send className="h-4 w-4" />
                <span>Sim, Enviar WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
