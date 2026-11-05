import { z } from 'zod';
import { telegramAuthHeaders } from '@/telegramAuth';

const configuredApiUrl: unknown = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL;
export const PRESENTATION_API_URL = (typeof configuredApiUrl === 'string' && configuredApiUrl
  ? configuredApiUrl : 'https://paphos-whisky-api.onrender.com').replace(/\/$/, '');

const roomSummarySchema = z.object({
  room_id: z.string().regex(/^[a-f0-9]{32}$/),
  manifest_id: z.string(),
  title: z.record(z.string(), z.string()).nullable(),
  slide_count: z.number().int().positive(),
  current_slide_index: z.number().int().nonnegative(),
});
const roomPageSchema = z.object({
  items: z.array(roomSummarySchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  has_more: z.boolean(),
});
const createdRoomSchema = z.object({ room_id: z.string().regex(/^[a-f0-9]{32}$/) });
const broadcastSchema = z.object({ room_id: createdRoomSchema.shape.room_id.nullable() });
const errorSchema = z.object({
  detail: z.union([
    z.string(),
    z.array(z.object({ loc: z.array(z.union([z.string(), z.number()])), msg: z.string() })),
  ]),
});
export type PresentationRoomSummary = z.infer<typeof roomSummarySchema>;

export class PresentationApi {
  constructor(private readonly initDataRaw: string) {}

  private async request(path: string, signal: AbortSignal, body?: unknown,
    method = body === undefined ? 'GET' : 'POST'): Promise<unknown> {
    const response = await fetch(`${PRESENTATION_API_URL}/api/presentations${path}`, {
      method,
      headers: {
        ...telegramAuthHeaders(this.initDataRaw),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
      signal,
    });
    if (response.status === 204) return null;
    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch (cause) {
      if (!(cause instanceof SyntaxError)) throw cause;
      throw new Error(`HTTP ${response.status}: invalid JSON response`);
    }
    if (!response.ok) {
      const error = errorSchema.safeParse(payload);
      if (!error.success) throw new Error(`HTTP ${response.status}`);
      const detail = error.data.detail;
      throw new Error(typeof detail === 'string' ? detail
        : detail.map(item => `${item.loc.join('.')}: ${item.msg}`).join('\n'));
    }
    return payload;
  }

  async rooms(signal: AbortSignal, offset = 0) {
    return roomPageSchema.parse(await this.request(`/rooms?limit=20&offset=${offset}`, signal));
  }

  async upload(manifest: unknown, signal: AbortSignal) {
    return createdRoomSchema.parse(await this.request('/rooms', signal, manifest));
  }

  async broadcast(signal: AbortSignal) {
    return broadcastSchema.parse(await this.request('/broadcast', signal));
  }

  async startBroadcast(roomId: string, signal: AbortSignal) {
    return createdRoomSchema.parse(await this.request(`/rooms/${encodeURIComponent(roomId)}/broadcast`, signal, undefined, 'POST'));
  }

  async stopBroadcast(roomId: string, signal: AbortSignal) {
    await this.request(`/rooms/${encodeURIComponent(roomId)}/broadcast`, signal, undefined, 'DELETE');
  }
}
