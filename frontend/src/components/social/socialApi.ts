import { telegramAuthHeaders } from '@/telegramAuth.ts';
import type { SocialEvent, SocialProfile } from './SocialEventCard.tsx';
import type { GlobalEventDraft, RegularEventDraft, SocialEventUpdateDraft } from './SocialEventForms.tsx';
import type { ChatMessage, FriendRequest, JoinRequest, Report, TagRequest } from './SocialPanels.tsx';
import { compressSocialImage } from './compressImage.ts';

const API_URL = `${import.meta.env.VITE_API_BASE_URL ?? 'https://paphos-whisky-api.onrender.com'}/api/social`;
type DeliveryStatus = 'sent' | 'not_delivered' | 'not_configured';

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === 'object' && 'detail' in payload) {
      const detail = payload.detail;
      return typeof detail === 'string' ? detail : JSON.stringify(detail);
    }
  } catch {
    // Non-JSON errors are represented by the HTTP status.
  }
  return `HTTP ${response.status}`;
}

export class SocialApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'SocialApiError';
  }
}

export class SocialApi {
  constructor(private readonly initDataRaw: string) {}

  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: { ...telegramAuthHeaders(this.initDataRaw), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new SocialApiError(await errorMessage(response), response.status);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  events() { return this.request<SocialEvent[]>('/events'); }
  event(id: number) { return this.request<SocialEvent>(`/events/${id}`); }
  createEvent(draft: RegularEventDraft, photoKey: string) {
    return this.request<SocialEvent & { notifications: Record<string, DeliveryStatus> }>('/events', 'POST', {
      description: draft.description,
      drink: draft.drink,
      visibility: draft.visibility,
      latitude: draft.latitude,
      longitude: draft.longitude,
      location: draft.title,
      photo_key: photoKey,
      capacity: draft.capacity,
      start: draft.start_mode === 'now' ? 'now' : '20m',
      ttl: draft.duration === 'evening' ? 'today' : draft.duration,
      tagged_friend_ids: draft.tagged_friend_ids,
    });
  }
  createGlobalEvent(draft: GlobalEventDraft) {
    return this.request<SocialEvent>('/events/global', 'POST', {
      location: draft.title,
      description: draft.description,
      latitude: draft.latitude,
      longitude: draft.longitude,
      drink: draft.drink,
      visibility: draft.visibility,
      image_urls: draft.image_urls,
      starts_at: draft.starts_at,
      expires_at: draft.expires_at,
    });
  }
  updateEvent(id: number, draft: SocialEventUpdateDraft, photoKey?: string) {
    return this.request<SocialEvent>(`/admin/events/${id}`, 'PUT', {
      location: draft.title,
      description: draft.description,
      latitude: draft.latitude,
      longitude: draft.longitude,
      drink: draft.drink,
      visibility: draft.visibility,
      starts_at: draft.starts_at,
      expires_at: draft.expires_at,
      ...(draft.event_type === 'global' ? { image_urls: draft.image_urls } : {
        capacity: draft.capacity,
        ...(photoKey ? { photo_key: photoKey } : {}),
      }),
    });
  }
  deleteEvent(id: number) { return this.request<void>(`/admin/events/${id}`, 'DELETE'); }
  cheer(id: number) { return this.request<SocialEvent>(`/events/${id}/cheer`, 'POST'); }
  join(id: number) { return this.request<{ id: number; status: string; notification_status: DeliveryStatus }>(`/events/${id}/join`, 'POST'); }
  report(id: number, reason: 'spam' | 'inappropriate' | 'false_location') {
    return this.request<void>(`/events/${id}/report`, 'POST', { category: reason });
  }
  blockEvent(id: number) { return this.request<void>(`/events/${id}/block`, 'POST'); }
  profile() { return this.request<SocialProfile>('/profile'); }
  updateProfile(displayName: string, age: number | null, photoKey: string | null) {
    return this.request<SocialProfile>('/profile', 'PUT', { display_name: displayName, age, ...(photoKey ? { avatar_key: photoKey } : {}) });
  }
  friends() { return this.request<SocialProfile[]>('/friends'); }
  friendRequests() { return this.request<FriendRequest[]>('/friend-requests'); }
  tagRequests() { return this.request<TagRequest[]>('/tag-requests'); }
  acceptTag(id: number) { return this.request<void>(`/events/${id}/tags/accept`, 'POST'); }
  declineTag(id: number) { return this.request<void>(`/events/${id}/tags/decline`, 'POST'); }
  invite(telegramId: number) { return this.request<{ id: number; status: string; notification_status: DeliveryStatus }>('/friend-requests', 'POST', { telegram_id: telegramId }); }
  acceptFriend(id: number) { return this.request<void>(`/friend-requests/${id}/accept`, 'POST'); }
  chat(id: number, afterId: number) { return this.request<ChatMessage[]>(`/events/${id}/chat?after_id=${afterId}`); }
  async chatSince(id: number, afterId = 0): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];
    let cursor = afterId;
    while (true) {
      const batch = await this.chat(id, cursor);
      messages.push(...batch);
      if (batch.length < 100) return messages;
      cursor = batch[batch.length - 1].id;
    }
  }
  sendChat(id: number, text: string) { return this.request<ChatMessage>(`/events/${id}/chat`, 'POST', { body: text }); }
  joinRequests(id: number) { return this.request<JoinRequest[]>(`/events/${id}/join-requests`); }
  acceptJoin(id: number, requestId: number) {
    return this.request<{ status: string; notification_status: DeliveryStatus }>(`/events/${id}/join-requests/${requestId}/accept`, 'POST');
  }
  reports() { return this.request<Report[]>('/admin/reports'); }
  verify(telegramId: number) { return this.request<void>(`/admin/profiles/${telegramId}/verify`, 'POST', { verified: true }); }
  hideEvent(id: number) { return this.request<void>(`/admin/events/${id}/hide`, 'POST'); }
  resolveReport(id: number) { return this.request<void>(`/admin/reports/${id}/resolve`, 'POST'); }

  async upload(file: File, kind: 'event' | 'avatar'): Promise<string> {
    const image = await compressSocialImage(file);
    const response = await fetch(`${API_URL}/media?kind=${kind}`, {
      method: 'POST',
      headers: { ...telegramAuthHeaders(this.initDataRaw), 'Content-Type': 'image/jpeg' },
      body: image,
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    const result = await response.json() as { key: string };
    return result.key;
  }
}
