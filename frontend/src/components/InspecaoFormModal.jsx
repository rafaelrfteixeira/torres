import { useState, useEffect, useRef } from 'react';
import {
  X, Camera, Clock, AlertTriangle, CheckCircle2, ShieldAlert,
  Wrench, ChevronDown, Loader2, Save, Lock, Unlock,
  Image as ImageIcon, Upload, Trash2, Eye, RefreshCw, FolderOpen
} from 'lucide-react';
import { syncManager } from '../services/syncManager';

/**
 * InspecaoFormModal — Modal de Inspeção de Preventiva
 *
 * Formulário baseado no modelo operacional (form_preventiva 1.html).
 * Renderiza o checklist dinâmico de acordo com o tipo de dispositivo,
 * com upload de imagens (base64) e cálculo automático de horas.
 *
 * @param {Object}   props.dispositivo     - Dados do dispositivo selecionado
 * @param {Object}   props.user            - Dados do usuário logado
 * @param {Object}   props.currentShopping - Metadata do shopping atual
 * @param {string}   props.tenant          - ID do tenant
 * @param {function} props.onClose         - Callback para fechar o modal
 * @param {function} props.onSaved         - Callback pós-salvamento bem-sucedido
 */

// ============================================
// Banco de Atividades por Tipo de Dispositivo
// ============================================
const CHECKLISTS = {
  'Detector de Fumaça': [
    'Inspeção visual',
    'Verificação de LEDs de funcionamento do detector',
    'Retirada do detector da base gerando trouble no painel',
    'Conferência de label do painel de Incêndio',
    'Limpeza do equipamento',
    'Verificação de cabos e conexões na base',
    'Reaperto de parafusos',
    'Teste de acionamento com spray ou soprador térmico',
  ],
  'Acionador Manual': [
    'Inspeção visual',
    'Limpeza do equipamento',
    'Verificação de cabos e conexões',
    'Reaperto de parafusos',
    'Teste de acionamento',
    'Conferência de label do painel de Incêndio',
    'Verificação de LEDs de funcionamento do acionador',
  ],
  'Módulo de Monitoramento': [
    'Inspeção visual',
    'Verificação de LEDs de funcionamento do módulo',
    'Validação de resistor de fim de linha',
    'Limpeza do equipamento',
    'Verificação de cabos e conexões',
    'Reaperto de parafusos',
    'Teste de acionamento do dispositivo',
    'Conferência de label do painel de Incêndio',
  ],
};

// Fallback genérico
const CHECKLIST_GENERICO = [
  'Inspeção visual',
  'Verificação de LEDs de funcionamento',
  'Limpeza do equipamento',
  'Verificação de cabos e conexões',
  'Reaperto de parafusos',
  'Teste de acionamento',
  'Conferência de label do painel de Incêndio',
];

const GRAVIDADE_OPCOES = [
  { value: 'Baixa', label: 'Baixa' },
  { value: 'Média', label: 'Média' },
  { value: 'Alta', label: 'Alta' },
  { value: 'Crítica', label: 'Crítica (Risco de Inoperância)' },
];

/**
 * Comprime e redimensiona uma imagem no navegador via HTML5 Canvas
 * @param {File} file - Arquivo de imagem selecionado no input
 * @param {number} maxWidth - Largura/altura máxima em pixels (default: 800)
 * @param {number} quality - Qualidade da compressão JPEG (0 a 1, default: 0.5)
 * @returns {Promise<string>} Base64 da imagem otimizada
 */
function compressImage(file, maxWidth = 800, quality = 0.5) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

// Detecta tipo de checklist com base no campo "Tipo" da Matriz Mestra
function resolveChecklist(tipo) {
  const tipoLower = (tipo || '').toLowerCase();
  if (tipoLower.includes('detector') || tipoLower.includes('fumaça') || tipoLower.includes('fumaca') || tipoLower === 'df' || tipoLower === 'dt') {
    return { label: 'Detector de Fumaça', items: CHECKLISTS['Detector de Fumaça'] };
  }
  if (tipoLower.includes('acionador') || tipoLower.includes('manual') || tipoLower === 'am') {
    return { label: 'Acionador Manual', items: CHECKLISTS['Acionador Manual'] };
  }
  if (tipoLower.includes('módulo') || tipoLower.includes('modulo') || tipoLower.includes('monitoramento') || tipoLower === 'mod') {
    return { label: 'Módulo de Monitoramento', items: CHECKLISTS['Módulo de Monitoramento'] };
  }
  return { label: tipo || 'Dispositivo', items: CHECKLIST_GENERICO };
}

function getTodayDateString() {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export default function InspecaoFormModal({ dispositivo, user, currentShopping, tenant, onClose, onSaved }) {
  const modalRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  // Form state
  const [dataExecucao, setDataExecucao] = useState(getTodayDateString());
  const [acessivel, setAcessivel] = useState(null); // null, 'sim', 'nao'
  const [gravidadeFalha, setGravidadeFalha] = useState('Média');
  const [descricaoDefeito, setDescricaoDefeito] = useState('');
  const [observacoesGerais, setObservacoesGerais] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [horarioTermino, setHorarioTermino] = useState('');
  const [totalHoras, setTotalHoras] = useState('');
  const [imagem1, setImagem1] = useState(null);
  const [imagem2, setImagem2] = useState(null);
  const [preview1, setPreview1] = useState(null);
  const [preview2, setPreview2] = useState(null);

  // Referências para os inputs de arquivo (Câmera direta vs Galeria)
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const pendingSlotRef = useRef(1); // 1 ou 2

  // Estado para o modal de escolha da origem da foto e zoom
  const [photoSourceModalSlot, setPhotoSourceModalSlot] = useState(null); // null, 1 ou 2
  const [selectedZoomImage, setSelectedZoomImage] = useState(null); // null ou string base64

  // Checklist dinâmico
  const { label: tipoLabel, items: checklistItems } = resolveChecklist(dispositivo?.tipo);
  const [checklistRespostas, setChecklistRespostas] = useState(() =>
    checklistItems.map((atividade) => ({ atividade, status: '' })) // Começa vazio
  );

  // Resetar checklist se o dispositivo mudar
  useEffect(() => {
    setChecklistRespostas(
      checklistItems.map((atividade) => ({ atividade, status: '' }))
    );
    setDataExecucao(getTodayDateString());
    setAcessivel(null);
    setDescricaoDefeito('');
    setObservacoesGerais('');
    setImagem1(null);
    setImagem2(null);
    setPreview1(null);
    setPreview2(null);
    setPhotoSourceModalSlot(null);
    setSelectedZoomImage(null);
  }, [dispositivo?.descricao]);

  // Fechar com ESC
  useEffect(() => {
    const handleEsc = (e) => { 
      if (e.key === 'Escape') {
        if (selectedZoomImage) {
          setSelectedZoomImage(null);
        } else if (photoSourceModalSlot) {
          setPhotoSourceModalSlot(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose, selectedZoomImage, photoSourceModalSlot]);

  // Lógica condicional de OS
  const temFalhaChecklist = checklistRespostas.some((item) => item.status === 'nao');
  const deveAbrirOS = acessivel === 'nao' || (acessivel === 'sim' && temFalhaChecklist);

  // Handler para checklist
  const handleChecklistChange = (index, valor) => {
    setChecklistRespostas((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: valor };
      return updated;
    });
  };

  // Funções de abertura de Câmera / Galeria
  const openPhotoSourceModal = (slot) => {
    pendingSlotRef.current = slot;
    setPhotoSourceModalSlot(slot);
  };

  const handleTriggerCamera = () => {
    setPhotoSourceModalSlot(null);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  const handleTriggerGallery = () => {
    setPhotoSourceModalSlot(null);
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
      galleryInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetSlot = pendingSlotRef.current;
    try {
      const compressedBase64 = await compressImage(file, 800, 0.5);
      if (targetSlot === 1) {
        setImagem1(compressedBase64);
        setPreview1(compressedBase64);
      } else if (targetSlot === 2) {
        setImagem2(compressedBase64);
        setPreview2(compressedBase64);
      }
    } catch (err) {
      console.error('Erro ao comprimir imagem:', err);
      alert('Não foi possível processar a imagem selecionada.');
    }
  };

  const handleRemovePhoto = (slot) => {
    if (slot === 1) {
      setImagem1(null);
      setPreview1(null);
    } else if (slot === 2) {
      setImagem2(null);
      setPreview2(null);
    }
    setPhotoSourceModalSlot(null);
  };

  // Submissão
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validações
    if (acessivel === null) {
      setSubmitStatus({ type: 'error', message: 'Selecione se o dispositivo está acessível ou não.' });
      setTimeout(() => setSubmitStatus(null), 4000);
      return;
    }

    if (acessivel === 'sim') {
      const temPendente = checklistRespostas.some((item) => !item.status);
      if (temPendente) {
        setSubmitStatus({ type: 'error', message: 'Responda todas as atividades do checklist antes de salvar.' });
        setTimeout(() => setSubmitStatus(null), 4000);
        return;
      }
    }

    if (!horarioInicio) {
      setSubmitStatus({ type: 'error', message: 'Preencha o Horário de Início.' });
      setTimeout(() => setSubmitStatus(null), 4000);
      return;
    }

    if (deveAbrirOS && !descricaoDefeito.trim()) {
      setSubmitStatus({
        type: 'error',
        message: acessivel === 'nao'
          ? 'Descreva o motivo de estar Sem Acesso para abertura da OS.'
          : 'Descreva o defeito encontrado para abertura da OS.',
      });
      setTimeout(() => setSubmitStatus(null), 4000);
      return;
    }

    // Calcular horário de término e total de horas
    const agora = new Date();
    const termino = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    let totalCalc = '';

    const [h1, m1] = horarioInicio.split(':').map(Number);
    const [h2, m2] = termino.split(':').map(Number);
    let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMinutes < 0) diffMinutes += 24 * 60;
    const diffH = Math.floor(diffMinutes / 60);
    const diffM = diffMinutes % 60;
    totalCalc = `${String(diffH).padStart(2, '0')}h${String(diffM).padStart(2, '0')}m`;

    setHorarioTermino(termino);
    setTotalHoras(totalCalc);

    // Mapear status final para o Lists
    const resolvedStatusInspecao = acessivel === 'nao'
      ? 'Sem Acesso'
      : (temFalhaChecklist ? 'Com Defeito' : 'Funcionando');

    // Payload
    const payload = {
      tenant,
      tag: dispositivo?.laco ? `${dispositivo.pavimento} ${dispositivo.laco}` : dispositivo?.descricao || '',
      localizacao: dispositivo?.descricao || '',
      descricao: dispositivo?.descricao || '',
      pavimento: dispositivo?.pavimento || '',
      tipoDispositivo: tipoLabel,
      dataExecucao,
      statusInspecao: resolvedStatusInspecao,
      checklist: acessivel === 'sim'
        ? checklistRespostas
        : [{ atividade: 'Acesso físico ao local e dispositivo', status: 'nao' }],
      gravidadeFalha: deveAbrirOS ? gravidadeFalha : '',
      descricaoDefeito: deveAbrirOS ? descricaoDefeito : '',
      observacoesGerais,
      tecnicoResponsavel: user?.name || '',
      horarioInicio,
      horarioTermino: termino,
      totalHoras: totalCalc,
      imagem1: imagem1 || '',
      imagem2: imagem2 || '',
      // Dados do Excel para atualização
      rowIndex: dispositivo?.rowIndex,
      realizadoColIndex: dispositivo?.realizadoColIndex,
    };

    setIsLoading(true);
    setSubmitStatus(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const result = await syncManager.submitWithOfflineSupport({
        url: `${API_URL}/preventivas/salvar`,
        method: 'POST',
        payload,
        description: `Preventiva: ${dispositivo.tipoDispositivo || 'Dispositivo'} ${dispositivo.tagId || ''} (${dispositivo.localizacao || ''})`,
        tenant,
        type: 'preventiva',
      });

      if (result.success) {
        if (result.offline) {
          setSubmitStatus({
            type: 'success',
            message: '💾 Modo Offline: Inspeção salva no dispositivo! Será sincronizada assim que a internet voltar.',
          });
        } else {
          setSubmitStatus({
            type: 'success',
            message: result.data?.osVinculada
              ? `Preventiva salva e OS #${result.data.osVinculada} aberta!`
              : 'Preventiva salva com sucesso!',
          });
        }

        setTimeout(() => {
          onSaved?.();
          onClose();
        }, 1800);
      } else {
        setSubmitStatus({
          type: 'error',
          message: result.message || 'Erro ao processar a preventiva.',
        });
      }
    } catch (error) {
      setSubmitStatus({ type: 'error', message: 'Erro inesperado ao salvar preventiva.' });
      console.error('❌ Erro ao salvar preventiva:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => setSubmitStatus(null), 6000);
    }
  };

  if (!dispositivo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-4 animate-slide-in"
      >
        {/* ============================================ */}
        {/* CABEÇALHO VERMELHO                           */}
        {/* ============================================ */}
        <div className="bg-gradient-to-r from-red-800 to-red-600 px-4 sm:px-6 py-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-black/10 rounded-md border border-white/10 text-xs sm:text-sm">
              {currentShopping?.logo && (
                <div className="bg-white rounded p-0.5">
                  <img src={currentShopping.logo} alt={currentShopping.name} className="h-3 sm:h-4 object-contain" />
                </div>
              )}
              <span className="font-medium text-red-50">
                {currentShopping?.name} <span className="text-red-200 mx-1">&gt;</span> Preventiva SDAI
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="bg-white rounded-lg px-3 py-1 shadow-sm">
                <img src="/logo.png" alt="Torres Cx" className="h-8 sm:h-10 object-contain" />
              </div>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase">Relatório Operacional</h2>
            <p className="text-red-200 text-xs sm:text-sm mt-0.5">Checklist — Manutenção Preventiva (Áreas Comuns)</p>
          </div>
        </div>

        {/* ============================================ */}
        {/* FORMULÁRIO                                   */}
        {/* ============================================ */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">

          {/* ---- INFORMAÇÕES DO DISPOSITIVO ---- */}
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">
              Informações do Dispositivo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Data</label>
                <input
                  type="date"
                  value={dataExecucao}
                  onChange={(e) => setDataExecucao(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Tipo de Dispositivo</label>
                <input
                  type="text"
                  value={tipoLabel}
                  readOnly
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-100 text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">TAG / ID</label>
                <input
                  type="text"
                  value={dispositivo.laco ? `${dispositivo.pavimento} ${dispositivo.laco}` : dispositivo.descricao}
                  readOnly
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-100 text-slate-600 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Localização / Descrição</label>
                <input
                  type="text"
                  value={dispositivo.descricao || ''}
                  readOnly
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-100 text-slate-600"
                />
              </div>
            </div>
          </section>

          {/* ---- ACESSIBILIDADE DO DISPOSITIVO (Substitui Status da Inspeção) ---- */}
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">
              Acessibilidade do Dispositivo <span className="text-red-500">*</span>
            </h3>
            <div className="flex flex-wrap gap-3">
              {/* Opção: Tem Acesso */}
              <label
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  acessivel === 'sim'
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="acessivel"
                  value="sim"
                  checked={acessivel === 'sim'}
                  onChange={() => setAcessivel('sim')}
                  className="sr-only"
                />
                <Unlock size={18} className={acessivel === 'sim' ? 'text-emerald-600' : 'text-slate-400'} />
                <span className={`text-sm font-medium ${acessivel === 'sim' ? 'text-slate-800' : 'text-slate-600'}`}>
                  Tem Acesso
                </span>
              </label>

              {/* Opção: Sem Acesso */}
              <label
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  acessivel === 'nao'
                    ? 'border-red-500 bg-red-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="acessivel"
                  value="nao"
                  checked={acessivel === 'nao'}
                  onChange={() => setAcessivel('nao')}
                  className="sr-only"
                />
                <Lock size={18} className={acessivel === 'nao' ? 'text-red-600' : 'text-slate-400'} />
                <span className={`text-sm font-medium ${acessivel === 'nao' ? 'text-slate-800' : 'text-slate-600'}`}>
                  Sem Acesso
                </span>
              </label>
            </div>
          </section>

          {/* ---- CHECKLIST DINÂMICO (Somente se Tem Acesso) ---- */}
          {acessivel === 'sim' && (
            <section className="border border-slate-200 rounded-xl overflow-hidden animate-fade-in">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Atividades de Preventiva
                </h3>
              </div>
              {/* Header da tabela */}
              <div className="grid grid-cols-[1fr_60px_60px] bg-red-800 text-white text-xs font-semibold uppercase tracking-wider">
                <div className="px-4 py-2.5">Atividade Executada</div>
                <div className="py-2.5 text-center border-l border-red-700">Sim</div>
                <div className="py-2.5 text-center border-l border-red-700">Não</div>
              </div>
              {/* Linhas */}
              {checklistRespostas.map((item, index) => (
                <div
                  key={index}
                  className={`grid grid-cols-[1fr_60px_60px] items-center border-t border-slate-200 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                  } ${item.status === 'nao' ? 'bg-red-50' : ''}`}
                >
                  <div className="px-4 py-3 text-xs sm:text-sm text-slate-700">
                    <span className="text-red-400 mr-1.5">•</span>
                    {item.atividade}
                  </div>
                  <div className="flex justify-center py-3 border-l border-slate-200">
                    <input
                      type="radio"
                      name={`check_${index}`}
                      value="sim"
                      checked={item.status === 'sim'}
                      onChange={() => handleChecklistChange(index, 'sim')}
                      className="w-[18px] h-[18px] cursor-pointer accent-red-600"
                    />
                  </div>
                  <div className="flex justify-center py-3 border-l border-slate-200">
                    <input
                      type="radio"
                      name={`check_${index}`}
                      value="nao"
                      checked={item.status === 'nao'}
                      onChange={() => handleChecklistChange(index, 'nao')}
                      className="w-[18px] h-[18px] cursor-pointer accent-red-600"
                    />
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* ---- OS CORRETIVA AUTOMÁTICA (Condicional) ---- */}
          {deveAbrirOS && (
            <section className="bg-red-50 border-2 border-red-300 rounded-xl p-4 animate-fade-in">
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2 pb-1 border-b border-red-200 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-600" />
                Abertura Automática de OS Corretiva
              </h3>
              <p className="text-xs text-red-600 font-medium mb-4">
                {acessivel === 'nao'
                  ? 'O dispositivo está inacessível. Esta preventiva gerará uma OS Corretiva para regularizar o acesso.'
                  : 'Uma ou mais atividades falharam. Esta preventiva gerará um chamado de correção vinculado.'}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-red-700 uppercase mb-1">Gravidade da Falha</label>
                  <div className="relative">
                    <select
                      value={gravidadeFalha}
                      onChange={(e) => setGravidadeFalha(e.target.value)}
                      className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm bg-white text-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none appearance-none pr-8"
                    >
                      {GRAVIDADE_OPCOES.map((g) => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-red-700 uppercase mb-1">
                    Descrição Detalhada do Defeito <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={descricaoDefeito}
                    onChange={(e) => setDescricaoDefeito(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-y placeholder:text-slate-400"
                    placeholder={
                      acessivel === 'nao'
                        ? 'Ex: Ponto obstruído por forro gesso fechado sem alçapão de acesso.'
                        : 'Ex: Detector falhou no teste de spray e a base apresenta oxidação nos contatos.'
                    }
                    required
                  />
                </div>
              </div>
            </section>
          )}

          {/* ---- EVIDÊNCIAS FOTOGRÁFICAS ---- */}
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 pb-1 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Evidências Fotográficas (Mínimo 2 fotos)
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">Câmera ou Galeria</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card Foto 1 */}
              {preview1 ? (
                <div className="relative h-36 rounded-xl overflow-hidden border border-slate-300 shadow-xs bg-slate-900 group">
                  <img src={preview1} alt="Foto 1" className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>Foto 01 (Geral)</span>
                  </div>
                  {/* Barra de ações */}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                    <button
                      type="button"
                      onClick={() => setSelectedZoomImage(preview1)}
                      className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                      title="Visualizar ampliada"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openPhotoSourceModal(1)}
                      className="p-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                      title="Alterar foto"
                    >
                      <RefreshCw size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(1)}
                      className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                      title="Remover foto"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {/* Botão de toque móvel para facilitar em celulares */}
                  <button
                    type="button"
                    onClick={() => openPhotoSourceModal(1)}
                    className="sm:hidden absolute bottom-2 right-2 px-2.5 py-1 bg-slate-900/80 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    <span>Opções</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openPhotoSourceModal(1)}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-red-500 rounded-xl p-4 bg-white hover:bg-red-50/20 transition-all h-36 cursor-pointer text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-red-100 flex items-center justify-center text-slate-500 group-hover:text-red-600 transition-colors">
                    <Camera size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-red-700 block">
                      📷 Foto 01 (Geral)
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Toque para tirar foto ou selecionar da galeria
                    </span>
                  </div>
                </button>
              )}

              {/* Card Foto 2 */}
              {preview2 ? (
                <div className="relative h-36 rounded-xl overflow-hidden border border-slate-300 shadow-xs bg-slate-900 group">
                  <img src={preview2} alt="Foto 2" className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>Foto 02 (Teste/Detalhe)</span>
                  </div>
                  {/* Barra de ações */}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                    <button
                      type="button"
                      onClick={() => setSelectedZoomImage(preview2)}
                      className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                      title="Visualizar ampliada"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openPhotoSourceModal(2)}
                      className="p-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                      title="Alterar foto"
                    >
                      <RefreshCw size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(2)}
                      className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg backdrop-blur-sm transition-colors cursor-pointer"
                      title="Remover foto"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {/* Botão de toque móvel para facilitar em celulares */}
                  <button
                    type="button"
                    onClick={() => openPhotoSourceModal(2)}
                    className="sm:hidden absolute bottom-2 right-2 px-2.5 py-1 bg-slate-900/80 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    <span>Opções</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openPhotoSourceModal(2)}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-red-500 rounded-xl p-4 bg-white hover:bg-red-50/20 transition-all h-36 cursor-pointer text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-red-100 flex items-center justify-center text-slate-500 group-hover:text-red-600 transition-colors">
                    <Camera size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-red-700 block">
                      📷 Foto 02 (Teste/Detalhe)
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Toque para tirar foto ou selecionar da galeria
                    </span>
                  </div>
                </button>
              )}
            </div>
          </section>

          {/* ---- OBSERVAÇÕES GERAIS ---- */}
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">
              Observações Gerais
            </h3>
            <textarea
              value={observacoesGerais}
              onChange={(e) => setObservacoesGerais(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-y placeholder:text-slate-400"
              placeholder="Notas adicionais sobre o estado geral do ponto..."
            />
          </section>

          {/* ---- REGISTRO DE EXECUÇÃO ---- */}
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">
              Registro de Execução
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Eng. / Técnico Responsável</label>
                <input
                  type="text"
                  value={user?.name || ''}
                  readOnly
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-100 text-slate-600"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Horário Início <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={horarioInicio}
                    onChange={(e) => setHorarioInicio(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Horário Término</label>
                  <input
                    type="time"
                    value={horarioTermino}
                    readOnly
                    placeholder="Automático"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-100 text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Total Horas</label>
                  <input
                    type="text"
                    value={totalHoras}
                    readOnly
                    placeholder="Auto"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-100 text-slate-500"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ---- NOTA LEGAL ---- */}
          <p className="text-[10px] text-slate-400 leading-relaxed px-1">
            * Conforme NBR 17240 – A manutenção preventiva deve garantir que o sistema de detecção e alarme de incêndio
            esteja em pleno funcionamento, visando registrar em relatório suas restrições ou falhas.
          </p>

          {/* ---- BOTÃO DE AÇÃO ---- */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 text-white font-bold rounded-xl shadow-xl text-sm uppercase tracking-wider transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${
              isLoading
                ? 'bg-slate-400 cursor-not-allowed shadow-none'
                : deveAbrirOS
                  ? 'bg-gradient-to-r from-red-900 to-red-700 shadow-red-900/30 hover:from-red-800 hover:to-red-600 active:scale-[0.98]'
                  : 'bg-gradient-to-r from-red-600 to-red-800 shadow-red-500/30 hover:from-red-500 hover:to-red-700 active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Processando...
              </>
            ) : deveAbrirOS ? (
              <>
                <AlertTriangle size={18} />
                Salvar Preventiva e Abrir OS
              </>
            ) : (
              <>
                <Save size={18} />
                Salvar Preventiva
              </>
            )}
          </button>
        </form>

        {/* ---- TOAST NOTIFICATION ---- */}
        {submitStatus && (
          <div
            className={`fixed top-6 right-6 z-[60] max-w-md px-6 py-4 rounded-xl shadow-2xl animate-slide-in ${
              submitStatus.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">{submitStatus.type === 'success' ? '✅' : '❌'}</span>
              <div>
                <p className="font-semibold text-sm">
                  {submitStatus.type === 'success' ? 'Sucesso!' : 'Erro'}
                </p>
                <p className="text-sm opacity-90 mt-0.5">{submitStatus.message}</p>
              </div>
              <button
                onClick={() => setSubmitStatus(null)}
                className="ml-auto text-white/70 hover:text-white text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Inputs de arquivo ocultos (Câmera com capture vs Galeria sem capture) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Modal / Bottom-Sheet de Seleção da Origem da Foto (Câmera vs Galeria) */}
        {photoSourceModalSlot && (
          <div
            className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={() => setPhotoSourceModalSlot(null)}
          >
            <div
              className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabeçalho */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {photoSourceModalSlot === 1 ? 'Foto 01 (Geral)' : 'Foto 02 (Teste/Detalhe)'}
                  </h4>
                  <p className="text-xs text-slate-500">Escolha a origem da imagem</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPhotoSourceModalSlot(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Opções de Origem */}
              <div className="grid grid-cols-1 gap-2.5">
                {/* Opção 1: Câmera ao Vivo */}
                <button
                  type="button"
                  onClick={handleTriggerCamera}
                  className="flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200 hover:border-red-400 hover:bg-red-50/50 bg-white transition-all text-left group cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <div className="w-11 h-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Camera size={22} />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 block group-hover:text-red-700">
                      Tirar Foto (Câmera)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Abrir a câmera do dispositivo para fotografar agora
                    </span>
                  </div>
                </button>

                {/* Opção 2: Galeria do Dispositivo */}
                <button
                  type="button"
                  onClick={handleTriggerGallery}
                  className="flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 bg-white transition-all text-left group cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ImageIcon size={22} />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 block group-hover:text-blue-700">
                      Escolher da Galeria / Arquivos
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Selecionar foto já tirada ou salva no aparelho
                    </span>
                  </div>
                </button>
              </div>

              {/* Ações Extras se já houver foto anexada */}
              {((photoSourceModalSlot === 1 && preview1) || (photoSourceModalSlot === 2 && preview2)) && (
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const currentImg = photoSourceModalSlot === 1 ? preview1 : preview2;
                      setSelectedZoomImage(currentImg);
                      setPhotoSourceModalSlot(null);
                    }}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Eye size={15} />
                    Visualizar Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(photoSourceModalSlot)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-red-200 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                    Remover Foto
                  </button>
                </div>
              )}

              {/* Botão Cancelar */}
              <button
                type="button"
                onClick={() => setPhotoSourceModalSlot(null)}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Modal de Zoom em Tela Cheia */}
        {selectedZoomImage && (
          <div
            className="fixed inset-0 z-70 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setSelectedZoomImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <img src={selectedZoomImage} alt="Evidência Ampliada" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain" />
              <button
                type="button"
                onClick={() => setSelectedZoomImage(null)}
                className="absolute -top-3 -right-3 p-2 bg-white text-slate-900 rounded-full shadow-lg hover:bg-slate-200 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
