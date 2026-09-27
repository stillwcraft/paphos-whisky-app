export const eventsCacheKey = (languageCode: string) => `paphos-whisky:events:${languageCode}`;

export function clearEventsCache() {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith('paphos-whisky:events:')) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('Could not clear the events session cache.', error);
  }
}
