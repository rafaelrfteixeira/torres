import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Clock, Camera, Upload, Trash2, Image as ImageIcon, Calendar, User, FileText, Tag, Loader2, Package } from 'lucide-react';

/**
 * Formata qualquer data (ISO, YYYY-MM-DD, DD/MM/YYYY) de forma segura em PT-BR (DD/MM/AAAA)
 */
function formatDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'object' && dateVal !== null) {
    if (dateVal.dateTime) dateVal = dateVal.dateTime;
    else return '';
  }
  const str = String(dateVal).trim();
  if (!str) return '';

  // Se a string não contiver dígitos, não é uma data
  if (!/\d/.test(str)) return '';

  // Se já estiver no formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    return str.substring(0, 10);
  }

  // Se contiver horário (ISO com 'T' ou espaço), parseia no fuso horário do navegador do usuário
  if (str.includes('T') || str.includes(' ')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR');
    }
  }

  // Se estiver no formato simples YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split('-');
    return `${day}/${month}/${year}`;
  }

  // Fallback via Date
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

export default function CorretivaEditModal({ corretiva, isOpen, onClose, onSaved }) {
  const [status, setStatus] = useState('Pendente');
  const [resolucaoProblema, setResolucaoProblema] = useState('');
  const [imagem3Base64, setImagem3Base64] = useState(null);
  const [imagem3Preview, setImagem3Preview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedFullImage, setSelectedFullImage] = useState(null);

  // Formatar a data de hoje para exibição no formulário
  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  useEffect(() => {
    if (corretiva) {
      setStatus(corretiva.status || 'Pendente');
      setResolucaoProblema(corretiva.resolucaoProblema || '');
      setImagem3Base64(null);

      // Se já tiver Imagem_3 salva no backend
      const existingImg3 = getImageUrl(corretiva.imagem3);
      setImagem3Preview(existingImg3 || null);

      setErrorMessage(null);
    }
  }, [corretiva, isOpen]);

  if (!isOpen || !corretiva) return null;

  // Processar upload de imagem
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecione um arquivo de imagem válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      setImagem3Base64(base64);
      setImagem3Preview(base64);
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage3 = () => {
    setImagem3Base64(null);
    setImagem3Preview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const tenant = corretiva.tenantSlug || window.location.pathname.split('/')[1] || 'shopping-recife';

      const bodyData = {
        status,
        resolucaoProblema,
      };

      if (imagem3Base64) {
        bodyData.imagem3 = imagem3Base64;
      }

      const response = await fetch(`${API_URL}/corretivas/${corretiva.id}?tenant=${tenant}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Erro ${response.status} ao salvar.`);
      }

      const result = await response.json();
      if (result.success) {
        if (onSaved) onSaved();
        onClose();
      } else {
        throw new Error(result.message || 'Erro ao atualizar a ocorrência.');
      }
    } catch (err) {
      console.error('❌ Erro no salvamento da corretiva:', err);
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper para obter URL da imagem
  function getImageUrl(imgObj) {
    if (!imgObj) return null;
    if (typeof imgObj === 'string') {
      if (imgObj.startsWith('http') || imgObj.startsWith('data:')) return imgObj;
      if (imgObj.startsWith('/')) return `https://torrescx.sharepoint.com${imgObj}`;
      return imgObj;
    }
    if (imgObj.fullUrl) return imgObj.fullUrl;
    const serverUrl = imgObj.serverUrl || 'https://torrescx.sharepoint.com';
    let relUrl = imgObj.serverRelativeUrl || imgObj.url || '';
    if (!relUrl) return null;
    if (relUrl.startsWith('http') || relUrl.startsWith('data:')) return relUrl;
    if (!relUrl.startsWith('/')) relUrl = '/' + relUrl;
    return `${serverUrl}${relUrl}`;
  }

  const img1Url = getImageUrl(corretiva.imagem1);
  const img2Url = getImageUrl(corretiva.imagem2);

  const statusOptions = [
    { value: 'Pendente', label: 'Pendente', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100', activeColor: 'bg-red-600 text-white' },
    { value: 'Em Andamento', label: 'Em Andamento', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100', activeColor: 'bg-blue-600 text-white' },
    { value: 'Aguardando Peça', label: 'Aguardando Peça', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', activeColor: 'bg-amber-600 text-white' },
    { value: 'Concluída', label: 'Concluída', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', activeColor: 'bg-emerald-600 text-white' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Cabeçalho */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center font-bold text-white shadow-lg">
              OS #{corretiva.osNumber}
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">{corretiva.titulo}</h2>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{corretiva.categoria}</span> • <span>Solicitante: {corretiva.solicitante}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo do Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
              <AlertTriangle className="shrink-0 text-red-600" size={20} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dados da Ocorrência Original */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={14} /> Detalhes da Falha Relatada
            </h3>
            <p className="text-sm font-medium text-slate-800 whitespace-pre-line bg-white p-3 rounded-lg border border-slate-200">
              {corretiva.descricaoDefeito || 'Sem descrição cadastrada.'}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block">Prioridade</span>
                <span className="font-bold text-slate-700">{corretiva.prioridade || 'Normal'}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block">Data Relatada</span>
                <span className="font-bold text-slate-700">
                  {formatDate(corretiva.dataRelatada) || '—'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 col-span-2 md:col-span-1">
                <span className="text-slate-400 block">Atendimento Atual</span>
                <span className="font-bold text-slate-700">{formatDate(corretiva.dataAtendimento) || 'Pendente'}</span>
              </div>
            </div>

            {/* Imagens Anexadas na Preventiva */}
            {(img1Url || img2Url) && (
              <div className="pt-2">
                <span className="text-xs font-semibold text-slate-500 block mb-2">Fotos da Preventiva (Inspeção):</span>
                <div className="flex gap-3">
                  {img1Url && (
                    <button
                      type="button"
                      onClick={() => setSelectedFullImage(img1Url)}
                      className="group relative w-24 h-24 rounded-lg overflow-hidden border border-slate-300 hover:border-red-500 transition-all shadow-sm"
                    >
                      <img src={img1Url} alt="Foto 1" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">Foto 1</span>
                    </button>
                  )}
                  {img2Url && (
                    <button
                      type="button"
                      onClick={() => setSelectedFullImage(img2Url)}
                      className="group relative w-24 h-24 rounded-lg overflow-hidden border border-slate-300 hover:border-red-500 transition-all shadow-sm"
                    >
                      <img src={img2Url} alt="Foto 2" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">Foto 2</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Campo 1: Seleção de Status */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Status do Atendimento <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {statusOptions.map((opt) => {
                const isSelected = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      isSelected ? opt.activeColor + ' shadow-md scale-[1.02]' : opt.color
                    }`}
                  >
                    {opt.value === 'Concluída' && <CheckCircle size={14} />}
                    {opt.value === 'Em Andamento' && <Clock size={14} />}
                    {opt.value === 'Aguardando Peça' && <Package size={14} />}
                    {opt.value === 'Pendente' && <AlertTriangle size={14} />}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campo 2: Resolução do Problema */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Resolução do Problema <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={resolucaoProblema}
              onChange={(e) => setResolucaoProblema(e.target.value)}
              placeholder="Descreva detalhadamente a ação corretiva realizada pelo técnico..."
              className="w-full p-3 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-slate-800 text-sm resize-none transition-all placeholder:text-slate-400"
              required={status === 'Concluída'}
            />
          </div>

          {/* Campo 3: Imagem_3 (Foto do Reparo / Evidência Adicional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Imagem de Evidência da Solução (Campo Imagem_3)
            </label>
            
            {imagem3Preview ? (
              <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-slate-300 shadow-md group">
                <img src={imagem3Preview} alt="Evidência Solução" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFullImage(imagem3Preview)}
                    className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg backdrop-blur-sm transition-colors"
                    title="Visualizar"
                  >
                    <ImageIcon size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage3}
                    className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg backdrop-blur-sm transition-colors"
                    title="Remover"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-red-500 bg-slate-50 hover:bg-red-50/30 cursor-pointer transition-all">
                <Camera className="text-slate-400 mb-2" size={32} />
                <span className="text-xs font-semibold text-slate-700">Clique para adicionar 1 Imagem</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Tire uma foto ou selecione do dispositivo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Campo 4: Data de Atendimento Automática */}
          <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2 font-medium">
              <Calendar size={16} className="text-blue-600" />
              <span>Data do Atendimento: <strong className="text-blue-950 font-bold">{todayFormatted}</strong></span>
            </div>
            <span className="text-[11px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
              Atualizada Automaticamente
            </span>
          </div>

        </form>

        {/* Rodapé de Ações */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Salva Ocorrência...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Salvar Atendimento
              </>
            )}
          </button>
        </div>

      </div>

      {/* Modal de Zoom de Imagem */}
      {selectedFullImage && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setSelectedFullImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={selectedFullImage} alt="Zoom" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain" />
            <button
              onClick={() => setSelectedFullImage(null)}
              className="absolute -top-4 -right-4 p-2 bg-white text-slate-900 rounded-full shadow-lg hover:bg-slate-200"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
