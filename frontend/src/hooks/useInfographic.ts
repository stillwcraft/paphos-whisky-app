import { useQuery } from '@tanstack/react-query';
import { infographicResponseSchema } from '@/types/infographicSchemas.ts';

const API_BASE_URL = 'https://paphos-whisky-api.onrender.com';

export function useInfographic(id: string) {
  return useQuery({
    queryKey: ['infographic', id],
    enabled: id.length > 0,
    staleTime: 1000 * 60 * 15,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/infographics/${encodeURIComponent(id)}`, { signal });
      if (!response.ok) {
        throw new Error(`Не удалось загрузить инфографику (${response.status})`);
      }
      const payload: unknown = await response.json();
      return infographicResponseSchema.parse(payload);
    },
  });
}

export function useDistilleryInfographic(distilleryId: number) {
  return useQuery({
    queryKey: ['distillery-infographic', distilleryId],
    enabled: distilleryId > 0,
    staleTime: 1000 * 60 * 15,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/distilleries/${distilleryId}/infographic`, { signal });
      if (!response.ok) {
        throw new Error(`Could not load distillery infographic (${response.status})`);
      }
      const payload: unknown = await response.json();
      const infographic = infographicResponseSchema.nullable().parse(payload);
      if (infographic && infographic.distillery_id !== distilleryId) {
        throw new Error('Infographic does not belong to the requested distillery');
      }
      return infographic;
    },
  });
}
