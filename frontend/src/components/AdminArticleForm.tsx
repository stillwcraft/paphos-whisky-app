import { useEffect, useState, type FormEvent } from 'react';

export type AdminArticle = {
  id: number;
  title: string;
  content: string;
  type: 'article' | 'news';
  image_urls: string[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type ArticleFormValues = Pick<
  AdminArticle,
  'title' | 'content' | 'type' | 'image_urls' | 'is_published'
>;

type Props = {
  article: AdminArticle | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: ArticleFormValues) => void;
};

const emptyArticle = (): ArticleFormValues => ({
  title: '',
  content: '',
  type: 'news',
  image_urls: [],
  is_published: true,
});

function formValuesFromArticle(article: AdminArticle | null): ArticleFormValues {
  return article
    ? {
      title: article.title,
      content: article.content,
      type: article.type,
      image_urls: article.image_urls,
      is_published: article.is_published,
    }
    : emptyArticle();
}

export function AdminArticleForm({ article, isSaving, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<ArticleFormValues>(() => formValuesFromArticle(article));
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrlError, setImageUrlError] = useState<string | null>(null);

  useEffect(() => {
    setForm(formValuesFromArticle(article));
    setImageUrl('');
    setImageUrlError(null);
  }, [article]);

  const addImageUrl = () => {
    const url = imageUrl.trim();
    if (!url) {
      setImageUrlError('Введіть URL зображення.');
      return;
    }
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        throw new Error('Unsupported protocol');
      }
    } catch {
      setImageUrlError('Введіть коректний URL зображення.');
      return;
    }
    if (form.image_urls.includes(url)) {
      setImageUrlError('Це посилання вже додано.');
      return;
    }
    setForm((current) => ({ ...current, image_urls: [...current.image_urls, url] }));
    setImageUrl('');
    setImageUrlError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...form,
      title: form.title.trim(),
      content: form.content.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xl">
      <form className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-[#C5A059]/30 bg-[#16161A] p-5 shadow-2xl shadow-black/70" onSubmit={submit}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl font-bold text-[#F4F4F5]">{article ? 'Редагувати публікацію' : 'Нова публікація'}</h2>
          <button aria-label="Закрити форму статті" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-[#9E9D9A] transition-colors hover:bg-white/5 hover:text-[#F4F4F5]" onClick={onClose} type="button">x</button>
        </div>

        <label className="mb-4 flex flex-col gap-1.5 text-sm font-medium text-[#CBC9C5]">
          Title
          <input className="rounded-xl border border-[#4A4847] bg-[#0D0D0E] px-3 py-2.5 text-[#F4F4F5] outline-none transition-colors focus:border-[#C5A059]" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required value={form.title} />
        </label>

        <label className="mb-4 flex flex-col gap-1.5 text-sm font-medium text-[#CBC9C5]">
          Type
          <select className="rounded-xl border border-[#4A4847] bg-[#0D0D0E] px-3 py-2.5 text-[#F4F4F5] outline-none transition-colors focus:border-[#C5A059]" onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as AdminArticle['type'] }))} value={form.type}>
            <option value="article">Статья</option>
            <option value="news">Новость</option>
          </select>
        </label>

        <label className="mb-4 flex flex-col gap-1.5 text-sm font-medium text-[#CBC9C5]">
          Content
          <textarea className="min-h-40 resize-y rounded-xl border border-[#4A4847] bg-[#0D0D0E] px-3 py-2.5 leading-6 text-[#F4F4F5] outline-none transition-colors focus:border-[#C5A059]" onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} required value={form.content} />
        </label>

        <fieldset className="mb-4 rounded-xl border border-[#4A4847] p-3">
          <legend className="px-1 text-sm font-medium text-[#CBC9C5]">Image URLs</legend>
          <div className="flex gap-2">
            <input className="min-w-0 flex-1 rounded-xl border border-[#4A4847] bg-[#0D0D0E] px-3 py-2 text-sm text-[#F4F4F5] outline-none transition-colors focus:border-[#C5A059]" onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." type="url" value={imageUrl} />
            <button className="shrink-0 rounded-xl border border-[#C5A059]/50 px-3 py-2 text-sm font-semibold text-[#C5A059] transition-colors hover:bg-[#C5A059]/10" onClick={addImageUrl} type="button">Додати</button>
          </div>
          {imageUrlError && <p className="mt-2 text-xs text-red-300">{imageUrlError}</p>}
          {form.image_urls.length > 0 && (
            <ul className="mt-3 space-y-2">
              {form.image_urls.map((url) => (
                <li className="flex items-center gap-2 rounded-lg bg-black/20 p-2" key={url}>
                  <img alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" src={url} />
                  <span className="min-w-0 flex-1 truncate text-xs text-[#CBC9C5]">{url}</span>
                  <button aria-label={`Видалити ${url}`} className="rounded-md px-2 py-1 text-sm text-red-300 transition-colors hover:bg-red-400/10" onClick={() => setForm((current) => ({ ...current, image_urls: current.image_urls.filter((image) => image !== url) }))} type="button">x</button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <label className="mb-5 flex items-center gap-2 text-sm text-[#CBC9C5]">
          <input checked={form.is_published} className="accent-[#C5A059]" onChange={(event) => setForm((current) => ({ ...current, is_published: event.target.checked }))} type="checkbox" />
          Опубликовано
        </label>

        <div className="flex justify-end gap-2">
          <button className="rounded-xl border border-[#4A4847] px-4 py-2.5 text-sm font-semibold text-[#F4F4F5] transition-colors hover:bg-white/5" disabled={isSaving} onClick={onClose} type="button">Скасувати</button>
          <button className="rounded-xl bg-[#C5A059] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#b59049] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? 'Збереження...' : 'Зберегти'}</button>
        </div>
      </form>
    </div>
  );
}
