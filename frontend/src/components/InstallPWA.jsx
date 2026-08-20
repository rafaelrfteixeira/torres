import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Check } from 'lucide-react';

/**
 * InstallPWA — Prompt de Instalação do PWA
 *
 * Captura o evento nativo `beforeinstallprompt` e apresenta
 * uma interface amigável para instalação do app no celular ou desktop.
 */
export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Verifica se já está rodando como PWA (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Verifica se o usuário dispensou recentemente
    const dismissedAt = localStorage.getItem('torres_pwa_dismissed');
    if (dismissedAt) {
      const daysSinceDismiss = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < 3) {
        // Não incomoda por 3 dias
        return;
      }
    }

    // 3. Ouve o evento nativo do navegador
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log('🎉 Torres CX PWA instalado com sucesso!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Dispara o prompt nativo
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('✅ Usuário aceitou a instalação do PWA.');
    } else {
      console.log('❌ Usuário recusou a instalação do PWA.');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('torres_pwa_dismissed', Date.now().toString());
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-slide-in">
      <div className="bg-slate-900/95 backdrop-blur-md border border-brand-500/30 text-white p-4 rounded-2xl shadow-2xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="Torres CX"
              className="w-12 h-12 rounded-xl bg-slate-950 p-1 border border-brand-500/40 object-contain shrink-0 shadow-md"
            />
            <div>
              <h4 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                Instalar Torres CX
                <span className="bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[10px] px-1.5 py-0.2 rounded font-normal">App</span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                Acesse mais rápido, trabalhe offline sem sinal e envie inspeções direto da tela inicial.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleInstallClick}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-500 hover:to-blue-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-brand-900/40 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Instalar Aplicativo
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
