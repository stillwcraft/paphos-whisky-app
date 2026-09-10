import { useState } from 'react';
import { telegramAuthHeaders } from '@/telegramAuth.ts';

const API_URL = 'https://paphos-whisky-api.onrender.com';

type Props = {
  reviewId: number;
  initDataRaw: string | undefined;
  onClose: () => void;
  threadId?: number;
};

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      return String(payload.detail);
    }
  } catch {
    // Use the HTTP status when the API response does not include a JSON error body.
  }
  return `Server error: ${response.status}`;
}

export function ReviewShareModal({ reviewId, initDataRaw, onClose, threadId }: Props) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const cardUrl = `${API_URL}/api/reviews/${reviewId}/card.png`;
  const downloadUrl = `${cardUrl}?download=1`;

  const publish = async () => {
    setIsPublishing(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/reviews/${reviewId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) },
        body: JSON.stringify(threadId ? { thread_id: threadId } : {}),
      });
      if (!response.ok) throw new Error(await extractErrorMessage(response));
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
      setIsPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish the review card.');
    } finally {
      setIsPublishing(false);
    }
  };

  const download = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      const downloadFile = window.Telegram?.WebApp?.downloadFile;
      if (downloadFile) {
        await new Promise<void>((resolve) => downloadFile(
          { url: cardUrl, file_name: `whisky-review-${reviewId}.png` },
          () => resolve(),
        ));
        return;
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the review card.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xl">
      <article className="w-full max-w-md overflow-hidden rounded-3xl border border-[#C5A059]/30 bg-[#16161A] shadow-2xl shadow-black/70">
        <div className="flex items-center justify-between border-b border-[#C5A059]/15 px-5 py-4">
          <h2 className="font-serif text-xl font-bold text-[#F4F4F5]">Ваш отзыв</h2>
          <button
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[#9E9D9A] transition-colors hover:bg-white/5 hover:text-[#F4F4F5]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>
        <img alt="Review card preview" className="aspect-square w-full bg-[#0D0D0E] object-cover" src={cardUrl} />
        <div className="space-y-3 p-4">
          {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          {isPublished && <p className="rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 px-3 py-2 text-center text-sm font-medium text-[#C5A059]">Опубликовано!</p>}
          <button
            className="w-full rounded-xl bg-[#C5A059] px-4 py-3.5 text-sm font-semibold uppercase tracking-wider text-black transition-colors hover:bg-[#b59049] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPublishing || isPublished}
            onClick={() => void publish()}
            type="button"
          >
            {isPublished ? 'Опубликовано' : isPublishing ? 'Публикация...' : 'Опубликовать в чате клуба'}
          </button>
          <button
            className="w-full rounded-xl border border-[#C5A059]/30 px-4 py-3.5 text-sm font-semibold text-[#C5A059] transition-colors hover:bg-[#C5A059]/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDownloading}
            onClick={() => void download()}
            type="button"
          >
            {isDownloading ? 'Подготовка...' : 'Сохранить на устройство'}
          </button>
        </div>
      </article>
    </div>
  );
}
