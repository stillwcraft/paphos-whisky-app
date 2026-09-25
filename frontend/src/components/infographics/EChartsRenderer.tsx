import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { ChartPayload } from '@/types/infographicSchemas.ts';

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

const accents = ['#C5A059', '#FFE28A', '#8A5A2B'];

export default function EChartsRenderer({ payload }: { payload: ChartPayload }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const chart = echarts.init(element, undefined, { renderer: 'svg' });
    const series = payload.chart_type === 'pie'
      ? [{
        name: payload.datasets[0].name,
        type: 'pie' as const,
        radius: ['35%', '65%'],
        data: payload.labels.map((name, index) => ({
          name,
          value: payload.datasets[0].data[index],
        })),
      }]
      : payload.datasets.map((dataset, index) => ({
        name: dataset.name,
        type: payload.chart_type,
        data: dataset.data,
        itemStyle: { color: dataset.color || accents[index % accents.length] },
      }));

    chart.setOption({
      backgroundColor: '#141417',
      color: accents,
      textStyle: { color: '#E5E7EB' },
      tooltip: { trigger: payload.chart_type === 'pie' ? 'item' : 'axis', renderMode: 'richText' },
      legend: { textStyle: { color: '#E5E7EB' }, bottom: 0 },
      ...(payload.chart_type === 'pie' ? {} : {
        grid: { left: 48, right: 24, top: 28, bottom: 66, containLabel: true },
        xAxis: {
          type: 'category', data: payload.labels, name: payload.x_axis_label || '',
          axisLabel: { color: '#E5E7EB' }, axisLine: { lineStyle: { color: '#8A5A2B' } },
        },
        yAxis: {
          type: 'value', name: payload.y_axis_label || '',
          axisLabel: { color: '#E5E7EB' }, splitLine: { lineStyle: { color: '#C5A059', opacity: 0.15 } },
        },
      }),
      animation: payload.animated,
      animationDelay: (index: number) => index * payload.animation_delay_ms,
      series,
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [payload]);

  return <div ref={containerRef} className="w-full min-h-[320px] rounded-xl overflow-hidden" role="img" aria-label="График" />;
}
