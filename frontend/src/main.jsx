import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Registra o Service Worker do PWA com atualização automática
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('🔄 Nova versão do app disponível.');
  },
  onOfflineReady() {
    console.log('🚀 Torres CX pronto para funcionamento offline!');
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
