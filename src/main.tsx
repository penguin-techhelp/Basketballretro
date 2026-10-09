import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker with auto-update on connect
if (typeof window !== 'undefined') {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('PWA: New version available. Workbox autoUpdate active.');
    },
    onOfflineReady() {
      console.log('PWA: Retro Hoops 95 cached and ready for offline play.');
    },
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        // Whenever device comes online or every minute, check for service worker update
        window.addEventListener('online', () => {
          registration.update().catch(console.warn);
        });
        setInterval(() => {
          if (navigator.onLine) {
            registration.update().catch(console.warn);
          }
        }, 60000);
      }
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
