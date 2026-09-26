import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedApiUrl } from '@/localization.ts';
import { useAnalytics } from '@/hooks/useAnalytics.ts';
import { normalizePaginatedResponse, paginatedUrl, type PaginatedResponse, useInfiniteScroll } from '@/pagination.ts';
import type { Article } from '@/types/interactiveNews.ts';
import { ArticleImages, NewsCard, formatArticleDate } from '@/components/news/NewsCard.tsx';

const API_URL = 'https://paphos-whisky-api.onrender.com';
const InteractiveNewsViewer = lazy(() => import('@/components/news/InteractiveNewsViewer.tsx'));

function ArticleReader({ article, onClose }: { article: Article; onClose: () => void }) {
  const { i18n, t } = useTranslation();
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/95 p-4 backdrop-blur-sm"
      onClick={() => {
        if (isImageExpanded) {
          setIsImageExpanded(false);
        }
      }}
    >
      <article
        className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[#C5A059]/20 bg-[#141417] shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${article.type === 'article' ? 'border-[#C5A059]/50 bg-gradient-to-r from-[#8D6A28] to-[#C5A059] text-black' : 'border-slate-400/30 bg-slate-500/20 text-slate-200'}`}>
            {article.type === 'article' ? t('articles.article') : t('articles.news')}
          </span>
          <button aria-label="Закрыть публикацию" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-xl text-[#F4F4F5] transition-colors hover:bg-white/10" onClick={onClose} type="button">x</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ArticleImages
            article={article}
            expanded
            isImageExpanded={isImageExpanded}
            onImageClick={() => setIsImageExpanded((current) => !current)}
          />
          <div className="p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-[#C5A059]">{formatArticleDate(article.created_at, i18n.language)}</p>
            <h1 className="mt-3 font-serif text-2xl font-bold leading-tight text-[#F4F4F5]">{article.title}</h1>
            <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-300">{article.content}</p>
          </div>
        </div>
      </article>
    </div>
  );
}

export function NewsFeedTab() {
  const { i18n, t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedInteractiveArticle, setSelectedInteractiveArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadArticles = useCallback(async (offset: number, replace = false) => {
    if (replace) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    try {
      const response = await fetch(localizedApiUrl(
        paginatedUrl(`${API_URL}/api/articles`, 3, offset),
        i18n.language,
      ));
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const page = normalizePaginatedResponse(
        await response.json() as PaginatedResponse<Article> | Article[],
      );
      setArticles((current) => replace ? page.items : [...current, ...page.items]);
      setHasMore(page.has_more);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load articles.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [i18n.language]);

  useEffect(() => {
    setSelectedArticle(null);
    setSelectedInteractiveArticle(null);
    void loadArticles(0, true);
  }, [loadArticles]);

  const loadMoreArticles = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      void loadArticles(articles.length);
    }
  }, [articles.length, hasMore, isLoadingMore, loadArticles]);
  const articlesSentinelRef = useInfiniteScroll(
    loadMoreArticles,
    hasMore && !isLoading && !isLoadingMore,
  );

  return (
    <section className="mx-auto w-full max-w-md pb-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
      {isLoading ? (
        <p className="text-center text-sm text-slate-400">Завантаження...</p>
      ) : error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : articles.length === 0 ? (
        <p className="text-center text-sm text-slate-400">Публікацій поки немає.</p>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <NewsCard
              article={article}
              key={article.id}
              language={i18n.language}
              onOpen={() => {
                trackEvent('news_article_opened', {
                  article_id: article.id,
                  article_type: article.type,
                  image_count: article.image_urls.length,
                });
                if (article.format === 'interactive_presentation') {
                  setSelectedInteractiveArticle(article);
                } else {
                  setSelectedArticle(article);
                }
              }}
            />
          ))}
          {hasMore && <div ref={articlesSentinelRef} className="h-px" aria-hidden="true" />}
          {isLoadingMore && <p className="text-center text-sm text-slate-400">Завантаження...</p>}
        </div>
      )}
      {selectedArticle && <ArticleReader article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
      {selectedInteractiveArticle && (
        <Suspense fallback={<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-white" role="status">{t('articles.loading_presentation')}</div>}>
          <InteractiveNewsViewer
            article={selectedInteractiveArticle}
            key={selectedInteractiveArticle.id}
            language={i18n.language}
            onClose={() => setSelectedInteractiveArticle(null)}
          />
        </Suspense>
      )}
    </section>
  );
}
