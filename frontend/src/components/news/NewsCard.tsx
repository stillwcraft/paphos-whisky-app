import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Article } from '@/types/interactiveNews.ts';

export function formatArticleDate(value: string, language: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function ArticleImages({
  article,
  expanded = false,
  isImageExpanded = false,
  onImageClick,
}: {
  article: Article;
  expanded?: boolean;
  isImageExpanded?: boolean;
  onImageClick?: () => void;
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const imageHeightClassName = expanded
    ? isImageExpanded
      ? 'h-[55dvh] max-h-[60dvh]'
      : 'h-72'
    : 'h-44';
  const imageFitClassName = isImageExpanded ? 'object-contain' : 'object-cover';
  const imageInteractionClassName = onImageClick
    ? isImageExpanded ? 'cursor-zoom-out' : 'cursor-zoom-in'
    : '';

  if (article.image_urls.length === 0) {
    return null;
  }

  if (article.image_urls.length === 1) {
    return (
      <img
        alt=""
        className={`${imageHeightClassName} w-full transition-all duration-300 ease-in-out ${imageFitClassName} ${imageInteractionClassName}`}
        onClick={onImageClick}
        src={article.image_urls[0]}
      />
    );
  }

  return (
    <div
      className={`relative ${imageHeightClassName} transition-all duration-300 ease-in-out ${imageInteractionClassName}`}
      onClick={onImageClick}
    >
      <div
        className="flex h-full snap-x snap-mandatory overflow-x-auto"
        onScroll={(event) => {
          const gallery = event.currentTarget;
          const viewportCenter = gallery.scrollLeft + gallery.clientWidth / 2;
          let closestIndex = 0;
          let closestDistance = Number.POSITIVE_INFINITY;

          Array.from(gallery.children).forEach((image, index) => {
            if (!(image instanceof HTMLElement)) {
              return;
            }
            const imageCenter = image.offsetLeft + image.clientWidth / 2;
            const distance = Math.abs(imageCenter - viewportCenter);
            if (distance < closestDistance) {
              closestIndex = index;
              closestDistance = distance;
            }
          });
          setActiveImageIndex((current) => current === closestIndex ? current : closestIndex);
        }}
      >
        {article.image_urls.map((imageUrl, index) => (
          <img
            alt=""
            className={`h-full w-[88%] shrink-0 snap-center ${imageFitClassName} first:w-full`}
            key={`${imageUrl}-${index}`}
            src={imageUrl}
          />
        ))}
      </div>
      <span className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {article.image_urls.map((imageUrl, index) => (
          <i aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${index === activeImageIndex ? 'bg-[#C5A059]' : 'bg-white/50'}`} key={`${imageUrl}-${index}`} />
        ))}
      </span>
    </div>
  );
}

export function NewsCard({ article, language, onOpen }: { article: Article; language: string; onOpen: () => void }) {
  const { t } = useTranslation();
  const isInteractive = article.format === 'interactive_presentation';

  return (
    <article className="overflow-hidden rounded-2xl border border-[#C5A059]/20 bg-[#141417] shadow-lg shadow-black/20">
      <button
        aria-label={t('articles.open', { title: article.title })}
        className={`block w-full text-left ${isInteractive ? 'h-64' : ''}`}
        onClick={onOpen}
        type="button"
      >
        {isInteractive ? (
          <div className="relative h-full w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#C5A059]/15 via-[#141417] to-[#141417]">
            {article.image_urls[0] && <img alt="" className="h-full w-full object-cover" src={article.image_urls[0]} />}
            <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-[#C5A059]/50 bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#FFE28A]">
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <rect height="12" rx="1" width="15" x="4" y="4" />
                <path d="M7 19h13V8" />
              </svg>
              {t('articles.interactive')}
            </span>
          </div>
        ) : (
          <>
            <div className={`relative ${article.image_urls.length === 0 ? 'min-h-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#C5A059]/15 via-[#141417] to-[#141417]' : ''}`}>
              <ArticleImages article={article} />
              <span className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${article.type === 'article' ? 'border-[#C5A059]/50 bg-gradient-to-r from-[#8D6A28] to-[#C5A059] text-black' : 'border-slate-400/30 bg-slate-500/20 text-slate-200'}`}>
                {article.type === 'article' ? t('articles.article') : t('articles.news')}
              </span>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#C5A059]">{formatArticleDate(article.created_at, language)}</p>
              <h2 className="mt-2 text-lg font-semibold text-[#F4F4F5]">{article.title}</h2>
              {article.content && <p className="mt-2 overflow-hidden text-sm leading-5 text-slate-400" style={{ WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, display: '-webkit-box' }}>{article.content}</p>}
            </div>
          </>
        )}
      </button>
    </article>
  );
}
