import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources } from './translations';

// We will use chrome.storage.local to persist the selected language across all extension views,
// and localStorage as a synchronous fallback during initial load so the UI doesn't flicker.
const LANGUAGE_KEY = 'traceguard-language';

const savedLanguage = localStorage.getItem(LANGUAGE_KEY) || 'en';

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
  chrome.storage.local.get(LANGUAGE_KEY, (result) => {
    if (result[LANGUAGE_KEY] && result[LANGUAGE_KEY] !== i18n.language) {
      i18n.changeLanguage(result[LANGUAGE_KEY]);
      localStorage.setItem(LANGUAGE_KEY, result[LANGUAGE_KEY]);
    }
  });

  // Listen for changes from other views
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[LANGUAGE_KEY]) {
      const newLang = changes[LANGUAGE_KEY].newValue;
      if (newLang && newLang !== i18n.language) {
        i18n.changeLanguage(newLang);
        localStorage.setItem(LANGUAGE_KEY, newLang);
      }
    }
  });
}

// Intercept changeLanguage to also write to chrome.storage
const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lng: string, ...args) => {
  localStorage.setItem(LANGUAGE_KEY, lng);
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [LANGUAGE_KEY]: lng });
  }
  return originalChangeLanguage(lng, ...args);
};

export default i18n;
