import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [checklists, setChecklists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_URL}/checklists`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setChecklists(result.data);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar checklists:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChecklists();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'Data não informada';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header content below topbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Painel Operacional</h1>
            <p className="text-slate-500 mt-1">Gerencie os relatórios e check lists das lojas</p>
          </div>
          <button
            onClick={() => navigate('/nova-loja')}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-brand-500/30 hover:shadow-brand-500/40 hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            Novo Check List
          </button>
        </div>

        {/* List of recent checklists */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-brand-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Check Lists Recentes</h2>
              <p className="text-sm text-slate-500">Últimos relatórios cadastrados no sistema</p>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 flex justify-center items-center text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mr-3"></div>
              <span>Carregando dados...</span>
            </div>
          ) : checklists.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                <FileText className="w-8 h-8" />
              </div>
              <p className="text-slate-500 text-lg font-medium">Nenhum check list encontrado</p>
              <p className="text-slate-400 text-sm mt-1 mb-6">Comece criando um novo registro para uma loja.</p>
              <button
                onClick={() => navigate('/nova-loja')}
                className="text-brand-600 hover:text-brand-700 font-medium px-4 py-2 bg-brand-50 rounded-lg transition-colors"
              >
                Criar primeiro relatório
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm">
                    <th className="py-4 px-6 font-medium">Data</th>
                    <th className="py-4 px-6 font-medium">Loja</th>
                    <th className="py-4 px-6 font-medium hidden sm:table-cell">Solicitante</th>
                    <th className="py-4 px-6 font-medium hidden md:table-cell">Técnico/Eng.</th>
                    <th className="py-4 px-6 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {checklists.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-sm">{formatDate(item.data)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-800">
                        {item.loja || '—'}
                        <div className="text-xs text-slate-400 font-normal sm:hidden mt-1">{item.solicitante || '—'}</div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-sm hidden sm:table-cell">
                        {item.solicitante || '—'}
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-sm hidden md:table-cell">
                        {item.engTecnico || '—'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {item.statusLoja && Object.values(item.statusLoja).includes(true) ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Registrado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full border border-slate-200">
                            <Clock className="w-3.5 h-3.5" />
                            Pendente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
