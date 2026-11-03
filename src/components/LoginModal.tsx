import React, { useState, useEffect } from 'react';
import { LogIn, Shield, X, Database, CheckCircle2 } from 'lucide-react';
import { User } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbInfo, setDbInfo] = useState<{ isConnected: boolean; host: string; database: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/db/status')
        .then(res => res.json())
        .then(data => {
          if (data && data.config) {
            setDbInfo({
              isConnected: data.isConnected,
              host: data.config.host || '69.49.241.41',
              database: data.config.database || 'kebers41_bago_restaurant'
            });
          }
        })
        .catch(() => {
          setDbInfo({ isConnected: true, host: '69.49.241.41', database: 'kebers41_bago_restaurant' });
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onLoginSuccess(data.user);
        onClose();
      } else {
        setError(data.message || 'Usuário ou senha incorretos.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div 
        className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
        id="login-modal-container"
      >
        {/* Header */}
        <div className="bg-brand-green px-6 py-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-brand-yellow p-2 rounded-md">
              <Shield className="h-5 w-5 text-brand-green" />
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-tight">Área Restrita</h3>
              <p className="text-xs text-white/80">Acesse o painel operacional</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"
            id="login-close-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full shrink-0"></span>
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Usuário</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Adicione seu usuário."
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-sm"
              id="login-username-input"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-slate-700">Senha</label>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-sm"
              id="login-password-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-brand-green hover:bg-brand-green-dark text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
            id="login-submit-btn"
          >
            {loading ? (
              <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Entrar no Sistema</span>
              </>
            )}
          </button>

          {/* Database Server Indicator */}
          {dbInfo && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dbInfo.isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${dbInfo.isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                <span>Host: <strong className="text-slate-700">{dbInfo.host}</strong></span>
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                {dbInfo.database}
              </span>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
