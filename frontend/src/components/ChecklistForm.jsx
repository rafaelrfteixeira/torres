import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';


/**
 * ChecklistForm — Relatório Operacional / Check List Lojas
 *
 * Reprodução digital do formulário físico de inspeção de incêndio.
 * Utiliza react-hook-form para gerenciamento de estado.
 */

const SISTEMAS = [
  'Alarme do Shopping',
  'Alarme da Loja',
  'Extração de Fumaça',
  'Insuflamento de Ar',
  'Ar Condicionado',
  'Comando de Gás',
  'Damper Extração',
  'Damper Insuflamento',
];

const TIPOS_LOJA = ['Âncora', 'Megaloja', 'Satélite', 'Fast Food', 'Quiosque'];

const STATUS_LOJA = [
  'Sistema Funcionando Normalmente',
  'Sistema Funcionando Parcialmente',
  'Sistema com Defeito',
  'Não Possui Detecção',
];

const PENDENCIAS = [
  'Necessário Abertura do Forro',
  'Verificar Integridade do Cabo de Alimentação',
  'Verificar Integridade do Cabo de Sinal',
  'Interligar o Sistema da Loja com do Shopping',
  'Necessário Verificar o Sistema da Loja',
  'Troca de Dispositivo',
];

const ESPECIFICACOES = [
  { key: 'nDF', label: 'N° DF' },
  { key: 'nDT', label: 'N° DT' },
  { key: 'nAM', label: 'N° AM' },
  { key: 'nSirenes', label: 'N° Sirenes' },
  { key: 'nDG', label: 'N° DG' },
  { key: 'nModulos', label: 'N° Módulos' },
  { key: 'outrosDispositivos', label: 'Outros Dispositivos' },
];

export default function ChecklistForm({ user }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // { type: 'success'|'error', message: '' }

  const { register, handleSubmit, watch, reset, setValue } = useForm({
    defaultValues: {
      data: new Date().toISOString().split('T')[0],
      loja: '',
      solicitante: '',
      telefone: '',
      email: '',
      tipoManutencao: '', // 'corretiva' ou 'preventiva'
      tipoLoja: '',
      sistemas: SISTEMAS.reduce((acc, s) => {
        const key = s.replace(/\s+/g, '_').toLowerCase();
        acc[key] = { existenteSim: false, existenteNao: false, funcionandoSim: false, funcionandoNao: false };
        return acc;
      }, {}),
      centralPropria: '',
      especificacoes: ESPECIFICACOES.reduce((acc, e) => { acc[e.key] = ''; return acc; }, {}),
      observacoes: '',
      statusLojaOpcao: '', // Opção selecionada
      statusOutros: '',
      pendencias: PENDENCIAS.reduce((acc, p) => { acc[p] = false; return acc; }, {}),
      pendenciasOutros: '',
      engTecnico: user?.name || '',
      horarioInicio: '',
      horarioTermino: '',
      totalHoras: '',
      aceitoPor: '',
    },
  });

  const sistemasWatch = watch('sistemas');

  const onSubmit = async (formData) => {
    // 1. Validação Prévia Simples
    if (!formData.loja?.trim() || !formData.email?.trim()) {
      setSubmitStatus({
        type: 'error',
        message: '⚠️ Campos Obrigatórios: Preencha o Nome da Loja e o E-mail do Solicitante antes de enviar.'
      });
      // Auto-dismiss após 5 segundos
      setTimeout(() => setSubmitStatus(null), 5000);
      return;
    }

    // 2. Horário Término Simulado Automático (Apenas visual / Lógica)
    const agora = new Date();
    const termino = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    formData.horarioTermino = termino;

    if (formData.horarioInicio) {
      const [h1, m1] = formData.horarioInicio.split(':').map(Number);
      const [h2, m2] = termino.split(':').map(Number);
      let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diffMinutes < 0) diffMinutes += 24 * 60; // Caso tenha passado da meia-noite
      const diffH = Math.floor(diffMinutes / 60);
      const diffM = diffMinutes % 60;
      formData.totalHoras = `${String(diffH).padStart(2, '0')}h${String(diffM).padStart(2, '0')}m`;
    }

    // Set UI directly via setValue so users can see the updated fields before reload if needed.
    setValue('horarioTermino', formData.horarioTermino);
    setValue('totalHoras', formData.totalHoras);

    // Mapear radios para booleans
    const formMapped = {
      ...formData,
      manutencaoCorretiva: formData.tipoManutencao === 'corretiva',
      manutencaoPreventiva: formData.tipoManutencao === 'preventiva',
      statusLoja: {}
    };

    STATUS_LOJA.forEach(statusOpcao => {
      formMapped.statusLoja[statusOpcao] = (formData.statusLojaOpcao === statusOpcao);
    });

    setIsLoading(true);
    setSubmitStatus(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

      const response = await fetch(`${API_URL}/checklists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formMapped),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // 3. Limpar Formulário e Exibir Sucesso
        setSubmitStatus({ type: 'success', message: '🚀 Relatório salvo no Lists e enviado por e-mail com sucesso!' });
        reset(); // Limpa todos os campos, retornando aos defaultValues definidos (vazios)
        console.log('✅ Resposta do backend:', result);
      } else {
        setSubmitStatus({ type: 'error', message: result.message || 'Erro ao processar o relatório.' });
        console.error('❌ Erro do backend:', result);
      }
    } catch (error) {
      setSubmitStatus({ type: 'error', message: 'Erro de conexão com o servidor. Verifique se o backend está rodando.' });
      console.error('❌ Erro de rede:', error);
    } finally {
      setIsLoading(false);
      // Auto-dismiss após 6 segundos
      setTimeout(() => setSubmitStatus(null), 6000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 py-6 px-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        {/* ============================================ */}
        {/* CABEÇALHO DO FORMULÁRIO                      */}
        {/* ============================================ */}
        <div className="bg-gradient-to-r from-brand-800 to-brand-700 px-6 py-5 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                title="Voltar para o Painel"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center bg-white rounded px-2 py-1 shadow-sm">
                <img src="/logo.png" alt="Torres Cx" className="h-10 sm:h-12 object-contain" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">RELATÓRIO OPERACIONAL</p>
              <p className="text-blue-200 text-sm">Check List — Lojas</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ============================================ */}
          {/* MANUTENÇÃO CORRETIVA / PREVENTIVA            */}
          {/* ============================================ */}
          <div className="flex flex-wrap gap-6 items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Tipo de Manutenção:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="corretiva"
                {...register('tipoManutencao')}
                className="w-5 h-5 border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm font-medium text-slate-700">Manutenção Corretiva</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="preventiva"
                {...register('tipoManutencao')}
                className="w-5 h-5 border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm font-medium text-slate-700">Manutenção Preventiva</span>
            </label>
          </div>

          {/* ============================================ */}
          {/* DADOS DA LOJA                                */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Data" type="date" register={register('data')} />
            <InputField label="Loja" register={register('loja')} placeholder="Nome da loja" />
            <InputField label="Solicitante" register={register('solicitante')} placeholder="Nome do solicitante" />
            <InputField label="Telefone" type="tel" register={register('telefone')} placeholder="(00) 00000-0000" />
            <InputField label="E-mail" type="email" register={register('email')} placeholder="email@exemplo.com" className="md:col-span-2" />
          </div>

          {/* ============================================ */}
          {/* TIPO DA LOJA                                 */}
          {/* ============================================ */}
          <fieldset className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <legend className="text-sm font-semibold text-slate-600 uppercase tracking-wide px-2">Tipo da Loja</legend>
            <div className="flex flex-wrap gap-4 mt-2">
              {TIPOS_LOJA.map((tipo) => (
                <label key={tipo} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    value={tipo}
                    {...register('tipoLoja')}
                    className="w-5 h-5 border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-brand-700 transition-colors">{tipo}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* ============================================ */}
          {/* TABELA DE SISTEMAS + ESPECIFICAÇÕES          */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tabela de Sistemas (2/3) */}
            <div className="lg:col-span-2">
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Sistemas</h2>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Header da tabela */}
                <div className="grid grid-cols-[1fr_repeat(4,_minmax(0,_1fr))] bg-brand-800 text-white text-xs font-semibold uppercase tracking-wider">
                  <div className="px-4 py-3">Sistema</div>
                  <div className="px-2 py-3 text-center col-span-2 border-l border-brand-700">Existente</div>
                  <div className="px-2 py-3 text-center col-span-2 border-l border-brand-700">Funcionando</div>
                </div>
                <div className="grid grid-cols-[1fr_repeat(4,_minmax(0,_1fr))] bg-brand-700 text-blue-200 text-xs font-medium">
                  <div className="px-4 py-1.5"></div>
                  <div className="px-2 py-1.5 text-center border-l border-brand-600">Sim</div>
                  <div className="px-2 py-1.5 text-center">Não</div>
                  <div className="px-2 py-1.5 text-center border-l border-brand-600">Sim</div>
                  <div className="px-2 py-1.5 text-center">Não</div>
                </div>

                {/* Linhas dos sistemas */}
                {SISTEMAS.map((sistema, index) => {
                  const key = sistema.replace(/\s+/g, '_').toLowerCase();
                  
                  // Se "Existente=Não" está marcado para esta linha, desabilitamos os checkboxes de "Funcionando"
                  const existenteNaoMarcado = sistemasWatch?.[key]?.existenteNao;

                  return (
                    <div
                      key={sistema}
                      className={`grid grid-cols-[1fr_repeat(4,_minmax(0,_1fr))] items-center border-t border-slate-200 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                      } hover:bg-blue-50 transition-colors ${existenteNaoMarcado ? 'opacity-70' : ''}`}
                    >
                      <div className="px-4 py-3 text-sm font-medium text-slate-800">{sistema}</div>
                      <CheckboxCell register={register(`sistemas.${key}.existenteSim`)} />
                      <CheckboxCell register={register(`sistemas.${key}.existenteNao`)} />
                      <CheckboxCell 
                        register={register(`sistemas.${key}.funcionandoSim`)} 
                        borderLeft 
                        disabled={existenteNaoMarcado} 
                      />
                      <CheckboxCell 
                        register={register(`sistemas.${key}.funcionandoNao`)} 
                        disabled={existenteNaoMarcado} 
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Especificações (1/3) */}
            <div>
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Especificações</h2>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white p-4 space-y-4">
                {/* Central Própria */}
                <fieldset>
                  <legend className="text-sm font-semibold text-slate-700 mb-2">Central Própria</legend>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value="sim" {...register('centralPropria')} className="w-4 h-4 text-brand-600 focus:ring-brand-500" />
                      <span className="text-sm text-slate-700">Sim</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value="nao" {...register('centralPropria')} className="w-4 h-4 text-brand-600 focus:ring-brand-500" />
                      <span className="text-sm text-slate-700">Não</span>
                    </label>
                  </div>
                </fieldset>

                <hr className="border-slate-200" />

                {/* Campos numéricos */}
                {ESPECIFICACOES.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-slate-700 whitespace-nowrap">{label}</label>
                    <input
                      type="number"
                      min="0"
                      {...register(`especificacoes.${key}`)}
                      className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-center focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* OBSERVAÇÕES                                  */}
          {/* ============================================ */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Observações
            </label>
            <textarea
              {...register('observacoes')}
              rows={4}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-y placeholder:text-slate-400"
              placeholder="Descreva observações relevantes sobre a inspeção..."
            />
          </div>

          {/* ============================================ */}
          {/* STATUS DA LOJA + PENDÊNCIAS                  */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status da Loja */}
            <fieldset className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <legend className="text-sm font-semibold text-slate-600 uppercase tracking-wide px-2">Status da Loja</legend>
              <div className="space-y-2 mt-2">
                {STATUS_LOJA.map((status) => (
                  <label key={status} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      value={status}
                      {...register('statusLojaOpcao')}
                      className="w-5 h-5 border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-brand-700 transition-colors">{status}</span>
                  </label>
                ))}
                {/* Outros */}
                <div className="flex items-center gap-3 mt-1">
                  <label className="text-sm font-medium text-slate-600">Outros:</label>
                  <input
                    type="text"
                    {...register('statusOutros')}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                    placeholder="Especifique..."
                  />
                </div>
              </div>
            </fieldset>

            {/* Pendências */}
            <fieldset className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <legend className="text-sm font-semibold text-slate-600 uppercase tracking-wide px-2">Pendências</legend>
              <div className="space-y-2 mt-2">
                {PENDENCIAS.map((pendencia) => (
                  <label key={pendencia} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      {...register(`pendencias.${pendencia}`)}
                      className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-brand-700 transition-colors">{pendencia}</span>
                  </label>
                ))}
                {/* Outros */}
                <div className="flex items-center gap-3 mt-1">
                  <label className="text-sm font-medium text-slate-600">Outros:</label>
                  <input
                    type="text"
                    {...register('pendenciasOutros')}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                    placeholder="Especifique..."
                  />
                </div>
              </div>
            </fieldset>
          </div>

          {/* ============================================ */}
          {/* RODAPÉ — ENG/TÉC, HORÁRIOS, ACEITE           */}
          {/* ============================================ */}
          <div className="border-t-2 border-slate-200 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <InputField label="Eng. / Técnico" register={register('engTecnico')} placeholder="Nome completo" />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Início" type="time" register={register('horarioInicio')} />
                <InputField 
                  label="Término" 
                  type="time" 
                  register={register('horarioTermino')} 
                  placeholder="Automático" 
                  disabled 
                  className="opacity-70 bg-slate-100 placeholder-slate-500" 
                />
              </div>
              <InputField 
                label="Total de Horas" 
                register={register('totalHoras')} 
                placeholder="Calculado ao salvar" 
                disabled 
                className="opacity-70 bg-slate-100 placeholder-slate-500" 
              />
              <InputField label="Aceito Por" register={register('aceitoPor')} placeholder="Nome de quem aceita" />
            </div>
          </div>

          {/* ============================================ */}
          {/* NOTA LEGAL                                   */}
          {/* ============================================ */}
          <p className="text-xs text-slate-400 leading-relaxed">
            * Conforme NBR 17240 – 10.3 – A manutenção preventiva deve garantir que o sistema de detecção e alarme de incêndio
            esteja em pleno funcionamento, ou registrar no relatório as suas restrições ou falhas. Neste último caso recomenda‑se
            que as correções necessárias sejam executadas de imediato. (Associação Brasileira de Normas Técnicas, 2010, p. 47).
          </p>

        {/* ============================================ */}
          {/* TOAST NOTIFICATION                            */}
          {/* ============================================ */}
          {submitStatus && (
            <div
              className={`fixed top-6 right-6 z-50 max-w-md px-6 py-4 rounded-xl shadow-2xl animate-slide-in ${
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

          {/* ============================================ */}
          {/* BOTÃO SALVAR                                 */}
          {/* ============================================ */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full sm:w-auto px-10 py-5 text-white font-bold rounded-2xl shadow-xl text-base sm:text-lg uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                isLoading
                  ? 'bg-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-brand-600 to-brand-800 shadow-brand-500/30 hover:from-brand-500 hover:to-brand-700 hover:shadow-2xl hover:shadow-brand-500/40 active:scale-[0.98]'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Gerando PDF e Processando...
                </span>
              ) : (
                '💾 Salvar e Enviar Relatório'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ============================================ */
/* COMPONENTES AUXILIARES                       */
/* ============================================ */

function InputField({ label, register, type = 'text', placeholder = '', className = '', disabled = false }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        {...register}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none placeholder:text-slate-400 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function CheckboxCell({ register, borderLeft = false, disabled = false }) {
  return (
    <div className={`flex justify-center py-3 ${borderLeft ? 'border-l border-slate-200' : ''}`}>
      <input
        type="checkbox"
        {...register}
        disabled={disabled}
        className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      />
    </div>
  );
}
