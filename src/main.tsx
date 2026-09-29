import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import './app/style.css';
import { registerSW } from 'virtual:pwa-register';
import { loadAuthoredCat } from './characters/authoredCat';
registerSW({ immediate: true });
void loadAuthoredCat().finally(() => createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
));
