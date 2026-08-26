import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Receipt, 
  Search, 
  Calendar, 
  RefreshCw, 
  Printer, 
  FileText, 
  Eye, 
  DollarSign, 
  TrendingUp, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Wallet, 
  CreditCard, 
  Clock, 
  User as UserIcon, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ChevronRight,
  Filter,
  ShoppingBag,
  Truck,
  Layers,
  Store
} from 'lucide-react';
import { CashRegisterSession, Order, User } from '../types';
import { formatDateBrasilia, formatTimeBrasilia, formatDateTimeBrasilia } from '../utils/dateUtils';
import { 
  getCashSessionMetrics, 
  printThermalClosingReport, 
  printPdfClosingReport, 
  formatMachineName 
} from '../utils/printCashRegisterReport';

interface ClosedCashRegistersPanelProps {
  user: User;
}

export const ClosedCashRegistersPanel: React.FC<ClosedCashRegistersPanelProps> = ({ user }) => {
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickDateFilter, setQuickDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('all');
  const [selectedSession, setSelectedSession] = useState<CashRegisterSession | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const fetchClosedSessions = useCallback(async () => {
    setLoading(true);
    try {
      const [cashRes, ordersRes] = await Promise.all([
        fetch('/api/cash-register/history'),
        fetch('/api/orders')
      ]);

      if (cashRes.ok) {
        const data = await cashRes.json();
        let list: CashRegisterSession[] = [];
        if (data.history && Array.isArray(data.history)) {
          list = data.history;
        } else if (Array.isArray(data)) {
          list = data;
        }
        // Keep only closed sessions, sorted newest first
        const closedOnly = list
          .filter(s => s.status === 'closed')
          .sort((a, b) => {
            const timeA = a.closedAt ? new Date(a.closedAt).getTime() : new Date(a.openedAt).getTime();
            const timeB = b.closedAt ? new Date(b.closedAt).getTime() : new Date(b.openedAt).getTime();
            return timeB - timeA;
          });
        setSessions(closedOnly);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        if (Array.isArray(ordersData)) {
          setOrders(ordersData);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar caixas fechados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClosedSessions();
  }, [fetchClosedSessions]);

  // Quick Date Filter Handlers
  const handleQuickFilter = (type: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    setQuickDateFilter(type);
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    if (type === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (type === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === 'yesterday') {
      const prev = new Date(now);
      prev.setDate(prev.getDate() - 1);
      const prevStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
      setStartDate(prevStr);
      setEndDate(prevStr);
    } else if (type === 'week') {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 6);
      const past7Str = `${past7.getFullYear()}-${String(past7.getMonth() + 1).padStart(2, '0')}-${String(past7.getDate()).padStart(2, '0')}`;
      setStartDate(past7Str);
      setEndDate(todayStr);
    } else if (type === 'month') {
      const monthStartStr = `${y}-${m}-01`;
      setStartDate(monthStartStr);
      setEndDate(todayStr);
    }
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // 1. Text Search (ID, Op Abertura, Op Fechamento, Notas)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const idMatch = session.id.toLowerCase().includes(query);
        const opOpenMatch = (session.openedBy || '').toLowerCase().includes(query);
        const opCloseMatch = (session.closedBy || '').toLowerCase().includes(query);
        const notesMatch = (session.notes || '').toLowerCase().includes(query);
        if (!idMatch && !opOpenMatch && !opCloseMatch && !notesMatch) {
          return false;
        }
      }

      // 2. Date Filtering
      const sessionDateStr = session.closedAt ? session.closedAt.substring(0, 10) : session.openedAt.substring(0, 10);
      if (startDate && sessionDateStr < startDate) return false;
      if (endDate && sessionDateStr > endDate) return false;

      return true;
    });
  }, [sessions, searchTerm, startDate, endDate]);

  // Aggregate Metrics over the filtered list
  const aggregateMetrics = useMemo(() => {
    let totalTurnover = 0;
    let totalInitial = 0;
    let totalCashSales = 0;
    let totalCardSales = 0;
    let totalPixSales = 0;
    let totalSangrias = 0;
    let totalSuprimentos = 0;
    let totalCashDifference = 0;
    let totalOrdersCount = 0;

    filteredSessions.forEach(s => {
      const m = getCashSessionMetrics(s, orders);
      totalTurnover += m.totalTurnover;
      totalInitial += m.initial;
      totalCashSales += m.cashSales;
      totalCardSales += (m.debitoSales + m.creditoSales + m.vrSales);
      totalPixSales += m.pixSales;
      totalSangrias += m.sangrias;
      totalSuprimentos += m.suprimentos;
      totalCashDifference += m.cashDifference;
      totalOrdersCount += m.totalOrdersCount;
    });

    return {
      count: filteredSessions.length,
      totalTurnover,
      totalInitial,
      totalCashSales,
      totalCardSales,
      totalPixSales,
      totalSangrias,
      totalSuprimentos,
      totalCashDifference,
      totalOrdersCount
    };
  }, [filteredSessions, orders]);

  return (
    <div className="space-y-6" id="closed-cash-registers-panel">
      {/* Header & Filter Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl border border-emerald-200">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-800">
                  Histórico de Caixas Fechados
                </h2>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {filteredSessions.length} {filteredSessions.length === 1 ? 'Turno' : 'Turnos'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Consulte todos os turnos de caixa encerrados, extrato de valores, conferência da gaveta, quebras e reimprima comprovantes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabela
              </button>
            </div>

            <button
              type="button"
              onClick={fetchClosedSessions}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Atualizar lista de caixas"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Quick Date Filters & Search */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          {/* Quick Buttons */}
          <div className="md:col-span-6 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Período:
            </span>
            {[
              { id: 'all', label: 'Todos' },
              { id: 'today', label: 'Hoje' },
              { id: 'yesterday', label: 'Ontem' },
              { id: 'week', label: 'Últimos 7 dias' },
              { id: 'month', label: 'Mês Atual' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleQuickFilter(tab.id as any)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  quickDateFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div className="md:col-span-3 flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setQuickDateFilter('all'); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              title="Data inicial"
            />
            <span className="text-slate-400 font-bold text-xs">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setQuickDateFilter('all'); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              title="Data final"
            />
          </div>

          {/* Search Input */}
          <div className="md:col-span-3 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar operador, ID ou obs..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Faturamento Total</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            R$ {aggregateMetrics.totalTurnover.toFixed(2).replace('.', ',')}
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">
            {aggregateMetrics.totalOrdersCount} pedidos no período
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Dinheiro Total</span>
            <Wallet className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            R$ {aggregateMetrics.totalCashSales.toFixed(2).replace('.', ',')}
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">
            Fundo inicial: R$ {aggregateMetrics.totalInitial.toFixed(2).replace('.', ',')}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cartões (Déb/Créd)</span>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            R$ {aggregateMetrics.totalCardSales.toFixed(2).replace('.', ',')}
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">
            Débito, Crédito e VR
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">PIX Total</span>
            <TrendingUp className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            R$ {aggregateMetrics.totalPixSales.toFixed(2).replace('.', ',')}
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">
            Transferências instantâneas
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Sangrias / Suprim.</span>
            <ArrowDownLeft className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-xs sm:text-sm font-black text-slate-900">
            <span className="text-rose-600">-R$ {aggregateMetrics.totalSangrias.toFixed(2).replace('.', ',')}</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
            +R$ {aggregateMetrics.totalSuprimentos.toFixed(2).replace('.', ',')} suprimentos
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Quebra / Dif. Caixa</span>
            <AlertTriangle className={`h-4 w-4 ${aggregateMetrics.totalCashDifference < 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
          </div>
          <div className={`text-base sm:text-lg font-black ${
            aggregateMetrics.totalCashDifference < 0 
              ? 'text-rose-600' 
              : (aggregateMetrics.totalCashDifference > 0 ? 'text-blue-600' : 'text-emerald-600')
          }`}>
            {aggregateMetrics.totalCashDifference > 0 ? '+' : ''}R$ {aggregateMetrics.totalCashDifference.toFixed(2).replace('.', ',')}
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">
            {aggregateMetrics.totalCashDifference === 0 ? 'Sem divergência' : (aggregateMetrics.totalCashDifference < 0 ? 'Falta na gaveta' : 'Sobra na gaveta')}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">Carregando histórico de caixas fechados...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
          <Receipt className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">Nenhum caixa fechado encontrado</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {sessions.length === 0 
              ? 'Nenhum turno de caixa foi finalizado ainda. Quando os operadores fecharem o caixa no PDV/Balcão, os relatórios completos aparecerão aqui.' 
              : 'Nenhum caixa corresponde aos filtros selecionados. Tente ajustar as datas ou o termo de busca.'}
          </p>
          {(startDate || endDate || searchTerm || quickDateFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
                setQuickDateFilter('all');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <X className="h-3.5 w-3.5" /> Limpar Filtros
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSessions.map(session => {
            const m = getCashSessionMetrics(session, orders);
            const openedDate = session.openedAt ? formatDateTimeBrasilia(session.openedAt) : '-';
            const closedDate = session.closedAt ? formatDateTimeBrasilia(session.closedAt) : '-';

            return (
              <div 
                key={session.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
              >
                {/* Card Top: ID, Status, and Date */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        #{session.id}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Fechado
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{closedDate}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-500">Faturamento</div>
                    <div className="text-lg font-black text-emerald-700">
                      R$ {m.totalTurnover.toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                </div>

                {/* Turn Details: Operators & Breakdown */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-bold text-slate-700">{session.closedBy || session.openedBy || 'Operador'}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold">
                      Abertura: {openedDate.split(' ')[1] || '-'}
                    </span>
                  </div>

                  {/* Financial Breakdown Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Balcão / PDV</div>
                      <div className="font-black text-slate-800">
                        R$ {m.counterSalesTotal.toFixed(2).replace('.', ',')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">{m.counterSalesCount} pedidos</div>
                    </div>

                    <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Delivery</div>
                      <div className="font-black text-slate-800">
                        R$ {m.deliverySalesTotal.toFixed(2).replace('.', ',')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">{m.deliverySalesCount} pedidos</div>
                    </div>
                  </div>

                  {/* Payment Methods Chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {m.cashSales > 0 && (
                      <span className="bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        💵 Dinheiro: R$ {m.cashSales.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                    {m.pixSales > 0 && (
                      <span className="bg-teal-50 border border-teal-200 text-teal-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        ⚡ PIX: R$ {m.pixSales.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                    {m.debitoSales > 0 && (
                      <span className="bg-blue-50 border border-blue-200 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        💳 Déb: R$ {m.debitoSales.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                    {m.creditoSales > 0 && (
                      <span className="bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        💳 Créd: R$ {m.creditoSales.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                    {m.vrSales > 0 && (
                      <span className="bg-purple-50 border border-purple-200 text-purple-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        🍽️ VR: R$ {m.vrSales.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </div>

                  {/* Cash Drawer Reconciliation */}
                  <div className="border-t border-dashed border-slate-200 pt-2 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Fundo Inicial:</span>
                      <span className="font-bold text-slate-700">R$ {m.initial.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Gaveta Contada:</span>
                      <span className="font-bold text-slate-800">R$ {m.actualCashInDrawer.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-600">Diferença / Quebra:</span>
                      <span className={m.cashDifference < 0 ? 'text-rose-600 font-black' : (m.cashDifference > 0 ? 'text-blue-600 font-black' : 'text-emerald-600')}>
                        {m.cashDifference > 0 ? '+' : ''}R$ {m.cashDifference.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>

                  {session.notes && (
                    <div className="bg-amber-50/70 border border-amber-200/70 text-amber-900 text-[11px] p-2 rounded-xl italic">
                      <strong>Obs:</strong> {session.notes}
                    </div>
                  )}
                </div>

                {/* Card Actions: Print & View Details */}
                <div className="border-t border-slate-100 pt-3 flex items-center gap-1.5 justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedSession(session)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Ver raio-x completo do caixa"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Detalhes</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => printThermalClosingReport(session, orders)}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      title="Imprimir Cupom Térmico (80mm)"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Térmica</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => printPdfClosingReport(session, orders)}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      title="Imprimir / Salvar Relatório A4 (PDF)"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>A4/PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Turno / ID</th>
                  <th className="py-3.5 px-4">Abertura & Fechamento</th>
                  <th className="py-3.5 px-4">Operador</th>
                  <th className="py-3.5 px-4 text-right">Fundo Inicial</th>
                  <th className="py-3.5 px-4 text-right">Balcão</th>
                  <th className="py-3.5 px-4 text-right">Delivery</th>
                  <th className="py-3.5 px-4 text-right">Faturamento</th>
                  <th className="py-3.5 px-4 text-right">Gaveta Contada</th>
                  <th className="py-3.5 px-4 text-right">Diferença</th>
                  <th className="py-3.5 px-4 text-center">Ações / Impressão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map(session => {
                  const m = getCashSessionMetrics(session, orders);
                  const openedDate = session.openedAt ? formatDateTimeBrasilia(session.openedAt) : '-';
                  const closedDate = session.closedAt ? formatDateTimeBrasilia(session.closedAt) : '-';

                  return (
                    <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        #{session.id}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div className="font-bold text-slate-800">{closedDate}</div>
                        <div className="text-[10px] text-slate-400">Aberto: {openedDate}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {session.closedBy || session.openedBy || 'Operador'}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        R$ {m.initial.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-800 font-semibold">
                        R$ {m.counterSalesTotal.toFixed(2).replace('.', ',')}
                        <span className="block text-[10px] text-slate-400 font-normal">({m.counterSalesCount} ped)</span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-800 font-semibold">
                        R$ {m.deliverySalesTotal.toFixed(2).replace('.', ',')}
                        <span className="block text-[10px] text-slate-400 font-normal">({m.deliverySalesCount} ped)</span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                        R$ {m.totalTurnover.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        R$ {m.actualCashInDrawer.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        <span className={m.cashDifference < 0 ? 'text-rose-600 font-black' : (m.cashDifference > 0 ? 'text-blue-600 font-black' : 'text-emerald-600')}>
                          {m.cashDifference > 0 ? '+' : ''}R$ {m.cashDifference.toFixed(2).replace('.', ',')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSession(session)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Ver detalhes"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => printThermalClosingReport(session, orders)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                            title="Imprimir Térmica"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => printPdfClosingReport(session, orders)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                            title="Imprimir A4 / PDF"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                    Extrato Completo do Caixa
                    <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 text-emerald-400">
                      #{selectedSession.id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    Aberto em {formatDateTimeBrasilia(selectedSession.openedAt)} &bull; Fechado em {formatDateTimeBrasilia(selectedSession.closedAt || new Date())}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printThermalClosingReport(selectedSession, orders)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  title="Imprimir Cupom Térmico"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Imprimir Térmica</span>
                </button>

                <button
                  type="button"
                  onClick={() => printPdfClosingReport(selectedSession, orders)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  title="Imprimir Relatório A4 / PDF"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Relatório A4</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {(() => {
                const m = getCashSessionMetrics(selectedSession, orders);

                return (
                  <>
                    {/* Top Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-2xl">
                        <div className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Faturamento Total</div>
                        <div className="text-lg font-black text-emerald-900 mt-0.5">
                          R$ {m.totalTurnover.toFixed(2).replace('.', ',')}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                          {m.totalOrdersCount} pedidos
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Fundo Inicial</div>
                        <div className="text-lg font-black text-slate-900 mt-0.5">
                          R$ {m.initial.toFixed(2).replace('.', ',')}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          Op: {selectedSession.openedBy || 'Operador'}
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Gaveta Contada</div>
                        <div className="text-lg font-black text-slate-900 mt-0.5">
                          R$ {m.actualCashInDrawer.toFixed(2).replace('.', ',')}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          Esperado: R$ {m.expectedCashInDrawer.toFixed(2).replace('.', ',')}
                        </div>
                      </div>

                      <div className={`p-3.5 rounded-2xl border ${
                        m.cashDifference < 0 
                          ? 'bg-rose-50 border-rose-200 text-rose-900' 
                          : (m.cashDifference > 0 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900')
                      }`}>
                        <div className="text-[10px] font-black uppercase tracking-wider">Diferença / Quebra</div>
                        <div className="text-lg font-black mt-0.5">
                          {m.cashDifference > 0 ? '+' : ''}R$ {m.cashDifference.toFixed(2).replace('.', ',')}
                        </div>
                        <div className="text-[10px] font-bold mt-0.5">
                          {m.cashDifference === 0 ? 'Conferência exata' : (m.cashDifference < 0 ? 'Falta no caixa' : 'Sobra no caixa')}
                        </div>
                      </div>
                    </div>

                    {/* Channel & Payment Methods Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Channels */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <ShoppingBag className="h-4 w-4 text-slate-500" />
                          <span>Vendas por Canal</span>
                        </h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200">
                            <div>
                              <span className="font-bold text-slate-800">Balcão / Presencial</span>
                              <span className="block text-[10px] text-slate-400 font-medium">{m.counterSalesCount} pedidos</span>
                            </div>
                            <span className="font-black text-slate-900">R$ {m.counterSalesTotal.toFixed(2).replace('.', ',')}</span>
                          </div>

                          <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200">
                            <div>
                              <span className="font-bold text-slate-800">Delivery / Entregas</span>
                              <span className="block text-[10px] text-slate-400 font-medium">{m.deliverySalesCount} pedidos</span>
                            </div>
                            <span className="font-black text-slate-900">R$ {m.deliverySalesTotal.toFixed(2).replace('.', ',')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Payment Methods */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard className="h-4 w-4 text-slate-500" />
                          <span>Formas de Pagamento</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Dinheiro</span>
                            <div className="font-black text-slate-900">R$ {m.cashSales.toFixed(2).replace('.', ',')}</div>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">PIX</span>
                            <div className="font-black text-slate-900">R$ {m.pixSales.toFixed(2).replace('.', ',')}</div>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Cartão Débito</span>
                            <div className="font-black text-slate-900">R$ {m.debitoSales.toFixed(2).replace('.', ',')}</div>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Cartão Crédito</span>
                            <div className="font-black text-slate-900">R$ {m.creditoSales.toFixed(2).replace('.', ',')}</div>
                          </div>
                          {m.vrSales > 0 && (
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 col-span-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Vale Refeição (VR)</span>
                              <div className="font-black text-slate-900">R$ {m.vrSales.toFixed(2).replace('.', ',')}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Maquininhas Breakdown if any */}
                    {Object.keys(m.machineTotals).length > 0 && (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                        <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">
                          Maquininhas & Operadoras de Cartão
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(m.machineTotals).map(([mach, val]) => (
                            <div key={mach} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                              <span className="text-[10px] font-bold text-slate-500 block truncate">{mach}</span>
                              <span className="font-black text-slate-900">R$ {val.toFixed(2).replace('.', ',')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full Transactions Audit Table */}
                    <div className="space-y-2">
                      <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Extrato Detalhado de Transações</span>
                        <span className="text-[10px] text-slate-400 font-bold">{(selectedSession.transactions || []).length} movimentações</span>
                      </h4>

                      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="max-h-72 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="sticky top-0 bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                              <tr>
                                <th className="py-2.5 px-3">Hora</th>
                                <th className="py-2.5 px-3">Tipo</th>
                                <th className="py-2.5 px-3">Origem</th>
                                <th className="py-2.5 px-3">Descrição / Pedido</th>
                                <th className="py-2.5 px-3">Forma Pgto</th>
                                <th className="py-2.5 px-3 text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(selectedSession.transactions || []).map(tx => {
                                const time = tx.timestamp ? formatTimeBrasilia(tx.timestamp) : '-';
                                const isSangria = tx.type === 'sangria';
                                const mStr = formatMachineName(tx.cardProvider, tx.machineModel);

                                return (
                                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{time}</td>
                                    <td className="py-2 px-3">
                                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                        tx.type === 'sale' 
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                          : (tx.type === 'opening' 
                                              ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                                              : (tx.type === 'suprimento' 
                                                  ? 'bg-teal-50 text-teal-800 border border-teal-200' 
                                                  : 'bg-rose-50 text-rose-800 border border-rose-200'))
                                      }`}>
                                        {tx.type === 'opening' ? 'Abertura' : (tx.type === 'sale' ? 'Venda' : (tx.type === 'suprimento' ? 'Suprimento' : 'Sangria'))}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-slate-600 font-medium">
                                      {tx.channel === 'delivery' || tx.deliveryType === 'entrega' ? 'Delivery' : (tx.type === 'sale' ? 'Balcão' : 'Caixa')}
                                    </td>
                                    <td className="py-2 px-3 font-semibold text-slate-800">
                                      {tx.description || tx.orderCode || '-'}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600 text-[11px]">
                                      {tx.paymentMethod ? tx.paymentMethod.toUpperCase() : '-'}
                                      {mStr && <span className="text-[10px] text-slate-400 block truncate">[{mStr}]</span>}
                                      {((tx.channel === 'delivery' || tx.deliveryType === 'entrega') && tx.deliveryFee && tx.deliveryFee > 0) ? (
                                        <span className="text-[10px] text-amber-700 font-bold block">Frete: R$ {Number(tx.deliveryFee).toFixed(2).replace('.', ',')}</span>
                                      ) : null}
                                    </td>
                                    <td className={`py-2 px-3 text-right font-black ${isSangria ? 'text-rose-600' : 'text-slate-900'}`}>
                                      {isSangria ? '-' : ''}R$ {(Number(tx.amount) || 0).toFixed(2).replace('.', ',')}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {selectedSession.notes && (
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                        <span className="font-bold text-slate-700 block mb-0.5">Observações do Fechamento:</span>
                        <p className="text-slate-600 italic">{selectedSession.notes}</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
