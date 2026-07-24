import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Bundled translations for top popular languages
const resources = {
  es: {
    translation: {
      "Settings": "Ajustes",
      "Language": "Idioma",
      "Get help": "Ayuda",
      "Learn more": "Más información",
      "Log out": "Cerrar sesión",
      "About Anthropic": "Acerca de Anthropic",
      "Tutorials": "Tutoriales",
      "Courses": "Cursos",
      "Usage policy": "Política de uso",
      "Privacy policy": "Política de privacidad",
      "Your privacy choices": "Tus opciones de privacidad",
      "Keyboard shortcuts": "Atajos de teclado",
      "Language changed successfully.": "Idioma cambiado correctamente.",
      "Undo": "Deshacer"
    }
  },
  fr: {
    translation: {
      "Settings": "Paramètres",
      "Language": "Langue",
      "Get help": "Obtenir de l'aide",
      "Learn more": "En savoir plus",
      "Log out": "Déconnexion",
      "About Anthropic": "À propos d'Anthropic",
      "Tutorials": "Tutoriels",
      "Courses": "Cours",
      "Usage policy": "Politique d'utilisation",
      "Privacy policy": "Politique de confidentialité",
      "Your privacy choices": "Vos choix de confidentialité",
      "Keyboard shortcuts": "Raccourcis clavier",
      "Language changed successfully.": "Langue changée avec succès.",
      "Undo": "Annuler"
    }
  },
  de: {
    translation: {
      "Settings": "Einstellungen",
      "Language": "Sprache",
      "Get help": "Hilfe",
      "Learn more": "Mehr erfahren",
      "Log out": "Abmelden",
      "About Anthropic": "Über Anthropic",
      "Tutorials": "Tutorials",
      "Courses": "Kurse",
      "Usage policy": "Nutzungsbedingungen",
      "Privacy policy": "Datenschutzrichtlinie",
      "Your privacy choices": "Ihre Datenschutzeinstellungen",
      "Keyboard shortcuts": "Tastenkombinationen",
      "Language changed successfully.": "Sprache erfolgreich geändert.",
      "Undo": "Rückgängig"
    }
  }
};

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
