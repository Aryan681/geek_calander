import { Link, NavLink } from "react-router-dom";
import { Menu, Search } from "lucide-react";
export function Header({ onSearch, onMenu }) {
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="brand-mark">GC</span>
        <span>
          GEEK <i>CALENDAR</i>
        </span>
      </Link>
      <nav>
        <NavLink to="/">Calendar</NavLink>
        <NavLink to="/discover">Discover</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
      <button
        className="search-button"
        onClick={onSearch}
        aria-label="Search events"
      >
        <Search size={17} />
        <span>Search releases</span>
        <kbd>⌘ K</kbd>
      </button>
      <button
        className="icon-button mobile-menu"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
    </header>
  );
}
