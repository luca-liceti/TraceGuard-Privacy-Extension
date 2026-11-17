import { translationKeys } from './translations-extra-keys';
import { es } from './translations-extra-es';
import { fr } from './translations-extra-fr';
import { de } from './translations-extra-de';

const placeholders = (text: string): string =>
  (text.match(/\{\{[a-zA-Z]+\}\}/g) ?? []).sort().join('|');

const toMap = (values: readonly string[]): Record<string, string> => {
  if (values.length !== translationKeys.length) {
    throw new Error(`Translation length mismatch: expected ${translationKeys.length}, got ${values.length}`);
  }
  return Object.fromEntries(
    translationKeys.map((key, index) => {
      const value = values[index] ?? '';
      if (placeholders(key) !== placeholders(value)) {
        throw new Error(`Translation placeholder mismatch for "${key}"`);
      }
      return [key, value];
    }),
  );
};

const validate = (values: Record<string, string>): Record<string, string> => {
  const missing = translationKeys.filter((key) => !(key in values));
  if (missing.length > 0) {
    throw new Error(`Missing translations: ${missing.join(' | ')}`);
  }
  for (const key of translationKeys) {
    const value = values[key];
    if (placeholders(key) !== placeholders(value)) {
      throw new Error(`Translation placeholder mismatch for "${key}"`);
    }
  }
  return values;
};

export const extraTranslations = {
  es: toMap(es),
  fr: validate(fr),
  de: validate(de),
};
