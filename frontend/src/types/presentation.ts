import { z } from 'zod';

const localized = z.record(z.string(), z.string());
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const photo = z.object({ url: z.url().refine(value => new URL(value).protocol === 'https:'), alt: localized });
const base = {
  id: identifier,
  title: localized.nullable().optional(),
  animations: z.object({
    entry: z.enum(['fade', 'rise', 'none']),
    staggerDelay: z.number().min(0).max(1),
  }).nullable().optional(),
};
export const presentationRouteSchema = z.enum([
  'events', 'articles', 'map', 'cyprus-map', 'distilleries', 'bottles', 'profile',
]);
export type PresentationRoute = z.infer<typeof presentationRouteSchema>;

export const slideSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('static'), html: z.string(), css: z.string(), image: photo.nullable() }),
  z.object({ ...base, type: z.literal('video'), video: photo, autoplay: z.literal(true), muted: z.literal(true) }),
  z.object({ ...base, type: z.literal('gallery'), photos: z.array(photo).min(1).max(30) }),
  z.object({
    ...base, type: z.literal('interactive_tabs'),
    tabs: z.array(z.object({
      id: identifier, label: localized, html: z.string(), route: presentationRouteSchema.nullable(),
    })).min(1).max(10),
  }),
  z.object({
    ...base, type: z.literal('poll'), question: localized,
    options: z.array(z.object({ id: identifier, label: localized })).min(2).max(10),
  }),
  z.object({ ...base, type: z.literal('word_cloud'), prompt: localized, max_words: z.number().int().min(1).max(3) }),
]);

export type SlideConfig = z.infer<typeof slideSchema>;
export type SlideType = SlideConfig['type'];
export type BaseSlideConfig = Pick<SlideConfig, 'id' | 'type' | 'title' | 'animations'>;
export type StaticSlideConfig = Extract<SlideConfig, { type: 'static' }>;
export type VideoSlideConfig = Extract<SlideConfig, { type: 'video' }>;
export type GallerySlideConfig = Extract<SlideConfig, { type: 'gallery' }>;
export type InteractiveTabsSlideConfig = Extract<SlideConfig, { type: 'interactive_tabs' }>;
export type PollSlideConfig = Extract<SlideConfig, { type: 'poll' }>;
export type WordCloudSlideConfig = Extract<SlideConfig, { type: 'word_cloud' }>;
// Answers exist only in the authoring manifest, never in a public session.
export interface PresentationManifest {
  id: string;
  slides: (SlideConfig | (PollSlideConfig & { answers: string[] }))[];
}

const counts = z.record(z.string(), z.number().int().nonnegative());
export const sessionStateSchema = z.object({
  type: z.literal('state'),
  room_id: z.string(),
  role: z.enum(['presenter', 'viewer']),
  revision: z.number().int().nonnegative(),
  current_slide_index: z.number().int().nonnegative(),
  max_unlocked_slide_index: z.number().int().nonnegative(),
  slide_count: z.number().int().min(1).max(100),
  slides: z.record(z.string(), slideSchema),
  results: z.record(z.string(), z.object({
    counts,
    own_vote: z.string().nullable().optional(),
    own_words: z.array(z.string()).optional(),
  })),
}).superRefine((state, ctx) => {
  if (state.current_slide_index > state.max_unlocked_slide_index
    || state.max_unlocked_slide_index >= state.slide_count
    || Object.keys(state.slides).length !== state.max_unlocked_slide_index + 1
    || Array.from({ length: state.max_unlocked_slide_index + 1 }, (_, i) => state.slides[String(i)]).some(slide => !slide)) {
    ctx.addIssue({ code: 'custom', message: 'Invalid presentation unlock state' });
  }
});
export type PresentationState = z.infer<typeof sessionStateSchema>;
export type SlideResult = PresentationState['results'][string];
export type PresentationCommand =
  | { type: 'advance'; index: number }
  | { type: 'vote'; slide_id: string; option_id: string }
  | { type: 'words'; slide_id: string; words: string[] };

export function localize(value: Record<string, string> | null | undefined, language: string): string {
  return value?.[language] ?? value?.[language.split('-')[0]] ?? value?.en ?? Object.values(value ?? {})[0] ?? '';
}
