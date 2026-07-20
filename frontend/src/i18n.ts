import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';

type AppLanguage = 'en' | 'ru' | 'uk';

function getSupportedLanguage(languageCode: string | null | undefined): AppLanguage | undefined {
  const language = languageCode?.toLowerCase().split(/[-_]/, 1)[0];
  return language === 'en' || language === 'ru' || language === 'uk' ? language : undefined;
}

function getTelegramLanguage(): AppLanguage {
  const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user as
    | { language_code?: string }
    | undefined;

  return getSupportedLanguage(telegramUser?.language_code) ?? 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      uk: { translation: uk },
    },
    lng: getSupportedLanguage(localStorage.getItem('app_lang')) ?? getTelegramLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
