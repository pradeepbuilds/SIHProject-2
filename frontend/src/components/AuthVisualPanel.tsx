import React from 'react';
import { CloudRain, Thermometer, MapPin, Sprout, ShieldCheck, Sparkles } from 'lucide-react';
import { getTranslation, type SupportedLanguage } from '../i18n';

interface AuthVisualPanelProps {
  lang?: SupportedLanguage;
}

export const AuthVisualPanel: React.FC<AuthVisualPanelProps> = ({ lang = 'en' }) => {
  const t = getTranslation(lang);
  const a = t.auth || {};

  return (
    <div className="km-auth-visual-panel" aria-label="KrishiMitra Agricultural Visual">
      {/* Background Hero Image with Natural Vignette */}
      <div className="km-farmer-hero-container">
        <img
          src="/farmer_hero.jpg"
          alt="Indian Farmer in lush agricultural field"
          className="km-farmer-hero-img"
          loading="eager"
        />
        <div className="km-farmer-hero-overlay" />
      </div>

      {/* Floating Animated Agricultural & Weather Intelligence Widgets */}
      <div className="km-visual-overlay-layer">
        {/* Top Floating Badge */}
        <div className="km-visual-top-badge animate-float-slow">
          <div className="km-vbadge-icon">
            <Sparkles size={14} className="km-text-amber" />
          </div>
          <span>{a.visual_badge || 'Panchayat-Level Agromet'}</span>
        </div>

        {/* Floating Weather Indicator: Rainfall */}
        <div className="km-floating-card km-card-rain animate-float-1">
          <div className="km-fcard-icon km-fcard-rain-icon">
            <CloudRain size={20} />
          </div>
          <div className="km-fcard-body">
            <span className="km-fcard-label">{a.visual_weather_rain || 'Rainfall'}</span>
            <span className="km-fcard-val">72 mm</span>
            <span className="km-fcard-sub">85% probability · PNC-MH-0019</span>
          </div>
        </div>

        {/* Floating Weather Indicator: Temperature */}
        <div className="km-floating-card km-card-temp animate-float-2">
          <div className="km-fcard-icon km-fcard-temp-icon">
            <Thermometer size={20} />
          </div>
          <div className="km-fcard-body">
            <span className="km-fcard-label">{a.visual_weather_temp || 'Temperature'}</span>
            <span className="km-fcard-val">31°C</span>
            <span className="km-fcard-sub">P10: 29°C · P90: 33°C</span>
          </div>
        </div>

        {/* Floating Location Marker Widget */}
        <div className="km-floating-card km-card-panchayat animate-float-3">
          <div className="km-fcard-icon km-fcard-pin-icon">
            <MapPin size={20} />
          </div>
          <div className="km-fcard-body">
            <span className="km-fcard-label">{a.visual_panchayat_label || 'Panchayat Forecast'}</span>
            <span className="km-fcard-val">PNC-KA-0001</span>
            <span className="km-fcard-sub">{a.visual_panchayat_sub || 'Local weather intelligence'}</span>
          </div>
        </div>

        {/* Floating Crop Advisory Card */}
        <div className="km-floating-card km-card-crop animate-float-4">
          <div className="km-fcard-icon km-fcard-crop-icon">
            <Sprout size={20} />
          </div>
          <div className="km-fcard-body">
            <span className="km-fcard-label">{a.visual_crop_label || 'Crop Advisory'}</span>
            <span className="km-fcard-val">{a.visual_crop_val || 'Ragi · Vegetative Stage'}</span>
            <span className="km-fcard-sub">Phenological moisture guidance active</span>
          </div>
        </div>

        {/* Bottom Atmospheric Banner */}
        <div className="km-visual-bottom-banner">
          <div className="km-vbanner-header">
            <ShieldCheck size={18} className="km-text-emerald" />
            <h3>{a.visual_headline || 'Empowering Indian Agriculture'}</h3>
          </div>
          <p className="km-vbanner-desc">
            {a.visual_tagline || 'Hyperlocal weather forecasts and phenological advisories for every village.'}
          </p>
        </div>
      </div>
    </div>
  );
};
