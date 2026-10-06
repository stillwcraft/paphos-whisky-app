import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, type MotionProps } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { AnimationConfig, Article, SlideElement } from '@/types/interactiveNews.ts';

type Props = {
  article: Article;
  onClose: () => void;
  language: string;
};

function getElementAnimation(anim: AnimationConfig): Pick<MotionProps, 'initial' | 'animate' | 'transition'> {
  if (anim.type === 'fade_in_out') {
    return {
      initial: { opacity: 0 },
      animate: { opacity: [0, 1, 1, 0] },
      transition: {
        duration: anim.duration || 1.1,
        delay: anim.delay || 0,
        times: [0, 0.15, 0.85, 1],
        ease: 'easeInOut',
      },
    };
  }
  if (anim.type === 'pulse') {
    return {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.2, 1, 0.2, 1] },
      transition: {
        duration: anim.duration || 2.0,
        delay: anim.delay || 0,
        ease: 'easeInOut',
      },
    };
  }

  const movement = {
    slide_up: { y: 50 },
    slide_down: { y: -50 },
    slide_left: { x: 50 },
    slide_right: { x: -50 },
    fade_in: {},
    zoom_in: { scale: 0.8 },
  }[anim.type];

  return {
    initial: { opacity: 0, ...movement },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    transition: { delay: anim.delay, duration: anim.duration, ease: 'easeOut' },
  };
}

function localizedContent(element: SlideElement, language: string): string {
  const content = element.content;
  if (!content) return '';
  const locale = language.toLowerCase().split(/[-_]/, 1)[0];
  return content[locale] ?? content.en ?? content.ru ?? Object.values(content)[0] ?? '';
}

function SlideItem({ element, language }: { element: SlideElement; language: string }) {
  const { position, style } = element;
  const positionStyle: CSSProperties = {
    position: 'absolute',
    top: position.top ?? undefined,
    bottom: position.bottom ?? undefined,
    left: position.left ?? undefined,
    right: position.right ?? undefined,
    width: position.width ?? undefined,
    height: position.height ?? undefined,
    zIndex: position.z_index ?? 10,
  };
  const textStyle: CSSProperties = {
    fontSize: style?.font_size ?? undefined,
    color: style?.color ?? undefined,
    fontFamily: style?.font_family ?? undefined,
    fontWeight: style?.font_weight ?? undefined,
    textAlign: style?.text_align ?? undefined,
  };

  return (
    <motion.div {...(element.animation ? getElementAnimation(element.animation) : {})} style={positionStyle}>
      <div className="h-full w-full" style={{ transform: position.transform ?? undefined }}>
        {element.type === 'image' || element.type === 'logo' ? (
          element.src ? <img alt={localizedContent(element, language)} className="block h-full w-full object-contain" src={element.src} /> : null
        ) : element.type === 'badge' ? (
          <span className="inline-block rounded-full border border-[#C5A059]/50 bg-black/60 px-3 py-1 text-sm text-[#FFE28A]" style={textStyle}>
            {localizedContent(element, language)}
          </span>
        ) : (
          <p className="break-words whitespace-pre-wrap" style={textStyle}>{localizedContent(element, language)}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function InteractiveNewsViewer({ article, onClose, language }: Props) {
  const { t } = useTranslation();
  const [activeSlide, setActiveSlide] = useState(0);
  const slides = article.slides_data ?? [];
  const slideIndex = Math.min(activeSlide, Math.max(slides.length - 1, 0));
  const slide = slides[slideIndex];
  const background = article.background_config;

  const nextSlide = useCallback(() => {
    if (slideIndex >= slides.length - 1) {
      onClose();
    } else {
      setActiveSlide(slideIndex + 1);
    }
  }, [onClose, slideIndex, slides.length]);
  const prevSlide = useCallback(() => {
    setActiveSlide(Math.max(slideIndex - 1, 0));
  }, [slideIndex]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') nextSlide();
      if (event.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nextSlide, onClose, prevSlide]);

  return (
    <div aria-label={article.title} aria-modal="true" className="fixed inset-0 z-[100] overflow-hidden bg-black text-white" role="dialog">
      <div className="absolute inset-0 z-0">
        {background?.type === 'image' ? (
          <img alt="" className="h-full w-full object-cover" src={background.value} />
        ) : (
          <div
            className="h-full w-full"
            style={background?.type === 'gradient'
              ? { background: background.value }
              : { backgroundColor: background?.value ?? '#0a0a0c' }}
          />
        )}
        {background?.overlay_opacity != null && (
          <div className="absolute inset-0 bg-black" style={{ opacity: background.overlay_opacity }} />
        )}
      </div>

      <div aria-label={t('articles.slide_progress', { current: slide ? slideIndex + 1 : 0, total: slides.length })} className="absolute left-2 right-12 z-50 flex gap-1 top-[calc(env(safe-area-inset-top)+0.75rem)]">
        {slides.map((item, index) => (
          <div className={`h-1 flex-1 rounded-full ${index <= slideIndex ? 'bg-white' : 'bg-white/30'}`} key={`${item.slide_index}-${index}`} />
        ))}
      </div>
      <button
        aria-label={t('articles.close_presentation')}
        className="absolute right-2 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 p-2 text-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-white top-[calc(env(safe-area-inset-top)+0.5rem)]"
        onClick={onClose}
        type="button"
      >
        <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>

      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-10 isolate"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={slideIndex}
          transition={{ duration: 0.2 }}
        >
          {slide ? slide.elements.map((element) => (
            <SlideItem element={element} key={element.id} language={language} />
          )) : (
            <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-slate-300">
              {t('articles.no_slides')}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 z-40 flex">
        <button aria-label={t('articles.previous_slide')} className="h-full w-[30%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" onClick={prevSlide} type="button" />
        <button aria-label={t('articles.next_slide')} className="h-full w-[70%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" onClick={nextSlide} type="button" />
      </div>
    </div>
  );
}
