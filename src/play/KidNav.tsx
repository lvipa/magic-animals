import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { useGame } from '../storage/store';
import './play.css';
export function KidNav({ inFlow = false }: { inFlow?: boolean }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  const navigation = (
    <nav className={`kid-nav${inFlow ? ' kid-nav-flow' : ''}`} aria-label="Детское меню">
      <NavLink to="/" end onClick={() => useGame.getState().send({ type: 'HOME' })}>
        <span>🏠</span>Домой
      </NavLink>
      <NavLink to="/hunt">
        <span>🔎</span>Карточки
      </NavLink>
      <NavLink to="/friends">
        <span>🐾</span>Друзья
      </NavLink>
      <NavLink to="/worlds">
        <span>🚀</span>Миры
      </NavLink>
      <NavLink to="/sing">
        <span>🎶</span>Песни
      </NavLink>
      <NavLink to="/connect-tv">
        <span>📺</span>TV
      </NavLink>
    </nav>
  );
  // Camera scenes need an external portal. Video lessons use normal document flow
  // so the menu cannot cover any part of the official player in landscape.
  return inFlow ? navigation : createPortal(navigation, document.body);
}
