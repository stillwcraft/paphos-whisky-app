-- Manual-only UkrCy News import, snapshot 2026-10-19.
-- Application code and database schema are NOT changed by this file.
-- Read all four populated listing pages (12 + 12 + 12 + 3 = 39 cards).
-- Page 5 is empty; its SEO rel=next misleadingly continues to further empty pages.
-- Opened all 39 cards; 10 start in November 2026, strictly after 2026-10-19.
-- 7 INSERT candidates: November 7, 14, 15, 21, 22 (two events), 29.
-- 3 excluded rows remain below as an auditable dataset, never INSERTed:
-- 43002: November 1 wine festival, missing venue/address/coordinates.
-- 42606: November 8 Elsa, unresolved theatre coordinates and Pano/Kato conflict.
-- 42609: November 28 Olaf, unresolved theatre coordinates.
-- No location guesses or replacement city-centre pins are used.
-- All 10 API records explicitly specify Europe/Kyiv; November offset is +02.
-- Every card uses Date + Time range, not separate Start/End fields.
-- Both bounds are taken verbatim from that date and range, per the requested rule.
-- Do not create extra performances mentioned only inside prose.
-- English titles in original headings are preserved without translation.
-- Full source descriptions retain Ukrainian text, headings and list items.
-- Original price text is appended LAST. Missing prices are NULL, not "free".
-- Missing Google Maps links are explicitly reported, not invented.
-- Coordinates/precision/provenance and source inconsistencies are in notes.
-- All 7 distinct source image URLs returned HTTP 200 and an image Content-Type.
-- Database comparison was NOT possible: DATABASE_URL unset, backend/.env has
-- no DB setting; local backend/*.db files have no social_events table.
-- owner_id 8546526596 is copied from backend/manual_ukrcy_october_2026.sql
-- and corroborated by backend/manual_lima_paphos_october_2026_asof_20261016.sql.
-- Its current administrator status could not be checked without a DB connection.
-- Apply existing migrations 022 and 027 before manual execution.
-- Existing global format: title -> location, venue -> description,
-- global/public/spirits, external image_urls JSONB, NULL photo_key/capacity.
-- Duplicate protection: source URL OR image+local start DATE OR title+local
-- start DATE. A reused show poster on different dates is NOT a duplicate.
-- Two Bubble Show rows deliberately share title/image, on November 14 and 15.
-- Hidden existing events are included in duplicate checks; this file neither
-- unhides nor updates existing records.
-- Table lock serializes concurrent writes; repeat execution adds no duplicates.
-- Runtime date guards also skip events that have started by manual execution.
-- RETURNING lists only rows actually inserted by the manual operator.
-- Coordinate attribution: (c) OpenStreetMap contributors, ODbL 1.0,
-- https://www.openstreetmap.org/copyright
BEGIN;
SET LOCAL TIME ZONE 'Europe/Kyiv';
SET LOCAL standard_conforming_strings = on;
SET LOCAL lock_timeout = '10s';
LOCK TABLE social_events IN SHARE ROW EXCLUSIVE MODE;

WITH settings AS (
    SELECT 8546526596::bigint AS owner_id
),
source_rows (
    source_id, title, summary, venue, venue_address, image_url,
    starts_local, expires_local, event_timezone, latitude, longitude,
    maps_url, resource_links, price_line, source_url, notes, exclusion_reason
) AS (
    VALUES
    (
        43002,
        'Фестиваль вина: дегустації, музика та кіпрські традиції',
        'День, присвячений місцевим традиціям, музиці, танцям і кіпрській гостинності.

Організатори обіцяють атмосферу традиційного сільського свята, де вино об’єднує місцевих жителів і гостей.

Гасло цьогорічної події — «Вино з глиняного глека, як у давнину!» — відсилає до традиційного способу зберігання вина та давніх звичаїв.

На вході можна буде придбати пам’ятний келих за €2. За інформацією організаторів, він дає змогу дегустувати вино без додаткової оплати та обмежень за кількістю.

На гостей також чекають музика, танці та можливість провести неділю в одному з гірських сіл Кіпру.',
        NULL,
        NULL,
        'https://ukrcy.news/wp-content/uploads/2026/10/vine1.jpg',
        '2026-11-01 10:00:00'::timestamp,
        '2026-11-01 17:00:00'::timestamp,
        'Europe/Kyiv',
        NULL,
        NULL,
        NULL,
        NULL,
        'Келих для дегустації: €2',
        'https://ukrcy.news/event/festyval-vyna-degustacziyi-muzyka-ta-kiprski-tradycziyi/',
        NULL,
        'Не додавати: у картці немає поля «Місце проведення» або Google Maps; API також повертає venue: []. Назву села, адресу й координати встановити не вдалося.'
    ),
    (
        42602,
        'Дитяча вистава «Ельза та чарівна корона»',
        'Відважна королева вирушає на пошуки своєї загубленої чарівної корони. На шляху вона зустріне вірних друзів, загадкових істот і пройде через низку випробувань. Поступово героїня відкриє, що справжня сила може бути не в магії, а в доброти, дружбі, любові та вірі у власні сили.

На сцені — казкові декорації, костюми, музика й танці. Вистава триває 65 хвилин і розрахована на дітей від 2 до 8 років.

НІКОСІЯ

Амфітеатр PASYDY

7 листопада — 11:00 та 16:00

15 листопада — 11:00 та 16:00

22 листопада — 11:00 та 16:00

ЛІМАСОЛ

Муніципальний театр Като Полемідії

8 листопада — 11:00 та 16:00

14 листопада — 11:00',
        'Pasydy Theatre',
        'Deligiorgi 4 5973+JW, Nicosia, 1066, Cyprus',
        'https://ukrcy.news/wp-content/uploads/2026/09/elsa8.jpg',
        '2026-11-07 11:00:00'::timestamp,
        '2026-11-07 18:00:00'::timestamp,
        'Europe/Kyiv',
        35.1640625,
        33.3548125,
        'https://maps.google.com/maps?f=q&source=s_q&hl=en&geocode=&q=Deligiorgi+4+5973%2BJW+Nicosia+1066+Cyprus',
        NULL,
        '10–16€',
        'https://ukrcy.news/event/42602/',
        'Координати приблизні: центр комірки Plus Code 8G7M5973+JW, відновленого з 5973+JW Nicosia у посиланні Google Maps. Розмір комірки приблизно 14 × 11 м; це не підтверджений вхід. Незалежна позначка PASYDY Auditorium (35.16419, 33.35479) розташована приблизно за 14 м: https://www.cyprusevents.net/venues/pasydy-auditorium/ .',
        NULL
    ),
    (
        42606,
        'Дитяча вистава «Ельза та чарівна корона»',
        'Відважна королева вирушає на пошуки своєї загубленої чарівної корони. На шляху вона зустріне вірних друзів, загадкових істот і пройде через низку випробувань. Поступово героїня відкриє, що справжня сила може бути не в магії, а в доброти, дружбі, любові та вірі у власні сили.

На сцені — казкові декорації, костюми, музика й танці. Вистава триває 65 хвилин і розрахована на дітей від 2 до 8 років.

НІКОСІЯ

Амфітеатр PASYDY

7 листопада — 11:00 та 16:00

15 листопада — 11:00 та 16:00

22 листопада — 11:00 та 16:00

ЛІМАСОЛ

Муніципальний театр Като Полемідії

8 листопада — 11:00 та 16:00

14 листопада — 11:00

Квитки — €10–16 залежно від зони.',
        'Δημοτικό Θέατρο Πάνω Πολεμιδιών',
        'Δημοτικό Θέατρο Πάνω Πολεμιδιών',
        'https://ukrcy.news/wp-content/uploads/2026/09/elsa8.jpg',
        '2026-11-08 11:00:00'::timestamp,
        '2026-11-08 18:00:00'::timestamp,
        'Europe/Kyiv',
        NULL,
        NULL,
        'https://maps.google.com/maps?f=q&source=s_q&hl=en&geocode=&q=%CE%94%CE%B7%CE%BC%CE%BF%CF%84%CE%B9%CE%BA%CF%8C+%CE%98%CE%AD%CE%B1%CF%84%CF%81%CE%BF+%CE%A0%CE%AC%CE%BD%CF%89+%CE%A0%CE%BF%CE%BB%CE%B5%CE%BC%CE%B9%CE%B4%CE%B9%CF%8E%CE%BD',
        NULL,
        '10–16€',
        'https://ukrcy.news/event/dytyacha-vystava-elza-ta-charivna-korona/',
        NULL,
        'Не додавати: координати конкретного театру не встановлено. У «Місце проведення» вказано Πάνω Πολεμιδιών, а в описі — Като Полемідії. Google Maps містить лише пошуковий запит, без координат. Центр населеного пункту не використано замість театру.'
    ),
    (
        42615,
        'The Mr & Mrs Bubble Show',
        'Фантастичний світ планети «Бульбашка», де з води, мила, любові та трохи магії створюється цілий мінливий світ. Глядачів буквально поміщають всередину величезної мильної бульбашки, а маленькі й великі учасники стають частиною вистави.

На сцені — десятки маленьких, середніх і гігантських бульбашок, незвичайні саморобні інструменти та звичайні предмети, які перетворюються на частину цього бульбашкового світу.

Ларнака — муніципальний театр «Г. Ликургос»

15 листопада, 11:00

Для дітей від 2 років.

Квитки',
        'Θέατρο Μασκαρίνι',
        NULL,
        'https://ukrcy.news/wp-content/uploads/2026/09/800x538-bubble.jpg',
        '2026-11-14 16:00:00'::timestamp,
        '2026-11-14 17:00:00'::timestamp,
        'Europe/Kyiv',
        35.1188602,
        33.3780561,
        NULL,
        'Квитки: https://www.ticketmaster.cy/showEventInformation.html?idEvent=7654',
        '10-15€',
        'https://ukrcy.news/event/the-mr-mrs-bubble-show/',
        'У картці немає посилання Google Maps. Координати приблизні: центр контуру будівлі Θέατρο Μασκαρίνι на OpenStreetMap, Athalassis 4, Latsia, а не вхід: https://www.openstreetmap.org/way/1047395017 . Місце підтверджене сайтом театру: https://maskarini.info/ . У тексті картки також згадано інший показ у Ларнаці 15 листопада; для цього запису використані дата 14 листопада та Θέατρο Μασκαρίνι з полів «Деталі» і «Місце проведення».',
        NULL
    ),
    (
        42617,
        'The Mr & Mrs Bubble Show',
        'Фантастичний світ планети «Бульбашка», де з води, мила, любові та трохи магії створюється цілий мінливий світ. Глядачів буквально поміщають всередину величезної мильної бульбашки, а маленькі й великі учасники стають частиною вистави.

На сцені — десятки маленьких, середніх і гігантських бульбашок, незвичайні саморобні інструменти та звичайні предмети, які перетворюються на частину цього бульбашкового світу.

Для дітей від 2 років.

Квитки',
        'ΔΗΜΟΤΙΚΟ ΘΕΑΤΡΟ ΛΑΡΝΑΚΑΣ «Γ. ΛΥΚΟΥΡΓΟΣ»',
        'ΔΗΜΟΤΙΚΟ ΘΕΑΤΡΟ ΛΑΡΝΑΚΑΣ «Γ. ΛΥΚΟΥΡΓΟΣ»',
        'https://ukrcy.news/wp-content/uploads/2026/09/800x538-bubble.jpg',
        '2026-11-15 11:00:00'::timestamp,
        '2026-11-15 12:00:00'::timestamp,
        'Europe/Kyiv',
        34.9160688,
        33.6265403,
        'https://maps.google.com/maps?f=q&source=s_q&hl=en&geocode=&q=%CE%94%CE%97%CE%9C%CE%9F%CE%A4%CE%99%CE%9A%CE%9F+%CE%98%CE%95%CE%91%CE%A4%CE%A1%CE%9F+%CE%9B%CE%91%CE%A1%CE%9D%CE%91%CE%9A%CE%91%CE%A3+%C2%AB%CE%93.+%CE%9B%CE%A5%CE%9A%CE%9F%CE%A5%CE%A1%CE%93%CE%9F%CE%A3%C2%BB',
        'Квитки: https://www.ticketmaster.cy/showEventInformation.html?idEvent=7654',
        '10-15€',
        'https://ukrcy.news/event/the-mr-mrs-bubble-show-2/',
        'Координати приблизні: центр контуру Larnaca Theatre на OpenStreetMap, а не вхід: https://www.openstreetmap.org/way/493412499 . Муніципальний театр та адресу Leonida Kioupi підтверджує https://www.cyprusevents.net/venues/larnaca-municipal-theater/ .',
        NULL
    ),
    (
        42359,
        'Віденські вальси у Пафосі',
        'Після аншлагових концертів у Нікосії та Лімасолі у 2025 році «Йоганн Штраус Віртуози» повертаються на Кіпр.

У Пафосі звучатимуть твори Йоганна Штрауса та музика Золотого віку Відня, а кульмінацією вечора стане знаменитий «Прекрасний блакитний Дунай» — під музику вальсу виступлять і танцюристи.

Квитки',
        'Markideio Municipal Theatre',
        'Andrea Geroudi 18, Paphos, 8010, Cyprus',
        'https://ukrcy.news/wp-content/uploads/2026/09/vw70.jpg',
        '2026-11-21 20:30:00'::timestamp,
        '2026-11-21 22:00:00'::timestamp,
        'Europe/Kyiv',
        34.7781831,
        32.4231383,
        'https://maps.google.com/maps?f=q&source=s_q&hl=en&geocode=&q=Andrea+Geroudi+18+Paphos+8010+Cyprus',
        'Квитки: https://www.soldoutticketbox.com/ru/event/viennese-waltzes-nov-2026',
        NULL,
        'https://ukrcy.news/event/videnski-valsy-u-pafosi/',
        'Координати приблизні: центр контуру будівлі Markideion Theater на OpenStreetMap, Andrea Geroudi, а не вхід: https://www.openstreetmap.org/way/824979277 .',
        NULL
    ),
    (
        42734,
        'Концерт KREATOR',
        'Легенди німецького thrash metal KREATOR вперше зіграють на Кіпрі в межах світового туру Krushers of the World, названого на честь їхнього нового альбому.

Спеціальними гостями концерту стануть американські ветерани thrash metal OVERKILL. Відкриватиме вечір кіпрський гурт DAGGR з Лімасола. Для обох хедлайнерів це буде перший виступ на Кіпрі.

Квитки',
        'MONTE CAPUTO',
        'Monte Caputo, Limassol, Cyprus',
        'https://ukrcy.news/wp-content/uploads/2026/10/kreator1080.jpg',
        '2026-11-22 08:00:00'::timestamp,
        '2026-11-22 17:00:00'::timestamp,
        'Europe/Kyiv',
        34.7183692,
        33.1879147,
        'https://maps.google.com/maps?f=q&source=s_q&hl=en&geocode=&q=Monte+Caputo+Limassol+Cyprus',
        'Квитки: https://www.soldoutticketbox.com/event/kreator-live-2026?utm_medium=paid&utm_source=fb&utm_id=120249808660210716&utm_content=120249808660230716&utm_term=120249808660220716&utm_campaign=120249808660210716&fbclid=IwY2xjawUzMyNleHRuA2FlbQIxMABwZG9mBWJyaWQRMXBqNHNYZ2RhNDdsakV5cW9zcnRjBmFwcF9pZBAyMjIwMzkxNzg4MjAwODkyAAEetmRLpryuPW1tGf_42M35kqAxANuAhwXWjRbsZq8MJ18QXLZk9xXUGod8pVw_aem_sEJynSmWVltbn0QOrmqupw',
        NULL,
        'https://ukrcy.news/event/konczert-kreator/',
        'Координати приблизні: позначка закладу Monte'' Caputo, B1, Pyrgos Limassol, за OpenStreetMap/Nominatim; це не підтверджений вхід: https://www.openstreetmap.org/way/75306794 . Час 08:00–17:00 перенесений без виправлень із поля «Час проведення»; для вечірнього концерту він виглядає нетипово, тому його варто уточнити в організатора.',
        NULL
    ),
    (
        43047,
        'Висадка 3 000 дерев в громаді Суні',
        'Друга частина екологічної ініціативи з озеленення постраждалих громади Суні — Занакія від великої пожеді 2025 року.

Цього разу організатори планують подарувати та висадити 3 000 дерев. Загальна мета ініціативи — 5 000 дерев для цієї місцевості.

До висаджування запрошують усіх охочих, зокрема сім’ї з дітьми. Організатори прагнуть змалечку привчати дітей до відповідального ставлення до довкілля та показувати, що позитивні зміни починаються з особистої участі.

На учасників чекають:

перекуси та сік

сертифікат про участь для всіх волонтерів

медаль для дітей віком до 12 років включно

Необхідно зареєструватися через форму реєстрації

Місце збору',
        'Місце збору в громаді Суні — Занакія (за посиланням у картці)',
        NULL,
        'https://ukrcy.news/wp-content/uploads/2026/10/845653419_984078003979701_3683403902533634591_n.jpeg',
        '2026-11-22 11:00:00'::timestamp,
        '2026-11-22 17:00:00'::timestamp,
        'Europe/Kyiv',
        34.7342782,
        32.8891313,
        'https://www.google.com/maps/place/34%C2%B044''03.4%22N+32%C2%B053''20.9%22E/@34.7342468,32.886767,585m/data=!3m1!1e3!4m4!3m3!8m2!3d34.7342782!4d32.8891313!18m1!1e1?entry=ttu&g_ep=EgoyMDI2MTAxMi4wIKXMDSoASAFQAw%3D%3D',
        'форму реєстрації: https://docs.google.com/forms/u/0/d/1WBbm_Ay_g4wHVK32bIKR7kxKNnmsUeje133aQcLxKNc/viewform?ts=6acd432b&edit_requested=true',
        NULL,
        'https://ukrcy.news/event/vysadka-3-000-derev-v-gromadi-suni/',
        'Окремого поля «Місце проведення» немає. Використано опубліковане в описі «Місце збору»: координати цільової точки !3d34.7342782!4d32.8891313 із Google Maps, а не центр вікна карти @34.7342468,32.886767.',
        NULL
    ),
    (
        42609,
        '«Різдвяна подорож Олафа»: чи зможуть діти врятувати Різдво?',
        'Злий чаклун Гріндж закриває різдвяні ворота міста, і Олаф разом із друзями — ельфійкою Холлі та різдвяною ялинкою Глаймер — вирушає в подорож. На них чекають зачаровані ліси, магічні істоти, загадки, танці, пісні та чарівні заклинання. Але є одна проблема: Олафу не впоратися без маленьких глядачів. Саме їхня участь допоможе героям пройти випробування й повернути Різдво.

Лімасол

28 листопада та 5 грудня — 11:00

Нікосія — амфітеатр PASYDY

29 листопада та 6 грудня — 11:00 і 16:00

Вистава розрахована на всю родину й поєднує театр, музику, танці та активну участь дітей.',
        'ΔΗΜΟΤΙΚΟ ΘΕΑΤΡΟ ΠΑΝΩ ΠΟΛΕΜΙΔΙΩΝ ΛΕΜΕΣΟΥ',
        NULL,
        'https://ukrcy.news/wp-content/uploads/2026/09/olaf8.jpg',
        '2026-11-28 11:00:00'::timestamp,
        '2026-11-28 12:00:00'::timestamp,
        'Europe/Kyiv',
        NULL,
        NULL,
        NULL,
        NULL,
        'від 10€',
        'https://ukrcy.news/event/rizdvyana-podorozh-olafa-chy-zmozhut-dity-vryatuvaty-rizdvo/',
        NULL,
        'Не додавати: для ΔΗΜΟΤΙΚΟ ΘΕΑΤΡΟ ΠΑΝΩ ΠΟΛΕΜΙΔΙΩΝ ΛΕΜΕΣΟΥ не знайдено підтверджених координат; у картці немає адреси й Google Maps. Центр населеного пункту не використано замість театру.'
    ),
    (
        42613,
        '«Різдвяна подорож Олафа»: чи зможуть діти врятувати Різдво?',
        'Злий чаклун Гріндж закриває різдвяні ворота міста, і Олаф разом із друзями — ельфійкою Холлі та різдвяною ялинкою Глаймер — вирушає в подорож. На них чекають зачаровані ліси, магічні істоти, загадки, танці, пісні та чарівні заклинання. Але є одна проблема: Олафу не впоратися без маленьких глядачів. Саме їхня участь допоможе героям пройти випробування й повернути Різдво.

Нікосія — амфітеатр PASYDY

29 листопада та 6 грудня — 11:00 і 16:00

Вистава розрахована на всю родину й поєднує театр, музику, танці та активну участь дітей.',
        'Pasydy Theatre',
        'Deligiorgi 4 5973+JW, Nicosia, 1066, Cyprus',
        'https://ukrcy.news/wp-content/uploads/2026/09/olaf8.jpg',
        '2026-11-29 11:00:00'::timestamp,
        '2026-11-29 17:00:00'::timestamp,
        'Europe/Kyiv',
        35.1640625,
        33.3548125,
        'https://maps.google.com/maps?f=q&source=s_q&hl=en&geocode=&q=Deligiorgi+4+5973%2BJW+Nicosia+1066+Cyprus',
        NULL,
        'від €10',
        'https://ukrcy.news/event/rizdvyana-podorozh-olafa-chy-zmozhut-dity-vryatuvaty-rizdvo-2/',
        'Координати приблизні: центр комірки Plus Code 8G7M5973+JW, відновленого з 5973+JW Nicosia у посиланні Google Maps. Розмір комірки приблизно 14 × 11 м; це не підтверджений вхід. Незалежна позначка PASYDY Auditorium (35.16419, 33.35479) розташована приблизно за 14 м: https://www.cyprusevents.net/venues/pasydy-auditorium/ .',
        NULL
    )
),
prepared AS (
    SELECT source_rows.*,
        starts_local AT TIME ZONE event_timezone AS starts_at,
        expires_local AT TIME ZONE event_timezone AS expires_at,
        concat_ws(
            E'\n\n',
            summary,
            'Місце проведення: ' || venue,
            CASE WHEN venue_address IS NOT NULL AND venue_address <> venue
                THEN 'Адреса: ' || venue_address END,
            COALESCE('Google Maps: ' || maps_url,
                     'Google Maps: посилання у картці відсутнє.'),
            notes,
            resource_links,
            'Джерело: ' || source_url,
            'Часовий пояс: ' || event_timezone,
            CASE WHEN price_line IS NOT NULL THEN 'Вартість: ' || price_line END
        ) AS description,
        row_number() OVER (
            PARTITION BY lower(btrim(title)), starts_local::date
            ORDER BY source_id
        ) AS title_date_rank,
        row_number() OVER (
            PARTITION BY source_url
            ORDER BY source_id
        ) AS source_rank,
        row_number() OVER (
            PARTITION BY image_url, starts_local::date
            ORDER BY source_id
        ) AS image_date_rank
    FROM source_rows
)
INSERT INTO social_events (
    owner_id, description, event_type, image_urls, drink, visibility,
    latitude, longitude, location, photo_key, starts_at, expires_at,
    capacity, hidden
)
SELECT
    settings.owner_id, prepared.description, 'global',
    jsonb_build_array(prepared.image_url), 'spirits', 'public',
    prepared.latitude, prepared.longitude, prepared.title, NULL,
    prepared.starts_at, prepared.expires_at, NULL, FALSE
FROM prepared
CROSS JOIN settings
WHERE prepared.exclusion_reason IS NULL
  AND prepared.title_date_rank = 1
  AND prepared.source_rank = 1
  AND prepared.image_date_rank = 1
  AND prepared.venue IS NOT NULL
  AND prepared.image_url LIKE 'https://%'
  AND prepared.latitude BETWEEN 34 AND 36
  AND prepared.longitude BETWEEN 32 AND 35
  AND prepared.starts_local::date > DATE '2026-10-19'
  AND prepared.starts_local >= TIMESTAMP '2026-11-01 00:00:00'
  AND prepared.starts_local < TIMESTAMP '2026-12-01 00:00:00'
  AND prepared.starts_at > CURRENT_TIMESTAMP
  AND prepared.expires_at > prepared.starts_at
  AND NOT EXISTS (
      SELECT 1
      FROM social_events AS existing
      WHERE existing.event_type = 'global'
        AND (
            strpos(existing.description, prepared.source_url) > 0
            OR (
                (existing.starts_at AT TIME ZONE prepared.event_timezone)::date
                    = prepared.starts_local::date
                AND (
                    existing.image_urls @> jsonb_build_array(prepared.image_url)
                    OR lower(btrim(existing.location)) = lower(btrim(prepared.title))
                )
            )
        )
  )
RETURNING id, location, starts_at, expires_at;

COMMIT;
