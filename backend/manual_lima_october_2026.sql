-- Manual import of future October 2026 Lima Events from https://lima.events/en/paphos.
-- Replace the owner ID below with the configured administrator's Telegram ID.
-- Coordinates are map-pin estimates from the listed venue/area; verify before running.
-- Re-running this query is safe: it checks the stable Lima event URL and title/start time.
-- LUSTRA (event 2360) is omitted because the listing has no event image.
BEGIN;

WITH settings AS (
    SELECT 123456789::bigint AS owner_id
),
source_rows (
    lima_id, title, summary, venue, image_url, ticket_url,
    starts_at, latitude, longitude
) AS (
    VALUES
    (1911, 'Тренинг А.Гиршона "Танец отношений"',
     'Практический тренинг по танцевально-двигательной терапии и исследованию отношений.',
     'Paphos, Paphos, Cyprus',
     'https://lima.events/uploads/events/17320c99-63fe-490d-b0b3-5df5882d966b.webp',
     NULL, '2026-10-09 19:00:00+03:00', 34.7754, 32.4218),
    (2490, 'HUGE SALE',
     'Распродажа с приглашением заглянуть и помочь освободить место.',
     '6 Melinas Merkouri Avenue',
     'https://lima.events/uploads/events/19e568a8-6de7-44fd-9afa-82d671fab28e.webp',
     NULL, '2026-10-10 10:00:00+03:00', 34.7539, 32.4214),
    (2464, 'Stress Reset Workshop - 10.10.2026 (Saturday) - ENG',
     'Практический воркшоп о стрессе, восстановлении и навыках работы с нервной системой.',
     'Agiou Neofytou Ave. 14, 8270 Tremithousa',
     'https://lima.events/uploads/events/95ed09fc-0aa2-48e2-b5ec-b34e808cc25c.webp',
     NULL, '2026-10-10 10:00:00+03:00', 34.8510, 32.4620),
    (2385, 'Locals Only at cafe Haratsi',
     'Вечерняя встреча с электронной музыкой и диджейским составом; вход бесплатный до 19:00, затем €10.',
     'Tba - Cafe Haratsi',
     'https://lima.events/uploads/events/c2eb18f9-a902-4605-b366-69e7209342c1.webp',
     NULL, '2026-10-10 17:00:00+03:00', 34.7754, 32.4218),
    (2233, '5th Arminou Grape & Local Products Festival',
     'Сельский фестиваль, посвящённый винограду, местным продуктам, традициям и жизни кипрской деревни.',
     'Arminou',
     'https://lima.events/uploads/events/c7b5c876-7011-45a4-98ec-005bc598289a.webp',
     NULL, '2026-10-11 11:00:00+03:00', 34.8210, 32.7440),
    (2461, 'Emma Adler Performing Live',
     'Вечер живой музыки с вокалисткой Emma Adler в The Meeting Pub.',
     '13 Konstandias Street',
     'https://lima.events/uploads/events/d7073b27-5b52-461a-8a56-3c2a18939642.webp',
     NULL, '2026-10-11 17:00:00+03:00', 34.7730, 32.4220),
    (2460, 'Karaoke with Jim the Music Man',
     'Караоке-вечер с Jim the Music Man; на площадке также работает кухня.',
     'Coral Bay Strip, Peyia',
     'https://lima.events/uploads/events/167d5cae-01f8-40c5-9b8b-49dcde7603ad.webp',
     NULL, '2026-10-11 18:00:00+03:00', 34.8560, 32.3670),
    (2462, 'An Audience with Barry Appleton',
     'Бесплатная встреча и беседа с писателем Barry Appleton; бронирование не требуется.',
     'The Emba Theatre, 74 Nicolaou Ellina Leoforos, Emba 8250, Cyprus., 8250',
     'https://lima.events/uploads/events/21cc498a-0f9e-4cf0-8b2a-e84fb5317814.webp',
     NULL, '2026-10-15 19:00:00+03:00', 34.8080, 32.4190),
    (2120, 'Seaside Street Food Festival: Autumn Edition in Paphos',
     'Бесплатный фестиваль уличной еды на Medieval Castle Square, завершающий сезон.',
     'Medieval Castle Square',
     'https://lima.events/uploads/events/828b8954-14f6-436b-9d40-3990c772e232.webp',
     NULL, '2026-10-16 00:00:00+03:00', 34.7550, 32.4060),
    (2491, 'BERLIN BEATS AT BERLIN MEET',
     'Серия техно-вечеринок с диджеями и направлениями techno, tech house, hard techno и schranz.',
     'Berlin Meets',
     'https://lima.events/uploads/events/aa5b968e-2231-4bd0-aad3-7919920e2779.webp',
     NULL, '2026-10-16 17:00:00+03:00', 34.8560, 32.3670),
    (2415, 'Poolparty, YOGA & Brunch',
     'День йоги, вечеринки у бассейна и бранча с диджейским сопровождением.',
     'Kamares Club',
     'https://lima.events/uploads/events/5bd385e7-ca38-419a-a6c8-703f6c24125b.webp',
     'https://ra.co/events/2551685?utm_source=lima',
     '2026-10-17 10:00:00+03:00', 34.8420, 32.4310),
    (2492, 'LEGO® δραστηριότητες για μικρούς builders @ Public Kings Avenue Mall, Πάφος',
     'Детская активность с LEGO для юных конструкторов в Kings Avenue Mall.',
     'Kings Avenue Mall Paphos',
     'https://lima.events/uploads/events/0b7594ea-28cb-4f08-b525-ba6a9784b36d.webp',
     NULL, '2026-10-17 16:00:00+03:00', 34.7680, 32.4080),
    (2459, 'Charity Fun Run & Walk',
     'Благотворительный забег и прогулка в поддержку людей в местном сообществе, живущих с онкологическими заболеваниями.',
     'Paphos Castle',
     'https://lima.events/uploads/events/342aeecd-be65-4c08-8c22-9b26e002532c.webp',
     NULL, '2026-10-17 16:00:00+03:00', 34.7550, 32.4060),
    (2493, 'Έκθεση: Ύλη & Κοινότητα | Exhibition: Matter & Community',
     'Выставка «Материя и сообщество» в деревне Фити.',
     'Fyti',
     'https://lima.events/uploads/events/07eccfee-09ef-4435-b3dc-555c564dde6a.webp',
     NULL, '2026-10-17 17:00:00+03:00', 34.9510, 32.4840),
    (2266, 'A Night Of Soul & Motown With Una',
     'Живое выступление Una Pettiford с музыкой soul, Motown и disco; доступен ужин из трёх блюд.',
     'Colosseum Restaurant Paphos Live Shows & Weddings',
     'https://lima.events/uploads/events/d41d3c18-5a4b-44a4-8c23-fdb133c8ba35.webp',
     NULL, '2026-10-17 19:00:00+03:00', 34.7750, 32.4210),
    (2488, 'Αόρατη πόλη / Invisible City',
     'Культурное событие «Invisible City» в пространстве Old Powerhouse в Пафосе.',
     'Old Powerhouse, Pafos - Παλιά Ηλεκτρική, Πάφος',
     'https://lima.events/uploads/events/2c932ac3-d8a5-4d12-9423-63c7acf95b52.webp',
     NULL, '2026-10-17 19:30:00+03:00', 34.7760, 32.4240),
    (2343, 'Lotus Parable label night',
     'Вечер лейбла Lotus Parable с глубокой и гипнотической техно-музыкой.',
     'Tba',
     'https://lima.events/uploads/events/a91faf60-7493-4c45-be2d-260bcc30b99e.webp',
     'https://ra.co/events/2535790?utm_source=lima',
     '2026-10-17 20:30:00+03:00', 34.7754, 32.4218),
    (2248, 'NERVENRLINIK Vol.5: Industrial Secret',
     'Вечеринка тяжёлой индустриальной электронной музыки; состав артистов ещё объявляется.',
     'Tba',
     'https://lima.events/uploads/events/2f553123-be6e-407f-ab95-af97d63706b7.webp',
     NULL, '2026-10-17 21:00:00+03:00', 34.7754, 32.4218),
    (1894, 'Mochakk CALLING',
     'Ночная электронная вечеринка GO LOCO с диджеем Mochakk и масштабной звуковой и визуальной постановкой.',
     'Tba - Limassol',
     'https://lima.events/uploads/events/669c9bc5-6a0d-4863-bf10-aa222afa83bc.webp',
     'https://ra.co/events/2480774?utm_source=lima',
     '2026-10-17 22:00:00+03:00', 34.6750, 33.0440),
    (2458, 'DUSSHERA INDIAN FOOD FESTIVAL',
     'Праздничный индийский ужин с традиционными блюдами, приготовленными специально к Дуссехре.',
     '22, Iassonos Str., 8041 Paphos',
     'https://lima.events/uploads/events/22a6dc51-3c33-4b50-b545-68317eb5eff2.webp',
     NULL, '2026-10-18 18:00:00+03:00', 34.7570, 32.4150),
    (2471, 'YALLA HABIBI',
     'Первая клубная вечеринка серии с арабской и англоязычной музыкой от DJ Nour N.',
     'Tba - Club Teez',
     'https://lima.events/uploads/events/12373942-393d-412c-996f-fd2b64c39429.webp',
     NULL, '2026-10-22 23:00:00+03:00', 34.7754, 32.4218),
    (2376, 'MLC @ Monara Live Music Sports Bar',
     'Три часа живых рок-хитов 1970-х, 1980-х и 1990-х; для посещения требуется бронирование.',
     'Monara Live Music & Sports Bar Paphos',
     'https://lima.events/uploads/events/eff695d6-7e2f-4f93-9a91-cfa834a2e761.webp',
     NULL, '2026-10-23 20:30:00+03:00', 34.7690, 32.4190),
    (2457, 'Reconnect to YOURSELF - Two Days Away From the Noise',
     'Двухдневная оздоровительная программа в Друше, посвящённая отдыху и восстановлению связи с собой.',
     'Palates Hotel, Akamantos, Drouseia',
     'https://lima.events/uploads/events/c53f5abb-4097-4d21-bf70-c00e24380899.webp',
     NULL, '2026-10-24 09:00:00+03:00', 34.9630, 32.3350),
    (2221, '✨🤍 THE ULTIMATE WHITE PARTY BOTTOMLESS BRUNCH IS COMING! 🤍✨',
     'Бранч в белой тематике с R&B, диджеем, живым вокалом, едой и напитками; указаны ранние билеты от €30.',
     '13 Konstandias Street',
     'https://lima.events/uploads/events/16b27589-3075-4656-a350-1e6283b69ed2.webp',
     NULL, '2026-10-24 12:30:00+03:00', 34.7730, 32.4220),
    (2463, '🌊 Ocean of OM-s | Mantra Circle by the Sea',
     'Вечер совместного пения мантры OM на природе у моря.',
     'Mandria Paphos Cyprus',
     'https://lima.events/uploads/events/634313b0-66ab-4c86-8f6f-eaf064e1fe18.webp',
     NULL, '2026-10-24 18:00:00+03:00', 34.7080, 32.4830),
    (2181, 'Karaoke with Jim the music man!',
     'Караоке-вечер с Jim the Music Man; для бронирования столика указан телефон площадки.',
     'Chalkies Bar',
     'https://lima.events/uploads/events/6f5901a3-396e-419f-9a08-bff48e0980ca.webp',
     NULL, '2026-10-24 20:00:00+03:00', 34.8560, 32.3670),
    (2465, 'Joanna Sophia Fun Run/Walk Around the World In 5k CYPRUS',
     'Благотворительный забег и прогулка на 5 км в Пафосе.',
     'Paphos Castle',
     'https://lima.events/uploads/events/72718c50-e611-46c2-ab8f-a070bec69b81.webp',
     NULL, '2026-10-25 16:00:00+02:00', 34.7550, 32.4060),
    (2409, 'Traffic Reactor',
     'Ночная open-air электронная вечеринка в удалённой горной локации рядом с деревней Пенталия.',
     'Traffic Experience',
     'https://lima.events/uploads/events/cac3d11b-9cab-4f5b-ad26-789aef11bdcc.webp',
     NULL, '2026-10-31 20:00:00+02:00', 34.8600, 32.5600),
    (2500, 'LUNA MORADA: THE HAUNTED MALL - CITY PLAZA NICOSIA (HALLOWEEN EDITION)',
     'Хэллоуинская вечеринка в City Plaza с диджейскими выступлениями; на странице указаны билеты Go-Out.',
     'Tba',
     'https://lima.events/uploads/events/e48c0dfd-b1df-4b60-96dc-3624689786b9.webp',
     NULL, '2026-10-31 21:00:00+02:00', 35.1850, 33.3820),
    (2489, 'Halloween 🎃 Party Too Hot For Red',
     'Бесплатная хэллоуинская вечеринка в Monara с живой музыкой группы Too Hot For Red.',
     'Monara Live Music & Sports Bar Paphos',
     'https://lima.events/uploads/events/a28ccd94-ccde-462a-bf65-6016b9434443.webp',
     NULL, '2026-10-31 21:00:00+02:00', 34.7690, 32.4190),
    (2472, 'Matrix Halloween Face 2 Face',
     'Хэллоуинская клубная ночь в Matrix с семью диджеями и сетами face-to-face.',
     'Tba - Nicosia',
     'https://lima.events/uploads/events/ede1c932-9f2d-448a-927d-8b0b0979ef49.webp',
     NULL, '2026-10-31 22:00:00+02:00', 35.1850, 33.3820)
),
prepared AS (
    SELECT
        r.*,
        'https://lima.events/en/events/' || r.lima_id AS source_url,
        ('Location: ' || r.venue || E'\n\n' ||
         CASE WHEN r.ticket_url IS NULL THEN '' ELSE 'Tickets: ' || r.ticket_url || E'\n\n' END ||
         'Source: https://lima.events/en/events/' || r.lima_id) AS footer,
        (((r.starts_at::timestamptz AT TIME ZONE 'Europe/Nicosia')::date + time '23:59'))
            AT TIME ZONE 'Europe/Nicosia' AS local_end
    FROM source_rows r
)
INSERT INTO social_events (
    owner_id, description, event_type, image_urls, drink, visibility,
    latitude, longitude, location, photo_key, starts_at, expires_at,
    capacity, hidden, created_at
)
SELECT
    settings.owner_id,
    left(prepared.summary || E'\n\n' || prepared.footer, 5000),
    'global',
    jsonb_build_array(prepared.image_url),
    'spirits',
    'public',
    prepared.latitude,
    prepared.longitude,
    prepared.title,
    NULL,
    prepared.starts_at::timestamptz,
    prepared.local_end,
    NULL,
    FALSE,
    now()
FROM prepared
CROSS JOIN settings
WHERE NOT EXISTS (
    SELECT 1
    FROM social_events existing
    WHERE existing.event_type = 'global'
      AND (
          existing.description LIKE '%' || prepared.source_url || '%'
          OR (
              existing.location = prepared.title
              AND existing.starts_at = prepared.starts_at::timestamptz
          )
      )
)
RETURNING id, location, starts_at;

COMMIT;
