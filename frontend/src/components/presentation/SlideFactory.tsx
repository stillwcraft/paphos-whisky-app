import { useEffect, useMemo, useRef, useState } from 'react';
import { openTelegramLink } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import {
  localize, type GallerySlideConfig, type InteractiveTabsSlideConfig, type PresentationCommand,
  type PhotoConfig, type PresentationRoute, type PresentationTheme, type SlideConfig, type SlideResult,
  type VideoSlideConfig, type WordCloudSlideConfig,
} from '@/types/presentation';
import { SwipeController } from './SwipeController';
import { presentationThemeStyle } from './presentationTheme';
import { PresentationIcon } from './PresentationIcon';
import { htmlBridgeMessageSchema, htmlBridgeScript } from './htmlBridge';

function HtmlContent({ html, css = '', title, theme, viewer = false, staticSlide = false, interactiveHtml = false, onSwipe }: {
  html: string; css?: string; title: string; theme?: PresentationTheme | null; viewer?: boolean; staticSlide?: boolean;
  interactiveHtml?: boolean; onSwipe?: (direction: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  useEffect(() => {
    setLinkError(null);
    if (!interactiveHtml) return;
    const receive = (event: MessageEvent<unknown>) => {
      if (!frameRef.current?.contentWindow || event.source !== frameRef.current.contentWindow) return;
      const message = htmlBridgeMessageSchema.safeParse(event.data);
      if (!message.success) return;
      if (message.data.action === 'swipe') {
        onSwipe?.(message.data.direction);
        return;
      }
      try {
        if (!openTelegramLink.isAvailable()) throw new Error(t('presentation.telegram_link_unavailable'));
        openTelegramLink(message.data.url);
        setLinkError(null);
      } catch (cause: unknown) {
        setLinkError(cause instanceof Error ? cause.message : t('presentation.link_error'));
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [html, interactiveHtml, onSwipe, t]);
  const srcDoc = useMemo(() => {
    const policy = `default-src 'none'; img-src https:; style-src 'unsafe-inline'${interactiveHtml ? ' https:' : ''}; font-src https:; base-uri 'none'; form-action 'none'${interactiveHtml ? "; script-src 'unsafe-inline'" : ''}`;
    const variables = Object.entries(presentationThemeStyle(theme)).map(([key, value]) => `${key}:${value}`).join(';');
    const styles = `:root{${variables}}${interactiveHtml ? 'html{touch-action:pan-y;overscroll-behavior-x:none}' : ''}body{margin:0;padding:${interactiveHtml ? 0 : 16}px;background:var(--presentation-background);color:var(--presentation-text);font-family:var(--presentation-font)}a{color:var(--presentation-primary)}img{max-width:100%}${css}`;
    if (!interactiveHtml) {
      return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><style>${styles}</style></head><body>${html}</body></html>`;
    }
    // Parse full documents without executing them; enforce CSP before any authored resources.
    const document = new DOMParser().parseFromString(html, 'text/html');
    const csp = document.createElement('meta');
    csp.httpEquiv = 'Content-Security-Policy';
    csp.content = policy;
    const style = document.createElement('style');
    style.textContent = styles;
    document.head.prepend(csp, style);
    const bridge = document.createElement('script');
    bridge.textContent = htmlBridgeScript(window.location.origin);
    document.body.prepend(bridge);
    return `<!doctype html>${document.documentElement.outerHTML}`;
  }, [html, css, theme, interactiveHtml]);
  // Never allow same-origin, parent navigation, forms, or access to the app/SDK.
  const frame = <iframe ref={frameRef} title={title || t('presentation.content')}
    sandbox={interactiveHtml ? 'allow-scripts allow-popups allow-popups-to-escape-sandbox' : ''}
    referrerPolicy="no-referrer" className="presentation-html" srcDoc={srcDoc} />;
  return viewer || interactiveHtml ? <div className="presentation-html-frame">{frame}
    {linkError && <p className="presentation-html-error" role="alert">{linkError}</p>}
    {viewer && !interactiveHtml && (staticSlide
      ? <div className="presentation-html-swipe-surface" aria-hidden="true" />
      : <>
        <div className="presentation-html-swipe-rail presentation-html-swipe-rail--left" aria-hidden="true" />
        <div className="presentation-html-swipe-rail presentation-html-swipe-rail--right" aria-hidden="true" />
      </>)}
  </div> : frame;
}

function PhotoContent({ photo, language }: { photo: PhotoConfig; language: string }) {
  const caption = localize(photo.caption, language);
  return <figure>
    <img className="presentation-photo" src={photo.url} alt={localize(photo.alt, language) || caption} draggable={false} />
    {caption && <figcaption className="presentation-caption">{caption}</figcaption>}
  </figure>;
}

function VideoSlide({ slide, viewer }: { slide: VideoSlideConfig; viewer: boolean }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [paused, setPaused] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let live = true;
    void video.play().catch(() => { if (live) setNeedsPlay(true); });
    return () => {
      live = false;
      video.pause();
      video.src = '';
      video.removeAttribute('src');
      video.load();
    };
  }, []);
  const play = () => {
    const video = ref.current;
    if (!video) return;
    void video.play().then(() => { setNeedsPlay(false); setError(null); }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : t('presentation.play_error'));
    });
  };
  const toggleMute = () => {
    if (ref.current) ref.current.muted = !muted;
    setMuted(!muted);
  };
  const updateDuration = () => {
    const value = ref.current?.duration;
    setDuration(value !== undefined && Number.isFinite(value) && value > 0 ? value : 0);
  };
  return (
    <div className="presentation-video">
      <video ref={ref} src={slide.video.url} playsInline autoPlay muted={muted} loop={slide.loop} controls={!viewer}
        tabIndex={viewer ? 0 : undefined} aria-label={viewer ? t('presentation.video_controls') : undefined}
        onClick={viewer ? () => setControlsVisible(visible => !visible) : undefined}
        onKeyDown={event => {
          if (viewer && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setControlsVisible(visible => !visible);
          }
        }}
        onLoadedMetadata={updateDuration} onDurationChange={updateDuration}
        onTimeUpdate={() => setCurrentTime(ref.current?.currentTime ?? 0)}
        onPlay={() => setPaused(false)} onPause={() => setPaused(true)}
        onVolumeChange={() => setMuted(ref.current?.muted ?? true)}
        preload="metadata" onError={() => setError(t('presentation.video_error'))} />
      {!viewer && <button className="presentation-unmute" onClick={toggleMute}>
        {t(muted ? 'presentation.unmute' : 'presentation.mute')}</button>}
      {viewer && controlsVisible && <div className="presentation-video-controls" role="group"
        aria-label={t('presentation.video_controls')}>
        <button className="presentation-icon-button" aria-label={t(paused ? 'presentation.play' : 'presentation.pause')}
          onClick={() => { if (ref.current?.paused) play(); else ref.current?.pause(); }}>
          <PresentationIcon name={paused ? 'play' : 'pause'} />
        </button>
        <input type="range" min={0} max={duration} step="0.1" value={Math.min(currentTime, duration)}
          disabled={!duration} aria-label={t('presentation.seek_video')}
          onChange={event => {
            const value = Number(event.target.value);
            if (ref.current && duration > 0) {
              ref.current.currentTime = value;
              setCurrentTime(value);
            }
          }} />
        <button className="presentation-icon-button" aria-label={t(muted ? 'presentation.unmute' : 'presentation.mute')}
          onClick={toggleMute}><PresentationIcon name={muted ? 'mute' : 'volume'} /></button>
      </div>}
      {needsPlay && <button className="presentation-video-play" onClick={play}>{t('presentation.play')}</button>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function GallerySlide({ slide, language, viewer }: { slide: GallerySlideConfig; language: string; viewer: boolean }) {
  const { t } = useTranslation();
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = slide.photos[photoIndex];
  const move = (direction: -1 | 1) => setPhotoIndex(i => Math.max(0, Math.min(slide.photos.length - 1, i + direction)));
  return (
    <SwipeController onVertical={move} className="presentation-gallery">
      <PhotoContent photo={photo} language={language} />
      {viewer ? slide.photos.length > 1 && <div className="presentation-photo-dots" role="img"
        aria-label={t('presentation.photo_progress', { current: photoIndex + 1, total: slide.photos.length })}>
        {slide.photos.map((item, i) => <span key={`${item.url}-${i}`} className="presentation-dot"
          aria-hidden="true" data-active={i === photoIndex} />)}
      </div> : <div className="presentation-controls">
        <button disabled={photoIndex === 0} onClick={() => move(-1)}>{t('presentation.previous_photo')}</button>
        <span>{photoIndex + 1} / {slide.photos.length}</span>
        <button disabled={photoIndex === slide.photos.length - 1} onClick={() => move(1)}>{t('presentation.next_photo')}</button>
      </div>}
    </SwipeController>
  );
}

function TabsSlide({ slide, language, onRoute, theme, viewer }: {
  slide: InteractiveTabsSlideConfig; language: string; onRoute: (route: PresentationRoute) => void;
  theme?: PresentationTheme | null; viewer: boolean;
}) {
  const { t } = useTranslation();
  const [tabIndex, setTabIndex] = useState(0);
  const tab = slide.tabs[tabIndex];
  return (
    <>
      <div role="tablist" aria-label={localize(slide.title, language)}>
        {slide.tabs.map((item, i) => (
          <button key={item.id} id={`${slide.id}-${item.id}`} role="tab"
            aria-selected={tabIndex === i} aria-controls={`${slide.id}-panel`}
            style={{ animationDelay: `${i * (slide.animations?.staggerDelay ?? 0)}s` }}
            onClick={() => setTabIndex(i)}>{localize(item.label, language)}</button>
        ))}
      </div>
      <div role="tabpanel" id={`${slide.id}-panel`} aria-labelledby={`${slide.id}-${tab.id}`}>
        <HtmlContent html={typeof tab.html === 'string' ? tab.html : localize(tab.html, language)}
          title={localize(tab.label, language)} theme={theme} viewer={viewer} />
        {tab.route && <button onClick={() => { if (tab.route) onRoute(tab.route); }}>{t('presentation.open_tab', { label: localize(tab.label, language) })}</button>}
      </div>
    </>
  );
}

function WordCloudSlide({ slide, result, language, disabled, send }: {
  slide: WordCloudSlideConfig; result?: SlideResult; language: string;
  disabled: boolean; send: (command: PresentationCommand) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const [displayCounts, setDisplayCounts] = useState<Record<string, number>>({});
  const latestCounts = useRef(result?.counts ?? {});
  latestCounts.current = result?.counts ?? {};
  const cloudWords = useMemo(() => Object.entries(displayCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word, count]) => (
      <span key={word} style={{ fontSize: `${Math.min(3, 1 + Math.log2(count + 1) * 0.3)}rem` }}>
        {word} <small>({count})</small>
      </span>
    )), [displayCounts]);
  useEffect(() => {
    // Recompute the visual layout at most once per two seconds, including bursts of votes.
    const timer = setInterval(() => setDisplayCounts({ ...latestCounts.current }), 2000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <p>{localize(slide.prompt, language)}</p>
      <div className="presentation-word-cloud" aria-label={t('presentation.word_cloud')}>
        {cloudWords}
      </div>
      <form onSubmit={event => {
        event.preventDefault();
        const words = text.split(',').map(word => word.trim()).filter(Boolean);
        if (!words.length || words.length > slide.max_words || words.some(word => word.length > 32)) {
          setValidation(t('presentation.invalid_words', { max: slide.max_words }));
          return;
        }
        setValidation(null);
        send({ type: 'words', slide_id: slide.id, words });
      }}>
        <label>{t('presentation.words_label')}<input value={text} maxLength={100}
          disabled={disabled || Boolean(result?.own_words?.length)} onChange={event => setText(event.target.value)} /></label>
        <button disabled={disabled || Boolean(result?.own_words?.length)}>{t('presentation.submit_words')}</button>
      </form>
      {validation && <p role="alert">{validation}</p>}
      {!!result?.own_words?.length && <p>{t('presentation.own_words', { words: result.own_words.join(', ') })}</p>}
    </>
  );
}

interface Props {
  slide: SlideConfig;
  active: boolean;
  language: string;
  result?: SlideResult;
  canRespond: boolean;
  send: (command: PresentationCommand) => void;
  onRoute: (route: PresentationRoute) => void;
  theme?: PresentationTheme | null;
  viewer?: boolean;
  onSwipe?: (direction: -1 | 1) => void;
}

export function SlideFactory({ slide, active, language, result, canRespond, send, onRoute, theme, viewer = false, onSwipe }: Props) {
  const title = localize(slide.title, language);
  const subtitle = localize(slide.subtitle, language);
  let content;
  switch (slide.type) {
    case 'static':
      content = <>{slide.image && <PhotoContent photo={slide.image} language={language} />}
        {slide.html && (!slide.interactiveHtml || active)
          && <HtmlContent html={typeof slide.html === 'string' ? slide.html : localize(slide.html, language)}
            css={slide.css} title={title} theme={theme} viewer={viewer} staticSlide
            interactiveHtml={slide.interactiveHtml} onSwipe={onSwipe} />}</>;
      break;
    case 'video':
      content = active ? <VideoSlide slide={slide} viewer={viewer} /> : null;
      break;
    case 'gallery':
      content = <GallerySlide slide={slide} language={language} viewer={viewer} />;
      break;
    case 'interactive_tabs':
      content = <TabsSlide slide={slide} language={language} onRoute={onRoute} theme={theme} viewer={viewer} />;
      break;
    case 'poll':
      content = <>
        <p>{localize(slide.question, language)}</p>
        {slide.options.map(option => <button key={option.id}
          disabled={!canRespond || Boolean(result?.own_vote)}
          aria-pressed={result?.own_vote === option.id}
          onClick={() => send({ type: 'vote', slide_id: slide.id, option_id: option.id })}>
          {localize(option.label, language)} ({result?.counts[option.id] ?? 0})
        </button>)}
      </>;
      break;
    case 'word_cloud':
      content = <WordCloudSlide slide={slide} result={result} language={language} disabled={!canRespond} send={send} />;
      break;
  }
  return <article className={`presentation-slide presentation-slide--${slide.type} presentation-entry--${slide.animations?.entry ?? 'none'}`}>
    {(title || (subtitle && !(viewer && slide.type === 'gallery'))) && <div className="presentation-slide-heading">
      {title && <h1>{title}</h1>}
      {subtitle && !(viewer && slide.type === 'gallery') && <p className="presentation-subtitle">{subtitle}</p>}
    </div>}
    <div className="presentation-slide-content">{content}</div>
  </article>;
}
