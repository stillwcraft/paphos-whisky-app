import { useState } from 'react';
import { AccessDeniedError, downloadFile, openLink, useSignal } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
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
  const { i18n, t } = useTranslation();
  const useNativeDownload = useSignal(downloadFile.isAvailable);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [previewTimestamp] = useState(() => Date.now());
  const cardEndpoint = `${API_URL}/api/reviews/${reviewId}/card.png`;
  const languageCode = i18n.resolvedLanguage?.toLowerCase().split(/[-_]/, 1)[0];
  const cardLanguage = languageCode === 'ru' || languageCode === 'uk' ? languageCode : 'en';
  const cardUrl = `${cardEndpoint}?lang=${cardLanguage}&t=${previewTimestamp}`;
  const createDownloadUrl = () => `${cardEndpoint}?download=1&lang=${cardLanguage}&t=${Date.now()}`;

  const publish = async () => {
    setIsPublishing(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/reviews/${reviewId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...telegramAuthHeaders(initDataRaw) },
        body: JSON.stringify({ language: cardLanguage, ...(threadId ? { thread_id: threadId } : {}) }),
      });
      if (!response.ok) throw new Error(await extractErrorMessage(response));
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
      setIsPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('review_share.publish_error'));
    } finally {
      setIsPublishing(false);
    }
  };

  const download = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadFailed(false);
    setError(null);
    try {
      await downloadFile(createDownloadUrl(), `whisky-review-${reviewId}.png`, { timeout: 60_000 });
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        setError(t('review_share.download_cancelled'));
      } else {
        setDownloadFailed(true);
        setError(t('review_share.download_error'));
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const browserDownload = (
    <a
      className="block w-full rounded-xl border border-[#C5A059]/30 px-4 py-3.5 text-center text-sm font-semibold text-[#C5A059] transition-colors hover:bg-[#C5A059]/10"
      href={`${cardEndpoint}?download=1&lang=${cardLanguage}&t=${previewTimestamp}`}
      onClick={(event) => {
        const downloadUrl = createDownloadUrl();
        // Let the Telegram host open the URL outside the Mini App's iframe.
        if (openLink.isAvailable()) {
          event.preventDefault();
          setError(null);
          try {
            openLink(downloadUrl);
          } catch {
            setError(t('review_share.browser_error'));
          }
        } else {
          event.currentTarget.href = downloadUrl;
        }
      }}
      rel="noopener noreferrer"
      target="_blank"
    >
      {useNativeDownload ? t('review_share.open_in_browser') : t('review_share.download')}
    </a>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xl">
      <article className="w-full max-w-md overflow-hidden rounded-3xl border border-[#C5A059]/30 bg-[#16161A] shadow-2xl shadow-black/70">
        <div className="flex items-center justify-between border-b border-[#C5A059]/15 px-5 py-4">
          <h2 className="font-serif text-xl font-bold text-[#F4F4F5]">{t('review_share.title')}</h2>
          <button
            aria-label={t('review_share.close')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[#9E9D9A] transition-colors hover:bg-white/5 hover:text-[#F4F4F5]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>
        <img alt={t('review_share.preview_alt')} className="aspect-square w-full bg-[#0D0D0E] object-cover" src={cardUrl} />
        <div className="space-y-3 p-4">
          {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          {isPublished && <p className="rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 px-3 py-2 text-center text-sm font-medium text-[#C5A059]">{t('review_share.published')}</p>}
          <button
            className="w-full rounded-xl bg-[#C5A059] px-4 py-3.5 text-sm font-semibold uppercase tracking-wider text-black transition-colors hover:bg-[#b59049] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPublishing || isPublished}
            onClick={() => void publish()}
            type="button"
          >
            {isPublished ? t('review_share.published') : isPublishing ? t('review_share.publishing') : t('review_share.publish')}
          </button>
          {useNativeDownload ? (
            <button
              className="w-full rounded-xl border border-[#C5A059]/30 px-4 py-3.5 text-sm font-semibold text-[#C5A059] transition-colors hover:bg-[#C5A059]/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isDownloading}
              onClick={() => void download()}
              type="button"
            >
              {isDownloading ? t('review_share.preparing') : t('review_share.download')}
            </button>
          ) : browserDownload}
          {useNativeDownload && downloadFailed && browserDownload}
        </div>
      </article>
    </div>
  );
}
