import React from 'react';
import type { ScenarioItem } from '../types/api';
import { getTranslation, type SupportedLanguage } from '../i18n';

interface ScenarioBarProps {
  scenarios: ScenarioItem[];
  onSelectScenario: (scenario: ScenarioItem) => void;
  activeScenarioId?: string;
  lang: SupportedLanguage;
}

export const ScenarioBar: React.FC<ScenarioBarProps> = ({
  scenarios,
  onSelectScenario,
  activeScenarioId,
  lang
}) => {
  const t = getTranslation(lang);

  if (!scenarios || scenarios.length === 0) return null;

  return (
    <div className="km-scenario-bar" role="region" aria-label="Scenario Presets">
      <div className="km-container km-scenario-content">
        <span className="km-scenario-label">{t.map_controls.scenarios_label}</span>
        <div className="km-scenario-scroll">
          {scenarios.map((sc) => {
            const isActive = activeScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                className={`km-scenario-chip ${isActive ? 'active' : ''}`}
                onClick={() => onSelectScenario(sc)}
                title={`Select scenario: ${sc.label}`}
              >
                <span className="km-scenario-title">{sc.label}</span>
                <span className="km-scenario-peak">Peak: {sc.peak_value}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
