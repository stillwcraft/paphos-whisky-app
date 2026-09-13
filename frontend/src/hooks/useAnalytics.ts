import { useCallback } from 'react';
import { captureAnalyticsEvent } from '@/analytics/posthog.ts';

export function useAnalytics() {
  const trackEvent = useCallback((
    eventName: string,
    properties?: Record<string, unknown>,
  ) => {
    captureAnalyticsEvent(eventName, properties);
  }, []);

  return { trackEvent };
}
