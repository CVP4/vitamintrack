import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Pill,
  CalendarDays,
  PackageSearch,
  UserRound,
  ArrowUpRight,
  Menu,
  X,
  Search,
  Sprout,
  Leaf,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTracker } from '../context/TrackerContext';
import { formatDate } from '../lib/dates';
import { useToday } from '../lib/useToday';

const links = [
  { to: '/', text: 'Обзор', icon: LayoutDashboard },
  { to: '/supplements', text: 'Мои добавки', icon: Pill },
  { to: '/history', text: 'История приёма', icon: CalendarDays },
  { to: '/catalog', text: 'Каталог добавок', icon: PackageSearch },
  { to: '/profile', text: 'Мой профиль', icon: UserRound },
];

export function Layout() {
  const { user } = useAuth();
  const { error, refresh } = useTracker();
  const date = useToday();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const handleChange = (event) => {
      setIsMobile(event.matches);
      if (!event.matches) setMenuOpen(false);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isMobile || !menuOpen) return;
    const menuButton = menuButtonRef.current;
    const sidebar = sidebarRef.current;
    closeButtonRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
      }
      if (event.key === 'Tab') {
        const elements = [...sidebar.querySelectorAll('button,a[href]')].filter(
          (element) => !element.disabled && element.getClientRects().length,
        );
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (window.matchMedia('(max-width: 760px)').matches) menuButton?.focus();
    };
  }, [isMobile, menuOpen]);

  return (
    <div className="app-shell">
      {menuOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Закрыть меню"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${menuOpen ? 'is-open' : ''}`}
        id="primary-sidebar"
        ref={sidebarRef}
        inert={isMobile && !menuOpen}
        aria-hidden={isMobile && !menuOpen ? true : undefined}
        role={isMobile ? 'dialog' : undefined}
        aria-modal={isMobile && menuOpen ? true : undefined}
        aria-label="Главное меню"
      >
        <Link className="brand" to="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-icon">
            <Pill size={23} />
          </span>
          Vitamin<span>Track</span>
        </Link>
        <button
          className="mobile-sidebar-close icon-button"
          ref={closeButtonRef}
          onClick={() => setMenuOpen(false)}
          aria-label="Закрыть меню"
        >
          <X size={22} />
        </button>
        <p className="sidebar-label">ВАШ ЛИЧНЫЙ РИТМ</p>
        <nav aria-label="Главная навигация">
          {links.map(({ to, text, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={19} />
              <span>{text}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Sprout size={23} />
            </span>
            <h3>
              Найдите свою добавку.
              <br />
              Соберите свой план.
            </h3>
            <p>
              Название и бренд из каталога.
              <br />
              Расписание — по вашему выбору.
            </p>
            <Link to="/catalog" onClick={() => setMenuOpen(false)}>
              Перейти в каталог <ArrowUpRight size={15} />
            </Link>
          </div>
          <Link className="sidebar-profile" to="/profile" onClick={() => setMenuOpen(false)}>
            <span className="avatar">{user.name[0]?.toUpperCase()}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.isDemo ? 'Демонстрационный профиль' : 'Личный кабинет'}</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </aside>
      <div className="main-column" inert={isMobile && menuOpen}>
        <header className="topbar">
          <div className="topbar-date">
            <button
              className="mobile-menu icon-button"
              ref={menuButtonRef}
              onClick={() => setMenuOpen(true)}
              aria-label="Открыть меню"
              aria-expanded={menuOpen}
              aria-controls="primary-sidebar"
            >
              <Menu size={23} />
            </button>
            <Leaf size={17} />
            <span>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          <div className="topbar-actions">
            <Link className="header-search" to="/catalog">
              <Search size={17} />
              <span>Найти добавку</span>
            </Link>
            <span className="topbar-divider" />
            <Link to="/profile" className="avatar avatar-small" aria-label="Открыть профиль">
              {user.name[0]?.toUpperCase()}
            </Link>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button className="button button-secondary" onClick={() => refresh()}>
                Повторить
              </button>
            </div>
          )}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            VitaminTrack <span className="footer-dot">·</span> Забота начинается с привычки
          </span>
          <span>Дозировки и назначения определяет ваш специалист.</span>
        </footer>
      </div>
    </div>
  );
}
