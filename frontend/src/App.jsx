import { useState, useEffect } from 'react';
import ChecklistForm from './components/ChecklistForm';

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verifica se o usuário já está autenticado
    const checkAuth = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_URL}/auth/profile`, {
          credentials: 'include', // Envia os cookies de sessão!
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.isAuthenticated) {
            setUser(result.data.user);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const loginUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/signin`;
  const logoutUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/signout`;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  // --- TELA DE LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
          <div className="flex flex-col items-center justify-center mb-6">
            <img src="/logo.png" alt="Torres Cx" className="h-20 object-contain drop-shadow-sm" />
          </div>
          <div className="pt-4">
            <a
              href={loginUrl}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors shadow-lg"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
              </svg>
              Entrar com Microsoft 365
            </a>
            <p className="text-xs text-slate-400 mt-4">
              Acesso restrito a colaboradores autorizados.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- TELA PRINCIPAL (FORMULÁRIO) ---
  return (
    <>
      {/* Topbar do Usuário */}
      <div className="bg-slate-900 border-b border-brand-800 px-6 py-3 text-white flex justify-between items-center sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center font-bold text-sm">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <span className="text-sm font-medium hidden sm:inline-block">
            Olá, <span className="text-brand-300">{user.name}</span>
          </span>
        </div>
        <a
          href={logoutUrl}
          className="text-sm text-slate-300 hover:text-white flex items-center gap-2 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
        >
          Sair
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </a>
      </div>

      {/* Formulário */}
      <ChecklistForm user={user} />
    </>
  );
}

export default App;
