import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedApiUrl } from '@/localization.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';

type Article = {
  id: number;
  title: string;
  content: string;
  type: 'article' | 'news';
  image_urls: string[];
  created_at: string;
};

function formatArticleDate(value: string, language: string) {
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

function ArticleImages({ article, expanded = false }: { article: Article; expanded?: boolean }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (article.image_urls.length === 0) {
    return null;
  }

  if (article.image_urls.length === 1) {
    return (
      <img
        alt=""
        className={expanded ? 'h-72 w-full object-cover' : 'h-44 w-full object-cover'}
        src={article.image_urls[0]}
      />
    );
  }

  return (
    <div className={`relative ${expanded ? 'h-72' : 'h-44'}`}>
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
            className="h-full w-[88%] shrink-0 snap-center object-cover first:w-full"
            key={`${imageUrl}-${index}`}
            src={imageUrl}
          />
        ))}
      </div>
      {(
        <span className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {article.image_urls.map((imageUrl, index) => (
            <i aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${index === activeImageIndex ? 'bg-[#C5A059]' : 'bg-white/50'}`} key={`${imageUrl}-${index}`} />
          ))}
        </span>
      )}
    </div>
  );
}

function ArticleReader({ article, onClose }: { article: Article; onClose: () => void }) {
  const { i18n, t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 p-4 backdrop-blur-sm">
      <article className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[#C5A059]/20 bg-[#141417] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between px-5 py-4">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${article.type === 'article' ? 'border-[#C5A059]/50 bg-gradient-to-r from-[#8D6A28] to-[#C5A059] text-black' : 'border-slate-400/30 bg-slate-500/20 text-slate-200'}`}>
            {article.type === 'article' ? t('articles.article') : t('articles.news')}
          </span>
          <button aria-label="Закрыть публикацию" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-xl text-[#F4F4F5] transition-colors hover:bg-white/10" onClick={onClose} type="button">x</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ArticleImages article={article} expanded />
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

export function ArticlesTab() {
  const { i18n, t } = useTranslation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const loadArticles = async () => {
      try {
        const response = await fetch(
          localizedApiUrl(`${API_URL}/api/articles`, i18n.language),
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        setArticles(await response.json() as Article[]);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Could not load articles.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadArticles();
    return () => controller.abort();
  }, [i18n.language]);

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
            <article className="overflow-hidden rounded-2xl border border-[#C5A059]/20 bg-[#141417] shadow-lg shadow-black/20" key={article.id}>
              <button aria-label={`Відкрити ${article.title}`} className="block w-full text-left" onClick={() => setSelectedArticle(article)} type="button">
                <div className={`relative ${article.image_urls.length === 0 ? 'min-h-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#C5A059]/15 via-[#141417] to-[#141417]' : ''}`}>
                  <ArticleImages article={article} />
                  <span className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${article.type === 'article' ? 'border-[#C5A059]/50 bg-gradient-to-r from-[#8D6A28] to-[#C5A059] text-black' : 'border-slate-400/30 bg-slate-500/20 text-slate-200'}`}>
                    {article.type === 'article' ? t('articles.article') : t('articles.news')}
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#C5A059]">{formatArticleDate(article.created_at, i18n.language)}</p>
                  <h2 className="mt-2 text-lg font-semibold text-[#F4F4F5]">{article.title}</h2>
                  <p className="mt-2 overflow-hidden text-sm leading-5 text-slate-400" style={{ WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, display: '-webkit-box' }}>{article.content}</p>
                </div>
              </button>
            </article>
          ))}
        </div>
      )}
      {selectedArticle && <ArticleReader article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
    </section>
  );
}
