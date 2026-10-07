BEGIN;

UPDATE public.articles AS article
SET slides_data = (
    SELECT COALESCE(jsonb_agg(
        jsonb_set(slide.value, '{elements}', COALESCE((
            SELECT jsonb_agg(
                CASE
                    WHEN jsonb_typeof(element.value->'animation') = 'array'
                         AND NOT element.value ? 'animations'
                    THEN (element.value - 'animation')
                         || jsonb_build_object('animations', element.value->'animation')
                    ELSE element.value
                END
                ORDER BY element.ordinality
            )
            FROM jsonb_array_elements(slide.value->'elements')
                WITH ORDINALITY AS element(value, ordinality)
        ), '[]'::jsonb))
        ORDER BY slide.ordinality
    ), '[]'::jsonb)
    FROM jsonb_array_elements(article.slides_data::jsonb)
        WITH ORDINALITY AS slide(value, ordinality)
)
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(article.slides_data::jsonb) AS slide(value)
    CROSS JOIN LATERAL jsonb_array_elements(slide.value->'elements') AS element(value)
    WHERE jsonb_typeof(element.value->'animation') = 'array'
      AND NOT element.value ? 'animations'
);

COMMIT;
