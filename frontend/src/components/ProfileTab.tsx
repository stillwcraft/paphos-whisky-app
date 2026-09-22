import { initData, useSignal } from '@tma.js/sdk-react';
import { useTranslation } from 'react-i18next';
import { WhiskyTrail } from '@/components/WhiskyTrail.tsx';

type TelegramUser = {
  id?: number;
  first_name?: string;
  username?: string;
  photo_url?: string;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          start_param?: string;
          user?: TelegramUser;
        };
        HapticFeedback?: {
          selectionChanged: () => void;
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
        };
        downloadFile?: (
          params: { url: string; file_name: string },
          callback?: (accepted: boolean) => void,
        ) => void;
        switchInlineQuery: (query: string, chooseChatTypes?: string[]) => void;
      };
    };
  }
}

export function ProfileTab() {
  const { i18n } = useTranslation();
  const tg = window.Telegram?.WebApp;
  const rawUser = tg?.initDataUnsafe?.user;
  const initDataState = useSignal(initData.state);
  const initDataRaw = useSignal(initData.raw);
  const userId = initDataState?.user?.id ?? rawUser?.id;
  const currentLanguage = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().split(/[-_]/, 1)[0];

  return (
    <section className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-md justify-center pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <WhiskyTrail
        firstName={initDataState?.user?.first_name ?? rawUser?.first_name}
        initDataRaw={initDataRaw}
        language={currentLanguage}
        telegramId={userId}
        username={initDataState?.user?.username ?? rawUser?.username}
      />
    </section>
  );
}
