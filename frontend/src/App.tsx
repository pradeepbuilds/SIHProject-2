import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { OnDemandModal } from './components/OnDemandModal';
import { MapPage } from './pages/MapPage';
import { fetchRegions } from './services/api';
import type { RegionSummary } from './types/api';
import type { SupportedLanguage } from './i18n';

const InsightsPage = lazy(() => import('./pages/InsightsPage').then(m => ({ default: m.InsightsPage })));
const AdvisoriesPage = lazy(() => import('./pages/AdvisoriesPage').then(m => ({ default: m.AdvisoriesPage })));
const ComparePage = lazy(() => import('./pages/ComparePage').then(m => ({ default: m.ComparePage })));
const MethodPage = lazy(() => import('./pages/MethodPage').then(m => ({ default: m.MethodPage })));
const BulletinPage = lazy(() => import('./pages/BulletinPage').then(m => ({ default: m.BulletinPage })));

const AppContent: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Region and navigation state from URL query
  const regionParam = searchParams.get('region') || 'ka-tumakuru';
  const langParam = (searchParams.get('lang') || 'en') as SupportedLanguage;
  const viewParam = (searchParams.get('view') || 'farmer') as 'farmer' | 'officer';

  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [currentRegionId, setCurrentRegionId] = useState<string>(regionParam);
  const [lang, setLang] = useState<SupportedLanguage>(langParam);
  const [userView, setUserView] = useState<'farmer' | 'officer'>(viewParam);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isOnDemandOpen, setIsOnDemandOpen] = useState<boolean>(false);

  // Load regions on mount
  useEffect(() => {
    fetchRegions()
      .then((data) => {
        setRegions(data);
        if (data.length > 0 && !data.some((r) => r.region_id === currentRegionId)) {
          setCurrentRegionId(data[0].region_id);
        }
      })
      .catch((err) => {
        console.error('Failed to load regions:', err);
        // Fallback default regions if API is starting up
        const defaultMode = {
          boundaries_district: 'real',
          boundaries_sub_units: 'illustrative',
          terrain: 'calibrated',
          weather: 'synthetic_calibrated'
        };
        const defaultBbox = { min_lat: 12.5, max_lat: 14.5, min_lon: 76.5, max_lon: 77.5 };
        const defaultHorizon = { min: 1, max: 5 };
        setRegions([
          {
            region_id: 'ka-tumakuru',
            id_prefix: 'PNC-KA',
            state: 'Karnataka',
            district: 'Tumakuru',
            agro_climatic_zone: 'Southern dry / semi-arid plateau',
            languages: ['en', 'kn', 'hi'],
            main_crops: ['ragi', 'groundnut', 'coconut'],
            data_mode: defaultMode,
            horizon_days: defaultHorizon,
            bbox: defaultBbox,
            attribution: 'geoBoundaries ADM2'
          },
          {
            region_id: 'mh-ratnagiri',
            id_prefix: 'PNC-MH',
            state: 'Maharashtra',
            district: 'Ratnagiri',
            agro_climatic_zone: 'Konkan coastal zone',
            languages: ['en', 'mr', 'hi'],
            main_crops: ['rice', 'mango', 'cashew'],
            data_mode: defaultMode,
            horizon_days: defaultHorizon,
            bbox: defaultBbox,
            attribution: 'geoBoundaries ADM2'
          },
          {
            region_id: 'pb-ludhiana',
            id_prefix: 'PNC-PB',
            state: 'Punjab',
            district: 'Ludhiana',
            agro_climatic_zone: 'Northern plain zone',
            languages: ['en', 'hi'],
            main_crops: ['wheat', 'rice', 'cotton'],
            data_mode: defaultMode,
            horizon_days: defaultHorizon,
            bbox: defaultBbox,
            attribution: 'geoBoundaries ADM2'
          },
          {
            region_id: 'rj-jodhpur',
            id_prefix: 'PNC-RJ',
            state: 'Rajasthan',
            district: 'Jodhpur',
            agro_climatic_zone: 'Western arid desert zone',
            languages: ['en', 'hi'],
            main_crops: ['bajra', 'mustard', 'groundnut'],
            data_mode: defaultMode,
            horizon_days: defaultHorizon,
            bbox: defaultBbox,
            attribution: 'geoBoundaries ADM2'
          }
        ]);
      });
  }, []);

  // Sync state with URL params
  const updateUrlParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const handleSelectRegion = (id: string) => {
    setCurrentRegionId(id);
    updateUrlParam('region', id);
  };

  const handleSelectLang = (newLang: SupportedLanguage) => {
    setLang(newLang);
    updateUrlParam('lang', newLang);
  };

  const handleToggleView = (view: 'farmer' | 'officer') => {
    setUserView(view);
    updateUrlParam('view', view);
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Is bulletin print view
  const isBulletin = location.pathname === '/bulletin';

  return (
    <div className={`km-app km-theme-${theme}`}>
      {!isBulletin && (
        <Header
          regions={regions}
          currentRegionId={currentRegionId}
          onSelectRegion={handleSelectRegion}
          lang={lang}
          onSelectLang={handleSelectLang}
          userView={userView}
          onToggleView={handleToggleView}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenPointQuery={() => setIsOnDemandOpen(true)}
        />
      )}

      <main className="km-main-content">
        <Suspense fallback={<div className="km-loading-box" style={{ padding: '40px', textAlign: 'center' }}><div className="km-spinner"></div><p>Loading...</p></div>}>
          <Routes>
            <Route
              path="/"
              element={
                <MapPage
                  currentRegionId={currentRegionId}
                  lang={lang}
                  userView={userView}
                  onSelectRegion={handleSelectRegion}
                  isOnDemandOpen={isOnDemandOpen}
                  onCloseOnDemand={() => setIsOnDemandOpen(false)}
                />
              }
            />
            <Route path="/insights" element={<InsightsPage currentRegionId={currentRegionId} />} />
            <Route path="/advisories" element={<AdvisoriesPage currentRegionId={currentRegionId} lang={lang} />} />
            <Route path="/compare" element={<ComparePage currentRegionId={currentRegionId} />} />
            <Route path="/method" element={<MethodPage currentRegionId={currentRegionId} />} />
            <Route path="/bulletin" element={<BulletinPage />} />
          </Routes>
        </Suspense>
      </main>

      {/* Point Query Modal accessible from anywhere */}
      <OnDemandModal
        isOpen={isOnDemandOpen}
        onClose={() => setIsOnDemandOpen(false)}
        defaultDate="2026-05-15"
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
