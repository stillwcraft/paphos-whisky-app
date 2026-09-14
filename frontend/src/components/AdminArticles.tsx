import { useCallback, useEffect, useState } from 'react';
import { telegramAuthHeaders } from '@/telegramAuth.ts';
import { AdminArticleForm, type AdminArticle, type ArticleFormValues } from '@/components/AdminArticleForm.tsx';

const API_URL = 'https://paphos-whisky-api.onrender.com';

function articleTitle(article: AdminArticle) {
  return article.title.ru || article.title.en || article.title.uk || 'Без назви';
}

type Props = {
  initDataRaw: string | undefined;
};

async function getError(response: Response) {
  try {
    const data: unknown = await response.json();
    if (typeof data === 'object' && data !== null && 'detail' in data) {
      return String(data.detail);
    }
  } catch {
    // Status below is sufficient when the server response is not JSON.
  }
  return `Server error: ${response.status}`;
}

export function AdminArticles({ initDataRaw }: Props) {
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [editingArticle, setEditingArticle] = useState<AdminArticle | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/articles`, {
        headers: telegramAuthHeaders(initDataRaw),
      });
      if (!response.ok) throw new Error(await getError(response));
      setArticles(await response.json() as AdminArticle[]);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити публікації.');
    } finally {
      setIsLoading(false);
    }
  }, [initDataRaw]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  const saveArticle = async (values: ArticleFormValues) => {
    const articleId = editingArticle?.id;
    setIsSaving(true);
    try {
      const response = await fetch(
        articleId === undefined
          ? `${API_URL}/api/admin/articles`
          : `${API_URL}/api/admin/articles/${articleId}`,
        {
          method: articleId === undefined ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) },
          body: JSON.stringify(values),
        },
      );
      if (!response.ok) throw new Error(await getError(response));
      setEditingArticle(undefined);
      await loadArticles();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти публікацію.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteArticle = async (article: AdminArticle) => {
    if (!window.confirm(`Видалити публікацію «${articleTitle(article)}»?`)) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/admin/articles/${article.id}`, {
        method: 'DELETE',
        headers: telegramAuthHeaders(initDataRaw),
      });
      if (!response.ok) throw new Error(await getError(response));
      await loadArticles();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не вдалося видалити публікацію.');
    }
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className="rounded-xl bg-[#C5A059] px-3 py-2 text-sm font-bold text-black transition-colors hover:bg-[#b59049]" onClick={() => setEditingArticle(null)} type="button">+ Додати новину / статтю</button>
      </div>
      {error && <p className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      {isLoading ? (
        <p className="text-sm text-[#9E9D9A]">Завантаження...</p>
      ) : articles.length === 0 ? (
        <p className="text-sm text-[#9E9D9A]">Публікацій ще немає.</p>
      ) : (
        <div className="space-y-2">
          {articles.map((article) => (
            <article className="flex items-center gap-3 rounded-xl bg-[#2A292C] p-3" key={article.id}>
              {article.image_urls[0] && <img alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" src={article.image_urls[0]} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${article.type === 'article' ? 'border-[#C5A059]/40 bg-[#C5A059]/10 text-[#C5A059]' : 'border-slate-400/30 bg-slate-400/10 text-slate-300'}`}>
                    {article.type === 'article' ? 'Статья' : 'Новость'}
                  </span>
                  {!article.is_published && <span className="text-[10px] font-semibold text-[#9E9D9A]">Черновик</span>}
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-[#F4F4F5]">{articleTitle(article)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button aria-label={`Редагувати ${articleTitle(article)}`} className="rounded-lg p-2 text-[#C5A059] transition-colors hover:bg-white/5" onClick={() => setEditingArticle(article)} type="button">✏️</button>
                <button aria-label={`Видалити ${articleTitle(article)}`} className="rounded-lg p-2 text-red-300 transition-colors hover:bg-red-400/10" onClick={() => void deleteArticle(article)} type="button">🗑️</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editingArticle !== undefined && (
        <AdminArticleForm
          article={editingArticle}
          isSaving={isSaving}
          onClose={() => setEditingArticle(undefined)}
          onSubmit={(values) => void saveArticle(values)}
        />
      )}
    </div>
  );
}
