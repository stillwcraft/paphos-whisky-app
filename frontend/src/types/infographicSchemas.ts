import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const chartSchema = z.object({
  chart_type: z.enum(['bar', 'line', 'pie']),
  labels: z.array(z.string()).min(1),
  datasets: z.array(z.object({
    name: z.string().min(1),
    data: z.array(z.number().finite()).min(1),
    color: hexColor.nullable().optional(),
  }).strict()).min(1),
  x_axis_label: z.string().nullable().optional(),
  y_axis_label: z.string().nullable().optional(),
  animated: z.boolean().default(true),
  animation_delay_ms: z.number().int().nonnegative().default(0),
}).strict().superRefine((payload, context) => {
  if (payload.datasets.some((dataset) => dataset.data.length !== payload.labels.length)) {
    context.addIssue({ code: 'custom', message: 'Each dataset must match the labels length' });
  }
  if (payload.chart_type === 'pie' && payload.datasets.length !== 1) {
    context.addIssue({ code: 'custom', message: 'Pie charts require exactly one dataset' });
  }
});

const timelineStepSchema = z.object({
  id: z.union([z.string().min(1), z.number().int()]),
  badge: z.string().nullable().optional(),
  title: z.string().min(1),
  subtitle: z.string(),
  description: z.string(),
  dateOrYear: z.union([z.string(), z.number().int()]),
}).strict();

const legacyTimelineStepSchema = z.object({
    step: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string(),
    badge: z.string().nullable().optional(),
}).strict();

export const timelineSchema = z.object({
  steps: z.array(z.union([timelineStepSchema, legacyTimelineStepSchema])).min(1),
}).strict().superRefine((payload, context) => {
  const identifiers = payload.steps.map((item) => String('id' in item ? item.id : item.step));
  if (new Set(identifiers).size !== payload.steps.length) {
    context.addIssue({ code: 'custom', message: 'Timeline step identifiers must be unique' });
  }
});

export const mapOverlaySchema = z.object({
  markers: z.array(z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    title: z.string().min(1),
  }).strict()).min(1),
}).strict();

export const infographicSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chart'), schema_data: chartSchema }),
  z.object({ type: z.literal('timeline'), schema_data: timelineSchema, title: z.string().optional() }),
  z.object({ type: z.literal('map_overlay'), schema_data: mapOverlaySchema }),
]);

export const infographicResponseSchema = infographicSchema.and(z.object({
  id: z.string().uuid(),
  title: z.string(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}));

export type ChartPayload = z.infer<typeof chartSchema>;
export type TimelinePayload = z.infer<typeof timelineSchema>;
export type TimelineStep = TimelinePayload['steps'][number];
export type Infographic = z.infer<typeof infographicSchema>;
export type InfographicResponse = z.infer<typeof infographicResponseSchema>;
