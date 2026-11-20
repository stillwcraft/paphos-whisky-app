import { lazy, Suspense, type ComponentProps } from 'react';

// recharts is ~200 KB; load it only when a bottle's tag chart is actually shown.
const BottleTagChartImpl = lazy(() => import('@/components/BottleTagChart.tsx').then(
  ({ BottleTagChart }) => ({ default: BottleTagChart }),
));

export function BottleTagChart(props: ComponentProps<typeof BottleTagChartImpl>) {
  return (
    <Suspense fallback={<div className="h-[180px]" aria-hidden="true" />}>
      <BottleTagChartImpl {...props} />
    </Suspense>
  );
}
