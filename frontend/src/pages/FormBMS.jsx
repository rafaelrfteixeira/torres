import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';



/**
 * FormBMS — Relatório Operacional / Check List Lojas (BMS)
 *
 * Reprodução digital do formulário BMS.
 * Utiliza react-hook-form para gerenciamento de estado.
 */

const SISTEMAS_PADRAO = [
  'Sensor de temperatura ambiente',
  'Sensor de duto',
  'Botão de pânico',
  'Sensor de movimento',
  'Sensor de porta'
];

const SISTEMAS_VALORES = [
  'Sensor de barreira',
  'Falta de fase'
];

const TIPOS_LOJA = ['Âncora', 'Megaloja', 'Satélite', 'Fast Food', 'Restaurante', 'Clínica', 'Valores'];

const STATUS_LOJA = [
  'Sistema Funcionando Normalmente',
  'Sistema Funcionando Parcialmente',
  'Sistema com Defeito',
  'Não Possui BMS',
];

const PENDENCIAS = [
  'Necessário Abertura do Forro',
  'Verificar Integridade do Cabo de Alimentação',
  'Verificar Integridade do Cabo de Sinal',
  'Interligar o Sistema da Loja com do Shopping',
  'Necessário Verificar o Sistema da Loja',
  'Troca de Dispositivo',
];

export default function FormBMS({ user }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isReadOnly = !!id;
  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // { type: 'success'|'error', message: '' }

  const { register, handleSubmit, watch, reset, setValue } = useForm({
    defaultValues: {
      data: new Date().toISOString().split('T')[0],
      loja: '',
      codigoLoja: '',
      responsavelShopping: {
        solicitante: 'Flávia Barbosa',
        telefone: '81992643095',
        email: 'flavia.barbosa@riomarrecife.com.br'
      },
      responsavelLoja: { solicitante: '', telefone: '', email: '' },
      tipoManutencao: '', // 'corretiva' ou 'preventiva'
      tipoLoja: '',
      sistemas: [...SISTEMAS_PADRAO, ...SISTEMAS_VALORES].reduce((acc, s) => {
        const key = s.replace(/\s+/g, '_').toLowerCase();
        acc[key] = { existenteSim: false, existenteNao: false, funcionandoSim: false, funcionandoNao: false };
        return acc;
      }, {}),
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
  const tipoLojaSelected = watch('tipoLoja');

  // Lógica condicional: Limpar estado quando desmarcar Valores
  useEffect(() => {
    if (tipoLojaSelected !== 'Valores') {
      SISTEMAS_VALORES.forEach(s => {
        const key = s.replace(/\s+/g, '_').toLowerCase();
        setValue(`sistemas.${key}`, { existenteSim: false, existenteNao: false, funcionandoSim: false, funcionandoNao: false });
      });
    }
  }, [tipoLojaSelected, setValue]);

  useEffect(() => {
    if (id) {
      const fetchChecklist = async () => {
        setIsLoading(true);
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
          const response = await fetch(`${API_URL}/checklists/${id}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              reset(result.data);
            }
          }
        } catch (error) {
          console.error('Erro ao buscar checklist:', error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchChecklist();
    }
  }, [id, reset]);

  const onSubmit = async (formData) => {
    // 1. Validação Prévia Simples
    if (!formData.loja?.trim()) {
      setSubmitStatus({
        type: 'error',
        message: '⚠️ Campo Obrigatório: Preencha o Nome da Loja antes de enviar.'
      });
      setTimeout(() => setSubmitStatus(null), 5000);
      return;
    }

    // 2. Validação da Seção Sistemas
    let chavesRequeridas = SISTEMAS_PADRAO.map(s => s.replace(/\s+/g, '_').toLowerCase());
    if (formData.tipoLoja === 'Valores') {
      const chavesValores = SISTEMAS_VALORES.map(s => s.replace(/\s+/g, '_').toLowerCase());
      chavesRequeridas = [...chavesRequeridas, ...chavesValores];
    }

    const sistemasNaoPreenchidos = chavesRequeridas.some(key => {
      const s = formData.sistemas[key];
      return !s?.existenteSim && !s?.existenteNao;
    });

    if (sistemasNaoPreenchidos) {
      alert("Por favor, preencha se os sistemas são existentes (Sim ou Não) para todas as linhas da tabela de Sistemas.");
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
      shopping_slug: 'riomar_recife',
      checklist_type: 'bms',
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
        console.log('✅ Resposta do backend BMS:', result);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 py-4 sm:py-6 px-3 sm:px-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        {/* ============================================ */}
        {/* CABEÇALHO DO FORMULÁRIO                      */}
        {/* ============================================ */}
        <div className="bg-gradient-to-r from-brand-800 to-brand-700 px-4 sm:px-6 py-4 sm:py-5 text-white">
          {/* Breadcrumb / Contexto */}
          <div className="flex items-center gap-2 mb-4 px-2.5 py-1.5 bg-black/10 w-fit rounded-md border border-white/10 backdrop-blur-sm">
            <div className="bg-white rounded p-0.5">
              <img src="/logo_riomar_recife.png" alt="RioMar" className="h-3 sm:h-4 object-contain" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-blue-50 tracking-wide">
              Shopping RioMar Recife <span className="text-blue-200 mx-1">&gt;</span> Inspeção BMS
            </span>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 relative mt-2 sm:mt-0">
            <div className="w-full flex items-center justify-center relative">
              <button
                type="button"
                onClick={() => navigate('/riomar_recife/selecionar-form')}
                className="absolute left-0 p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                title="Voltar para o Painel"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
              </button>
              <div className="flex items-center bg-white rounded-lg px-3 py-1 shadow-sm">
                <img src="/logo.png" alt="Torres Cx" className="h-10 sm:h-12 object-contain" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold tracking-wide">RELATÓRIO OPERACIONAL</p>
              <p className="text-blue-200 text-xs sm:text-sm mt-0.5">Check List — BMS</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-7">
          <fieldset disabled={isReadOnly} className="space-y-7 break-inside-avoid border-0 p-0 m-0">
            {/* ============================================ */}
            {/* MANUTENÇÃO CORRETIVA / PREVENTIVA            */}
            {/* ============================================ */}
            <div className="flex flex-wrap gap-4 sm:gap-6 items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Tipo de Manutenção:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="corretiva"
                  {...register('tipoManutencao', { required: true })}
                  required
                  className="w-5 h-5 border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-slate-700">Corretiva</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="preventiva"
                  {...register('tipoManutencao', { required: true })}
                  required
                  className="w-5 h-5 border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-slate-700">Manutenção Preventiva</span>
              </label>
            </div>

            {/* ============================================ */}
            {/* DADOS DA LOJA                                */}
            {/* ============================================ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Data" type="date" register={register('data')} />
              <InputField label="Loja" register={register('loja')} placeholder="Nome da loja" />
              <InputField label="Código Loja" register={register('codigoLoja')} placeholder="Código da loja" />
            </div>

            {/* ============================================ */}
            {/* CONTATOS — RESPONSÁVEIS                      */}
            {/* ============================================ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Responsável Shopping */}
              <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsável Shopping</h3>
                </div>
                <div className="p-4 space-y-3">
                  <InputField label="Solicitante" register={register('responsavelShopping.solicitante')} placeholder="Nome do responsável" readOnly={true} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField label="Telefone" type="tel" register={register('responsavelShopping.telefone')} placeholder="(00) 00000-0000" readOnly={true} />
                    <InputField label="E-mail" type="email" register={register('responsavelShopping.email')} placeholder="email@exemplo.com" />
                  </div>
                </div>
              </div>

              {/* Responsável Loja */}
              <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsável Loja</h3>
                </div>
                <div className="p-4 space-y-3">
                  <InputField label="Solicitante" register={register('responsavelLoja.solicitante', { required: true })} required={true} placeholder="Nome do responsável" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField label="Telefone" type="tel" register={register('responsavelLoja.telefone')} placeholder="(00) 00000-0000" />
                    <InputField label="E-mail" type="email" register={register('responsavelLoja.email')} placeholder="email@exemplo.com" />
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================ */}
            {/* TIPO DA LOJA                                 */}
            {/* ============================================ */}
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-100">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo da Loja</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-4">
                  {TIPOS_LOJA.map((tipo) => (
                    <label key={tipo} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        value={tipo}
                        {...register('tipoLoja', { required: true })}
                        required
                        className="w-4 h-4 sm:w-5 sm:h-5 border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0"
                      />
                      <span className="text-sm font-medium text-slate-700 group-hover:text-brand-700 transition-colors">{tipo}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* ============================================ */}
            {/* TABELA DE SISTEMAS                           */}
            {/* ============================================ */}
            <div className="w-full">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Header da tabela */}
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sistemas BMS</h3>
                </div>
                <div className="grid grid-cols-[2fr_repeat(4,_1fr)] bg-brand-800 text-white text-xs font-semibold uppercase tracking-wider">
                  <div className="px-4 py-3">Sistema</div>
                  <div className="px-2 py-3 text-center col-span-2 border-l border-brand-700">Existente</div>
                  <div className="px-2 py-3 text-center col-span-2 border-l border-brand-700">Funcionando</div>
                </div>
                <div className="grid grid-cols-[2fr_repeat(4,_1fr)] bg-brand-700 text-blue-200 text-xs font-medium">
                  <div className="px-4 py-1.5"></div>
                  <div className="px-2 py-1.5 text-center border-l border-brand-600">Sim</div>
                  <div className="px-2 py-1.5 text-center">Não</div>
                  <div className="px-2 py-1.5 text-center border-l border-brand-600">Sim</div>
                  <div className="px-2 py-1.5 text-center">Não</div>
                </div>

                {/* Linhas dos sistemas padrão */}
                {SISTEMAS_PADRAO.map((sistema, index) => {
                  const key = sistema.replace(/\s+/g, '_').toLowerCase();
                  const existenteNaoMarcado = sistemasWatch?.[key]?.existenteNao;

                  return (
                    <div
                      key={sistema}
                      className={`grid grid-cols-[2fr_repeat(4,_1fr)] items-center border-t border-slate-200 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                        } hover:bg-blue-50 transition-colors ${existenteNaoMarcado ? 'opacity-70' : ''}`}
                    >
                      <div className="px-4 py-3 text-sm font-medium text-slate-800">{sistema}</div>
                      <CheckboxCell register={register(`sistemas.${key}.existenteSim`, { onChange: (e) => { if (e.target.checked) setValue(`sistemas.${key}.existenteNao`, false); } })} />
                      <CheckboxCell register={register(`sistemas.${key}.existenteNao`, { onChange: (e) => { if (e.target.checked) setValue(`sistemas.${key}.existenteSim`, false); } })} />
                      <CheckboxCell register={register(`sistemas.${key}.funcionandoSim`, { onChange: (e) => { if (e.target.checked) setValue(`sistemas.${key}.funcionandoNao`, false); } })} borderLeft disabled={existenteNaoMarcado} />
                      <CheckboxCell register={register(`sistemas.${key}.funcionandoNao`, { onChange: (e) => { if (e.target.checked) setValue(`sistemas.${key}.funcionandoSim`, false); } })} disabled={existenteNaoMarcado} />
                    </div>
                  );
                })}

                {/* Linhas condicionais (se Valores selecionado) */}
                {tipoLojaSelected === 'Valores' && SISTEMAS_VALORES.map((sistema, index) => {
                  const key = sistema.replace(/\s+/g, '_').toLowerCase();
                  const existenteNaoMarcado = sistemasWatch?.[key]?.existenteNao;

                  const globalIndex = index + SISTEMAS_PADRAO.length;

                  return (
                    <div
                      key={sistema}
                      className={`grid grid-cols-[2fr_repeat(4,_1fr)] items-center border-t border-slate-200 ${globalIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                        } hover:bg-blue-50 transition-colors ${existenteNaoMarcado ? 'opacity-70' : ''}`}
                    >
                      <div className="px-4 py-3 text-sm font-medium text-slate-800">{sistema}</div>
                      <CheckboxCell register={register(`sistemas.${key}.existenteSim`, { onChange: (e) => { if (e.target.checked) setValue(`sistemas.${key}.existenteNao`, false); } })} />
                      <CheckboxCell register={register(`sistemas.${key}.existenteNao`, { onChange: (e) => { if (e.target.checked) setValue(`sistemas.${key}.existenteSim`, false); } })} />
                      <CheckboxCell register={register(`sistemas.${key}.funcionandoSim`, { onChange: (e) => { if (e.target.checked) setValue(`sistemas.${key}.funcionandoNao`, false); } })} borderLeft disabled={existenteNaoMarcado} />
                      <CheckboxCell register={register(`sistemas.${key}.funcionandoNao`, { onChange: (e) => { if (e.target.checked) setValue(`sistemas.${key}.funcionandoSim`, false); } })} disabled={existenteNaoMarcado} />
                    </div>
                  );
                })}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status da Loja */}
              <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status da Loja</h3>
                </div>
                <div className="p-4 space-y-2">
                  {STATUS_LOJA.map((status) => (
                    <label key={status} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        value={status}
                        {...register('statusLojaOpcao', { required: true })}
                        required
                        className="w-5 h-5 border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700 group-hover:text-brand-700 transition-colors">{status}</span>
                    </label>
                  ))}
                  {/* Outros */}
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-sm font-medium text-slate-600 shrink-0">Outros:</label>
                    <input
                      type="text"
                      {...register('statusOutros')}
                      className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                      placeholder="Especifique..."
                    />
                  </div>
                </div>
              </div>

              {/* Pendências */}
              <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pendências</h3>
                </div>
                <div className="p-4 space-y-2">
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
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-sm font-medium text-slate-600 shrink-0">Outros:</label>
                    <input
                      type="text"
                      {...register('pendenciasOutros')}
                      className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                      placeholder="Especifique..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================ */}
            {/* RODAPÉ — ENG/TÉC, HORÁRIOS, ACEITE           */}
            {/* ============================================ */}
            <div className="border-t-2 border-slate-200 pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Eng. / Técnico" register={register('engTecnico')} placeholder="Nome completo" />
                <InputField label="Aceito Por" register={register('aceitoPor', { required: true })} required={true} placeholder="Nome de quem aceita" />
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Horário Início" type="time" register={register('horarioInicio', { required: true })} required={true} />
                  <InputField
                    label="Horário Término"
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
              </div>
            </div>

            {/* ============================================ */}
            {/* TOAST NOTIFICATION                            */}
            {/* ============================================ */}
            {submitStatus && (
              <div
                className={`fixed top-6 right-6 z-50 max-w-md px-6 py-4 rounded-xl shadow-2xl animate-slide-in ${submitStatus.type === 'success'
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

          </fieldset>

          {/* ============================================ */}
          {/* BOTÃO SALVAR (Oculto em visualização)        */}
          {/* ============================================ */}
          {!isReadOnly && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full sm:w-auto px-10 py-5 text-white font-bold rounded-2xl shadow-xl text-base sm:text-lg uppercase tracking-wider transition-all duration-300 cursor-pointer ${isLoading
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
          )}
        </div>
      </form>
    </div>
  );
}

/* ============================================ */
/* COMPONENTES AUXILIARES                       */
/* ============================================ */

function InputField({ label, register, type = 'text', placeholder = '', className = '', disabled = false, readOnly = false, required = false }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-600 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        {...register}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none placeholder:text-slate-400 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed read-only:bg-slate-100 read-only:text-slate-500 read-only:focus:border-slate-300 read-only:focus:ring-0"
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
