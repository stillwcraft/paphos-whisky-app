-- Manual import from https://lima.events/en/paphos, snapshot 2026-10-16.
-- Reviewed all 50 rendered listing cards; opened all 27 date-eligible cards.
-- 21 SQL candidates. Start DATE must be later than 2026-10-16, within October 2026.
-- Excluded IDs: 2592, 2343, 2248, 2471, 2360, 2472. See companion JSON for reasons and source provenance.
-- LUSTRA (2360) has no event image. Card 2592 duplicates 2459 and is merged into it.
-- Other exclusions, if any, have no defensible venue coordinates; no city-center TBA pins invented.
-- No Russian-titled cards occur in this date-filtered listing snapshot.
-- Descriptions are factual Ukrainian adaptations retaining conditions, prices and contacts.
-- Missing About fields and approximate/source-only coordinates are explicitly labelled.
-- All 26 nonempty source image URLs returned HTTP 200 with image/webp content.
-- Apply migrations 022_social_events.sql and 027_global_social_events.sql first.
-- owner_id is copied from the existing project manual imports, not guessed.
-- Production DB NOT queried: DATABASE_URL unset, .env has no settings.
-- Local SQLite files have no social_events table. Existing Lima titles/images are UNKNOWN.
-- All starts are from Schedule, interpreted in Europe/Nicosia; DST changes on 2026-10-25.
-- Every expiry is 23:59 on its start DATE, intentionally ignoring multi-day/overnight duration.
-- A structured Lima price of 0 is NOT treated as evidence of free entry.
-- The Paphos page contains Nicosia events; confirmed actual locations are used.
-- Existing format: global/public/spirits, title in location, actual venue in description,
-- external image_urls, NULL photo_key/capacity, hidden FALSE.
-- The shared Batman title represents distinct performances (Oct 28 and Oct 31), not duplicates.
-- Both can enter this single INSERT if neither title exists. An existing shared title
-- conservatively suppresses both, as required by title-only duplicate protection.
-- Duplicate event 2592 is checked through its original title, source URL and image too.
-- No production rows were inserted while preparing this file. Manual execution only.
-- Coordinate attribution: (c) OpenStreetMap contributors, ODbL 1.0, https://osm.org/copyright
BEGIN;
SET LOCAL TIME ZONE 'Europe/Nicosia';
LOCK TABLE social_events IN SHARE ROW EXCLUSIVE MODE;

WITH settings AS (
    SELECT 8546526596::bigint AS owner_id
),
source_rows (
    title, original_title, description, venue, image_urls, starts_at, expires_at,
    latitude, longitude, source_url, source_aliases, original_title_aliases
) AS (
    VALUES
    ('Йога, вечірка біля басейну та бранч',
     'Poolparty, YOGA & Brunch',
     'Йога, бранч і відпочинок біля басейну в Kamares Club із живим DJ-сетом. Двері відчиняються о 10:00, йога починається о 10:30; для starts_at використано 10:00 із Schedule. Дрескод: білий, нюдовий або бежевий одяг. Візьміть купальник; доступна роздягальня. Умови Early Bird в About: €69 до 6 жовтня 2026 або до розпродажу — цей термін уже минув, поточну ціну слід перевірити при купівлі. Instagram організаторів: @ele.community.events.

Місце: Kamares Club

Координати приблизні / не підтверджені незалежно: Координати Kamares Club наведені лише за джерелом і округлені до двох десяткових знаків: похибка може становити сотні метрів. Точну будівлю клубу незалежно не підтверджено; позначку села Kamares не використано як адресу клубу.

Джерело координат: https://lima.events/en/events/2415

Квитки / реєстрація / деталі події: https://ra.co/events/2551685?utm_source=lima

Джерело: https://lima.events/en/events/2415',
     'Kamares Club',
     '["https://lima.events/uploads/events/5bd385e7-ca38-419a-a6c8-703f6c24125b.webp"]'::jsonb,
     '2026-10-17T10:00:00+03:00'::timestamptz,
     '2026-10-17T23:59:00+03:00'::timestamptz,
     34.85, 32.44,
     'https://lima.events/en/events/2415',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Стежка скель Інії: піший похід на Кіпрському фестивалі скелелазіння',
     'Inia Crags Trail: Scenic Hike at Cyprus Rock Climbing Festival',
     'Поле About у картці Lima відсутнє. У заголовку анонсовано піший похід Inia Crags Trail у межах Cyprus Rock Climbing Festival. Маршрут, вимоги до спорядження, умови участі та ціна в картці не наведені.

Місце: Inia Village Square

Координати приблизні / не підтверджені незалежно: Точка збору Inia Village Square наведена за джерелом. Розташування в Інеї узгоджується з картою, але саме площу та точку зустрічі незалежно не підтверджено; це не перевірений вхід.

Джерело координат: https://lima.events/en/events/2591

Квитки / реєстрація / деталі події: https://rsrvin.com/events/6acb768aad6fdbadb544eecf-Inia%20Crags%20Trail%3A%20Scenic%20Hike%20at%20Cyprus%20Rock%20Climbing%20Festival?utm_source=lima

Джерело: https://lima.events/en/events/2591',
     'Inia Village Square',
     '["https://lima.events/uploads/events/f0a0984d-e130-4b8d-81e2-143f0e3be701.webp"]'::jsonb,
     '2026-10-17T14:00:00+03:00'::timestamptz,
     '2026-10-17T23:59:00+03:00'::timestamptz,
     34.9560179, 32.3929482,
     'https://lima.events/en/events/2591',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Благодійний забіг або прогулянка',
     'Charity Fun Run & Walk',
     'Благодійний забіг або прогулянка на 5 км для підтримки людей з онкологічними захворюваннями. Збір коштів для CPSG та Care Days за підтримки Paphos Running Club підтверджений афішею. Початок о 16:00; реєстрація з 15:00. Організатори радять приїхати заздалегідь. Онлайн-реєстрація: https://shorturl.at/ik7DN. На афіші: участь €10, для дітей до 12 років — €5; DJ та танцювальна розминка. Картка 2592 описує цю саму подію, тому об’єднана з цією.

Місце: Paphos Castle

Походження координат: Координати уточнено за будівлею замку Пафоса на OpenStreetMap. Точний майданчик або вхід заходу біля замку слід уточнити в організатора.

Джерело координат: https://www.openstreetmap.org/way/8052789

Об’єкт на карті: https://www.openstreetmap.org/way/8052789

Квитки / реєстрація / деталі події: https://allevents.in/event/200030774508150?utm_source=lima

Джерело: https://lima.events/en/events/2459

Додаткова картка тієї самої події: https://lima.events/en/events/2592',
     'Paphos Castle',
     '["https://lima.events/uploads/events/342aeecd-be65-4c08-8c22-9b26e002532c.webp", "https://lima.events/uploads/events/0e589ca4-162d-40ba-abf2-8add7f82f663.webp"]'::jsonb,
     '2026-10-17T16:00:00+03:00'::timestamptz,
     '2026-10-17T23:59:00+03:00'::timestamptz,
     34.7536703, 32.4069592,
     'https://lima.events/en/events/2459',
     '["https://lima.events/en/events/2592"]'::jsonb,
     '["Fun 5K Run or Walk: Cancer Charity Event at Paphos Harbour"]'::jsonb),
    ('Заняття LEGO® для маленьких будівельників у Public Kings Avenue Mall, Пафос',
     'LEGO® δραστηριότητες για μικρούς builders @ Public Kings Avenue Mall, Πάφος',
     'Поле About у картці Lima відсутнє. Заголовок анонсує заняття LEGO® для дітей у Public, Kings Avenue Mall. Вікові обмеження, потреба в реєстрації та ціна не вказані.

Місце: Kings Avenue Mall Paphos

Походження координат: Місце підтверджено на карті як Kings Avenue Mall. Позначка відповідає будівлі торговельного центру, а не конкретному входу чи майданчику заходу.

Джерело координат: https://kingsavenuemall.com/

Об’єкт на карті: https://www.openstreetmap.org/way/147476732

Квитки / реєстрація / деталі події: https://allevents.in/event/200030800113543?utm_source=lima

Джерело: https://lima.events/en/events/2492',
     'Kings Avenue Mall Paphos',
     '["https://lima.events/uploads/events/0b7594ea-28cb-4f08-b525-ba6a9784b36d.webp"]'::jsonb,
     '2026-10-17T16:00:00+03:00'::timestamptz,
     '2026-10-17T23:59:00+03:00'::timestamptz,
     34.7657937, 32.413729,
     'https://lima.events/en/events/2492',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Виставка «Матерія та спільнота»',
     'Έκθεση: Ύλη & Κοινότητα | Exhibition: Matter & Community',
     'Поле About у картці Lima відсутнє. Назва виставки — «Матерія та спільнота»; місце, зазначене в Location, — Fyti. Авторів, програму, точну адресу та вартість не наведено.

Місце: Fyti

Координати приблизні / не підтверджені незалежно: Вказано лише село Фіті. Позначка орієнтовно показує центр села за картою, а не будівлю виставки; конкретне місце проведення не встановлено. Початкові координати джерела також позначали лише район села.

Джерело координат: https://allevents.in/event/200030800413955

Об’єкт на карті: https://www.openstreetmap.org/node/60061093

Квитки / реєстрація / деталі події: https://allevents.in/event/200030800413955?utm_source=lima

Джерело: https://lima.events/en/events/2493',
     'Fyti',
     '["https://lima.events/uploads/events/07eccfee-09ef-4435-b3dc-555c564dde6a.webp"]'::jsonb,
     '2026-10-17T17:00:00+03:00'::timestamptz,
     '2026-10-17T23:59:00+03:00'::timestamptz,
     34.9285633, 32.5449928,
     'https://lima.events/en/events/2493',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Вечір соулу та Motown з Уною',
     'A Night Of Soul & Motown With Una',
     'Уна Петтіфорд виконає програму, присвячену Motown, соулу й диско. Вечеря з трьох страв коштує €25; можна прийти лише на напої. Бронювання: 26 96 24 15. Додатковий контакт у джерелі подано в обфускованому вигляді «colosseum | cytanet ! com ! cy»; непідтверджену email-адресу не відновлено.

Місце: Colosseum Restaurant Paphos Live Shows & Weddings

Координати приблизні / не підтверджені незалежно: Координати Colosseum Restaurant взято з картки події; зовнішня картка AllEvents містить ту саму точку, але це не незалежна перевірка закладу. Точність розташування та входу не підтверджено.

Джерело координат: https://allevents.in/event/200030636300353

Квитки / реєстрація / деталі події: https://allevents.in/event/200030636300353?utm_source=lima

Джерело: https://lima.events/en/events/2266',
     'Colosseum Restaurant Paphos Live Shows & Weddings',
     '["https://lima.events/uploads/events/d41d3c18-5a4b-44a4-8c23-fdb133c8ba35.webp"]'::jsonb,
     '2026-10-17T19:00:00+03:00'::timestamptz,
     '2026-10-17T23:59:00+03:00'::timestamptz,
     34.74987604, 32.42742529,
     'https://lima.events/en/events/2266',
     '[]'::jsonb,
     '[]'::jsonb),
    ('«Невидиме місто»',
     'Αόρατη πόλη / Invisible City',
     'Поле About у картці Lima відсутнє. Подія «Невидиме місто» запланована в Old Powerhouse, Пафос. Формат, програму, умови участі та ціну в картці не зазначено.

Місце: Old Powerhouse, Pafos - Παλιά Ηλεκτρική, Πάφος

Походження координат: Місце підтверджено як культурний центр Παλιά Ηλεκτρική / Old Powerhouse у Пафосі; координати уточнено за об''єктом на OpenStreetMap.

Джерело координат: https://www.openstreetmap.org/node/60463692

Об’єкт на карті: https://www.openstreetmap.org/node/60463692

Квитки / реєстрація / деталі події: https://allevents.in/event/200030800112437?utm_source=lima

Джерело: https://lima.events/en/events/2488',
     'Old Powerhouse, Pafos - Παλιά Ηλεκτρική, Πάφος',
     '["https://lima.events/uploads/events/2c932ac3-d8a5-4d12-9423-63c7acf95b52.webp"]'::jsonb,
     '2026-10-17T19:30:00+03:00'::timestamptz,
     '2026-10-17T23:59:00+03:00'::timestamptz,
     34.7765493, 32.4219099,
     'https://lima.events/en/events/2488',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Індійський гастрономічний фестиваль Дуссехра',
     'DUSSHERA INDIAN FOOD FESTIVAL',
     'Curry House святкує Дуссехру спеціальним індійським меню. Включено по 3 вегетаріанські та невегетаріанські закуски, по 3 вегетаріанські та невегетаріанські основні страви, 2 види рису, 3 види наану, 2 десерти, чатні, салат і райту. Безлімітна їжа — €23,95 з особи. Два сеанси: 18:00 та 20:00. Заохочується яскравий одяг. Бронювання телефоном або WhatsApp: Raj 99 864 607, Tula 99 17 90 94.

Місце: 22, Iassonos Str., 8041 Paphos

Походження координат: Адресу 22 Iassonos підтверджено на OpenStreetMap як ресторан Curry House у Като-Пафосі; координати уточнено за закладом.

Джерело координат: https://curryhousepaphos.com/restaurant/

Об’єкт на карті: https://www.openstreetmap.org/node/3294281203

Квитки / реєстрація / деталі події: https://allevents.in/event/200030769993226?utm_source=lima

Джерело: https://lima.events/en/events/2458',
     '22, Iassonos Str., 8041 Paphos',
     '["https://lima.events/uploads/events/22a6dc51-3c33-4b50-b545-68317eb5eff2.webp"]'::jsonb,
     '2026-10-18T18:00:00+03:00'::timestamptz,
     '2026-10-18T23:59:00+03:00'::timestamptz,
     34.7573793, 32.4220882,
     'https://lima.events/en/events/2458',
     '[]'::jsonb,
     '[]'::jsonb),
    ('MLC у Monara Live Music & Sports Bar',
     'MLC @ Monara Live Music Sports Bar',
     'Три години живої рок-класики 1970-х, 1980-х та 1990-х від MLC на сцені Monara. Потрібне бронювання: 94 089 168.

Місце: Monara Live Music & Sports Bar Paphos

Походження координат: Місце зіставлено із закладом Monara на Tombs of the Kings Avenue у Пафосі; координати уточнено за об''єктом OpenStreetMap. Карта класифікує його як ресторан; конкретний вхід заходу не перевірено.

Джерело координат: https://www.openstreetmap.org/node/4793814234

Об’єкт на карті: https://www.openstreetmap.org/node/4793814234

Квитки / реєстрація / деталі події: https://allevents.in/event/200030726042553?utm_source=lima

Джерело: https://lima.events/en/events/2376',
     'Monara Live Music & Sports Bar Paphos',
     '["https://lima.events/uploads/events/eff695d6-7e2f-4f93-9a91-cfa834a2e761.webp"]'::jsonb,
     '2026-10-23T20:30:00+03:00'::timestamptz,
     '2026-10-23T23:59:00+03:00'::timestamptz,
     34.7655708, 32.4113225,
     'https://lima.events/en/events/2376',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Відновити зв’язок із собою: два дні подалі від шуму',
     'Reconnect to YOURSELF - Two Days Away From the Noise',
     'Дводенний ретрит у Друзії 24–25 жовтня з практичними вправами, роботою в парах і групі, рефлексією, рухом, ранковими практиками та обговореннями стосунків, вибору, відповідальності й особистих рішень. Відкритий для всіх; досвід Insight або інших ретритів не потрібен. Група — максимум 20 учасників. Наживо проводять Krasimir та Clementine; протягом вихідних відбудуться дві інтерактивні онлайн-сесії з фасилітаторами Insight. Внесок — €97 з особи. Проживання та харчування НЕ включені й оплачуються окремо: одномісний номер зі сніданком — €70, двомісний зі сніданком — €85; період розрахунку цих тарифів у джерелі не уточнений. Для імпорту завершення навмисно встановлене на 23:59 24 жовтня.

Місце: Palates Hotel, Akamantos, Drouseia

Походження координат: Початкову помилкову точку в місті Пафос відхилено. Офіційний сайт підтверджує Palates Village Hotel у Друсії та телефон +357 26332083; координати взято з відповідного готелю на OpenStreetMap. Поштова назва сусідньої Інеї в геокодері не означає інший готель.

Джерело координат: https://www.droushiahotelpalates.com/gr/contact-bgr.html

Об’єкт на карті: https://www.openstreetmap.org/node/3215974746

Квитки / реєстрація / деталі події: https://allevents.in/event/80001544123546?utm_source=lima

Джерело: https://lima.events/en/events/2457',
     'Palates Hotel, Akamantos, Drouseia',
     '["https://lima.events/uploads/events/c53f5abb-4097-4d21-bf70-c00e24380899.webp"]'::jsonb,
     '2026-10-24T09:00:00+03:00'::timestamptz,
     '2026-10-24T23:59:00+03:00'::timestamptz,
     34.9622987, 32.3959819,
     'https://lima.events/en/events/2457',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Біла вечірка з безлімітним бранчем',
     '✨🤍 THE ULTIMATE WHITE PARTY BOTTOMLESS BRUNCH IS COMING! 🤍✨',
     'White Party у The Meeting Bar, Като-Пафос: R&B-класика від DJ Tom Owens, живий вокал, їжа й дві години безлімітних напоїв — просеко, вина, пива та добірки коктейлів. У джерелі програма 12:30–16:30. Дрескод — білий одяг. Ранні квитки — €30, їх кількість обмежена, далі ціна зросте. Вхід лише за квитками; кількість місць обмежена.

Місце: 13 Konstandias Street

Координати приблизні / не підтверджені незалежно: Помилкову точку на однойменній вулиці Konstantias у Колоні відхилено. Використано координати зовнішньої картки події AllEvents для The Meeting Bar у Като-Пафосі. Це координати джерела, а не незалежно перевірений заклад; у картці також є розбіжність номерів будинку 13/14.

Джерело координат: https://allevents.in/event/200030599803553

Квитки / реєстрація / деталі події: https://allevents.in/event/200030599803553?utm_source=lima

Джерело: https://lima.events/en/events/2221',
     '13 Konstandias Street',
     '["https://lima.events/uploads/events/16b27589-3075-4656-a350-1e6283b69ed2.webp"]'::jsonb,
     '2026-10-24T12:30:00+03:00'::timestamptz,
     '2026-10-24T23:59:00+03:00'::timestamptz,
     34.75836, 32.41666,
     'https://lima.events/en/events/2221',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Океан OM: коло мантр біля моря',
     '🌊 Ocean of OM-s | Mantra Circle by the Sea',
     'Спільне співання мантри OM біля моря в Мандрії, 18:00–20:00. Учасникам запропонують аюрведичний трав’яний напій для голосу. Внесок — €20. Відкрито для всіх: знання мантр, вокальні навички й досвід співу не потрібні. Кількість місць обмежена; бронювання через WhatsApp +357 97492550. Ведучі — Marty та Dora.

Місце: Mandria Paphos Cyprus

Координати приблизні / не підтверджені незалежно: Помилкову точку в центрі Пафоса відхилено. Позначка показує лише район пляжу Мандрії за OpenStreetMap, а не точне місце кола мантр. Точну локацію біля моря організатори повідомляють через WhatsApp; перед поїздкою її потрібно отримати.

Джерело координат: https://allevents.in/event/200030769993024

Об’єкт на карті: https://www.openstreetmap.org/node/14200582130

Квитки / реєстрація / деталі події: https://allevents.in/event/200030769993024?utm_source=lima

Джерело: https://lima.events/en/events/2463',
     'Mandria Paphos Cyprus',
     '["https://lima.events/uploads/events/634313b0-66ab-4c86-8f6f-eaf064e1fe18.webp"]'::jsonb,
     '2026-10-24T18:00:00+03:00'::timestamptz,
     '2026-10-24T23:59:00+03:00'::timestamptz,
     34.7027244, 32.5248108,
     'https://lima.events/en/events/2463',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Караоке з Джимом — музичною людиною',
     'Karaoke with Jim the music man!',
     'Караоке з Jim the Music Man у Chalkies Bar. Кухня працює до 22:00, останні замовлення — о 21:45. Бронювання столиків: 26343511.

Місце: Chalkies Bar

Походження координат: Координати уточнено за баром Chalkies на Coral Bay strip у Пеї. Адреса Coral Bay strip підтверджується зовнішньою карткою події; початкову зміщену приблизно на 700 м точку відхилено. Точний вхід не перевірено.

Джерело координат: https://allevents.in/event/200030562742111

Об’єкт на карті: https://www.openstreetmap.org/node/4987771729

Квитки / реєстрація / деталі події: https://allevents.in/event/200030562742111?utm_source=lima

Джерело: https://lima.events/en/events/2181',
     'Chalkies Bar',
     '["https://lima.events/uploads/events/6f5901a3-396e-419f-9a08-bff48e0980ca.webp"]'::jsonb,
     '2026-10-24T20:00:00+03:00'::timestamptz,
     '2026-10-24T23:59:00+03:00'::timestamptz,
     34.8535799, 32.3770025,
     'https://lima.events/en/events/2181',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Joanna Sophia: забіг або прогулянка «Навколо світу за 5 км» на Кіпрі',
     'Joanna Sophia Fun Run/Walk Around the World In 5k CYPRUS',
     'Поле About у картці Lima відсутнє. Заголовок анонсує забіг або прогулянку Joanna Sophia Fun Run/Walk Around the World In 5k; Location — Paphos Castle. Умови участі, реєстраційний внесок і контакти в картці не наведені.

Місце: Paphos Castle

Походження координат: Координати уточнено за будівлею замку Пафоса на OpenStreetMap. Точний майданчик або вхід заходу біля замку слід уточнити в організатора.

Джерело координат: https://www.openstreetmap.org/way/8052789

Об’єкт на карті: https://www.openstreetmap.org/way/8052789

Квитки / реєстрація / деталі події: https://allevents.in/event/200030769993632?utm_source=lima

Джерело: https://lima.events/en/events/2465',
     'Paphos Castle',
     '["https://lima.events/uploads/events/72718c50-e611-46c2-ab8f-a070bec69b81.webp"]'::jsonb,
     '2026-10-25T16:00:00+02:00'::timestamptz,
     '2026-10-25T23:59:00+02:00'::timestamptz,
     34.7536703, 32.4069592,
     'https://lima.events/en/events/2465',
     '[]'::jsonb,
     '[]'::jsonb),
    ('«Темний лицар»: мюзикл про Бетмена',
     'One Dark Knight: A Batman Musical',
     'Оригінальний мюзикл про протистояння Бетмена та лиходіїв Ґотема в театрі Markideio, Пафос. Двері відчиняються о 19:30, вистава починається о 20:00. В About зазначені два покази — 28 та 31 жовтня; цей запис стосується Schedule 28 жовтня. Ціну квитка не наведено.

Місце: Markideio Theatre

Походження координат: Місце підтверджено як Markideion Theater / Markideio Theatre у Пафосі; позначка відповідає будівлі театру на OpenStreetMap, а не гарантовано конкретному входу.

Джерело координат: https://www.openstreetmap.org/way/824979277

Об’єкт на карті: https://www.openstreetmap.org/way/824979277

Квитки / реєстрація / деталі події: https://www.ticketbox.com.cy/one-dark-knight/28-10-2026?utm_source=lima

Джерело: https://lima.events/en/events/2672',
     'Markideio Theatre',
     '["https://lima.events/uploads/events/9ad54775-560f-42ec-85f0-610cd5035a04.webp"]'::jsonb,
     '2026-10-28T20:00:00+02:00'::timestamptz,
     '2026-10-28T23:59:00+02:00'::timestamptz,
     34.7781667, 32.4231959,
     'https://lima.events/en/events/2672',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Cyprus Property Week: конференція з нерухомості в Пафосі',
     'Cyprus Property Week: Real Estate Conference in Paphos',
     'Поле About у картці Lima відсутнє. Заголовок анонсує конференцію з нерухомості Cyprus Property Week у Leonardo Plaza Cypria Maris Beach Hotel & Spa. Програму, умови участі та ціну в картці не наведено.

Місце: Leonardo Plaza Cypria Maris Beach Hotel & Spa

Походження координат: Місце підтверджено як Leonardo Plaza Cypria Maris Beach Hotel & Spa, 10 Afroditis Avenue; координати уточнено за територією готелю OpenStreetMap. Конкретну залу або вхід заходу не встановлено.

Джерело координат: https://www.openstreetmap.org/way/1102929738

Об’єкт на карті: https://www.openstreetmap.org/way/1102929738

Квитки / реєстрація / деталі події: https://cypruspropertyweek.com/purchase-ticket/?utm_source=lima

Джерело: https://lima.events/en/events/2689',
     'Leonardo Plaza Cypria Maris Beach Hotel & Spa',
     '["https://lima.events/uploads/events/7e9c7842-f276-4a2c-b8f1-f0dc48ca5428.webp"]'::jsonb,
     '2026-10-31T16:00:00+02:00'::timestamptz,
     '2026-10-31T23:59:00+02:00'::timestamptz,
     34.7415984, 32.4316015,
     'https://lima.events/en/events/2689',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Traffic Reactor',
     'Traffic Reactor',
     'Open-air рейв на приватній віддаленій ділянці на пагорбі поблизу села Пенталія в районі Пафоса. Анонсовані професійні звук і світло, hard techno та інша швидка електронна музика. Початок — 20:00. Організатори закликають берегти природу. У полі ціни Lima — €10; точну адресу ділянки не оприлюднено.

Місце: Traffic Experience

Координати приблизні / не підтверджені незалежно: Захід заявлено на приватній гірській ділянці поблизу Пенталії. Координати з джерела округлені до двох десяткових знаків і є лише орієнтиром району, а не підтвердженим майданчиком чи під''їздом. Точну локацію потрібно отримати в організатора.

Джерело координат: https://lima.events/en/events/2409

Квитки / реєстрація / деталі події: https://ra.co/events/2550130?utm_source=lima

Джерело: https://lima.events/en/events/2409',
     'Traffic Experience',
     '["https://lima.events/uploads/events/cac3d11b-9cab-4f5b-ad26-789aef11bdcc.webp"]'::jsonb,
     '2026-10-31T20:00:00+02:00'::timestamptz,
     '2026-10-31T23:59:00+02:00'::timestamptz,
     34.86, 32.62,
     'https://lima.events/en/events/2409',
     '[]'::jsonb,
     '[]'::jsonb),
    ('«Темний лицар»: мюзикл про Бетмена',
     'One Dark Knight: A Batman Musical',
     'Оригінальний мюзикл про протистояння Бетмена та лиходіїв Ґотема в театрі Markideio, Пафос. Двері відчиняються о 19:30, вистава починається о 20:00. В About зазначені два покази — 28 та 31 жовтня; цей запис стосується Schedule 31 жовтня. Ціну квитка не наведено.

Місце: Markideio Theatre

Походження координат: Місце підтверджено як Markideion Theater / Markideio Theatre у Пафосі; позначка відповідає будівлі театру на OpenStreetMap, а не гарантовано конкретному входу.

Джерело координат: https://www.openstreetmap.org/way/824979277

Об’єкт на карті: https://www.openstreetmap.org/way/824979277

Квитки / реєстрація / деталі події: https://www.ticketbox.com.cy/one-dark-knight/31-10-2026?utm_source=lima

Джерело: https://lima.events/en/events/2694',
     'Markideio Theatre',
     '["https://lima.events/uploads/events/1ff73af8-a9b5-4779-a903-9648ca5735a2.webp"]'::jsonb,
     '2026-10-31T20:00:00+02:00'::timestamptz,
     '2026-10-31T23:59:00+02:00'::timestamptz,
     34.7781667, 32.4231959,
     'https://lima.events/en/events/2694',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Геловінська вечірка з Too Hot For Red',
     'Halloween 🎃 Party Too Hot For Red',
     'Halloween у Monara Live Music & Sports Bar із живим виступом Too Hot For Red від 21:00 та спеціальними коктейлями. Вхід безкоштовний. Очікується багато гостей: пріоритет бронювання мають відвідувачі, які замовляють їжу; тим, хто приходить лише на напої, радять прибути раніше. Бронювання: 94089168. Сайт: https://monaralivemusicsportsbar.com.

Місце: Monara Live Music & Sports Bar Paphos

Походження координат: Місце зіставлено із закладом Monara на Tombs of the Kings Avenue у Пафосі; координати уточнено за об''єктом OpenStreetMap. Карта класифікує його як ресторан; конкретний вхід заходу не перевірено.

Джерело координат: https://www.openstreetmap.org/node/4793814234

Об’єкт на карті: https://www.openstreetmap.org/node/4793814234

Квитки / реєстрація / деталі події: https://allevents.in/event/200030800150542?utm_source=lima

Джерело: https://lima.events/en/events/2489',
     'Monara Live Music & Sports Bar Paphos',
     '["https://lima.events/uploads/events/a28ccd94-ccde-462a-bf65-6016b9434443.webp"]'::jsonb,
     '2026-10-31T21:00:00+02:00'::timestamptz,
     '2026-10-31T23:59:00+02:00'::timestamptz,
     34.7655708, 32.4113225,
     'https://lima.events/en/events/2489',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Luna Morada: «Торговий центр із привидами» — City Plaza, Нікосія',
     'LUNA MORADA: THE HAUNTED MALL - CITY PLAZA NICOSIA (HALLOWEEN EDITION)',
     'Halloween-вечірка в покинутому торговому центрі City Plaza, Нікосія. Хедлайнер — Yet More; також виступлять Angie, Amyrran, Rokoshka та Selene. Початок о 21:00. Дрескод — Halloween Elegant. В About зазначено продаж квитків на GO-OUT; кнопка Lima веде на Resident Advisor. У полі ціни Lima — €20. Бронювання столиків: +357 99 328000.

Місце: Tba

Уточнення місця з опису або додаткового джерела: City Plaza, Nicosia

Походження координат: Уточнення TBA: за назвою та описом організатора захід відбудеться в City Plaza, Нікосія, а не в Пафосі. Координати відповідають будівлі City Plaza на Makariou Avenue у Нікосії; конкретний вхід заходу не перевірено.

Джерело координат: https://lima.events/en/events/2500

Об’єкт на карті: https://www.openstreetmap.org/way/775195646

Квитки / реєстрація / деталі події: https://ra.co/events/2555910?utm_source=lima

Джерело: https://lima.events/en/events/2500',
     'Tba',
     '["https://lima.events/uploads/events/e48c0dfd-b1df-4b60-96dc-3624689786b9.webp"]'::jsonb,
     '2026-10-31T21:00:00+02:00'::timestamptz,
     '2026-10-31T23:59:00+02:00'::timestamptz,
     35.1663431, 33.3614822,
     'https://lima.events/en/events/2500',
     '[]'::jsonb,
     '[]'::jsonb),
    ('Відкриття CYTEC — Hard Halloween',
     'CYTEC Opening – Hard Halloween',
     'Перша ніч BANK by CYTEC у Пафосі: hard techno, schranz та groove з 22:30 до 04:30. Вік 18+, обов’язковий чинний документ. Продажу на вході НЕ буде: квитки лише через https://cytec.app. На танцполі заборонені телефони, фото й відео; камери заклеюють на вході, телефон можна використовувати лише біля бару для оплати. Дрескод — темний, повністю чорний одяг або Halloween-костюм. Упродовж ночі працюватиме awareness-команда. Попри програму після опівночі, імпортований expires_at — 23:59 31 жовтня за заданим правилом.

Місце: Bank By Cytec

Походження координат: Офіційний сайт CYTEC підтверджує BANK, Constantinou Kanari 13, старе місто Пафоса. Координати уточнено за однойменним нічним клубом на цій вулиці в OpenStreetMap; початкова точка мала лише два десяткові знаки. Конкретний вхід не перевірено.

Джерело координат: https://cytec.app/venue

Об’єкт на карті: https://www.openstreetmap.org/node/11774679387

Квитки / реєстрація / деталі події: https://ra.co/events/2561709?utm_source=lima

Джерело: https://lima.events/en/events/2786',
     'Bank By Cytec',
     '["https://lima.events/uploads/events/57ea6e73-a763-4416-8104-71a8bd10e8a0.webp"]'::jsonb,
     '2026-10-31T22:30:00+02:00'::timestamptz,
     '2026-10-31T23:59:00+02:00'::timestamptz,
     34.7782776, 32.4202707,
     'https://lima.events/en/events/2786',
     '[]'::jsonb,
     '[]'::jsonb)
)
INSERT INTO social_events (
    owner_id, description, event_type, image_urls, drink, visibility,
    latitude, longitude, location, photo_key, starts_at, expires_at,
    capacity, hidden
)
SELECT
    settings.owner_id,
    source_rows.description,
    'global',
    source_rows.image_urls,
    'spirits',
    'public',
    source_rows.latitude,
    source_rows.longitude,
    source_rows.title,
    NULL,
    source_rows.starts_at,
    source_rows.expires_at,
    NULL,
    FALSE
FROM source_rows
CROSS JOIN settings
WHERE NOT EXISTS (
    SELECT 1
    FROM social_events AS existing
    WHERE lower(btrim(existing.location)) IN (
              lower(btrim(source_rows.title)),
              lower(btrim(source_rows.original_title))
          )
       OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(source_rows.original_title_aliases) AS alias(title)
           WHERE lower(btrim(existing.location)) = lower(btrim(alias.title))
       )
       OR strpos(existing.description, source_rows.source_url) > 0
       OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(source_rows.source_aliases) AS alias(url)
           WHERE strpos(existing.description, alias.url) > 0
       )
       OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(source_rows.image_urls) AS candidate(url)
           WHERE existing.image_urls @> jsonb_build_array(candidate.url)
       )
)
RETURNING id, location, starts_at, expires_at;

COMMIT;
