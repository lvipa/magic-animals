import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import './app/style.css';
import { registerSW } from 'virtual:pwa-register';
import { loadAuthoredCat } from './characters/authoredCat';
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;

    const checkForUpdate = () => {
      if (navigator.onLine) void registration.update().catch(() => {
        // Offline or temporarily unavailable hosting: keep the installed copy.
      });
    };

    checkForUpdate();
    window.setInterval(checkForUpdate, 15 * 60 * 1000);
    window.addEventListener('online', checkForUpdate);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForUpdate();
    });
  },
});
void loadAuthoredCat().finally(() => createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
));
