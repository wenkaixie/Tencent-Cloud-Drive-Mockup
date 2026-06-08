import { en } from './en';
import { zh } from './zh';

export type Language = 'en' | 'zh';

const LANG_KEY = 'app:language';

export function getStoredLanguage(): Language {
  const stored = localStorage.getItem(LANG_KEY);
  return stored === 'en' ? 'en' : 'zh';
}

export function setStoredLanguage(lang: Language): void {
  localStorage.setItem(LANG_KEY, lang);
}

const dicts = { en, zh } as const;

export function createT(language: Language) {
  return (key: string, params?: Record<string, string | number>): string => {
    const dict = dicts[language] as Record<string, string>;
    let result = dict[key] ?? (dicts.en as Record<string, string>)[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
    }
    return result;
  };
}

export type TFunction = ReturnType<typeof createT>;
