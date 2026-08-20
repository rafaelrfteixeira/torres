import { useState, useEffect } from 'react';
import {
  Download,
  X,
  Smartphone,
  Share2,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react';

/**
 * InstallPWA — Prompt Inteligente de Instalação do PWA
 *
 * Suporta:
 * 1. Android & Desktop: Evento nativo `beforeinstallprompt` com instalação em 1 clique.
 * 2. iOS (Safari/Chrome): Guia passo a passo com instruções visuais (Compartilhar -> Adicionar à Tela de Início).
 * 3. Fallback Android (caso o navegador não dispare beforeinstallprompt): Guia passo a passo via menu ⋮.
 */
export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState('other'); // 'ios' | 'android' | 'desktop'

  useEffect(() => {
    // 1. Detecta se já está rodando como PWA (modo standalone)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Identifica a plataforma
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(ua);

    if (isIos) {
      setPlatform('ios');
    } else if (isAndroid) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // 3. Captura o evento nativo beforeinstallprompt (Android / Desktop Chrome / Edge)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setShowInstructionsModal(false);
      setDeferredPrompt(null);
      console.log('🎉 Torres CX PWA instalado com sucesso!');
    };

    const handleOpenInstall = () => {
      if (deferredPrompt) {
        handleInstallClick();
      } else {
        setShowInstructionsModal(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('open_pwa_install', handleOpenInstall);

    // 4. No iOS ou em dispositivos móveis onde beforeinstallprompt não dispara automaticamente,
    // mostramos o banner após um breve delay se não tiver sido dispensado hoje
    const dismissedAt = localStorage.getItem('torres_pwa_dismissed_v2');
    const isDismissedRecently =
      dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 1000 * 60 * 60 * 24; // 24h

    if (!isDismissedRecently) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        window.removeEventListener('open_pwa_install', handleOpenInstall);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('open_pwa_install', handleOpenInstall);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    // Caso 1: Navegador suporta prompt nativo (Android / Desktop Chrome / Edge)
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('✅ Usuário aceitou a instalação do PWA.');
        setShowBanner(false);
      }
      setDeferredPrompt(null);
      return;
    }

    // Caso 2: iOS ou Android sem prompt automático -> Abre modal de instruções passo a passo
    setShowInstructionsModal(true);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowInstructionsModal(false);
    localStorage.setItem('torres_pwa_dismissed_v2', Date.now().toString());
  };

  // Se já estiver instalado em modo standalone, não renderiza nada
  if (isInstalled) return null;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. BANNER FLUTUANTE INFERIOR (Modo Mobile e Desktop)                      */}
      {/* ========================================================================= */}
      {showBanner && !showInstructionsModal && (
        <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:w-[420px] z-50 animate-slide-in">
          <div className="bg-slate-900/95 backdrop-blur-md border border-brand-500/40 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-md border border-slate-700">
                  <img
                    src="/logo_torres.png"
                    alt="Torres CX"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    Instalar Aplicativo Torres CX
                    <span className="bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[10px] px-1.5 py-0.5 rounded font-normal">
                      PWA
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                    Instale no seu celular para acessar mais rápido, usar offline e preencher checklists direto da tela inicial.
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
                {platform === 'ios' ? 'Como Instalar no iPhone' : 'Instalar Aplicativo'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Depois
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MODAL DE INSTRUÇÕES VISUAIS PASSO A PASSO (iOS / Android)              */}
      {/* ========================================================================= */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 text-white w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow">
                  <img src="/logo_torres.png" alt="Torres CX" className="max-w-full max-h-full object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">Instalar Torres CX no Celular</h3>
                  <p className="text-xs text-slate-400">Siga os passos abaixo no seu navegador</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* INSTRUÇÕES ESPECÍFICAS PARA iOS (iPhone / iPad) */}
            {platform === 'ios' && (
              <div className="space-y-3 py-1">
                <div className="flex items-start gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    1
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-slate-200">
                      No Safari, toque no botão <strong>Compartilhar</strong> na barra inferior:
                    </p>
                    <div className="flex items-center gap-2 text-blue-400 font-medium pt-1">
                      <Share2 className="w-4 h-4" />
                      <span>Ícone do quadrado com a seta para cima ( ⎋ )</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    2
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-slate-200">
                      Role para baixo e selecione a opção:
                    </p>
                    <div className="flex items-center gap-2 text-emerald-400 font-medium pt-1">
                      <PlusSquare className="w-4 h-4" />
                      <span>"Adicionar à Tela de Início"</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    3
                  </div>
                  <div className="text-xs">
                    <p className="text-slate-200">
                      Toque em <strong>"Adicionar"</strong> no canto superior direito. Pronto! O app Torres CX estará na sua tela inicial.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* INSTRUÇÕES ESPECÍFICAS PARA ANDROID / OUTROS NAVEGADORES */}
            {platform !== 'ios' && (
              <div className="space-y-3 py-1">
                <div className="flex items-start gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-brand-600/30 text-brand-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    1
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-slate-200">
                      No Google Chrome ou Samsung Internet, toque no menu de <strong>3 pontinhos</strong> no canto superior direito:
                    </p>
                    <div className="flex items-center gap-2 text-brand-400 font-medium pt-1">
                      <MoreVertical className="w-4 h-4" />
                      <span>Menu de opções do navegador</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-brand-600/30 text-brand-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    2
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-slate-200">
                      Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>:
                    </p>
                    <div className="flex items-center gap-2 text-emerald-400 font-medium pt-1">
                      <Download className="w-4 h-4" />
                      <span>Instalar aplicativo Torres CX</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-brand-600/30 text-brand-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    3
                  </div>
                  <div className="text-xs">
                    <p className="text-slate-200">
                      Confirme a instalação. O ícone oficial da Torres CX será adicionado aos seus aplicativos!
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
