import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Award,
  Gift,
  Plus,
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  Phone,
  MessageCircle,
  Trash2,
  Edit,
  X,
  AlertTriangle,
  Check,
  RotateCcw,
  LayoutGrid,
  Table as TableIcon,
  ShoppingBag,
  UserCheck,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { LoyaltyCard } from '../types';
import { formatDateBrasilia, formatDateTimeBrasilia } from '../utils/dateUtils';

export function LoyaltyManagementPanel() {
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready_to_claim' | 'claimed' | 'in_progress'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modal State - Create / Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<LoyaltyCard | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [consumptionCount, setConsumptionCount] = useState<number>(0);
  const [targetCount, setTargetCount] = useState<number>(10);
  const [rewardClaimed, setRewardClaimed] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal State - Claim Reward
  const [isClaimModalOpen, setIsClaimModalOpen] = useState<boolean>(false);
  const [cardToClaim, setCardToClaim] = useState<LoyaltyCard | null>(null);
  const [claimNotes, setClaimNotes] = useState<string>('');
  const [startNewCycleOnClaim, setStartNewCycleOnClaim] = useState<boolean>(false);
  const [claiming, setClaiming] = useState<boolean>(false);

  // Modal State - Delete Confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [cardToDelete, setCardToDelete] = useState<LoyaltyCard | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Notification / Alert Banner
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => {
      setActionMessage(null);
    }, 4500);
  };

  // Fetch Loyalty Cards
  const fetchCards = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/loyalty-cards?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        setCards(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Erro ao buscar cartões fidelidade:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();

    // Listen for SSE events if active
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'LOYALTY_REFRESH' && Array.isArray(parsed.data)) {
            setCards(parsed.data);
          }
        } catch {
          // Ignore parse errors on ping
        }
      };
    } catch {
      // EventSource fallback
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [fetchCards]);

  // Format phone number
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingCard(null);
    setCustomerName('');
    setCustomerPhone('');
    setConsumptionCount(0);
    setTargetCount(10);
    setRewardClaimed(false);
    setNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (card: LoyaltyCard) => {
    setEditingCard(card);
    setCustomerName(card.customerName);
    setCustomerPhone(card.phone);
    setConsumptionCount(card.consumptionCount);
    setTargetCount(card.targetCount || 10);
    setRewardClaimed(card.rewardClaimed);
    setNotes(card.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save Card (Create or Edit)
  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setFormError('Por favor, informe o nome completo do cliente.');
      return;
    }
    if (!customerPhone.trim()) {
      setFormError('Por favor, informe o telefone do cliente.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload: Partial<LoyaltyCard> = {
        id: editingCard?.id,
        customerName: customerName.trim(),
        phone: customerPhone.trim(),
        consumptionCount: Number(consumptionCount) || 0,
        targetCount: Number(targetCount) || 10,
        rewardClaimed: Boolean(rewardClaimed),
        notes: notes.trim() || undefined
      };

      const res = await fetch('/api/loyalty-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar cartão fidelidade no banco de dados.');
      }

      const result = await res.json();
      setIsModalOpen(false);
      showNotification(
        editingCard
          ? `Cartão de ${payload.customerName} atualizado com sucesso!`
          : `Cartão fidelidade de ${payload.customerName} cadastrado com sucesso!`,
        'success'
      );
      fetchCards(true);
    } catch (err: any) {
      setFormError(err.message || 'Erro inesperado ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  // Quick Stamp (+1 or -1)
  const handleStamp = async (card: LoyaltyCard, delta: number) => {
    try {
      const res = await fetch(`/api/loyalty-cards/${card.id}/stamp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta })
      });

      if (res.ok) {
        const data = await res.json();
        const newCount = data.card?.consumptionCount ?? (card.consumptionCount + delta);
        if (delta > 0 && newCount >= (card.targetCount || 10) && !card.rewardClaimed) {
          showNotification(
            `🎉 PARABÉNS! ${card.customerName} atingiu 10 consumos e GANHOU UM PEDIDO GRÁTIS! (Retirada pendente)`,
            'success'
          );
        } else if (delta > 0) {
          showNotification(`+1 consumo registrado para ${card.customerName}! Total: ${newCount} consumos.`, 'info');
        } else {
          showNotification(`Consumo de ${card.customerName} ajustado para ${newCount}.`, 'info');
        }
        fetchCards(true);
      }
    } catch (err) {
      console.error('Erro ao registrar consumo:', err);
      showNotification('Erro ao registrar consumo no banco de dados.', 'error');
    }
  };

  // Open Claim Modal
  const handleOpenClaimModal = (card: LoyaltyCard) => {
    setCardToClaim(card);
    setClaimNotes(card.notes || '');
    setStartNewCycleOnClaim(false);
    setIsClaimModalOpen(true);
  };

  // Confirm Claim (Marcar como RETIRADO)
  const handleConfirmClaim = async (claimedStatus: boolean) => {
    if (!cardToClaim) return;
    setClaiming(true);

    try {
      const res = await fetch(`/api/loyalty-cards/${cardToClaim.id}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimed: claimedStatus,
          notes: claimNotes.trim()
        })
      });

      if (!res.ok) throw new Error('Falha ao atualizar retirada no banco.');

      // If user chose to start new cycle right away
      if (claimedStatus && startNewCycleOnClaim) {
        await fetch(`/api/loyalty-cards/${cardToClaim.id}/reset`, {
          method: 'POST'
        });
        showNotification(
          `Pedido grátis de ${cardToClaim.customerName} registrado como RETIRADO e novo ciclo iniciado com 0 carimbos!`,
          'success'
        );
      } else {
        showNotification(
          claimedStatus
            ? `✅ Retirada confirmada! ${cardToClaim.customerName} retirou o pedido grátis.`
            : `Status alterado: ${cardToClaim.customerName} agora consta como NÃO RETIROU.`,
          'success'
        );
      }

      setIsClaimModalOpen(false);
      setCardToClaim(null);
      fetchCards(true);
    } catch (err: any) {
      showNotification(err.message || 'Erro ao registrar status de retirada.', 'error');
    } finally {
      setClaiming(false);
    }
  };

  // Reset Cycle (Zerar carimbos para novo ciclo de 10)
  const handleResetCycle = async (card: LoyaltyCard) => {
    if (!window.confirm(`Deseja zerar os consumos de ${card.customerName} para iniciar um NOVO ciclo de 10 carimbos?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/loyalty-cards/${card.id}/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        showNotification(`Novo ciclo iniciado para ${card.customerName}! Consumos zerados.`, 'success');
        fetchCards(true);
      }
    } catch (err) {
      console.error('Erro ao reiniciar ciclo:', err);
      showNotification('Erro ao reiniciar ciclo.', 'error');
    }
  };

  // Delete Card
  const handleDeleteCard = async () => {
    if (!cardToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/loyalty-cards/${cardToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showNotification(`Cartão de ${cardToDelete.customerName} excluído com sucesso.`, 'info');
        setIsDeleteModalOpen(false);
        setCardToDelete(null);
        fetchCards(true);
      }
    } catch (err) {
      console.error('Erro ao excluir cartão:', err);
      showNotification('Erro ao excluir cartão no banco.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // WhatsApp Message
  const handleOpenWhatsApp = (card: LoyaltyCard) => {
    const rawPhone = card.phone.replace(/\D/g, '');
    const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
    const target = card.targetCount || 10;
    const remaining = Math.max(0, target - card.consumptionCount);

    let message = '';
    if (card.consumptionCount >= target && !card.rewardClaimed) {
      message = `Olá *${card.customerName}*! 🎉 Temos uma ótima notícia: você atingiu os ${target} consumos no *Cartão Fidelidade do Bagô* e já tem direito a um *PEDIDO GRÁTIS*! Venha retirar o seu quando quiser! 🎁`;
    } else if (card.rewardClaimed) {
      message = `Olá *${card.customerName}*! Agradecemos por fazer parte da família Bagô! Seu pedido grátis de fidelidade já foi retirado com sucesso. Venha continuar pontuando no seu próximo pedido! 💛`;
    } else {
      message = `Olá *${card.customerName}*! Seu saldo no *Cartão Fidelidade do Bagô* é de *${card.consumptionCount} de ${target}* consumos. Faltam apenas *${remaining}* para você ganhar seu *PEDIDO GRÁTIS*! 🎁 Vem pro Bagô!`;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Filtered Cards
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchesSearch =
        card.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.phone.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''));

      if (!matchesSearch) return false;

      const target = card.targetCount || 10;
      const isReadyToClaim = card.consumptionCount >= target && !card.rewardClaimed;
      const isClaimed = Boolean(card.rewardClaimed);
      const isInProgress = card.consumptionCount < target;

      if (statusFilter === 'ready_to_claim') return isReadyToClaim;
      if (statusFilter === 'claimed') return isClaimed;
      if (statusFilter === 'in_progress') return isInProgress;

      return true;
    });
  }, [cards, searchTerm, statusFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let readyToClaimCount = 0;
    let claimedCount = 0;
    let inProgressCount = 0;
    let totalConsumptions = 0;

    cards.forEach((card) => {
      const target = card.targetCount || 10;
      totalConsumptions += card.consumptionCount;
      if (card.consumptionCount >= target && !card.rewardClaimed) {
        readyToClaimCount++;
      } else if (card.rewardClaimed) {
        claimedCount++;
      } else {
        inProgressCount++;
      }
    });

    return {
      totalCards: cards.length,
      readyToClaimCount,
      claimedCount,
      inProgressCount,
      totalConsumptions
    };
  }, [cards]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner / Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-bold shadow-md transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : actionMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' && <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />}
            {actionMessage.type === 'error' && <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />}
            {actionMessage.type === 'info' && <Info className="h-5 w-5 text-amber-600 shrink-0" />}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="bg-gradient-to-br from-amber-400 to-amber-600 text-white p-3.5 rounded-2xl shadow-md shadow-amber-200">
            <Award className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Cartão Fidelidade</h2>
              <span className="bg-amber-100 text-amber-900 border border-amber-200 text-xs font-black px-2.5 py-0.5 rounded-full">
                10 Consumos = 1 Pedido Grátis
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Cadastre clientes, controle a quantidade de consumo e acompanhe a retirada dos pedidos grátis.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchCards(true)}
            disabled={refreshing}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
            title="Atualizar lista do banco de dados"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-black rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
            id="btn-new-loyalty-card"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>+ Novo Cartão Fidelidade</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cards */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Clientes</div>
            <div className="text-2xl font-black text-slate-800">{metrics.totalCards}</div>
            <div className="text-[11px] text-slate-500 font-medium">Cartões cadastrados</div>
          </div>
        </div>

        {/* Ready to Claim (NOT CLAIMED YET) - High Visibility Attention */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'ready_to_claim' ? 'all' : 'ready_to_claim')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer flex items-center gap-4 ${
            metrics.readyToClaimCount > 0
              ? 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-300 ring-2 ring-amber-400/30 shadow-md'
              : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-sm">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>Pedido Grátis Liberado</span>
              {metrics.readyToClaimCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <div className="text-2xl font-black text-amber-900">{metrics.readyToClaimCount}</div>
            <div className="text-[11px] font-bold text-amber-700">
              {metrics.readyToClaimCount === 1 ? '1 cliente NÃO retirou ainda' : `${metrics.readyToClaimCount} clientes NÃO retiraram ainda`}
            </div>
          </div>
        </div>

        {/* Already Claimed */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'claimed' ? 'all' : 'claimed')}
          className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4 cursor-pointer hover:border-emerald-300 transition-all"
        >
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pedidos Grátis Retirados</div>
            <div className="text-2xl font-black text-emerald-700">{metrics.claimedCount}</div>
            <div className="text-[11px] text-slate-500 font-medium">Prêmios já entregues</div>
          </div>
        </div>

        {/* In Progress */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
          className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4 cursor-pointer hover:border-blue-300 transition-all"
        >
          <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Em Andamento</div>
            <div className="text-2xl font-black text-blue-700">{metrics.inProgressCount}</div>
            <div className="text-[11px] text-slate-500 font-medium">Menos de 10 consumos</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome completo ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-medium focus:bg-white focus:border-brand-green focus:outline-hidden transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Pills & View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({cards.length})
          </button>
          <button
            onClick={() => setStatusFilter('ready_to_claim')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'ready_to_claim'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Gift className="h-3.5 w-3.5" />
            <span>Liberado (Não Retirou) ({metrics.readyToClaimCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('claimed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'claimed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Já Retirou ({metrics.claimedCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'in_progress'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Em Andamento ({metrics.inProgressCount})</span>
          </button>

          {/* View Mode Toggle */}
          <div className="ml-auto flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Visualização em Cartões Digitais"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Visualização em Tabela"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
          <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-600">Carregando cartões fidelidade do banco de dados...</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center space-y-4">
          <div className="bg-amber-50 text-amber-600 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
            <Award className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-800">Nenhum cartão fidelidade encontrado</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchTerm || statusFilter !== 'all'
                ? 'Nenhum cliente corresponde aos filtros selecionados. Tente limpar os filtros de busca.'
                : 'Ainda não há clientes cadastrados no cartão fidelidade. Clique no botão abaixo para cadastrar o primeiro cliente!'}
            </p>
          </div>
          <div>
            <button
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-black rounded-2xl text-xs sm:text-sm shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Cadastrar Primeiro Cartão Fidelidade</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* Grid of Loyalty Punch Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCards.map((card) => {
            const target = card.targetCount || 10;
            const count = card.consumptionCount;
            const isReadyToClaim = count >= target && !card.rewardClaimed;
            const isClaimed = Boolean(card.rewardClaimed);
            const remaining = Math.max(0, target - count);

            return (
              <div
                key={card.id}
                className={`bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden ${
                  isReadyToClaim
                    ? 'border-amber-400 ring-2 ring-amber-400/30'
                    : isClaimed
                    ? 'border-emerald-300'
                    : 'border-slate-200'
                }`}
              >
                {/* Status Header Banner */}
                {isReadyToClaim && (
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-2 text-xs font-black flex items-center justify-between">
                    <span className="flex items-center gap-1.5 animate-pulse">
                      <Gift className="h-4 w-4" />
                      PEDIDO GRÁTIS LIBERADO! (NÃO RETIROU)
                    </span>
                    <span className="bg-white text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                      Pendente
                    </span>
                  </div>
                )}
                {isClaimed && (
                  <div className="bg-emerald-600 text-white px-4 py-1.5 text-xs font-black flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4" />
                      PEDIDO GRÁTIS JÁ RETIRADO
                    </span>
                    {card.rewardClaimedAt && (
                      <span className="text-[10px] font-medium opacity-90">
                        {formatDateBrasilia(card.rewardClaimedAt)}
                      </span>
                    )}
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  {/* Customer Info Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-800 text-base leading-tight">
                        {card.customerName}
                      </h4>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{formatPhone(card.phone)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenWhatsApp(card)}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all cursor-pointer"
                        title="Enviar mensagem WhatsApp com saldo de carimbos"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(card)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"
                        title="Editar cliente"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setCardToDelete(card);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                        title="Excluir cartão"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stamp Count & Status Text */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Progresso</div>
                      <div className="text-lg font-black text-slate-800 flex items-baseline gap-1">
                        <span>{count}</span>
                        <span className="text-xs text-slate-400 font-bold">/ {target} consumos</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status Retirada</div>
                      {isReadyToClaim ? (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                          🎁 Não Retirou
                        </span>
                      ) : isClaimed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                          ✅ Já Retirou
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded-lg">
                          Faltam {remaining}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Visual Stamp Card (10 Carimbos) */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between px-1">
                      <span>Cartela de Carimbos</span>
                      {count >= target && (
                        <span className="text-amber-600 font-black flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Meta atingida!
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-5 gap-2 bg-slate-100/70 p-3 rounded-2xl border border-slate-200/80">
                      {Array.from({ length: 10 }).map((_, index) => {
                        const stampNumber = index + 1;
                        const isStamped = stampNumber <= count;
                        const isTenthStamp = stampNumber === 10;

                        if (isTenthStamp) {
                          return (
                            <div
                              key={stampNumber}
                              className={`aspect-square rounded-xl flex flex-col items-center justify-center font-black transition-all relative ${
                                isStamped
                                  ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-300 scale-105 ring-2 ring-amber-300'
                                  : 'bg-white border-2 border-dashed border-amber-300 text-amber-500'
                              }`}
                              title={isStamped ? '10º Consumo Carimbado! Pedido Grátis Liberado!' : '10º Consumo: Ganhe 1 Pedido Grátis!'}
                            >
                              <Gift className={`h-4 w-4 ${isStamped ? 'animate-bounce' : ''}`} />
                              <span className="text-[9px] font-black uppercase">Grátis</span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={stampNumber}
                            className={`aspect-square rounded-xl flex items-center justify-center font-black text-xs transition-all ${
                              isStamped
                                ? 'bg-brand-green text-white shadow-xs'
                                : 'bg-white text-slate-400 border border-slate-200'
                            }`}
                            title={`Carimbo ${stampNumber}`}
                          >
                            {isStamped ? <Check className="h-4 w-4 stroke-[3]" /> : stampNumber}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notes / Reward Detail */}
                  {card.notes && (
                    <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-600 italic">
                      <span className="font-bold text-slate-700 not-italic">Obs: </span>
                      {card.notes}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    {/* Quick Consumption Increment / Decrement */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStamp(card, -1)}
                        disabled={count <= 0}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                        title="Diminuir 1 consumo"
                      >
                        -1
                      </button>

                      <button
                        onClick={() => handleStamp(card, 1)}
                        className="flex-1 py-2 bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <Plus className="h-3.5 w-3.5 stroke-[3]" />
                        <span>+1 Consumo</span>
                      </button>
                    </div>

                    {/* Claim Button or Status Toggle */}
                    {count >= target && !isClaimed && (
                      <button
                        onClick={() => handleOpenClaimModal(card)}
                        className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <Gift className="h-4 w-4" />
                        <span>🎁 Confirmar Retirada do Pedido Grátis</span>
                      </button>
                    )}

                    {isClaimed && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResetCycle(card)}
                          className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs rounded-xl border border-blue-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Reiniciar contagem para novo ciclo de 10 carimbos mantendo o histórico"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Zerar para Novo Ciclo</span>
                        </button>
                        <button
                          onClick={() => {
                            setCardToClaim(card);
                            handleConfirmClaim(false);
                          }}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
                          title="Desmarcar retirada (voltar para NÃO RETIRADO)"
                        >
                          Desmarcar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Table View */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Cliente</th>
                  <th className="px-5 py-3.5">Telefone</th>
                  <th className="px-5 py-3.5">Consumo (Meta 10)</th>
                  <th className="px-5 py-3.5 text-center">Status Retirada</th>
                  <th className="px-5 py-3.5">Último Consumo</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCards.map((card) => {
                  const target = card.targetCount || 10;
                  const count = card.consumptionCount;
                  const isReadyToClaim = count >= target && !card.rewardClaimed;
                  const isClaimed = Boolean(card.rewardClaimed);

                  return (
                    <tr
                      key={card.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isReadyToClaim ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="px-5 py-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>{card.customerName}</span>
                          {isReadyToClaim && (
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200">
                              🎁 LIBERADO
                            </span>
                          )}
                        </div>
                        {card.notes && (
                          <div className="text-[11px] text-slate-400 font-normal italic mt-0.5">
                            {card.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{formatPhone(card.phone)}</span>
                          <button
                            onClick={() => handleOpenWhatsApp(card)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Conversar no WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 max-w-[160px]">
                          <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                count >= target ? 'bg-amber-500' : 'bg-brand-green'
                              }`}
                              style={{ width: `${Math.min(100, (count / target) * 100)}%` }}
                            />
                          </div>
                          <span className="font-extrabold text-slate-700 text-xs whitespace-nowrap">
                            {count}/{target}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {isReadyToClaim ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1 rounded-full animate-pulse">
                            <Gift className="h-3.5 w-3.5" />
                            NÃO RETIROU
                          </span>
                        ) : isClaimed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full">
                            <CheckCircle className="h-3.5 w-3.5" />
                            JÁ RETIROU
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">
                            Em andamento ({target - count} restantes)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">
                        {card.lastPurchaseDate ? formatDateBrasilia(card.lastPurchaseDate) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStamp(card, 1)}
                            className="px-2.5 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                            title="Adicionar +1 consumo"
                          >
                            +1
                          </button>

                          {count >= target && !isClaimed && (
                            <button
                              onClick={() => handleOpenClaimModal(card)}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-lg transition-colors cursor-pointer"
                              title="Registrar retirada"
                            >
                              🎁 Retirar
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenEditModal(card)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => {
                              setCardToDelete(card);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Modal - Cadastrar / Editar Cartão Fidelidade */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-6 shadow-2xl border border-slate-200 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 text-amber-800 p-2.5 rounded-2xl">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg">
                    {editingCard ? 'Editar Cartão Fidelidade' : 'Novo Cartão Fidelidade'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Cadastre o cliente e acompanhe os consumos para liberar o pedido grátis.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Banner */}
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveCard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome Completo do Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Maria Silva Santos"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold focus:bg-white focus:border-brand-green focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Telefone / WhatsApp *
                </label>
                <div className="relative">
                  <Phone className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="(00) 00000-0000"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold focus:bg-white focus:border-brand-green focus:outline-hidden transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Quantidade de Consumos
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={consumptionCount}
                    onChange={(e) => setConsumptionCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-bold focus:bg-white focus:border-brand-green focus:outline-hidden transition-all"
                  />
                  <span className="text-[10px] text-slate-400 font-medium">Cada consumo = 1 carimbo</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Meta de Consumos
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={targetCount}
                    onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value) || 10))}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-bold focus:bg-white focus:border-brand-green focus:outline-hidden transition-all"
                  />
                  <span className="text-[10px] text-slate-400 font-medium">Padrão: 10 consumos</span>
                </div>
              </div>

              {/* Status do Pedido Grátis (Retirou ou Não Retirou) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Status do Pedido Grátis
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRewardClaimed(false)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                      !rewardClaimed
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Gift className="h-3.5 w-3.5" />
                    <span>NÃO Retirou</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRewardClaimed(true)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                      rewardClaimed
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>JÁ Retirou</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  {consumptionCount >= targetCount
                    ? 'O cliente já atingiu a meta de 10 consumos! Marque "JÁ Retirou" apenas se ele já fez a retirada do brinde.'
                    : 'Quando o cliente atingir 10 consumos, o pedido grátis ficará automaticamente disponível para retirada.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Preferência por Poke Salmão Especial, brinde liberado dia..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-medium focus:bg-white focus:border-brand-green focus:outline-hidden transition-all resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-black text-xs rounded-2xl shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Salvando no Banco...' : editingCard ? 'Salvar Alterações' : 'Cadastrar Cartão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Confirmar Retirada do Pedido Grátis */}
      {isClaimModalOpen && cardToClaim && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-amber-200">
                <Gift className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-black text-slate-800">Confirmar Retirada do Pedido Grátis</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Confirme que o cliente está retirando o brinde conquistado no Cartão Fidelidade.
              </p>
            </div>

            {/* Customer info card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5 text-center">
              <div className="text-sm font-black text-slate-800">{cardToClaim.customerName}</div>
              <div className="text-xs font-medium text-slate-500">{formatPhone(cardToClaim.phone)}</div>
              <div className="text-xs font-extrabold text-amber-700 bg-amber-100/70 py-1 px-3 rounded-full inline-block mt-1">
                {cardToClaim.consumptionCount} consumos atingidos (Meta: {cardToClaim.targetCount || 10})
              </div>
            </div>

            {/* Notes on what was claimed */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                O que o cliente retirou? (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: 1 Poke Bagô Crispy grátis"
                value={claimNotes}
                onChange={(e) => setClaimNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-brand-green focus:outline-hidden transition-all"
              />
            </div>

            {/* Checkbox to reset cycle */}
            <label className="flex items-start gap-2.5 bg-blue-50/60 p-3 rounded-2xl border border-blue-100 cursor-pointer">
              <input
                type="checkbox"
                checked={startNewCycleOnClaim}
                onChange={(e) => setStartNewCycleOnClaim(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-blue-900 font-medium">
                <strong>Zerar carimbos após retirada</strong> para o cliente já iniciar um novo ciclo de 10 consumos.
              </span>
            </label>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmClaim(true)}
                disabled={claiming}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black text-sm rounded-2xl shadow-md transition-all cursor-pointer active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4 stroke-[3]" />
                <span>{claiming ? 'Registrando no Banco...' : 'Confirmar Retirada (JÁ RETIROU)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsClaimModalOpen(false)}
                className="w-full py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Confirm Delete */}
      {isDeleteModalOpen && cardToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-slate-800">Excluir Cartão Fidelidade?</h3>
              <p className="text-xs text-slate-500">
                Tem certeza de que deseja remover o cartão fidelidade de{' '}
                <strong className="text-slate-700">{cardToDelete.customerName}</strong>? Esta ação não pode ser desfeita no banco de dados.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCard}
                disabled={deleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
