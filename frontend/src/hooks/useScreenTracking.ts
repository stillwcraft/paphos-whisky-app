import { useEffect } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics.ts';

type ScreenTrackingOptions = {
  entityId?: number | null;
  eventName?: '$pageview' | 'screen_view';
  screenName: string | null;
  title?: string;
};

export function useScreenTracking({
  entityId,
  eventName = 'screen_view',
  screenName,
  title,
}: ScreenTrackingOptions) {
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    if (!screenName) {
      return;
    }

    if (eventName === '$pageview') {
      trackEvent('$pageview', {
        current_screen: screenName,
        ...(title ? { title } : {}),
      });
      return;
    }

    trackEvent('screen_view', {
      screen_name: screenName,
      ...(entityId !== null && entityId !== undefined ? { entity_id: entityId } : {}),
    });
  }, [entityId, eventName, screenName, title, trackEvent]);
}
