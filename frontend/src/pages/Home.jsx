import { useState } from 'react';

/**
 * Home Page
 *
 * Página inicial do sistema de inspeção.
 * Exibirá o dashboard com resumo das inspeções.
 */
function Home() {
  return (
    <div className="home-page">
      <h1>🔥 Sistema de Inspeção de Incêndio</h1>
      <p>Checklist digital para inspeção de sistemas de detecção, alarmes e automação.</p>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>📋 Inspeções Pendentes</h3>
          <span className="count">—</span>
        </div>
        <div className="summary-card">
          <h3>✅ Inspeções Concluídas</h3>
          <span className="count">—</span>
        </div>
        <div className="summary-card">
          <h3>🏪 Total de Lojas</h3>
          <span className="count">~500</span>
        </div>
      </div>
    </div>
  );
}

export default Home;
