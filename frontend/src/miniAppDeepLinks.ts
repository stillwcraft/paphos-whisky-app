import { presentationRouteSchema, type PresentationRoute } from '@/types/presentation';

export const MINI_APP_URL = 'https://t.me/CyprusWhiskyClubBot/NoMoreDram';

export type MiniAppDestination =
  | { kind: 'entity'; entity: 'event' | 'bottle' | 'distillery' | 'social_event'; id: number }
  | { kind: 'tab'; tab: PresentationRoute | 'presentations' | 'admin'; distilleryId?: number; openReports?: boolean }
  | { kind: 'presentation'; roomId: string };

export function parseMiniAppStartParam(value: string): MiniAppDestination | null {
  const presentation = /^presentation_([a-f0-9]{32})$/.exec(value);
  if (presentation) return { kind: 'presentation', roomId: presentation[1] };
  const entity = /^(event|bottle|distillery|social_event)_(\d+)$/.exec(value);
  if (entity) {
    const id = Number(entity[2]);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const kind = entity[1];
    if (kind === 'event' || kind === 'bottle' || kind === 'distillery' || kind === 'social_event') {
      return { kind: 'entity', entity: kind, id };
    }
  }
  if (value === 'presentations') return { kind: 'tab', tab: 'presentations' };
  const tab = presentationRouteSchema.safeParse(value);
  return tab.success ? { kind: 'tab', tab: tab.data } : null;
}

export function parseMiniAppLink(value: string): {
  internal: true; destination: MiniAppDestination | null;
} | {
  internal: false; destination: null;
} {
  const url = new URL(value);
  const app = new URL(MINI_APP_URL);
  const path = url.pathname.replace(/\/+$/, '').toLowerCase();
  const isAppPath = path === app.pathname.toLowerCase()
    || (path === `/${app.pathname.split('/')[1].toLowerCase()}` && url.searchParams.has('startapp'));
  if (url.origin !== app.origin || url.username || url.password || !isAppPath) {
    return { internal: false, destination: null };
  }
  if (url.searchParams.getAll('startapp').length > 1) return { internal: true, destination: null };
  const parameter = url.searchParams.get('startapp');
  return {
    internal: true,
    destination: parameter ? parseMiniAppStartParam(parameter) : { kind: 'tab', tab: 'events' },
  };
}
