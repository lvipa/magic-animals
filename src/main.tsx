import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import './app/style.css';
import { registerSW } from 'virtual:pwa-register';
let reloading = false;
const reloadUpdatedApp = () => {
  if (reloading) return;
  reloading = true;
  window.location.reload();
};
if ('serviceWorker' in navigator) {
  let previousController = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (previousController) reloadUpdatedApp();
    previousController = navigator.serviceWorker.controller;
  });
}
registerSW({
  immediate: true,
  onNeedReload: reloadUpdatedApp,
  onRegisteredSW(_url, registration) {
    if (!registration) return;

    const checkForUpdate = () => {
      if (navigator.onLine) void registration.update().catch(() => {
        // Offline or temporarily unavailable hosting: keep the installed copy.
      });
    };

    checkForUpdate();
    window.setInterval(checkForUpdate, 60 * 1000);
    window.addEventListener('online', checkForUpdate);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForUpdate();
    });
  },
});
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
