import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST;
const EXCLUDED_TELEGRAM_IDS = [8546526596, 741623645];

export type TelegramAnalyticsUser = {
  id: number | string;
  username?: string;
  language_code?: string;
  languageCode?: string;
  is_admin?: boolean;
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
        capture_pageview: false,
        request_batching: true,
        request_queue_config: {
          flush_interval_ms: 5000,
        },
        session_recording: {
          maskAllInputs: true,
          maskCapturedNetworkRequestFn: (request) => {
            if (request.name.includes('/api/reviews/') || request.name.includes('/card')) {
              return null;
            }
            if (request.name.includes('tgWebAppData') || request.name.includes('token')) {
              request.name = request.name.split('?')[0];
            }
            return request;
          },
        },
      });
      isInitialized = true;
    } catch {
      return;
    }
  }

  const isExcludedUser = telegramUser && (
    EXCLUDED_TELEGRAM_IDS.includes(Number(telegramUser.id))
    || telegramUser.is_admin
  );
  if (import.meta.env.DEV || isExcludedUser) {
    try {
      posthog.opt_out_capturing();
      console.log('PostHog tracking disabled for admin/developer session');
    } catch {
      // Analytics must never affect the Mini App when the SDK is unavailable.
    }
    return;
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
  try {
    if (!isInitialized || posthog.has_opted_out_capturing()) {
      return;
    }
    posthog.capture(eventName, properties);
  } catch {
    // Analytics must never affect the Mini App when the SDK is blocked.
  }
}
