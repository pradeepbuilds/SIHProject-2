import en from './en.json';
import hi from './hi.json';
import kn from './kn.json';
import mr from './mr.json';

export type SupportedLanguage = 'en' | 'hi' | 'kn' | 'mr';

export const translations: Record<SupportedLanguage, any> = {
  en,
  hi,
  kn,
  mr
};

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  hi: 'हिंदी (Hindi)',
  kn: 'ಕನ್ನಡ (Kannada)',
  mr: 'मराठी (Marathi)'
};

export function t(
  path: string,
  vars?: Record<string, string | number>,
  lang: SupportedLanguage = 'en'
): string {
  const keys = path.split('.');
  const activeDict = translations[lang] || translations.en;
  const fallbackDict = translations.en;

  let current: any = activeDict;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      current = undefined;
      break;
    }
  }

  if (current === undefined || typeof current !== 'string') {
    // Development-only warning for missing translation key
    if (import.meta.env?.DEV && lang !== 'en') {
      console.warn(`[KrishiMitra i18n] Missing translation key: "${path}" for locale "${lang}". Falling back to English.`);
    }

    // Fallback to English
    let fallback: any = fallbackDict;
    for (const k of keys) {
      if (fallback && typeof fallback === 'object' && k in fallback) {
        fallback = fallback[k];
      } else {
        fallback = undefined;
        break;
      }
    }
    current = fallback !== undefined ? fallback : path;
  }

  if (typeof current === 'string' && vars) {
    return formatTemplate(current, vars);
  }

  return typeof current === 'string' ? current : path;
}

export function getTranslation(lang: SupportedLanguage = 'en') {
  return translations[lang] || translations.en;
}

export function formatTemplate(template: string, vars: Record<string, string | number>): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : '';
  });
}

export function formatDateLocale(dateStr: string, lang: SupportedLanguage = 'en'): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : lang === 'kn' ? 'kn-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(dt);
  } catch (e) {
    return dateStr;
  }
}
