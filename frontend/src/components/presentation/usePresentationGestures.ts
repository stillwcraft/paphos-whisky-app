import { useEffect, useState } from 'react';
import { swipeBehavior, viewport, useSignal } from '@tma.js/sdk-react';
import type { CSSProperties } from 'react';
import i18n from '@/i18n';

export function usePresentationGestures() {
  const [error, setError] = useState<string | null>(null);
  const safeArea = useSignal(viewport.safeAreaInsets);
  const contentArea = useSignal(viewport.contentSafeAreaInsets);
  useEffect(() => {
    const wasMounted = swipeBehavior.isMounted();
    let restoreVertical = false;
    try {
      if (!swipeBehavior.isSupported()) {
        setError(i18n.t('presentation.unsupported'));
        return;
      }
      if (!wasMounted) swipeBehavior.mount();
      restoreVertical = swipeBehavior.isVerticalEnabled();
      swipeBehavior.disableVertical();
      viewport.expand.ifAvailable();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : i18n.t('presentation.gesture_error'));
    }
    return () => {
      if (restoreVertical) swipeBehavior.enableVertical.ifAvailable();
      if (!wasMounted && swipeBehavior.isMounted()) swipeBehavior.unmount();
    };
  }, []);
  const style: CSSProperties & Record<string, string> = {};
  for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
    style[`--presentation-safe-${edge}`] = `${safeArea[edge] + contentArea[edge]}px`;
  }
  return { gestureError: error, safeAreaStyle: style };
}
