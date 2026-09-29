import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sprout,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Lock,
  Phone,
  Mail,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  Globe,
  User
} from 'lucide-react';
import type { UserRole, RegionSummary } from '../types/api';
import { AuthVisualPanel } from '../components/AuthVisualPanel';
import { getTranslation, LANGUAGE_NAMES, type SupportedLanguage } from '../i18n';

interface LoginPageProps {
  regions: RegionSummary[];
  lang?: SupportedLanguage;
  onSelectLang?: (lang: SupportedLanguage) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  regions,
  lang = 'en',
  onSelectLang
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginAsDemo, login } = useAuth();

  const initialRole = (searchParams.get('role') as UserRole) || 'farmer';
  const [role, setRole] = useState<UserRole>(initialRole);
  const [selectedRegion, setSelectedRegion] = useState<string>(regions[0]?.region_id || 'ka-tumakuru');
  const [name, setName] = useState<string>('');
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const t = getTranslation(lang);
  const a = t.auth || {};

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    if (onSelectLang) {
      onSelectLang(newLang);
    }
  };

  const handleDemoLogin = (selectedRole: UserRole) => {
    setIsLoading(true);
    setTimeout(() => {
      loginAsDemo(selectedRole, selectedRegion);
      setIsLoading(false);
      navigate(
        selectedRole === 'farmer'
          ? `/?role=farmer&region=${selectedRegion}&lang=${lang}`
          : `/?role=officer&region=${selectedRegion}&lang=${lang}`
      );
    }, 250);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError(
        role === 'farmer'
          ? (lang === 'mr' ? 'कृपया आपला मोबाईल क्रमांक प्रविष्ट करा' : lang === 'hi' ? 'कृपया अपना मोबाइल नंबर दर्ज करें' : lang === 'kn' ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ' : 'Please enter your Mobile Number')
          : (lang === 'mr' ? 'कृपया आपला शासकीय ईमेल / ओळख क्रमांक प्रविष्ट करा' : lang === 'hi' ? 'कृपया अपना आधिकारिक ईमेल दर्ज करें' : lang === 'kn' ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಅಧಿಕೃತ ಇಮೇಲ್ ನಮೂದಿಸಿ' : 'Please enter your Official Email / ID')
      );
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      login({
        id: `usr-${Date.now()}`,
        name: name.trim() || (role === 'farmer' ? (lang === 'mr' ? 'शेतकरी' : lang === 'hi' ? 'किसान' : lang === 'kn' ? 'ರೈತ' : 'Registered Farmer') : (lang === 'mr' ? 'कृषी अधिकारी' : lang === 'hi' ? 'कृषि अधिकारी' : lang === 'kn' ? 'ಕೃಷಿ ಅಧಿಕಾರಿ' : 'Agromet Field Officer')),
        role,
        phone: role === 'farmer' ? identifier : undefined,
        email: role === 'officer' ? identifier : undefined,
        regionId: selectedRegion,
        designation: role === 'officer' ? 'Agricultural Extension Officer' : undefined,
        department: role === 'officer' ? 'Department of Agriculture' : undefined,
        isDemo: false
      });
      setIsLoading(false);
      navigate(`/?role=${role}&region=${selectedRegion}&lang=${lang}`);
    }, 300);
  };

  return (
    <div className="km-split-auth-container">
      {/* Left 45%: Authentication Card Side */}
      <div className="km-auth-card-side">
        <div className="km-auth-card-inner">
          {/* Top Row: Brand & Language Selector */}
          <div className="km-auth-top-header">
            <Link to={`/?lang=${lang}`} className="km-auth-logo-link" aria-label="KrishiMitra Home">
              <img
                src="/logo.svg"
                alt="KrishiMitra Logo"
                width="48"
                height="48"
                className="km-auth-logo"
              />
              <div className="km-auth-brand-text">
                <span className="km-brand-name">{t.app_name}</span>
                <span className="km-brand-sub">{t.tagline}</span>
              </div>
            </Link>

            {/* Language Selector placed on top-right of panel */}
            <div className="km-auth-lang-selector" title={t.common?.select_language || 'Select Language'}>
              <Globe size={16} className="km-lang-globe-icon" />
              <select
                id="login-language-select"
                aria-label="Interface Language"
                className="km-select km-select-auth-lang"
                value={lang}
                onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
              >
                {(Object.keys(LANGUAGE_NAMES) as SupportedLanguage[]).map((lKey) => (
                  <option key={lKey} value={lKey}>
                    {LANGUAGE_NAMES[lKey]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ministry Provenance Tag */}
          <div className="km-auth-gov-tag">
            <span>{t.ministry_label || 'Ministry of Earth Sciences (MoES) — IMD PS 26074'}</span>
          </div>

          {/* Welcome Heading */}
          <div className="km-auth-welcome-block">
            <h1 className="km-auth-title">{a.welcome_title || 'Welcome to KrishiMitra'}</h1>
            <p className="km-auth-subtitle">{a.welcome_subtitle || 'Panchayat-level weather intelligence & agrometeorological advisories.'}</p>
          </div>

          {/* Role Selection Cards */}
          <div className="km-role-section">
            <label className="km-role-label">{a.choose_role || 'Choose your role'}</label>
            <div className="km-role-cards-grid" role="radiogroup" aria-label="Select User Role">
              {/* Farmer Role Card */}
              <div
                role="radio"
                aria-checked={role === 'farmer'}
                tabIndex={0}
                className={`km-role-card ${role === 'farmer' ? 'active' : ''}`}
                onClick={() => { setRole('farmer'); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setRole('farmer'); setError(''); } }}
              >
                <div className="km-rcard-icon km-rcard-farmer-icon">
                  <Sprout size={24} />
                </div>
                <div className="km-rcard-info">
                  <div className="km-rcard-title">{a.role_farmer_title || a.farmer_portal || 'Farmer'}</div>
                  <div className="km-rcard-desc">{a.role_farmer_subtitle || a.farmer_desc || 'Weather & Crop Advisory'}</div>
                </div>
                <div className="km-rcard-indicator" />
              </div>

              {/* Officer Role Card */}
              <div
                role="radio"
                aria-checked={role === 'officer'}
                tabIndex={0}
                className={`km-role-card ${role === 'officer' ? 'active' : ''}`}
                onClick={() => { setRole('officer'); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setRole('officer'); setError(''); } }}
              >
                <div className="km-rcard-icon km-rcard-officer-icon">
                  <ShieldCheck size={24} />
                </div>
                <div className="km-rcard-info">
                  <div className="km-rcard-title">{a.role_officer_title || a.officer_cockpit || 'Officer'}</div>
                  <div className="km-rcard-desc">{a.role_officer_subtitle || a.officer_desc || 'Surveillance & Analytics'}</div>
                </div>
                <div className="km-rcard-indicator" />
              </div>
            </div>
          </div>

          {/* 1-Click SIH Demo Access Banner */}
          <div className="km-demo-access-box">
            <div className="km-demo-header">
              <span className="km-demo-badge">
                <Sparkles size={12} className="km-inline-icon" /> {a.demo_badge || 'SIH DEMO MODE'}
              </span>
              <span className="km-demo-caption">{a.demo_desc || '1-Click Instant Evaluation Access'}</span>
            </div>
            <button
              type="button"
              className="km-btn km-btn-demo-action"
              onClick={() => handleDemoLogin(role)}
              disabled={isLoading}
            >
              <UserCheck size={18} />
              <span>
                {role === 'farmer'
                  ? (a.continue_farmer_demo || 'Continue with 1-Click Farmer Demo Account')
                  : (a.continue_officer_demo || 'Continue with 1-Click Officer Cockpit Account')}
              </span>
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="km-auth-divider">
            <span>{a.or_credentials || 'or sign in with credentials'}</span>
          </div>

          {/* Standard Login Form */}
          <form onSubmit={handleFormSubmit} className="km-auth-form" noValidate>
            {error && (
              <div className="km-auth-error" role="alert">
                {error}
              </div>
            )}

            <div className="km-form-group">
              <label htmlFor="auth-name" className="km-label">
                {a.full_name || 'Full Name'} <span className="km-optional-tag">{a.optional || '(Optional)'}</span>
              </label>
              <div className="km-input-icon-wrap">
                <User size={18} className="km-input-icon" />
                <input
                  id="auth-name"
                  type="text"
                  className="km-input km-input-with-icon"
                  placeholder={role === 'farmer' ? 'e.g., Ramesh Gowda' : 'e.g., Dr. Ananya Sharma'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="km-form-group">
              <label htmlFor="auth-identifier" className="km-label">
                {role === 'farmer'
                  ? (a.mobile_number_label || a.mobile_number || 'Mobile Number (10 Digits)')
                  : (a.official_id || 'Official Email / Government ID')}
              </label>
              <div className="km-input-icon-wrap">
                {role === 'farmer' ? (
                  <Phone size={18} className="km-input-icon" />
                ) : (
                  <Mail size={18} className="km-input-icon" />
                )}
                <input
                  id="auth-identifier"
                  type={role === 'farmer' ? 'tel' : 'email'}
                  className="km-input km-input-with-icon"
                  placeholder={role === 'farmer' ? (a.mobile_number_placeholder || '98765 43210') : 'officer@imd.gov.in'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete={role === 'farmer' ? 'tel' : 'email'}
                />
              </div>
            </div>

            <div className="km-form-group">
              <label htmlFor="auth-region" className="km-label">
                {a.district_region || 'District / Pilot Region'}
              </label>
              <select
                id="auth-region"
                className="km-select"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
              >
                {regions.map((r) => (
                  <option key={r.region_id} value={r.region_id}>
                    {r.state} — {r.district} ({r.agro_climatic_zone})
                  </option>
                ))}
              </select>
            </div>

            <div className="km-form-group">
              <label htmlFor="auth-password" className="km-label">
                {a.password || 'Password'}
              </label>
              <div className="km-input-icon-wrap">
                <Lock size={18} className="km-input-icon" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="km-input km-input-with-icon"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="km-password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? (a.hide_password || 'Hide password') : (a.show_password || 'Show password')}
                  title={showPassword ? (a.hide_password || 'Hide password') : (a.show_password || 'Show password')}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="km-auth-form-extras">
              <label className="km-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>{a.remember_me || 'Remember this workstation'}</span>
              </label>
            </div>

            <button
              type="submit"
              className="km-btn km-btn-primary km-btn-block km-auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="km-spinner-inline" />
                  <span>{a.signing_in || 'Signing in...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {role === 'farmer'
                      ? (a.sign_in_as_farmer || `Sign In as ${a.role_farmer_title || 'Farmer'}`)
                      : (a.sign_in_as_officer || `Sign In as ${a.role_officer_title || 'Officer'}`)}
                  </span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation & Provenance Notice */}
          <div className="km-auth-footer">
            <p>
              {a.no_account || "Don't have an account?"}{' '}
              <Link to={`/signup?role=${role}&lang=${lang}&region=${selectedRegion}`} className="km-auth-link">
                {a.register_prompt || 'Create account'}
              </Link>
            </p>
            <div className="km-auth-provenance-note">
              <CheckCircle2 size={14} className="km-text-success" />
              <span>{a.provenance_banner || 'Operating in Calibrated Synthetic Demonstration Mode'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right 55%: Rich Animated Farmer & Agriculture Visual Panel */}
      <AuthVisualPanel lang={lang} />
    </div>
  );
};
