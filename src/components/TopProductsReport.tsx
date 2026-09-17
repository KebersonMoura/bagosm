import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  BarChart2,
  Calendar,
  Clock,
  Filter,
  ShoppingBag,
  DollarSign,
  Truck,
  Store,
  X,
  RefreshCw,
  FileDown,
  Printer,
  Search,
  Award,
  ChevronDown,
  ChevronUp,
  Layers,
  Eye,
  Check,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { TopProductsReportData, TopProductItem, DailyProductSales, HourlyProductSales } from '../types';

interface TopProductsReportProps {
  onBackToSales?: () => void;
}

export const TopProductsReport: React.FC<TopProductsReportProps> = ({ onBackToSales }) => {
  const [data, setData] = useState<TopProductsReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'balcao' | 'delivery'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Chart configuration
  const [chartViewMode, setChartViewMode] = useState<'day' | 'hour'>('day');
  const [chartMetric, setChartMetric] = useState<'quantity' | 'revenue'>('quantity');
  const [visibleLines, setVisibleLines] = useState<{ balcao: boolean; delivery: boolean; total: boolean }>({
    balcao: true,
    delivery: true,
    total: true
  });

  // Table expand states
  const [showDailyTable, setShowDailyTable] = useState<boolean>(false);
  const [showHourlyTable, setShowHourlyTable] = useState<boolean>(false);

  // Quick preset helper
  const applyDatePreset = (preset: 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'all') => {
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const now = new Date();

    if (preset === 'today') {
      const t = formatYMD(now);
      setStartDate(t);
      setEndDate(t);
    } else if (preset === 'yesterday') {
      const yDate = new Date(now);
      yDate.setDate(yDate.getDate() - 1);
      const yStr = formatYMD(yDate);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === '7days') {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 6);
      setStartDate(formatYMD(past7));
      setEndDate(formatYMD(now));
    } else if (preset === '30days') {
      const past30 = new Date(now);
      past30.setDate(past30.getDate() - 29);
      setStartDate(formatYMD(past30));
      setEndDate(formatYMD(now));
    } else if (preset === 'thisMonth') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatYMD(first));
      setEndDate(formatYMD(now));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Fetch report data from API
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedProductId) params.append('productId', selectedProductId);
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedChannel && selectedChannel !== 'all') params.append('channel', selectedChannel);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/reports/top-products?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar relatório do servidor.');
      }
      const json: TopProductsReportData = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Error loading top products report:', err);
      setError(err?.message || 'Erro ao carregar dados do relatório.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedProductId, selectedCategory, selectedChannel, searchQuery]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Selected product object
  const selectedProductObj = useMemo(() => {
    if (!data || selectedProductId === 'all') return null;
    return data.topProducts.find((p) => p.id === selectedProductId) ||
      data.availableProducts.find((p) => p.id === selectedProductId) || null;
  }, [data, selectedProductId]);

  // Transform chart data depending on day vs hour and metric
  const chartData = useMemo(() => {
    if (!data) return [];

    if (chartViewMode === 'day') {
      return data.dailyBreakdown.map((day) => ({
        label: `${day.displayDate} (${day.dayOfWeek})`,
        displayDate: day.displayDate,
        date: day.date,
        balcao: chartMetric === 'quantity' ? day.balcaoQuantity : day.balcaoRevenue,
        delivery: chartMetric === 'quantity' ? day.deliveryQuantity : day.deliveryRevenue,
        total: chartMetric === 'quantity' ? day.totalQuantity : day.totalRevenue,
        rawBalcaoQty: day.balcaoQuantity,
        rawDeliveryQty: day.deliveryQuantity,
        rawBalcaoRev: day.balcaoRevenue,
        rawDeliveryRev: day.deliveryRevenue
      }));
    } else {
      return data.hourlyBreakdown.map((hr) => ({
        label: hr.hourLabel,
        hour: hr.hour,
        timeRange: hr.timeRangeLabel,
        balcao: chartMetric === 'quantity' ? hr.balcaoQuantity : hr.balcaoRevenue,
        delivery: chartMetric === 'quantity' ? hr.deliveryQuantity : hr.deliveryRevenue,
        total: chartMetric === 'quantity' ? hr.totalQuantity : hr.totalRevenue,
        rawBalcaoQty: hr.balcaoQuantity,
        rawDeliveryQty: hr.deliveryQuantity,
        rawBalcaoRev: hr.balcaoRevenue,
        rawDeliveryRev: hr.deliveryRevenue
      }));
    }
  }, [data, chartViewMode, chartMetric]);

  // Category translation helper
  const translateCategory = (cat: string): string => {
    const map: { [k: string]: string } = {
      sandwich: 'Sanduíche',
      salad: 'Salada',
      drink: 'Bebida',
      cookie: 'Sobremesa / Cookie',
      addon: 'Acompanhamento',
      bread: 'Pão Artesanal',
      outro: 'Outros'
    };
    return map[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  // Peak analysis for chart highlight
  const chartInsights = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    let maxPoint = chartData[0];
    let totalBalcao = 0;
    let totalDelivery = 0;

    chartData.forEach((pt) => {
      if (pt.total > maxPoint.total) {
        maxPoint = pt;
      }
      totalBalcao += pt.balcao;
      totalDelivery += pt.delivery;
    });

    const dominantChannel = totalBalcao >= totalDelivery ? 'Balcão' : 'Delivery';
    return {
      peakLabel: maxPoint.label,
      peakValue: maxPoint.total,
      dominantChannel,
      totalBalcao,
      totalDelivery
    };
  }, [chartData]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!data || data.topProducts.length === 0) {
      alert('Nenhum dado disponível para exportação.');
      return;
    }

    const headers = [
      'Posição',
      'Produto',
      'Categoria',
      'Qtd Total',
      'Receita Total (R$)',
      'Preço Médio (R$)',
      'Qtd Balcão',
      'Receita Balcão (R$)',
      'Qtd Delivery',
      'Receita Delivery (R$)',
      '% Qtd Total',
      'Horário de Pico'
    ];

    const rows = data.topProducts.map((p, idx) => [
      idx + 1,
      `"${p.name.replace(/"/g, '""')}"`,
      translateCategory(p.category),
      p.totalQuantity,
      p.totalRevenue.toFixed(2),
      p.averagePrice.toFixed(2),
      p.balcaoQuantity,
      p.balcaoRevenue.toFixed(2),
      p.deliveryQuantity,
      p.deliveryRevenue.toFixed(2),
      `${p.percentageOfQuantity}%`,
      p.peakHourLabel || `${p.peakHour}h`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_produtos_mais_vendidos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pt = payload[0].payload;
      const isQty = chartMetric === 'quantity';
      const unit = isQty ? 'un' : 'R$';
      const balcaoVal = isQty ? `${pt.rawBalcaoQty} un` : `R$ ${pt.rawBalcaoRev.toFixed(2).replace('.', ',')}`;
      const deliveryVal = isQty ? `${pt.rawDeliveryQty} un` : `R$ ${pt.rawDeliveryRev.toFixed(2).replace('.', ',')}`;
      const totalVal = isQty ? `${pt.total} un` : `R$ ${pt.total.toFixed(2).replace('.', ',')}`;

      const totalNum = pt.total || 0;
      const bPct = totalNum > 0 ? ((pt.balcao / totalNum) * 100).toFixed(0) : '0';
      const dPct = totalNum > 0 ? ((pt.delivery / totalNum) * 100).toFixed(0) : '0';

      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl border border-slate-800 text-xs min-w-[200px] z-50">
          <div className="font-extrabold text-slate-200 border-b border-slate-800 pb-1.5 mb-2 flex items-center justify-between">
            <span>{pt.timeRange || pt.label || label}</span>
            {chartViewMode === 'day' && <span className="text-[10px] text-slate-400">{pt.date}</span>}
          </div>

          <div className="space-y-1.5 font-medium">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                Balcão:
              </span>
              <span className="font-bold text-slate-100">
                {balcaoVal} <span className="text-[10px] text-slate-400">({bPct}%)</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-orange-400 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500 inline-block" />
                Delivery:
              </span>
              <span className="font-bold text-slate-100">
                {deliveryVal} <span className="text-[10px] text-slate-400">({dPct}%)</span>
              </span>
            </div>

            <div className="border-t border-slate-800 pt-1.5 mt-1 flex items-center justify-between text-indigo-300 font-black">
              <span>Total Geral:</span>
              <span className="text-white text-sm">{totalVal}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const hasActiveFilters = Boolean(
    startDate || endDate || (selectedProductId && selectedProductId !== 'all') ||
    (selectedCategory && selectedCategory !== 'all') || (selectedChannel && selectedChannel !== 'all') ||
    searchQuery
  );

  return (
    <div className="space-y-6" id="top-products-report-container">
      {/* Top Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-xs">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Relatório de Produtos Mais Vendidos
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium max-w-2xl">
              Análise comparativa detalhada das vendas por produto, por dia da semana e por horário, com distinção exata entre pedidos no <strong className="text-emerald-700">Balcão</strong> e pelo <strong className="text-orange-700">Delivery</strong>.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Exportar dados para planilha Excel / CSV"
            >
              <FileDown className="h-4 w-4 text-emerald-600" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Imprimir relatório"
            >
              <Printer className="h-4 w-4 text-slate-600" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={() => fetchReport()}
              disabled={loading}
              className="px-3.5 py-2 bg-brand-green hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="Atualizar dados agora"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Selected Product Banner Callout */}
        {selectedProductObj && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-200 text-emerald-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                Produto Isolado
              </span>
              <span className="font-bold text-emerald-950">
                Exibindo curva de vendas para: <strong>{selectedProductObj.name}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedProductId('all')}
              className="text-emerald-700 hover:text-emerald-950 font-black flex items-center gap-1 hover:underline cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>Ver Todos os Produtos</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Control Center */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-600" />
            <h3 className="font-extrabold text-slate-800 text-sm">Filtros de Pesquisa & Visualização</h3>
            {hasActiveFilters && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                Filtros Ativos
              </span>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1 text-xs font-bold">
            <span className="text-[10px] uppercase font-black text-slate-400 mr-1">Atalhos:</span>
            <button
              type="button"
              onClick={() => applyDatePreset('today')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('yesterday')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
            >
              Ontem
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('7days')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('30days')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
            >
              Últimos 30 dias
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('thisMonth')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
            >
              Este Mês
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSelectedProductId('all');
                  setSelectedCategory('all');
                  setSelectedChannel('all');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-all cursor-pointer flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Escolher Produto (Explicit user requirement) */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
              <ShoppingBag className="h-3.5 w-3.5 text-emerald-600" />
              Filtrar por Produto
            </label>
            <div className="relative">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                id="filter-top-product-select"
              >
                <option value="all">📦 Todos os Produtos (Visão Consolidada)</option>
                {data?.availableProducts && data.availableProducts.length > 0 ? (
                  data.availableProducts.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({translateCategory(prod.category)})
                    </option>
                  ))
                ) : (
                  <option value="all" disabled>Carregando catálogo...</option>
                )}
              </select>
            </div>
          </div>

          {/* 2. Canal de Venda (Balcão vs Delivery) */}
          <div>
            <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
              <Store className="h-3.5 w-3.5 text-emerald-600" />
              Canal de Venda
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              id="filter-channel-select"
            >
              <option value="all">🌐 Balcão + Delivery</option>
              <option value="balcao">🏬 Apenas Balcão (PDV)</option>
              <option value="delivery">🛵 Apenas Delivery (Entrega)</option>
            </select>
          </div>

          {/* 3. Data Início */}
          <div>
            <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              Data Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 4. Data Fim */}
          <div>
            <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              Data Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Secondary Row: Category & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
              Categoria do Produto
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Todas as Categorias</option>
              {data?.availableCategories && data.availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {translateCategory(cat)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
              <Search className="h-3.5 w-3.5 text-emerald-600" />
              Buscar Nome do Produto
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: Bagô Costela, Coca-Cola, Cookie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Spinner */}
      {loading && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-12 flex justify-center items-center">
          <div className="text-center space-y-2">
            <span className="inline-block h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></span>
            <p className="text-xs text-slate-500 font-bold">Processando dados e gerando gráficos...</p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}

      {/* Main Content when loaded */}
      {!loading && data && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Unidades Vendidas */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  Unidades Vendidas
                </span>
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">
                  {data.summary.totalProductsSold} <span className="text-sm font-bold text-slate-500">itens</span>
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] font-bold">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Store className="h-3 w-3 inline" />
                    {data.summary.balcaoQuantity} un ({data.summary.balcaoQuantityPercentage}%)
                  </span>
                  <span className="text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Truck className="h-3 w-3 inline" />
                    {data.summary.deliveryQuantity} un ({data.summary.deliveryQuantityPercentage}%)
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Faturamento Total */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  Faturamento de Produtos
                </span>
                <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-xl">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-700">
                  R$ {data.summary.totalRevenue.toFixed(2).replace('.', ',')}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] font-bold">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Balcão: R$ {data.summary.balcaoRevenue.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md">
                    Delivery: R$ {data.summary.deliveryRevenue.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Divisão de Canais (Balcão vs Delivery) */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  Proporção Balcão vs Delivery
                </span>
                <div className="bg-sky-50 text-sky-600 p-2.5 rounded-xl">
                  <BarChart2 className="h-5 w-5" />
                </div>
              </div>
              <div>
                {/* Proportional visual bar */}
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex my-2 border border-slate-200">
                  <div
                    className="bg-emerald-600 h-full transition-all"
                    style={{ width: `${data.summary.balcaoQuantityPercentage}%` }}
                    title={`Balcão: ${data.summary.balcaoQuantityPercentage}%`}
                  />
                  <div
                    className="bg-orange-500 h-full transition-all"
                    style={{ width: `${data.summary.deliveryQuantityPercentage}%` }}
                    title={`Delivery: ${data.summary.deliveryQuantityPercentage}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-black">
                  <span className="text-emerald-700 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 inline-block" />
                    Balcão {data.summary.balcaoQuantityPercentage}%
                  </span>
                  <span className="text-orange-600 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
                    Delivery {data.summary.deliveryQuantityPercentage}%
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Top 1 Campeão de Vendas */}
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-50 p-4 sm:p-5 rounded-2xl border border-amber-200 shadow-xs flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-amber-600" />
                  Mais Vendido (Top 1)
                </span>
                <div className="bg-amber-400 text-amber-950 font-black px-2 py-1 rounded-lg text-xs flex items-center gap-1 shadow-xs">
                  🥇 1º Lugar
                </div>
              </div>
              <div>
                <p className="text-base sm:text-lg font-black text-slate-900 truncate" title={data.summary.topSellingProduct?.name}>
                  {data.summary.topSellingProduct?.name || 'Nenhum produto'}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs font-bold text-amber-900">
                  <span>{data.summary.topSellingProduct?.quantity || 0} un vendidas</span>
                  <span>•</span>
                  <span>R$ {(data.summary.topSellingProduct?.revenue || 0).toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico de Linha Principal (Por Dia & Por Hora, Balcão vs Delivery) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4" id="line-chart-section">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-100 text-emerald-800 p-1.5 rounded-lg">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    {chartViewMode === 'day' ? 'Evolução Diária de Vendas' : 'Distribuição Horária (00h às 23h)'}
                    {selectedProductObj && (
                      <span className="text-emerald-700 font-bold ml-1.5 text-xs">
                        — {selectedProductObj.name}
                      </span>
                    )}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {chartViewMode === 'day'
                    ? 'Comparação de desempenho de vendas por dia entre Balcão e Delivery'
                    : 'Curva horária mostrando horários de pico e concentração de pedidos por canal'}
                </p>
              </div>

              {/* View Switches & Toggles */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Mode Switch: Dia vs Hora */}
                <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setChartViewMode('day')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      chartViewMode === 'day'
                        ? 'bg-white text-emerald-800 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Por Dia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartViewMode('hour')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      chartViewMode === 'hour'
                        ? 'bg-white text-emerald-800 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Por Hora</span>
                  </button>
                </div>

                {/* Metric Switch: Qtd vs R$ */}
                <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setChartMetric('quantity')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      chartMetric === 'quantity'
                        ? 'bg-white text-emerald-800 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>Quantidade</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric('revenue')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      chartMetric === 'revenue'
                        ? 'bg-white text-emerald-800 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>Faturamento</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Line Filter Checkboxes */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs">
              <div className="flex flex-wrap items-center gap-4 font-bold">
                <span className="text-[10px] uppercase font-black text-slate-400">Linhas no Gráfico:</span>

                {/* Balcão */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-emerald-700">
                  <input
                    type="checkbox"
                    checked={visibleLines.balcao}
                    onChange={(e) => setVisibleLines(prev => ({ ...prev, balcao: e.target.checked }))}
                    className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
                  <span>Balcão (PDV)</span>
                </label>

                {/* Delivery */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-orange-700">
                  <input
                    type="checkbox"
                    checked={visibleLines.delivery}
                    onChange={(e) => setVisibleLines(prev => ({ ...prev, delivery: e.target.checked }))}
                    className="rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-600 inline-block" />
                  <span>Delivery (Entrega)</span>
                </label>

                {/* Total */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-indigo-700">
                  <input
                    type="checkbox"
                    checked={visibleLines.total}
                    onChange={(e) => setVisibleLines(prev => ({ ...prev, total: e.target.checked }))}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 inline-block" />
                  <span>Total Geral</span>
                </label>
              </div>

              {/* Peak Insight Badge */}
              {chartInsights && (
                <div className="text-[11px] text-slate-600 font-semibold flex items-center gap-1.5">
                  <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold text-[10px]">
                    🔥 Pico: {chartInsights.peakLabel}
                  </span>
                  <span>({chartInsights.peakValue} {chartMetric === 'quantity' ? 'un' : 'R$'})</span>
                </div>
              )}
            </div>

            {/* Recharts Canvas */}
            <div className="h-[360px] w-full pt-2">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                  Nenhum dado encontrado para o período ou filtros selecionados.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 15, right: 25, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey={chartViewMode === 'day' ? 'displayDate' : 'label'}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => chartMetric === 'revenue' ? `R$${v}` : `${v}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(val: string) => {
                        const labels: { [k: string]: string } = {
                          balcao: 'Vendas Balcão',
                          delivery: 'Vendas Delivery',
                          total: 'Total Consolidado'
                        };
                        return <span className="text-xs font-bold text-slate-700">{labels[val] || val}</span>;
                      }}
                    />

                    {/* Linha Balcão: Verde Esmeralda */}
                    {visibleLines.balcao && (
                      <Line
                        type="monotone"
                        dataKey="balcao"
                        name="balcao"
                        stroke="#059669"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: '#059669', stroke: '#ffffff', strokeWidth: 3 }}
                      />
                    )}

                    {/* Linha Delivery: Laranja Vibrante */}
                    {visibleLines.delivery && (
                      <Line
                        type="monotone"
                        dataKey="delivery"
                        name="delivery"
                        stroke="#ea580c"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#ea580c', stroke: '#ffffff', strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: '#ea580c', stroke: '#ffffff', strokeWidth: 3 }}
                      />
                    )}

                    {/* Linha Total: Índigo pontilhada */}
                    {visibleLines.total && (
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="total"
                        stroke="#4f46e5"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 3, fill: '#4f46e5' }}
                        activeDot={{ r: 6, fill: '#4f46e5' }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Ranking dos Produtos Mais Vendidos */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  Ranking dos Produtos Mais Vendidos
                  <span className="text-xs font-bold text-slate-500">
                    ({data.topProducts.length} produtos encontrados)
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Clique em <strong className="text-emerald-700">"Filtrar no Gráfico"</strong> para isolar a curva diária e horária de qualquer produto.
                </p>
              </div>

              {selectedProductId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedProductId('all')}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Limpar Seleção do Produto</span>
                </button>
              )}
            </div>

            {/* Products Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-3 px-3 text-center w-12">#</th>
                    <th className="py-3 px-3">Produto</th>
                    <th className="py-3 px-3">Categoria</th>
                    <th className="py-3 px-3 text-right">Qtd Total</th>
                    <th className="py-3 px-3 text-right">Faturamento</th>
                    <th className="py-3 px-3 text-center">Balcão vs Delivery</th>
                    <th className="py-3 px-3 text-center">Pico</th>
                    <th className="py-3 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {data.topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Nenhum produto vendido com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    data.topProducts.map((prod, idx) => {
                      const isSelected = selectedProductId === prod.id;
                      const balcaoPct = prod.totalQuantity > 0 ? ((prod.balcaoQuantity / prod.totalQuantity) * 100).toFixed(0) : '0';
                      const deliveryPct = prod.totalQuantity > 0 ? ((prod.deliveryQuantity / prod.totalQuantity) * 100).toFixed(0) : '0';

                      return (
                        <tr
                          key={prod.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? 'bg-emerald-50/60 font-bold' : ''
                          }`}
                        >
                          {/* Rank badge */}
                          <td className="py-3 px-3 text-center">
                            {idx === 0 ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-400 text-amber-950 font-black text-xs shadow-xs">
                                1
                              </span>
                            ) : idx === 1 ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-300 text-slate-800 font-black text-xs shadow-xs">
                                2
                              </span>
                            ) : idx === 2 ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-600 text-white font-black text-xs shadow-xs">
                                3
                              </span>
                            ) : (
                              <span className="text-slate-500 font-bold">{idx + 1}º</span>
                            )}
                          </td>

                          {/* Product name and image */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              {prod.image ? (
                                <img
                                  src={prod.image}
                                  alt={prod.name}
                                  className="h-8 w-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                  <ShoppingBag className="h-4 w-4" />
                                </div>
                              )}
                              <div>
                                <p className="font-black text-slate-900 leading-snug">{prod.name}</p>
                                <p className="text-[10px] text-slate-400">
                                  Preço Médio: R$ {prod.averagePrice.toFixed(2).replace('.', ',')} • {prod.ordersCount} pedidos
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3 px-3">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold">
                              {translateCategory(prod.category)}
                            </span>
                          </td>

                          {/* Qtd Total */}
                          <td className="py-3 px-3 text-right">
                            <span className="font-black text-slate-900 text-sm">{prod.totalQuantity}</span>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {prod.percentageOfQuantity}% do total
                            </span>
                          </td>

                          {/* Faturamento */}
                          <td className="py-3 px-3 text-right">
                            <span className="font-black text-emerald-700 text-sm">
                              R$ {prod.totalRevenue.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {prod.percentageOfRevenue}% da receita
                            </span>
                          </td>

                          {/* Balcão vs Delivery Split Bar */}
                          <td className="py-3 px-3 text-center">
                            <div className="inline-block w-36">
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex border border-slate-200">
                                <div
                                  className="bg-emerald-600 h-full"
                                  style={{ width: `${balcaoPct}%` }}
                                  title={`Balcão: ${prod.balcaoQuantity} un (${balcaoPct}%)`}
                                />
                                <div
                                  className="bg-orange-500 h-full"
                                  style={{ width: `${deliveryPct}%` }}
                                  title={`Delivery: ${prod.deliveryQuantity} un (${deliveryPct}%)`}
                                />
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold mt-1 text-slate-500">
                                <span className="text-emerald-700">{prod.balcaoQuantity} un ({balcaoPct}%)</span>
                                <span className="text-orange-600">{prod.deliveryQuantity} un ({deliveryPct}%)</span>
                              </div>
                            </div>
                          </td>

                          {/* Peak Hour */}
                          <td className="py-3 px-3 text-center">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3 text-slate-500" />
                              {prod.peakHourLabel || `${prod.peakHour}h`}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProductId(isSelected ? 'all' : prod.id);
                                const chartEl = document.getElementById('line-chart-section');
                                if (chartEl) {
                                  chartEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 mx-auto cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                                  : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800'
                              }`}
                              title="Ver a linha deste produto no gráfico acima"
                            >
                              {isSelected ? (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Filtrado</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Filtrar</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Day-by-Day Table (Accordion) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDailyTable(!showDailyTable)}
              className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="h-5 w-5 text-emerald-600" />
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Detalhamento Dia a Dia
                    {selectedProductObj && (
                      <span className="text-emerald-700 font-bold text-xs ml-1">
                        ({selectedProductObj.name})
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    Tabela com totais de unidades e faturamento diários, separando Balcão e Delivery
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>{showDailyTable ? 'Ocultar' : 'Visualizar Tabela'}</span>
                {showDailyTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {showDailyTable && (
              <div className="p-5 border-t border-slate-100 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Dia da Semana</th>
                      <th className="py-2.5 px-3 text-right">Qtd Balcão</th>
                      <th className="py-2.5 px-3 text-right">Qtd Delivery</th>
                      <th className="py-2.5 px-3 text-right">Total Unidades</th>
                      <th className="py-2.5 px-3 text-right">Receita Balcão</th>
                      <th className="py-2.5 px-3 text-right">Receita Delivery</th>
                      <th className="py-2.5 px-3 text-right">Faturamento Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {data.dailyBreakdown.map((day) => (
                      <tr key={day.date} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{day.displayDate}</td>
                        <td className="py-2.5 px-3 text-slate-500">{day.dayOfWeek}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">{day.balcaoQuantity} un</td>
                        <td className="py-2.5 px-3 text-right text-orange-600 font-bold">{day.deliveryQuantity} un</td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">{day.totalQuantity} un</td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">
                          R$ {day.balcaoRevenue.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-orange-600 font-bold">
                          R$ {day.deliveryRevenue.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          R$ {day.totalRevenue.toFixed(2).replace('.', ',')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detailed Hour-by-Hour Table (Accordion) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHourlyTable(!showHourlyTable)}
              className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-emerald-600" />
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Detalhamento Hora a Hora (00h às 23h)
                    {selectedProductObj && (
                      <span className="text-emerald-700 font-bold text-xs ml-1">
                        ({selectedProductObj.name})
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    Concentração de vendas em cada faixa de horário do dia
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>{showHourlyTable ? 'Ocultar' : 'Visualizar Tabela'}</span>
                {showHourlyTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {showHourlyTable && (
              <div className="p-5 border-t border-slate-100 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3">Faixa Horária</th>
                      <th className="py-2.5 px-3 text-right">Qtd Balcão</th>
                      <th className="py-2.5 px-3 text-right">Qtd Delivery</th>
                      <th className="py-2.5 px-3 text-right">Total Unidades</th>
                      <th className="py-2.5 px-3 text-right">Receita Balcão</th>
                      <th className="py-2.5 px-3 text-right">Receita Delivery</th>
                      <th className="py-2.5 px-3 text-right">Faturamento Total</th>
                      <th className="py-2.5 px-3 text-center">Nível de Movimento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {data.hourlyBreakdown.map((hr) => {
                      const isPeak = hr.totalQuantity > 0 && chartInsights && hr.totalQuantity === chartInsights.peakValue;
                      return (
                        <tr key={hr.hour} className={`hover:bg-slate-50 ${isPeak ? 'bg-amber-50/50' : ''}`}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{hr.timeRangeLabel}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">{hr.balcaoQuantity} un</td>
                          <td className="py-2.5 px-3 text-right text-orange-600 font-bold">{hr.deliveryQuantity} un</td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">{hr.totalQuantity} un</td>
                          <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">
                            R$ {hr.balcaoRevenue.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="py-2.5 px-3 text-right text-orange-600 font-bold">
                            R$ {hr.deliveryRevenue.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            R$ {hr.totalRevenue.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {hr.totalQuantity === 0 ? (
                              <span className="text-slate-400 text-[10px]">—</span>
                            ) : isPeak ? (
                              <span className="bg-amber-100 text-amber-800 font-black text-[10px] px-2 py-0.5 rounded-full border border-amber-200">
                                🔥 Horário de Pico
                              </span>
                            ) : hr.totalQuantity >= 5 ? (
                              <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full">
                                Alto Movimento
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">
                                Movimento Normal
                              </span>
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
        </>
      )}
    </div>
  );
};
