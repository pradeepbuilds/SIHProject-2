import React from 'react';
import { NavLink } from 'react-router-dom';
import { Map, BarChart3, AlertTriangle, GitCompare, BookOpen, Sun, Moon, Crosshair } from 'lucide-react';
import { getTranslation, LANGUAGE_NAMES, type SupportedLanguage } from '../i18n';
import type { RegionSummary } from '../types/api';

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
  const t = getTranslation(lang);
  const currentRegion = regions.find((r) => r.region_id === currentRegionId) || regions[0];

  return (
    <header className="km-header" role="banner">
      {/* Top Provenance / Data Mode Strip */}
      <div className="km-provenance-bar">
        <div className="km-container km-provenance-content">
          <div className="km-provenance-badges">
            <span className="km-badge km-badge-official" title="Official district polygon source">
              {t.data_mode_badges.boundaries_district}: {currentRegion?.district || 'District'}
            </span>
            <span className="km-badge km-badge-illustrative" title="Illustrative seeded Voronoi partition">
              {t.data_mode_badges.boundaries_sub_units}
            </span>
            <span className="km-badge km-badge-calibrated" title="Calibrated synthetic meteorological fields">
              {t.data_mode_badges.weather}
            </span>
          </div>

          {lang !== 'en' && (
            <div className="km-review-notice" role="status">
              <span>{t.translation_pending_review}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Bar */}
      <div className="km-main-bar">
        <div className="km-container km-bar-content">
          {/* Brand */}
          <div className="km-brand">
            <img src="/logo.svg" alt="KrishiMitra Logo" className="km-logo" width="34" height="34" />
            <div>
              <div className="km-brand-title">{t.app_name}</div>
              <div className="km-brand-tagline">{t.tagline}</div>
            </div>
          </div>

          {/* Region, Language & View Selectors */}
          <div className="km-header-controls">
            {/* Region Selector */}
            <div className="km-control-group">
              <label htmlFor="region-select" className="km-visually-hidden">
                Select Region
              </label>
              <select
                id="region-select"
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
              <label htmlFor="lang-select" className="km-visually-hidden">
                Language
              </label>
              <select
                id="lang-select"
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

            {/* Farmer / Officer View Toggle */}
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

            {/* On-Demand Point Query Button */}
            <button
              type="button"
              className="km-btn km-btn-outline km-point-query-btn"
              onClick={onOpenPointQuery}
              title="Query GPS Coordinate"
            >
              <Crosshair size={15} />
              <span>Point Query</span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              className="km-icon-btn km-theme-toggle"
              onClick={onToggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="km-nav-tabs" aria-label="Main Navigation">
        <div className="km-container km-nav-content">
          <NavLink to="/" end className={({ isActive }) => `km-nav-link ${isActive ? 'active' : ''}`}>
            <Map size={16} />
            <span>{t.nav.map}</span>
          </NavLink>
          <NavLink to="/insights" className={({ isActive }) => `km-nav-link ${isActive ? 'active' : ''}`}>
            <BarChart3 size={16} />
            <span>{t.nav.insights}</span>
          </NavLink>
          <NavLink to="/advisories" className={({ isActive }) => `km-nav-link ${isActive ? 'active' : ''}`}>
            <AlertTriangle size={16} />
            <span>{t.nav.advisories}</span>
          </NavLink>
          <NavLink to="/compare" className={({ isActive }) => `km-nav-link ${isActive ? 'active' : ''}`}>
            <GitCompare size={16} />
            <span>{t.nav.compare}</span>
          </NavLink>
          <NavLink to="/method" className={({ isActive }) => `km-nav-link ${isActive ? 'active' : ''}`}>
            <BookOpen size={16} />
            <span>{t.nav.method}</span>
          </NavLink>
        </div>
      </nav>
    </header>
  );
};
