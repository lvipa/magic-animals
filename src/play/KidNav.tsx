import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { useGame } from '../storage/store';
import './play.css';
export function KidNav({
  inFlow = false,
  opening = false,
}: {
  inFlow?: boolean;
  opening?: boolean;
}) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  const navigation = (
    <nav className={`kid-nav${inFlow ? ' kid-nav-flow' : ''}`} aria-label="Детское меню">
      <NavLink
        to="/"
        end
        reloadDocument={opening}
        onClick={() => useGame.getState().send({ type: 'HOME' })}
      >
        <span>🏠</span>Домой
      </NavLink>
      <NavLink to="/hunt" reloadDocument={opening}>
        <span>🔎</span>Карточки
      </NavLink>
      <NavLink to="/friends" reloadDocument={opening}>
        <span>🐾</span>Друзья
      </NavLink>
      <NavLink to="/worlds" reloadDocument={opening}>
        <span>🚀</span>Миры
      </NavLink>
      <NavLink to="/sing" reloadDocument={opening}>
        <span>🎶</span>Песни
      </NavLink>
      <NavLink to="/connect-tv" reloadDocument={opening}>
        <span>📺</span>TV
      </NavLink>
    </nav>
  );
  // Camera scenes need an external portal. Video lessons use normal document flow
  // so the menu cannot cover any part of the official player in landscape.
  return inFlow ? navigation : createPortal(navigation, document.body);
}
