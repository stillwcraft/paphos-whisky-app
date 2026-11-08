import { useCallback, useEffect, useRef, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import { usePresentationSession } from '@/hooks/usePresentationSession';
import { localize, type PresentationRoute } from '@/types/presentation';
import { parseMiniAppLink, type MiniAppDestination } from '@/miniAppDeepLinks';
import { SlideFactory } from './SlideFactory';
import { SwipeController } from './SwipeController';
import { usePresentationGestures } from './usePresentationGestures';
import { presentationThemeStyle } from './presentationTheme';
import { PresentationIcon } from './PresentationIcon';
import { PresentationLinkScreen } from './PresentationLinkScreen';
import './presentation.css';

export function PresentationScreen({ roomId, onClose, onRoute, broadcastOnly = false,
  onBroadcastEnded, onStopBroadcast, stoppingBroadcast = false, broadcastError }: {
  roomId: string; onClose: () => void; onRoute: (route: PresentationRoute) => void;
  broadcastOnly?: boolean; onBroadcastEnded?: () => void; onStopBroadcast?: () => void;
  stoppingBroadcast?: boolean; broadcastError?: string | null;
}) {
  const raw = useSignal(initData.raw);
  const { t, i18n } = useTranslation();
  const [linkDestination, setLinkDestination] = useState<MiniAppDestination | null>(null);
  const screenRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeLink = useCallback(() => setLinkDestination(null), []);
  const session = usePresentationSession(roomId, raw, broadcastOnly);
  const { gestureError, safeAreaStyle } = usePresentationGestures();
  const { state, index, status, pending } = session;
  const viewer = state?.role !== 'presenter';
  const maximum = state?.role === 'presenter'
    ? Math.min(state.slide_count - 1, state.max_unlocked_slide_index + 1)
    : state?.max_unlocked_slide_index ?? 0;
  const controlsDisabled = Boolean(linkDestination) || pending || stoppingBroadcast || (state?.role === 'presenter' && status !== 'connected');
  const neighbors = [index - 1, index, index + 1].filter(i => i >= 0 && state?.slides[String(i)]);

  useEffect(() => {
    if (session.broadcastEnded) onBroadcastEnded?.();
  }, [session.broadcastEnded, onBroadcastEnded]);

  useEffect(() => {
    screenRef.current?.toggleAttribute('inert', Boolean(linkDestination));
    if (!linkDestination) {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
  }, [linkDestination]);

  const openLink = useCallback((url: string) => {
    if (linkDestination) return true;
    const link = parseMiniAppLink(url);
    if (!link.internal) return false;
    if (!link.destination) throw new Error(t('presentation.invalid_deep_link'));
    if (link.destination.kind === 'presentation' && link.destination.roomId === roomId) return true;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLinkDestination(link.destination);
    return true;
  }, [linkDestination, roomId, t]);

  return (
    <>
    <section ref={screenRef} className={`presentation-screen${viewer ? ' presentation-screen--viewer' : ''}`}
      style={{ ...safeAreaStyle, ...presentationThemeStyle(state?.theme) }}
      data-themed={state?.theme ? true : undefined}
      aria-hidden={linkDestination ? true : undefined}
      aria-label={localize(state?.title, i18n.language) || t('presentation.title')}>
      {!viewer && <header>
        <div className="presentation-controls">
          <button onClick={onClose}>{t('presentation.close')}</button>
          <span role="status">{t(`presentation.status.${status}`)}{state?.role === 'presenter' ? ` · ${t('presentation.presenter')}` : ''}</span>
          {state?.role === 'presenter' && onStopBroadcast && <button disabled={stoppingBroadcast}
            onClick={onStopBroadcast}>{t('presentation.stop_broadcast')}</button>}
        </div>
        {state?.title && <p className="presentation-heading">{localize(state.title, i18n.language)}</p>}
      </header>}
      {(gestureError || session.error || broadcastError) && <p className="presentation-notice" role="alert">
        {gestureError || session.error || broadcastError}</p>}
      {viewer && state && status !== 'connected' && !session.error && <p className="presentation-notice" role="status">
        {t(`presentation.status.${status}`)}</p>}
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
                  send={session.send} onRoute={onRoute} theme={state.theme} viewer={viewer} onTelegramLink={openLink}
                  galleryPhotoIndex={session.photoIndices[slide.id] ?? 0} onPhotoChange={session.changePhoto}
                  canChangePhoto={viewer || (!controlsDisabled && i === state.current_slide_index)}
                  onSwipe={direction => { if (!controlsDisabled) session.navigate(index + direction); }} />
              </div>;
            })}
          </SwipeController>
          {viewer ? <div className="presentation-slide-dots" role="img"
            aria-label={t('presentation.room_progress', { current: index + 1, total: state.slide_count })}>
            {Array.from({ length: state.slide_count }, (_, i) => <span key={i} aria-hidden="true"
              className="presentation-dot" data-active={i === index} data-locked={i > state.max_unlocked_slide_index} />)}
          </div> : <footer className="presentation-controls">
            <button disabled={controlsDisabled || index === 0} onClick={() => session.navigate(index - 1)}>{t('presentation.previous_slide')}</button>
            <span>{index + 1} / {state.slide_count}</span>
            <button disabled={controlsDisabled || index >= maximum} onClick={() => session.navigate(index + 1)}>
              {t(state.role === 'presenter' ? 'presentation.activate_next' : 'presentation.next_slide')}
            </button>
          </footer>}
          {!viewer && index !== state.current_slide_index && <button onClick={session.followPresenter}>{t('presentation.follow')}</button>}
        </>
      ) : !gestureError && <p className="presentation-loading">{t('presentation.synchronizing')}</p>}
      {viewer && <div className="presentation-viewer-actions">
        {state && <button className="presentation-icon-button" aria-label={t('presentation.follow')}
          title={t('presentation.follow')} disabled={session.isFollowingPresenter}
          onClick={session.followPresenter}><PresentationIcon name="follow" /></button>}
        <button className="presentation-icon-button" aria-label={t('presentation.close')} title={t('presentation.close')}
          onClick={onClose}><PresentationIcon name="close" /></button>
      </div>}
    </section>
    {linkDestination && <PresentationLinkScreen key={JSON.stringify(linkDestination)}
      destination={linkDestination} onClose={closeLink} onNavigate={setLinkDestination} style={safeAreaStyle} />}
    </>
  );
}
