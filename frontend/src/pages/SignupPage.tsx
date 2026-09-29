import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sprout,
  ShieldCheck,
  Lock,
  Phone,
  Mail,
  User,
  MapPin,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  ArrowRight
} from 'lucide-react';
import type { UserRole, RegionSummary } from '../types/api';
import { AuthVisualPanel } from '../components/AuthVisualPanel';
import { getTranslation, LANGUAGE_NAMES, type SupportedLanguage } from '../i18n';

interface SignupPageProps {
  regions: RegionSummary[];
  lang?: SupportedLanguage;
  onSelectLang?: (lang: SupportedLanguage) => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({
  regions,
  lang = 'en',
  onSelectLang
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup } = useAuth();

  const initialRole = (searchParams.get('role') as UserRole) || 'farmer';
  const [role, setRole] = useState<UserRole>(initialRole);
  const [selectedRegion, setSelectedRegion] = useState<string>(regions[0]?.region_id || 'ka-tumakuru');
  const [name, setName] = useState<string>('');
  const [contact, setContact] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [crop, setCrop] = useState<string>('ragi');
  const [designation, setDesignation] = useState<string>('Agricultural Extension Officer');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const t = getTranslation(lang);
  const a = t.auth || {};
  const currentRegionMeta = regions.find((r) => r.region_id === selectedRegion) || regions[0];

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    if (onSelectLang) {
      onSelectLang(newLang);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(lang === 'mr' ? 'कृपया आपले नाव प्रविष्ट करा' : lang === 'hi' ? 'कृपया अपना नाम दर्ज करें' : lang === 'kn' ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರನ್ನು ನಮೂದಿಸಿ' : 'Please enter your Name');
      return;
    }
    if (!contact.trim()) {
      setError(
        role === 'farmer'
          ? (lang === 'mr' ? 'कृपया आपला मोबाईल क्रमांक प्रविष्ट करा' : lang === 'hi' ? 'कृपया अपना मोबाइल नंबर दर्ज करें' : lang === 'kn' ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ' : 'Please enter your Mobile Number')
          : (lang === 'mr' ? 'कृपया आपला शासकीय ईमेल प्रविष्ट करा' : lang === 'hi' ? 'कृपया अपना आधिकारिक ईमेल दर्ज करें' : lang === 'kn' ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಅಧಿಕೃತ ಇಮೇಲ್ ನಮೂದಿಸಿ' : 'Please enter your Official Email')
      );
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      signup({
        name: name.trim(),
        role,
        phone: role === 'farmer' ? contact.trim() : undefined,
        email: role === 'officer' ? contact.trim() : undefined,
        regionId: selectedRegion,
        selectedCrop: role === 'farmer' ? crop : undefined,
        selectedStage: role === 'farmer' ? 'vegetative' : undefined,
        designation: role === 'officer' ? designation.trim() : undefined,
        department: role === 'officer' ? 'Department of Agriculture' : undefined,
        isDemo: false
      });
      setIsLoading(false);
      navigate(`/?role=${role}&region=${selectedRegion}&lang=${lang}`);
    }, 300);
  };

  return (
    <div className="km-split-auth-container">
      {/* Left 45%: Registration Form */}
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

            <div className="km-auth-lang-selector" title={t.common?.select_language || 'Select Language'}>
              <Globe size={16} className="km-lang-globe-icon" />
              <select
                id="signup-language-select"
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

          <div className="km-auth-gov-tag">
            <span>{t.ministry_label || 'Ministry of Earth Sciences (MoES) — IMD PS 26074'}</span>
          </div>

          <div className="km-auth-welcome-block">
            <h1 className="km-auth-title">{a.sign_up || 'Create Account'}</h1>
            <p className="km-auth-subtitle">{a.portal_subtitle || 'Panchayat-level weather intelligence & agrometeorological advisory system'}</p>
          </div>

          {/* Role Cards */}
          <div className="km-role-section">
            <label className="km-role-label">{a.choose_role || 'Choose your role'}</label>
            <div className="km-role-cards-grid" role="radiogroup" aria-label="Select User Role">
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

          {/* Form */}
          <form onSubmit={handleFormSubmit} className="km-auth-form" noValidate>
            {error && <div className="km-auth-error" role="alert">{error}</div>}

            <div className="km-form-group">
              <label htmlFor="reg-name" className="km-label">
                {a.full_name || 'Full Name'} *
              </label>
              <div className="km-input-icon-wrap">
                <User size={18} className="km-input-icon" />
                <input
                  id="reg-name"
                  type="text"
                  className="km-input km-input-with-icon"
                  placeholder={role === 'farmer' ? 'e.g., Ramesh Gowda' : 'e.g., Dr. Ananya Sharma'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="km-form-group">
              <label htmlFor="reg-contact" className="km-label">
                {role === 'farmer'
                  ? (a.mobile_number_label || a.mobile_number || 'Mobile Number (10 Digits) *')
                  : (a.official_id || 'Official Government Email *')}
              </label>
              <div className="km-input-icon-wrap">
                {role === 'farmer' ? (
                  <Phone size={18} className="km-input-icon" />
                ) : (
                  <Mail size={18} className="km-input-icon" />
                )}
                <input
                  id="reg-contact"
                  type={role === 'farmer' ? 'tel' : 'email'}
                  className="km-input km-input-with-icon"
                  placeholder={role === 'farmer' ? (a.mobile_number_placeholder || '98765 43210') : 'officer@imd.gov.in'}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  required
                  autoComplete={role === 'farmer' ? 'tel' : 'email'}
                />
              </div>
            </div>

            <div className="km-form-group">
              <label htmlFor="reg-region" className="km-label">
                {a.district_region || 'District / Pilot Region'} *
              </label>
              <div className="km-input-icon-wrap">
                <MapPin size={18} className="km-input-icon" />
                <select
                  id="reg-region"
                  className="km-select km-select-with-icon"
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
            </div>

            {role === 'farmer' ? (
              <div className="km-form-group">
                <label htmlFor="reg-crop" className="km-label">
                  {a.primary_crop || 'Primary Cultivated Crop'} *
                </label>
                <select
                  id="reg-crop"
                  className="km-select"
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                >
                  {(currentRegionMeta?.main_crops || ['ragi', 'paddy', 'groundnut', 'maize']).map((c) => (
                    <option key={c} value={c}>
                      {c.toUpperCase()}
                    </option>
                  ))}
                  <option value="wheat">WHEAT</option>
                  <option value="mustard">MUSTARD</option>
                  <option value="cotton">COTTON</option>
                  <option value="tomato">TOMATO</option>
                  <option value="sugarcane">SUGARCANE</option>
                </select>
              </div>
            ) : (
              <div className="km-form-group">
                <label htmlFor="reg-desig" className="km-label">
                  {a.official_designation || 'Official Designation'} *
                </label>
                <input
                  id="reg-desig"
                  type="text"
                  className="km-input"
                  placeholder="e.g., District Agromet Extension Officer"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              </div>
            )}

            <div className="km-form-group">
              <label htmlFor="reg-pass" className="km-label">
                {a.create_password || a.password || 'Create Password / PIN'} *
              </label>
              <div className="km-input-icon-wrap">
                <Lock size={18} className="km-input-icon" />
                <input
                  id="reg-pass"
                  type={showPassword ? 'text' : 'password'}
                  className="km-input km-input-with-icon"
                  placeholder="Create a secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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
                    {a.sign_up || 'Create Account'} &amp; {role === 'farmer' ? (a.role_farmer_title || 'Farmer') : (a.role_officer_title || 'Officer')}
                  </span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="km-auth-footer">
            <p>
              {a.have_account || 'Already have an account?'}{' '}
              <Link to={`/login?role=${role}&lang=${lang}&region=${selectedRegion}`} className="km-auth-link">
                {a.login_prompt || 'Sign in here'}
              </Link>
            </p>
            <div className="km-auth-provenance-note">
              <CheckCircle2 size={14} className="km-text-success" />
              <span>{a.provenance_banner || 'Operating in Calibrated Synthetic Demonstration Mode'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right 55%: Rich Animated Visual Panel */}
      <AuthVisualPanel lang={lang} />
    </div>
  );
};
