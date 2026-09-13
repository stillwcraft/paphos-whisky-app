import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST;

export type TelegramAnalyticsUser = {
  id: number | string;
  username?: string;
  language_code?: string;
  languageCode?: string;
};

let isInitialized = false;

export function initAnalytics(telegramUser?: TelegramAnalyticsUser) {
  if (!isInitialized) {
    if (!POSTHOG_KEY || !POSTHOG_HOST) {
      return;
    }

    try {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        autocapture: false,
      });
      isInitialized = true;
    } catch {
      return;
    }
  }

  if (!telegramUser) {
    return;
  }

  try {
    const language = telegramUser.language_code ?? telegramUser.languageCode;
    posthog.identify(String(telegramUser.id), {
      ...(telegramUser.username ? { username: telegramUser.username } : {}),
      ...(language ? { language } : {}),
    });
  } catch {
    // Analytics must never affect the Mini App when the SDK is unavailable.
  }
}

export function captureAnalyticsEvent(
  eventName: string,
  properties?: Record<string, unknown>,
) {
  if (!isInitialized) {
    return;
  }

  try {
    posthog.capture(eventName, properties);
  } catch {
    // Analytics must never affect the Mini App when the SDK is blocked.
  }
}
