import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useDistilleryInfographic } from '@/hooks/useInfographic.ts';
import type { TimelineStep } from '@/types/infographicSchemas.ts';
import UniversalInfographicRenderer from './UniversalInfographicRenderer.tsx';

const ArdbegTimelineInfographic = lazy(() => import('./ArdbegTimelineInfographic.tsx'));
type DetailedTimelineStep = Extract<TimelineStep, { id: string | number }>;

type Props = {
  distillery: {
    id: number;
    name: string;
    description: string | null;
    logo_url?: string | null;
  };
  isArdbeg: boolean;
};

export default function DistilleryInfographicContent({ distillery, isArdbeg }: Props) {
  const { t } = useTranslation();
  const infographic = useDistilleryInfographic(distillery.id);

  if (infographic.isPending) {
    return <p className="p-6 text-sm text-[#C5A059]">{t('common.loading')}</p>;
  }
  if (infographic.isError) {
    return (
      <div role="alert" className="p-6 text-sm text-red-300">
        <p>{t('infographic.load_error')}</p>
        <button
          type="button"
          className="mt-3 rounded-lg border border-[#C5A059]/40 px-4 py-2 text-[#C5A059]"
          onClick={() => void infographic.refetch()}
        >
          {t('infographic.retry')}
        </button>
      </div>
    );
  }
  if (infographic.data) {
    const steps = infographic.data.type === 'timeline' ? infographic.data.schema_data.steps : null;
    if (isArdbeg && steps?.every((step): step is DetailedTimelineStep => 'id' in step)) {
      const milestones = steps.map((step) => ({
        id: String(step.id),
        year: String(step.dateOrYear),
        title: step.title,
        description: step.description,
      }));
      return (
        <Suspense fallback={<p className="p-6 text-sm text-[#C5A059]">{t('common.loading')}</p>}>
          <ArdbegTimelineInfographic logoUrl={distillery.logo_url ?? null} milestones={milestones} />
        </Suspense>
      );
    }
    return (
      <div className="p-6">
        <h2 className="mb-5 text-2xl font-semibold text-white">{distillery.name}</h2>
        <UniversalInfographicRenderer schemaData={infographic.data} />
      </div>
    );
  }
  if (isArdbeg) {
    return (
      <Suspense fallback={<p className="p-6 text-sm text-[#C5A059]">{t('common.loading')}</p>}>
        <ArdbegTimelineInfographic logoUrl={distillery.logo_url ?? null} />
      </Suspense>
    );
  }
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold text-white">{distillery.name}</h2>
      <p className="mt-5 text-sm leading-7 text-slate-300" style={{ whiteSpace: 'pre-wrap' }}>
        {distillery.description || t('bottle.description_soon')}
      </p>
    </div>
  );
}
