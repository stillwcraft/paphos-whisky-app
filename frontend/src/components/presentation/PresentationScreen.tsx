import { initData, useSignal } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import { usePresentationSession } from '@/hooks/usePresentationSession';
import { localize, type PresentationRoute } from '@/types/presentation';
import { SlideFactory } from './SlideFactory';
import { SwipeController } from './SwipeController';
import { usePresentationGestures } from './usePresentationGestures';
import { presentationThemeStyle } from './presentationTheme';
import './presentation.css';

export function PresentationScreen({ roomId, onClose, onRoute }: {
  roomId: string; onClose: () => void; onRoute: (route: PresentationRoute) => void;
}) {
  const raw = useSignal(initData.raw);
  const { t, i18n } = useTranslation();
  const session = usePresentationSession(roomId, raw);
  const { gestureError, safeAreaStyle } = usePresentationGestures();
  const { state, index, status, pending } = session;
  const maximum = state?.role === 'presenter'
    ? Math.min(state.slide_count - 1, state.max_unlocked_slide_index + 1)
    : state?.max_unlocked_slide_index ?? 0;
  const controlsDisabled = pending || (state?.role === 'presenter' && status !== 'connected');
  const neighbors = [index - 1, index, index + 1].filter(i => i >= 0 && state?.slides[String(i)]);

  return (
    <section className="presentation-screen" style={{ ...safeAreaStyle, ...presentationThemeStyle(state?.theme) }}
      data-themed={state?.theme ? true : undefined}
      aria-label={localize(state?.title, i18n.language) || t('presentation.title')}>
      <header>
        <div className="presentation-controls">
          <button onClick={onClose}>{t('presentation.close')}</button>
          <span role="status">{t(`presentation.status.${status}`)}{state?.role === 'presenter' ? ` · ${t('presentation.presenter')}` : ''}</span>
        </div>
        {state?.title && <p className="presentation-heading">{localize(state.title, i18n.language)}</p>}
      </header>
      {(gestureError || session.error) && <p role="alert">{gestureError || session.error}</p>}
      {state && !gestureError ? (
        <>
          <SwipeController className="presentation-stage"
            onHorizontal={direction => { if (!controlsDisabled) session.navigate(index + direction); }}>
            {neighbors.map(i => {
              const slide = state.slides[String(i)];
              return <div key={slide.id} className="presentation-slot" hidden={i !== index} aria-hidden={i !== index}>
                <SlideFactory slide={slide} active={i === index} language={i18n.language}
                  result={state.results[slide.id]}
                  canRespond={i === state.current_slide_index && i === index && status === 'connected' && !pending}
                  send={session.send} onRoute={onRoute} theme={state.theme} />
              </div>;
            })}
          </SwipeController>
          <footer className="presentation-controls">
            <button disabled={controlsDisabled || index === 0} onClick={() => session.navigate(index - 1)}>{t('presentation.previous_slide')}</button>
            <span>{index + 1} / {state.slide_count}</span>
            <button disabled={controlsDisabled || index >= maximum} onClick={() => session.navigate(index + 1)}>
              {t(state.role === 'presenter' ? 'presentation.activate_next' : 'presentation.next_slide')}
            </button>
          </footer>
          {index !== state.current_slide_index && <button onClick={session.followPresenter}>{t('presentation.follow')}</button>}
        </>
      ) : !gestureError && <p>{t('presentation.synchronizing')}</p>}
    </section>
  );
}
