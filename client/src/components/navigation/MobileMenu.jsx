import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
export function MobileMenu({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="mobile-menu-panel">
      <button
        className="close-button"
        onClick={onClose}
        aria-label="Close menu"
      >
        <X />
      </button>
      <NavLink onClick={onClose} to="/">
        Calendar
      </NavLink>
      <NavLink onClick={onClose} to="/discover">
        Discover
      </NavLink>
      <NavLink onClick={onClose} to="/roulette">
        Geek Roulette
      </NavLink>
      <NavLink onClick={onClose} to="/about">
        About
      </NavLink>
    </div>
  );
}
