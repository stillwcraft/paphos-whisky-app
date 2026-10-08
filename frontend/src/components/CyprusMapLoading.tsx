import { useTranslation } from 'react-i18next';

export function CyprusMapLoading({ className = '' }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-label={t('common.loading')}
      className={`flex items-center justify-center bg-[#141417]/95 ${className}`}
    >
      <div aria-hidden="true" className="cyprus-map-loader" data-label={t('common.loading')} />
    </div>
  );
}
