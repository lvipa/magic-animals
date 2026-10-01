import { NavLink } from 'react-router-dom';
import { useGame } from '../storage/store';
export function KidNav() {
  return (
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
      <NavLink to="/connect-tv">
        <span>📺</span>TV
      </NavLink>
    </nav>
  );
}
