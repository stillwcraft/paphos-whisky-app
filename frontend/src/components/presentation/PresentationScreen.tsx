import { useCallback, useEffect, useRef, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import { usePresentationSession } from '@/hooks/usePresentationSession';
import { localize, type DrawingStroke, type PresentationRoute } from '@/types/presentation';
import { parseMiniAppLink, type MiniAppDestination } from '@/miniAppDeepLinks';
import { SlideFactory } from './SlideFactory';
import { SwipeController } from './SwipeController';
import { usePresentationGestures } from './usePresentationGestures';
import { presentationThemeStyle } from './presentationTheme';
import { PresentationIcon } from './PresentationIcon';
import { PresentationLinkScreen } from './PresentationLinkScreen';
import { PresentationDrawing } from './PresentationDrawing';
import './presentation.css';

const ANNOTATION_COLORS = [
  { value: '#C5A059', label: 'presentation.draw_gold' },
  { value: '#EF4444', label: 'presentation.draw_red' },
  { value: '#F4F4F5', label: 'presentation.draw_white' },
] as const;

export function PresentationScreen({ roomId, onClose, onRoute, broadcastOnly = false,
  onBroadcastEnded, onStopBroadcast, stoppingBroadcast = false, broadcastError }: {
  roomId: string; onClose: () => void; onRoute: (route: PresentationRoute) => void;
  broadcastOnly?: boolean; onBroadcastEnded?: () => void; onStopBroadcast?: () => void;
  stoppingBroadcast?: boolean; broadcastError?: string | null;
}) {
  const raw = useSignal(initData.raw);
  const { t, i18n } = useTranslation();
  const [linkDestination, setLinkDestination] = useState<MiniAppDestination | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [brushMode, setBrushMode] = useState<DrawingStroke['mode']>('pen');
  const [brushColor, setBrushColor] = useState<string>(ANNOTATION_COLORS[0].value);
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
  const slideId = state?.slides[String(index)]?.id;
  const canDraw = !viewer && status === 'connected' && !pending && !linkDestination && !stoppingBroadcast
    && index === state?.current_slide_index && Boolean(slideId);
  const title = localize(state?.title, i18n.language) || t('presentation.title');
  const connectionLabel = t(`presentation.status.${status}`);
  const notice = gestureError || session.error || broadcastError;
  const unlocksNext = index === state?.max_unlocked_slide_index && index < maximum;
  const nextLabel = t(unlocksNext ? 'presentation.activate_next' : 'presentation.next_slide');

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
    <section ref={screenRef} className={`presentation-screen ${viewer ? 'presentation-screen--viewer' : 'presentation-screen--presenter'}`}
      style={{ ...safeAreaStyle, ...presentationThemeStyle(state?.theme) }}
      data-themed={state?.theme ? true : undefined}
      aria-hidden={linkDestination ? true : undefined}
      aria-label={title}>
      {!viewer && <header className="presentation-presenter-header">
        <div className="presentation-top-bar">
          <button type="button" className="presentation-compact-button" onClick={onClose}
            aria-label={t('presentation.close')} title={t('presentation.close')}>
            <PresentationIcon name="close" />
          </button>
          <span className="presentation-connection-dot" data-status={status}
            role="img" aria-label={connectionLabel} title={connectionLabel} />
          <p className="presentation-presenter-title" title={title}>{title}</p>
          {onStopBroadcast && <button type="button" className="presentation-compact-button presentation-stop-button"
            aria-label={t('presentation.stop_broadcast')} title={t('presentation.stop_broadcast')}
            disabled={stoppingBroadcast} onClick={onStopBroadcast}>
            <PresentationIcon name="stop" />
          </button>}
        </div>
        <div className="presentation-drawing-tools" role="group" aria-label={t('presentation.draw_tools')}>
          <button type="button" className="presentation-compact-button" aria-pressed={drawing}
            aria-label={t('presentation.draw_toggle')} title={t('presentation.draw_toggle')}
            disabled={!canDraw} onClick={() => setDrawing(value => !value)}>
            <PresentationIcon name="pencil" />
          </button>
          <div className="presentation-drawing-options" role="group" aria-label={t('presentation.draw_tool')}>
            {(['pen', 'laser'] as const).map(mode => <button key={mode} type="button" className="presentation-compact-button"
              aria-label={t(`presentation.draw_${mode}`)} title={t(`presentation.draw_${mode}`)}
              aria-pressed={brushMode === mode} disabled={!canDraw || !drawing}
              onClick={() => setBrushMode(mode)}><PresentationIcon name={mode} /></button>)}
          </div>
          <div className="presentation-drawing-options" role="group" aria-label={t('presentation.draw_color')}>
            {ANNOTATION_COLORS.map(color => <button key={color.value} type="button" className="presentation-compact-button presentation-draw-swatch"
              aria-label={t(color.label)} title={t(color.label)} aria-pressed={brushColor === color.value}
              disabled={!canDraw || !drawing} onClick={() => setBrushColor(color.value)}
              style={{ backgroundColor: color.value }} />)}
          </div>
          <button type="button" className="presentation-compact-button" aria-label={t('presentation.draw_clear_slide')}
            title={t('presentation.draw_clear_slide')} disabled={!canDraw} onClick={() => {
            if (slideId && session.send({ type: 'draw_clear', slide_id: slideId })) {
              session.annotations.clearPreview(slideId);
            }
          }}><PresentationIcon name="trash" /></button>
        </div>
      </header>}
      {notice ? <p className="presentation-notice" role="alert">{notice}</p>
        : state && status !== 'connected' && <p className="presentation-notice" role="status">{connectionLabel}</p>}
      {state && !gestureError ? (
        <>
          <div className="presentation-stage-frame">
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
            {slideId && <PresentationDrawing key={`${roomId}:${slideId}`} slideId={slideId}
              annotations={session.annotations} enabled={canDraw && drawing}
              brush={{ mode: brushMode, color: brushColor, width: brushMode === 'laser' ? 5 : 4 }}
              send={session.send} />}
          </div>
          {viewer ? <div className="presentation-slide-dots" role="img"
            aria-label={t('presentation.room_progress', { current: index + 1, total: state.slide_count })}>
            {Array.from({ length: state.slide_count }, (_, i) => <span key={i} aria-hidden="true"
              className="presentation-dot" data-active={i === index} data-locked={i > state.max_unlocked_slide_index} />)}
          </div> : <footer className="presentation-presenter-nav">
            <button type="button" className="presentation-compact-button"
              aria-label={t('presentation.previous_slide')} title={t('presentation.previous_slide')}
              disabled={controlsDisabled || index === 0} onClick={() => session.navigate(index - 1)}>
              <PresentationIcon name="arrow-left" />
            </button>
            <div className="presentation-presenter-nav-center">
              <span aria-label={t('presentation.room_progress', { current: index + 1, total: state.slide_count })}>
                {index + 1} / {state.slide_count}
              </span>
              {index !== state.current_slide_index && <button type="button" className="presentation-compact-button"
                aria-label={t('presentation.follow')} title={t('presentation.follow')} onClick={session.followPresenter}>
                <PresentationIcon name="follow" />
              </button>}
            </div>
            <button type="button" className="presentation-compact-button" aria-label={nextLabel} title={nextLabel}
              disabled={controlsDisabled || index >= maximum} onClick={() => session.navigate(index + 1)}>
              <PresentationIcon name="arrow-right" />
              {unlocksNext && <span className="presentation-unlock-badge" aria-hidden="true">+</span>}
            </button>
          </footer>}
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
