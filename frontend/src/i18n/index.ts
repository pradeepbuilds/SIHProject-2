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
