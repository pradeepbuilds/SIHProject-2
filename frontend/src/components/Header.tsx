import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Map,
  BarChart3,
  AlertTriangle,
  GitCompare,
  BookOpen,
  Sun,
  Moon,
  Crosshair,
  LogOut,
  Menu,
  X,
  Sprout,
  ShieldCheck
} from 'lucide-react';
import { getTranslation, LANGUAGE_NAMES, type SupportedLanguage } from '../i18n';
import type { RegionSummary } from '../types/api';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  regions: RegionSummary[];
  currentRegionId: string;
  onSelectRegion: (regionId: string) => void;
  lang: SupportedLanguage;
  onSelectLang: (lang: SupportedLanguage) => void;
  userView: 'farmer' | 'officer';
  onToggleView: (view: 'farmer' | 'officer') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenPointQuery: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  regions,
  currentRegionId,
  onSelectRegion,
  lang,
  onSelectLang,
  userView,
  onToggleView,
  theme,
  onToggleTheme,
  onOpenPointQuery
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const t = getTranslation(lang);
  const currentRegion = regions.find((r) => r.region_id === currentRegionId) || regions[0];

  const handleLogout = () => {
    logout();
    navigate(`/login?lang=${lang}&region=${currentRegionId}`);
  };

  const isOfficer = user?.role === 'officer' || userView === 'officer';

  return (
    <header className="km-header" role="banner">
      {/* Top Provenance / Data Mode Strip */}
      <div className="km-provenance-bar">
        <div className="km-container km-provenance-content">
          <div className="km-provenance-badges">
            <span className="km-badge km-badge-official" title="Official district polygon source">
              {t.data_mode_badges?.boundaries_district || 'District Boundary'}: {currentRegion?.district || 'District'}
            </span>
            <span className="km-badge km-badge-illustrative" title="Illustrative seeded Voronoi partition">
              {t.data_mode_badges?.boundaries_sub_units || 'Illustrative Panchayats'}
            </span>
            <span className="km-badge km-badge-calibrated" title="Calibrated synthetic meteorological fields">
              {t.data_mode_badges?.weather || 'Synthetic Weather Data'}
            </span>
          </div>

          <div className="km-provenance-right">
            {user && (
              <span className="km-auth-pill">
                {user.role === 'farmer' ? <Sprout size={13} className="km-text-success" /> : <ShieldCheck size={13} className="km-text-brand" />}
                <span>{user.name} ({user.role === 'farmer' ? (t.auth?.role_farmer_title || 'Farmer') : (t.auth?.role_officer_title || 'Officer')})</span>
              </span>
            )}

            {lang !== 'en' && (
              <div className="km-review-notice" role="status">
                <span>{t.translation_pending_review}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Brand & Controls Bar */}
      <div className="km-main-bar">
        <div className="km-container km-bar-content">
          {/* Prominent Brand Logo & Title */}
          <Link to={`/?lang=${lang}&region=${currentRegionId}`} className="km-brand" aria-label="KrishiMitra Home">
            <img
              src="/logo.svg"
              alt="KrishiMitra Logo"
              className="km-logo"
              width="52"
              height="52"
            />
            <div className="km-brand-text">
              <div className="km-brand-title">{t.app_name}</div>
              <div className="km-brand-tagline">{t.tagline}</div>
            </div>
          </Link>

          {/* Desktop Controls */}
          <div className="km-header-controls km-desktop-only">
            {/* Region Selector */}
            <div className="km-control-group">
              <label htmlFor="header-region-select" className="km-visually-hidden">
                {t.common?.district || 'Select Region'}
              </label>
              <select
                id="header-region-select"
                className="km-select km-select-region"
                value={currentRegionId}
                onChange={(e) => onSelectRegion(e.target.value)}
                aria-label="Select Region"
              >
                {regions.map((r) => (
                  <option key={r.region_id} value={r.region_id}>
                    {r.state} — {r.district}
                  </option>
                ))}
              </select>
            </div>

            {/* Language Switcher */}
            <div className="km-control-group">
              <label htmlFor="header-lang-select" className="km-visually-hidden">
                {t.common?.language || 'Language'}
              </label>
              <select
                id="header-lang-select"
                className="km-select km-select-lang"
                value={lang}
                onChange={(e) => onSelectLang(e.target.value as SupportedLanguage)}
                aria-label="Select Language"
              >
                {(Object.keys(LANGUAGE_NAMES) as SupportedLanguage[]).map((lKey) => (
                  <option key={lKey} value={lKey}>
                    {LANGUAGE_NAMES[lKey]}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Switcher / Indicator */}
            {user?.role === 'officer' ? (
              <div className="km-toggle-group" role="radiogroup" aria-label="Audience View">
                <button
                  type="button"
                  className={`km-toggle-btn ${userView === 'farmer' ? 'active' : ''}`}
                  onClick={() => onToggleView('farmer')}
                  role="radio"
                  aria-checked={userView === 'farmer'}
                >
                  {t.view.farmer}
                </button>
                <button
                  type="button"
                  className={`km-toggle-btn ${userView === 'officer' ? 'active' : ''}`}
                  onClick={() => onToggleView('officer')}
                  role="radio"
                  aria-checked={userView === 'officer'}
                >
                  {t.view.officer}
                </button>
              </div>
            ) : (
              <div className="km-role-badge-tag">
                <Sprout size={14} className="km-text-success" />
                <span>{t.view.farmer}</span>
              </div>
            )}

            {/* Point Query GPS Button */}
            <button
              type="button"
              className="km-btn km-btn-outline km-point-query-btn"
              onClick={onOpenPointQuery}
              title="Query GPS Coordinate"
            >
              <Crosshair size={16} />
              <span>{t.point_query?.button_label || 'Point Query'}</span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              className="km-icon-btn km-theme-toggle"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Auth Action */}
            {user ? (
              <button
                type="button"
                className="km-icon-btn km-logout-btn"
                onClick={handleLogout}
                title="Sign Out / Switch Account"
                aria-label="Sign Out"
              >
                <LogOut size={17} />
              </button>
            ) : (
              <Link to={`/login?lang=${lang}&region=${currentRegionId}`} className="km-btn km-btn-primary km-btn-sm">
                {t.auth?.sign_in || 'Sign In'}
              </Link>
            )}
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <div className="km-mobile-toggle-wrap km-mobile-only">
            <button
              type="button"
              className="km-icon-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="km-mobile-drawer">
          <div className="km-container km-mobile-drawer-content">
            <div className="km-drawer-row">
              <label className="km-label-sm">{t.map_controls?.select_region || 'District'}</label>
              <select
                className="km-select km-select-sm"
                value={currentRegionId}
                onChange={(e) => {
                  onSelectRegion(e.target.value);
                  setIsMobileMenuOpen(false);
                }}
              >
                {regions.map((r) => (
                  <option key={r.region_id} value={r.region_id}>
                    {r.state} — {r.district}
                  </option>
                ))}
              </select>
            </div>

            <div className="km-drawer-row">
              <label className="km-label-sm">{t.common?.language || 'Language'}</label>
              <select
                className="km-select km-select-sm"
                value={lang}
                onChange={(e) => {
                  onSelectLang(e.target.value as SupportedLanguage);
                  setIsMobileMenuOpen(false);
                }}
              >
                {(Object.keys(LANGUAGE_NAMES) as SupportedLanguage[]).map((lKey) => (
                  <option key={lKey} value={lKey}>
                    {LANGUAGE_NAMES[lKey]}
                  </option>
                ))}
              </select>
            </div>

            <div className="km-drawer-row km-drawer-actions">
              <button
                type="button"
                className="km-btn km-btn-outline km-btn-sm"
                onClick={() => {
                  onOpenPointQuery();
                  setIsMobileMenuOpen(false);
                }}
              >
                <Crosshair size={16} />
                <span>{t.point_query?.button_label || 'Point Query GPS'}</span>
              </button>

              <button
                type="button"
                className="km-btn km-btn-outline km-btn-sm"
                onClick={onToggleTheme}
              >
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                <span>{theme === 'light' ? (t.theme?.dark || 'Dark') : (t.theme?.light || 'Light')}</span>
              </button>
            </div>

            <div className="km-drawer-auth-row">
              {user ? (
                <button
                  type="button"
                  className="km-btn km-btn-ghost km-btn-sm km-text-danger"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>{t.auth?.logout || 'Sign Out'} ({user.name})</span>
                </button>
              ) : (
                <Link
                  to={`/login?lang=${lang}&region=${currentRegionId}`}
                  className="km-btn km-btn-primary km-btn-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t.auth?.sign_in || 'Sign In'} / {t.auth?.sign_up || 'Register'}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Role-Aware Navigation Links */}
      <nav className="km-nav-tabs" aria-label="Main Navigation">
        <div className="km-container km-nav-content">
          <NavLink to={`/?region=${currentRegionId}&lang=${lang}`} className={({ isActive }) => `km-nav-link ${isActive ? 'active' : ''}`} end>
            <Map size={16} />
            <span>{isOfficer ? (t.nav?.map_surveillance || t.nav?.map) : t.nav?.map}</span>
          </NavLink>

          <NavLink to={`/advisories?region=${currentRegionId}&lang=${lang}`} className={({ isActive }) => `km-nav-link ${isActive ? 'active' : ''}`}>
            <AlertTriangle size={16} />
            <span>{t.nav?.advisories}</span>
          </NavLink>

          {isOfficer && (
            <NavLink to={`/insights?region=${currentRegionId}&lang=${lang}`} className={({ isActive }) => `km-nav-link ${isActive ? 'active' : ''}`}>
              <BarChart3 size={16} />
              <span>{t.nav?.insights}</span>
            </NavLink>
          )}

          {isOfficer && (
            <NavLink to={`/compare?region=${currentRegionId}&lang=${lang}`} className={({ isActive }) => `km-nav-link ${isActive ? 'active' : ''}`}>
              <GitCompare size={16} />
              <span>{t.nav?.compare}</span>
            </NavLink>
          )}

          <NavLink to={`/method?region=${currentRegionId}&lang=${lang}`} className={({ isActive }) => `km-nav-link ${isActive ? 'active' : ''}`}>
            <BookOpen size={16} />
            <span>{t.nav?.method}</span>
          </NavLink>
        </div>
      </nav>
    </header>
  );
};
