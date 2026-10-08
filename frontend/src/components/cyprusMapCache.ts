import type { SocialProfile } from './social/SocialEventCard.tsx';

export type MapEvent = {
  id: number;
  title: string;
  date: string;
  location: string | null;
  latitude: number;
  longitude: number;
};

export type SocialMapMarker = {
  id: number;
  event_type: 'regular' | 'global';
  drink: 'beer' | 'wine' | 'spirits' | 'cocktails' | 'coffee';
  image_url: string | null;
  latitude: number;
  longitude: number;
  starts_at: string;
  expires_at: string;
};

const events = new Map<string, { items: MapEvent[]; responseEmpty: boolean }>();
const profiles = new Map<number, SocialProfile>();
const socialMarkers = new Map<number, SocialMapMarker[]>();

export const cyprusMapCache = {
  getEvents: (language: string) => events.get(language),
  setEvents: (language: string, items: MapEvent[], responseEmpty: boolean) => {
    events.set(language, { items, responseEmpty });
  },
  getProfile: (userId: number | null) => userId === null ? undefined : profiles.get(userId),
  setProfile: (userId: number | null, profile: SocialProfile) => {
    if (userId !== null) profiles.set(userId, profile);
  },
  getMarkers: (userId: number | null) => userId === null ? undefined : socialMarkers.get(userId),
  setMarkers: (userId: number | null, markers: SocialMapMarker[]) => {
    if (userId !== null) socialMarkers.set(userId, markers);
  },
  clearMarkers: (userId: number | null) => {
    if (userId !== null) socialMarkers.delete(userId);
  },
  clearUser: (userId: number | null) => {
    if (userId !== null) {
      profiles.delete(userId);
      socialMarkers.delete(userId);
    }
  },
};
