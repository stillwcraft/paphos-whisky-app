import { z } from 'zod';

const localized = z.record(z.string(), z.string());
const htmlContent = z.union([z.string(), localized]);
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const photo = z.object({
  url: z.url().refine(value => new URL(value).protocol === 'https:'),
  alt: localized.default({}),
  caption: localized.nullable().optional(),
});
export type PhotoConfig = z.infer<typeof photo>;
const themeColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
export const presentationThemeSchema = z.object({
  primaryColor: themeColor.default('#C5A059'),
  backgroundColor: themeColor.default('#0D0D0E'),
  textColor: themeColor.default('#F4F4F5'),
  accentColor: themeColor.default('#C5A059'),
  fontFamily: z.enum(['sans', 'serif', 'monospace']).default('sans'),
});
export type PresentationTheme = z.infer<typeof presentationThemeSchema>;
const base = {
  id: identifier,
  title: localized.nullable().optional(),
  subtitle: localized.nullable().optional(),
  animations: z.object({
    entry: z.enum(['fade', 'rise', 'none', 'fade-up', 'slide-left', 'zoom-in']).default('fade'),
    staggerDelay: z.number().min(0).max(1).default(0),
  }).nullable().optional(),
};
export const presentationRouteSchema = z.enum([
  'events', 'articles', 'map', 'cyprus-map', 'distilleries', 'bottles', 'profile',
]);
export type PresentationRoute = z.infer<typeof presentationRouteSchema>;

export function canViewPresentationTab(userId: number | undefined, isAdmin: boolean): boolean {
  return isAdmin || userId === 741623645;
}

export const slideSchema = z.discriminatedUnion('type', [
  z.object({
    ...base, type: z.literal('static'), html: htmlContent.default(''),
    interactiveHtml: z.boolean().default(false),
    css: z.string().default(''), image: photo.nullable().default(null),
  }),
  z.object({
    ...base, type: z.literal('video'), video: photo, autoplay: z.literal(true).default(true),
    muted: z.literal(true).default(true), loop: z.boolean().default(false),
  }),
  z.object({ ...base, type: z.literal('gallery'), photos: z.array(photo).min(1).max(30) }),
  z.object({
    ...base, type: z.literal('interactive_tabs'),
    tabs: z.array(z.object({
      id: identifier, label: localized, html: htmlContent.default(''), route: presentationRouteSchema.nullable().default(null),
    })).min(1).max(10),
  }),
  z.object({
    ...base, type: z.literal('poll'), question: localized,
    options: z.array(z.object({ id: identifier, label: localized })).min(2).max(10),
    allowMultiple: z.literal(false).default(false),
    showResultsLive: z.literal(true).default(true),
  }),
  z.object({ ...base, type: z.literal('word_cloud'), prompt: localized, max_words: z.number().int().min(1).max(3) }),
]);

export type SlideConfig = z.infer<typeof slideSchema>;
export type SlideType = SlideConfig['type'];
export type BaseSlideConfig = Pick<SlideConfig, 'id' | 'type' | 'title' | 'subtitle' | 'animations'>;
export type StaticSlideConfig = Extract<SlideConfig, { type: 'static' }>;
export type VideoSlideConfig = Extract<SlideConfig, { type: 'video' }>;
export type GallerySlideConfig = Extract<SlideConfig, { type: 'gallery' }>;
export type InteractiveTabsSlideConfig = Extract<SlideConfig, { type: 'interactive_tabs' }>;
export type PollSlideConfig = Extract<SlideConfig, { type: 'poll' }>;
export type WordCloudSlideConfig = Extract<SlideConfig, { type: 'word_cloud' }>;
type SlideInput = z.input<typeof slideSchema>;
type HtmlInput = z.input<typeof htmlContent>;
type PhotoInput = z.input<typeof photo>;
export type AuthoredSlideConfig =
  | Exclude<SlideInput, { type: 'static' | 'video' | 'poll' }>
  | (Omit<Extract<SlideInput, { type: 'static' }>, 'html' | 'image'> & {
    html?: HtmlInput; contentHtml?: HtmlInput; image?: PhotoInput | null; imageUrl?: string;
  })
  | (Omit<Extract<SlideInput, { type: 'video' }>, 'video'> & {
    autoPlayMuted?: true;
  } & ({ video: PhotoInput; videoUrl?: never } | { video?: never; videoUrl: string }))
  | (Omit<Extract<SlideInput, { type: 'poll' }>, 'options'> & {
    options: ({ id: string } & (
      { label: Record<string, string>; text?: never } | { label?: never; text: Record<string, string> }
    ))[];
    answers?: string[];
  });
// Authoring aliases are normalized by the backend; sessions contain canonical fields only.
export interface PresentationManifest {
  id: string;
  title?: Record<string, string> | null;
  theme?: z.input<typeof presentationThemeSchema> | null;
  slides: AuthoredSlideConfig[];
}

const counts = z.record(z.string(), z.number().int().nonnegative());
export const sessionStateSchema = z.object({
  type: z.literal('state'),
  room_id: z.string(),
  role: z.enum(['presenter', 'viewer']),
  revision: z.number().int().nonnegative(),
  current_slide_index: z.number().int().nonnegative(),
  max_unlocked_slide_index: z.number().int().nonnegative(),
  gallery_photo_indices: z.record(identifier, z.number().int().nonnegative()).default({}),
  slide_count: z.number().int().min(1).max(100),
  title: localized.nullable().optional(),
  theme: presentationThemeSchema.nullable().optional(),
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
  for (const [slideId, photoIndex] of Object.entries(state.gallery_photo_indices)) {
    const slide = Object.values(state.slides).find(item => item.id === slideId);
    if (slide?.type !== 'gallery' || photoIndex >= slide.photos.length) {
      ctx.addIssue({ code: 'custom', message: 'Invalid presentation gallery photo state' });
    }
  }
});
export type PresentationState = z.infer<typeof sessionStateSchema>;
export type SlideResult = PresentationState['results'][string];
export type PresentationCommand =
  | { type: 'advance'; index: number }
  | { type: 'gallery_photo'; slide_id: string; photo_index: number }
  | { type: 'vote'; slide_id: string; option_id: string }
  | { type: 'words'; slide_id: string; words: string[] };

export function localize(value: Record<string, string> | null | undefined, language: string): string {
  return value?.[language] ?? value?.[language.split('-')[0]] ?? value?.en ?? Object.values(value ?? {})[0] ?? '';
}
