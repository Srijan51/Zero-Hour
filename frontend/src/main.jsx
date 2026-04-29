import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register';

registerSW({
  onOfflineReady() {
    document.dispatchEvent(new CustomEvent('swUpdated'));
  },
  onNeedRefresh() {
    document.dispatchEvent(new CustomEvent('swUpdated'));
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      registration.addEventListener('updatefound', () => {
        document.dispatchEvent(new CustomEvent('swUpdated'));
      });
    }
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
