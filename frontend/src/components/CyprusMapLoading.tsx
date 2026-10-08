import { useTranslation } from 'react-i18next';

export function CyprusMapLoading({ className = '' }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 bg-[#141417]/85 backdrop-blur-[2px] ${className}`}
    >
      <div aria-hidden="true" className="cyprus-map-shimmer h-24 w-[min(78vw,22rem)]" />
      <span className="text-sm font-medium tracking-wide text-[#D9BD82]">{t('common.loading')}</span>
    </div>
  );
}
