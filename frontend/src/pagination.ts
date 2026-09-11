import { useCallback, useEffect, useState, type RefObject } from 'react';

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export function normalizePaginatedResponse<T>(payload: PaginatedResponse<T> | T[]): PaginatedResponse<T> {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: payload.length,
      limit: payload.length,
      offset: 0,
      has_more: false,
    };
  }
  return payload;
}

export function paginatedUrl(url: string, limit: number, offset: number): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}limit=${limit}&offset=${offset}`;
}

export function useInfiniteScroll(
  onLoadMore: () => void,
  enabled: boolean,
  root?: RefObject<Element>,
) {
  const [sentinel, setSentinel] = useState<Element | null>(null);
  const sentinelRef = useCallback((node: Element | null) => setSentinel(node), []);

  useEffect(() => {
    if (!sentinel || !enabled) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { root: root?.current ?? null, rootMargin: '240px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, root, sentinel]);

  return sentinelRef;
}
