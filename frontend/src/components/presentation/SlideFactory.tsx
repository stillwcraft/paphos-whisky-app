import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  localize, type GallerySlideConfig, type InteractiveTabsSlideConfig, type PresentationCommand,
  type PresentationRoute, type SlideConfig, type SlideResult, type VideoSlideConfig, type WordCloudSlideConfig,
} from '@/types/presentation';
import { SwipeController } from './SwipeController';

function HtmlContent({ html, css = '', title }: { html: string; css?: string; title: string }) {
  const { t } = useTranslation();
  // No scripts, same-origin access, top navigation, forms, or SDK access inside author HTML.
  const policy = "default-src 'none'; img-src https:; style-src 'unsafe-inline'; font-src https:; base-uri 'none'; form-action 'none'";
  return <iframe title={title || t('presentation.content')} sandbox="" referrerPolicy="no-referrer"
    className="presentation-html" srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><style>body{margin:0;padding:16px;background:#0D0D0E;color:#F4F4F5;font-family:system-ui}img{max-width:100%}${css}</style></head><body>${html}</body></html>`} />;
}

function VideoSlide({ slide }: { slide: VideoSlideConfig }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
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
    void video.play().then(() => setNeedsPlay(false)).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : t('presentation.play_error'));
    });
  };
  return (
    <div className="presentation-video">
      <video ref={ref} src={slide.video.url} playsInline autoPlay muted={muted} controls
        preload="metadata" onError={() => setError(t('presentation.video_error'))} />
      <button className="presentation-unmute" onClick={() => {
        if (ref.current) ref.current.muted = !muted;
        setMuted(!muted);
      }}>{t(muted ? 'presentation.unmute' : 'presentation.mute')}</button>
      {needsPlay && <button onClick={play}>{t('presentation.play')}</button>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function GallerySlide({ slide, language }: { slide: GallerySlideConfig; language: string }) {
  const { t } = useTranslation();
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = slide.photos[photoIndex];
  const move = (direction: -1 | 1) => setPhotoIndex(i => Math.max(0, Math.min(slide.photos.length - 1, i + direction)));
  return (
    <SwipeController onVertical={move}>
      <img className="presentation-photo" src={photo.url} alt={localize(photo.alt, language)} draggable={false} />
      <div className="presentation-controls">
        <button disabled={photoIndex === 0} onClick={() => move(-1)}>{t('presentation.previous_photo')}</button>
        <span>{photoIndex + 1} / {slide.photos.length}</span>
        <button disabled={photoIndex === slide.photos.length - 1} onClick={() => move(1)}>{t('presentation.next_photo')}</button>
      </div>
    </SwipeController>
  );
}

function TabsSlide({ slide, language, onRoute }: {
  slide: InteractiveTabsSlideConfig; language: string; onRoute: (route: PresentationRoute) => void;
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
        <HtmlContent html={tab.html} title={localize(tab.label, language)} />
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
}

export function SlideFactory({ slide, active, language, result, canRespond, send, onRoute }: Props) {
  const title = localize(slide.title, language);
  let content;
  switch (slide.type) {
    case 'static':
      content = <>{slide.image && <img className="presentation-photo" src={slide.image.url} alt={localize(slide.image.alt, language)} />}
        {slide.html && <HtmlContent html={slide.html} css={slide.css} title={title} />}</>;
      break;
    case 'video':
      content = active ? <VideoSlide slide={slide} /> : null;
      break;
    case 'gallery':
      content = <GallerySlide slide={slide} language={language} />;
      break;
    case 'interactive_tabs':
      content = <TabsSlide slide={slide} language={language} onRoute={onRoute} />;
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
  return <article className={`presentation-slide presentation-entry--${slide.animations?.entry ?? 'none'}`}>
    {title && <h1>{title}</h1>}{content}
  </article>;
}
