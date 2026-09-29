import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { OnDemandModal } from './components/OnDemandModal';
import { MapPage } from './pages/MapPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
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
  const { user } = useAuth();

  // Region and navigation state from URL query or user context / localStorage
  const savedLang = (localStorage.getItem('krishimitra_lang') as SupportedLanguage) || 'en';
  const regionParam = searchParams.get('region') || user?.regionId || 'ka-tumakuru';
  const langParam = (searchParams.get('lang') || savedLang) as SupportedLanguage;
  const viewParam = (searchParams.get('view') || user?.role || 'farmer') as 'farmer' | 'officer';

  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [currentRegionId, setCurrentRegionId] = useState<string>(regionParam);
  const [lang, setLang] = useState<SupportedLanguage>(langParam);
  const [userView, setUserView] = useState<'farmer' | 'officer'>(user?.role === 'farmer' ? 'farmer' : viewParam);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isOnDemandOpen, setIsOnDemandOpen] = useState<boolean>(false);

  // Sync userView when user role changes
  useEffect(() => {
    if (user?.role === 'farmer') {
      setUserView('farmer');
    }
  }, [user?.role]);

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
        const defaultMode = {
          boundaries_district: 'real',
          boundaries_sub_units: 'illustrative',
          terrain: 'synthetic',
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
            main_crops: ['ragi', 'groundnut', 'coconut', 'paddy', 'maize'],
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
            agro_climatic_zone: 'Western coastal plains and ghats (Konkan)',
            languages: ['en', 'mr', 'hi'],
            main_crops: ['paddy', 'mango', 'cashew', 'coconut'],
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
            agro_climatic_zone: 'Trans-Gangetic plains / North-western irrigated plain',
            languages: ['en', 'hi'],
            main_crops: ['wheat', 'paddy', 'maize', 'cotton'],
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
            agro_climatic_zone: 'Western dry zone / Arid Thar desert margin',
            languages: ['en', 'hi'],
            main_crops: ['bajra', 'mustard', 'groundnut', 'moong'],
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
    try {
      localStorage.setItem('krishimitra_lang', newLang);
    } catch {
      // ignore in private browsing
    }
    updateUrlParam('lang', newLang);
  };

  const handleToggleView = (view: 'farmer' | 'officer') => {
    // Only officers can toggle to officer view
    if (view === 'officer' && user?.role === 'farmer') {
      return;
    }
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

  // Is auth page or bulletin print view
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';
  const isBulletin = location.pathname === '/bulletin';

  return (
    <div className={`km-app km-theme-${theme}`}>
      {!isBulletin && !isAuthPage && (
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
        <Suspense fallback={<div className="km-loading-box" style={{ padding: '60px', textAlign: 'center' }}><div className="km-spinner"></div><p>Loading KrishiMitra intelligence...</p></div>}>
          <Routes>
            <Route
              path="/login"
              element={<LoginPage regions={regions} lang={lang} onSelectLang={handleSelectLang} />}
            />
            <Route
              path="/signup"
              element={<SignupPage regions={regions} lang={lang} onSelectLang={handleSelectLang} />}
            />

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

            <Route path="/advisories" element={<AdvisoriesPage currentRegionId={currentRegionId} lang={lang} />} />

            <Route
              path="/insights"
              element={
                <ProtectedRoute allowedRoles={['officer']}>
                  <InsightsPage currentRegionId={currentRegionId} lang={lang} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/compare"
              element={
                <ProtectedRoute allowedRoles={['officer']}>
                  <ComparePage currentRegionId={currentRegionId} lang={lang} />
                </ProtectedRoute>
              }
            />

            <Route path="/method" element={<MethodPage currentRegionId={currentRegionId} lang={lang} />} />
            <Route path="/bulletin" element={<BulletinPage />} />
          </Routes>
        </Suspense>
      </main>

      {/* Point Query Modal accessible from anywhere - Single Instance */}
      <OnDemandModal
        isOpen={isOnDemandOpen}
        onClose={() => setIsOnDemandOpen(false)}
        defaultDate="2026-05-15"
        lang={lang}
        onViewOnMap={(_lat, _lon, unitId) => {
          if (unitId) {
            updateUrlParam('unit', unitId);
          }
        }}
      />
    </div>
  );
};


export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
