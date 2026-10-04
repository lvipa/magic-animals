import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { useGame } from '../storage/store';
import './play.css';
export function KidNav() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  // Keep touch navigation outside the clipped, composited camera/WebGL scene.
  return createPortal(
    <nav className="kid-nav" aria-label="Детское меню">
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
    </nav>,
    document.body,
  );
}
