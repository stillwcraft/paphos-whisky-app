import { lazy, Suspense } from 'react';
import { useInfographic } from '@/hooks/useInfographic.ts';
import { infographicSchema, type Infographic } from '@/types/infographicSchemas.ts';
import InfographicErrorBoundary from './InfographicErrorBoundary.tsx';

const EChartsRenderer = lazy(() => import('./EChartsRenderer.tsx'));
const TimelineStepByStep = lazy(() => import('./TimelineStepByStep.tsx'));

type Props =
  | { infographicId: string; schemaData?: never }
  | { schemaData: Infographic; infographicId?: never };

function Skeleton() {
  return (
    <div
      role="status"
      aria-label="Загрузка инфографики"
      className="h-80 w-full animate-pulse rounded-2xl border border-[#C5A059]/20 bg-gradient-to-br from-[#141417] via-[#8A5A2B]/30 to-[#141417]"
    />
  );
}

function Content({ infographicId, schemaData }: Props) {
  const query = useInfographic(infographicId ?? '');

  if (schemaData === undefined && !infographicId) {
    throw new Error('infographicId is required when schemaData is not provided');
  }
  if (schemaData === undefined && (query.isPending || query.isFetching && !query.data)) {
    return <Skeleton />;
  }
  if (schemaData === undefined && query.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-[#C5A059]/30 bg-[#1A1A1E] p-6 text-center text-[#E5E7EB]">
        <p>Не удалось загрузить инфографику</p>
        <button type="button" className="mt-3 text-[#C5A059]" onClick={() => void query.refetch()}>
          Повторить
        </button>
      </div>
    );
  }

  const input: unknown = schemaData === undefined ? query.data : schemaData;
  const infographic: Infographic = infographicSchema.parse(input);

  switch (infographic.type) {
    case 'chart':
      return <Suspense fallback={<Skeleton />}><EChartsRenderer payload={infographic.schema_data} /></Suspense>;
    case 'timeline':
      return <Suspense fallback={<Skeleton />}><TimelineStepByStep payload={infographic.schema_data} /></Suspense>;
    case 'map_overlay':
      return <p className="rounded-xl border border-[#C5A059]/30 bg-[#1A1A1E] p-4 text-[#E5E7EB]">Отображение карты пока не поддерживается</p>;
  }
}

export default function UniversalInfographicRenderer(props: Props) {
  return (
    <InfographicErrorBoundary key={props.infographicId ?? 'inline'}>
      <Content {...props} />
    </InfographicErrorBoundary>
  );
}
