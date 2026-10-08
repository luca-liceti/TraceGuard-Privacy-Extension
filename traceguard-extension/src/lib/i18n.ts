import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources } from './translations';

// We will use chrome.storage.local to persist the selected language across all extension views,
// and localStorage as a synchronous fallback during initial load so the UI doesn't flicker.
const LANGUAGE_KEY = 'traceguard-language';

const savedLanguage = (typeof localStorage !== 'undefined' ? localStorage.getItem(LANGUAGE_KEY) : null) || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    keySeparator: false, // Allows using natural language with periods like "Language changed successfully."
    nsSeparator: false,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    }
  });

// Setup synchronization between different extension views (popup, sidepanel, dashboard)
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  // Sync initial language from chrome.storage
  chrome.storage.local.get<{ [key: string]: any }>(LANGUAGE_KEY, (result) => {
    if (result[LANGUAGE_KEY] && result[LANGUAGE_KEY] !== i18n.language) {
      i18n.changeLanguage(result[LANGUAGE_KEY]);
      if (typeof localStorage !== 'undefined') localStorage.setItem(LANGUAGE_KEY, result[LANGUAGE_KEY]);
    }
  });

  // Listen for changes from other views
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[LANGUAGE_KEY]) {
      const newLang = changes[LANGUAGE_KEY].newValue as string | undefined;
      if (newLang && newLang !== i18n.language) {
        i18n.changeLanguage(newLang);
        if (typeof localStorage !== 'undefined') localStorage.setItem(LANGUAGE_KEY, newLang);
      }
    }
  });
}

// Keep the document's language tag in step with the selected language. The
// extension pages ship `<html lang="en">`, so without this a screen reader
// reads Spanish, French, or German text with an English voice, and the browser
// cannot pick the right hyphenation or font fallback. This covers every path
// that changes the language, because they all go through i18next.
function applyDocumentLanguage(lng: string) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lng;
  }
}

i18n.on('languageChanged', applyDocumentLanguage);
applyDocumentLanguage(savedLanguage);

// Intercept changeLanguage to also write to chrome.storage
const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lng: string, ...args) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(LANGUAGE_KEY, lng);
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [LANGUAGE_KEY]: lng });
  }
  return originalChangeLanguage(lng, ...args);
};

export default i18n;
