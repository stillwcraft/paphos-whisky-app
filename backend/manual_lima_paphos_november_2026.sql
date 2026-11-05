-- Manual import of future November 2026 events listed on Lima Events Paphos (https://lima.events/en/paphos).
-- Snapshot date: 2026-10-29 (Europe/Nicosia, UTC+02 in November 2026).
-- Total November 2026 cards found on listing page: 23.
-- Included SQL rows: 20 (date range: 2026-11-01 to 2026-11-28).
-- Excluded / merged cards:
--   * https://lima.events/en/events/3011 ("Clay theatre performance for little ones - Театр глиняных фигурок для малышей") — excluded due to Russian title.
--   * https://lima.events/en/events/2708 ("KEHA Somatic Healing Retreat: 7-Day All-Inclusive in Paphos") — internal duplicate of 2016 ("KEHA Somatic Retreat in Cyprus - Nov 2026"), merged into row 2016 with alias protection.
--   * https://lima.events/en/events/3022 ("NOX") — internal duplicate of 3023 ("NOX presents NAKADIA"), merged into row 3023 with alias protection.
-- All 23 event image URLs verified via HTTP HEAD (HTTP 200, image/webp).
-- Apply migrations 022_social_events.sql and 027_global_social_events.sql before running.
-- Database connection was unavailable in the local environment (DATABASE_URL unset); duplicate protection by title, source URL, and image URL is enforced in WHERE NOT EXISTS.
-- Every event expires at 23:59 on its start date in Europe/Nicosia (+02:00), including multi-day events.
BEGIN;

WITH settings AS (
    SELECT 8546526596::bigint AS owner_id
),
source_rows (
    title, original_title, summary, venue, map_query, image_url, starts_at, expires_at,
    latitude, longitude, resource_label, resource_url, source_url,
    alias_titles, alias_source_urls, alias_image_urls
) AS (
    VALUES
    ('Soula Soul — Пафос 2026',
     'Soula Soul - Paphos 2026',
     'Тижневий музичний захід Soula Soul у 5-зірковому готелі Venus Beach Hotel на узбережжі Пафосу (1–8 листопада 2026 року; час закінчення у записі виставлено на 23:59 дати початку). У програмі — денні сети біля басейну з 13:00 до 17:30 та вечірні події у двох залах (Soula Club Room і Mi Casa Es Tu Casa Room) з 21:00 до 02:00 із музикою soul, funk, disco, jazz-funk, soulful house, boogie та R&B. Склад діджеїв: Fatz, Jerry Bascombe, Munch, Vivy B, Victor Anderson, Tony Rodriguez, Patrick, Gerry Lyseight, D.Tee, Cassie Clarke, Mark Wynter, Aitch B та Mistri. Вартість повного тижневого браслета (Wristband Only) — £150 з особи (еквівалент у Lima — €174,89; одноденні або разові перепустки не продаються). Проживання в готелі бронюється окремо на сайті https://venusbeachhotel.com із промокодом SOULASOUL26 (знижка 15%). Контакти організаторів: WhatsApp 07958 318 671, телефон 01992 522 188, email info@soulasoul.com, сайт https://www.soulasoul.com. Координати на сторінці Lima відсутні (null); використано приблизну оцінку за об’єктом Venus Beach Hotel на OpenStreetMap (way/627582857). Квитки та реєстрація: https://ticketlab.co.uk/event/id/36258?utm_source=lima',
     'Venus Beach Hotel, Пафос (у Lima координати відсутні; точку готелю оцінено за OpenStreetMap)',
     'Venus Beach Hotel, Tombs of the Kings Avenue, Paphos, Cyprus',
     'https://lima.events/uploads/events/cd260284-ad31-4cbf-8611-de450d89ba3a.webp',
     '2026-11-01 13:00:00+02'::timestamptz, '2026-11-01 23:59:00+02'::timestamptz,
     34.7796178, 32.4050301, 'Квитки та реєстрація',
     'https://ticketlab.co.uk/event/id/36258?utm_source=lima',
     'https://lima.events/en/events/152',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('The Wellness Village: 2-га річниця центру Lea',
     'THE WELLNESS VILLAGE: Lea''s 2nd Anniversary',
     'Святкування другої річниці жіночого центру велнесу та мистецтв Lea у форматі простору The Wellness Village (15:00–19:30). Подія відкрита для всіх — жінок, чоловіків і дітей. На території працюватимуть тематичні зони: The Sanctuary (короткі сесії від практиків), The Atelier (творчі майстер-класи), The Wisdom Tent (живі бесіди та обговорення), The Agora (маркет місцевих майстрів, натуральної косметики й мистецтва), The Hearth (кава, трав’яні чаї та домашня випічка) і The Nest (дитячий куточок із творчими заняттями й аквагримом). О 18:30 — спільна церемонія до дня народження центру, торт, музика та розіграш подарунків. Вхід вільний, частина активностей може потребувати символічного внеску за матеріали; реєстрація бажана. Деталі та реєстрація: https://www.leawomencenter.com/news-events/lea-2nd-anniversary-wellness-village та https://allevents.in/event/200030573368120?utm_source=lima. Координати наведено за даними джерела як приблизну оцінку в районі Тали.',
     'Lea Women''s Wellness And Arts Center, Тала, Пафос (координата приблизна)',
     'Lea Women''s Wellness And Arts Center, Tala, Paphos, Cyprus',
     'https://lima.events/uploads/events/ad6b4d70-f1de-48fd-b13f-4158f50b0697.webp',
     '2026-11-01 15:00:00+02'::timestamptz, '2026-11-01 23:59:00+02'::timestamptz,
     34.83870865, 32.43475, 'Реєстрація та деталі',
     'https://www.leawomencenter.com/news-events/lea-2nd-anniversary-wellness-village',
     'https://lima.events/en/events/2185',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Караоке з Jim the Music Man (1 листопада)',
     'Karaoke with Jim the music man',
     'Вечір караоке з ведучим Jim the Music Man на вулиці Coral Bay Strip у Пейї. На місці працює кухня; останні замовлення на їжу приймають о 21:00. Конкретну назву бару в описі не зазначено, тому координата є приблизною оцінкою на Coral Bay Strip. Сторінка події: https://allevents.in/event/200030735705646?utm_source=lima',
     'Coral Bay Strip, Пейя (назву закладу не уточнено; координата приблизна)',
     'Coral Bay Strip, Peyia, Cyprus',
     'https://lima.events/uploads/events/b934b2d3-55c0-4de1-88c3-519b6856ace3.webp',
     '2026-11-01 16:00:00+02'::timestamptz, '2026-11-01 23:59:00+02'::timestamptz,
     34.85441, 32.36931, 'Сторінка події',
     'https://allevents.in/event/200030735705646?utm_source=lima',
     'https://lima.events/en/events/2388',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Живий виступ Emma Adler (1 листопада)',
     'Emma Adler Performing Live',
     'Живий вокальний виступ співачки Emma Adler у The Meeting Pub (у полі Location вказано 13 Konstandias Street). Організатори рекомендують заздалегідь бронювати столики. Примітка: у тексті About залишилася стара дата з попереднього анонсу («Sunday 12th April from 6PM»), тоді як у розкладі Schedule вказано 1 листопада 2026 року о 17:00. Координата в Lima (34.74992, 32.46602) вказує на район Колоні, тому використано приблизну оцінку розташування The Meeting Pub у Като-Пафосі (34.758505, 32.416927). Сторінка події: https://allevents.in/event/200030818213400?utm_source=lima',
     '13 Konstandias Street (The Meeting Pub), Като-Пафос (координата приблизна)',
     'Charleys Meeting Pub, Kato Paphos, Cyprus',
     'https://lima.events/uploads/events/bf791e89-b57f-4e66-a523-1df5b9ba54e0.webp',
     '2026-11-01 17:00:00+02'::timestamptz, '2026-11-01 23:59:00+02'::timestamptz,
     34.758505, 32.416927, 'Сторінка події',
     'https://allevents.in/event/200030818213400?utm_source=lima',
     'https://lima.events/en/events/2551',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Sun & Soul Cyprus 2026',
     'Sun & Soul Cyprus 2026',
     'Тижневий музичний відпочинок Sun & Soul на Кіпрі (1–8 листопада 2026 року; час закінчення у записі виставлено на 23:59 дати початку) із програмою soul, R&B, reggae, house та club classics біля басейну й у готельних залах. Конкретну назву готелю в описі не розкрито; координата з джерела (34.74421439, 32.4313447) є приблизною оцінкою в готельній зоні Като-Пафосу. Сторінка події: https://allevents.in/event/200030580007056?utm_source=lima',
     'Sun & Soul Cyprus, Пафос (точний готель не вказано; координата приблизна)',
     'Afroditis Avenue, Kato Paphos, Cyprus',
     'https://lima.events/uploads/events/19f3a71f-4a65-4e67-ba3a-3bef33614d8a.webp',
     '2026-11-01 17:00:00+02'::timestamptz, '2026-11-01 23:59:00+02'::timestamptz,
     34.74421439, 32.4313447, 'Сторінка події',
     'https://allevents.in/event/200030580007056?utm_source=lima',
     'https://lima.events/en/events/2194',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Соматичний ретрит KEHA у Пафосі',
     'KEHA Somatic Retreat in Cyprus - Nov 2026',
     'Семиденний соматичний ретрит KEHA (2–8 листопада 2026 року; час закінчення у записі виставлено на 23:59 дати початку) у форматі all-inclusive на приватній віллі з видом на море в Пафосі. Програма присвячена тілесним практикам, роботі з нервовою системою, емоційному відновленню, руху, диханню, голосовим практикам та інтеграції у малій групі. Усі прийоми їжі від приватного шеф-кухаря та проживання на віллі включені. Запис об’єднує дві дубльовані картки Lima: 2016 (початок о 16:00, орієнтовна точка в Пафосі 34.74786726, 32.42699559) та 2708 (початок о 00:00, поле About порожнє, орієнтовна точка вілли 34.8499908, 32.3822059). Точну адресу приватної вілли публічно не розкрито, тому координати є приблизною оцінкою. Реєстрація та деталі: https://retreat.gerlyto.com/cyprus-2026?utm_source=lima та https://allevents.in/event/200030177053853?utm_source=lima (дубльоване джерело: https://lima.events/en/events/2708)',
     'Private Sea-View Villa, Пафос (точну адресу вілли не розкрито; координата приблизна)',
     'Peyia, Paphos, Cyprus',
     'https://lima.events/uploads/events/adaee890-5f6f-4bd1-86b9-bc881234cfa3.webp',
     '2026-11-02 16:00:00+02'::timestamptz, '2026-11-02 23:59:00+02'::timestamptz,
     34.8499908, 32.3822059, 'Реєстрація та деталі',
     'https://retreat.gerlyto.com/cyprus-2026?utm_source=lima',
     'https://lima.events/en/events/2016',
     '["KEHA Somatic Healing Retreat: 7-Day All-Inclusive in Paphos"]'::jsonb,
     '["https://lima.events/en/events/2708"]'::jsonb,
     '["https://lima.events/uploads/events/6fef0d40-366c-4f34-a9d4-68c6ee8d76ec.webp"]'::jsonb),

    ('Берлінські біти в Berlin Meets (6 листопада)',
     'BERLIN BEATS AT BERLIN MEET',
     'Вечір електронної музики від Techno Island Cyprus у Berlin Meets (Coral Bay, Agiou Georgiou, 8560 Pegeia): techno, tech house, hard techno та schranz у виконанні резидентів і запрошених діджеїв (з 17:00 до півночі). Організатори наголошують на культурі поваги PLUR (Peace, Love, Unity, Respect). Оскільки у Lima вказано загальну точку в центрі Пафосу (34.77201462, 32.42973709), використано приблизну оцінку координат у районі Coral Bay (34.853794, 32.369931). Безкоштовні квитки та реєстрація: https://www.tickettailor.com/events/dietechnologenberlin/2452913 та https://allevents.in/event/80001408329855?utm_source=lima',
     'Berlin Meets, Coral Bay, Пейя (координата приблизна)',
     'Coral Bay, Agiou Georgiou, Pegeia, Cyprus',
     'https://lima.events/uploads/events/f62e5f44-29b3-483d-9a7d-f5105a1f6806.webp',
     '2026-11-06 17:00:00+02'::timestamptz, '2026-11-06 23:59:00+02'::timestamptz,
     34.853794, 32.369931, 'Квитки та реєстрація',
     'https://www.tickettailor.com/events/dietechnologenberlin/2452913',
     'https://lima.events/en/events/2496',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Вечір квізу у The Frog & Toad',
     'QUIZ NIGHT',
     'Вечір вікторини (Quiz Night) у пабі The Frog & Toad у Coral Bay (Пейя). Страви подають із 18:30, початок квізу — о 20:00. Доступне спеціальне меню: картопля фрі з чилі кон карне, беконом або сиром чеддер за €10, а також основне меню. Обов’язкове попереднє бронювання столиків за телефоном 97696916. Координати закладу підтверджено за OpenStreetMap (node/6562897885). Сторінка події: https://allevents.in/event/200030800102146?utm_source=lima',
     'The Frog & Toad, Coral Bay, Пейя',
     'The Frog & Toad, Coral Bay, Peyia, Cyprus',
     'https://lima.events/uploads/events/a9e4dd6a-2e85-4fb1-889b-9eb2545cd117.webp',
     '2026-11-06 18:30:00+02'::timestamptz, '2026-11-06 23:59:00+02'::timestamptz,
     34.8581219, 32.3657229, 'Сторінка події',
     'https://allevents.in/event/200030800102146?utm_source=lima',
     'https://lima.events/en/events/2494',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Караоке з Jim the Music Man (6 листопада)',
     'Karaoke with Jim the music man',
     'Вечір караоке з ведучим Jim the Music Man на вулиці Coral Bay Strip у Пейї. На місці працює кухня; останні замовлення на їжу приймають о 21:00. Конкретну назву бару в описі не зазначено, тому координата є приблизною оцінкою на Coral Bay Strip. Сторінка події: https://allevents.in/event/200030735705544?utm_source=lima',
     'Coral Bay Strip, Пейя (назву закладу не уточнено; координата приблизна)',
     'Coral Bay Strip, Peyia, Cyprus',
     'https://lima.events/uploads/events/03f645ce-fdae-4dff-ad33-c6dd8dc7a191.webp',
     '2026-11-06 20:00:00+02'::timestamptz, '2026-11-06 23:59:00+02'::timestamptz,
     34.85441, 32.36931, 'Сторінка події',
     'https://allevents.in/event/200030735705544?utm_source=lima',
     'https://lima.events/en/events/2389',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('NOX presents NAKADIA у Cliff Social',
     'NOX presents NAKADIA',
     'Перша вечірка нової клубної серії NOX від Techno Island Cyprus на відкритій терасі з видом на море в Cliff Social (1 Kiamil Tozian Street, 8016 Paphos) з 17:00 до 00:00. Хедлайнерка — міжнародна техно-артистка Nakadia (Cocoon, Filth on Acid, Kraftek), яка виступала на сценах Tomorrowland, Watergate, Tresor та Ushuaïa Ibiza; за підтримки локальних діджеїв (3339, Jamø). Кількість місць обмежена до 200 гостей. Запис об’єднує дві дубльовані картки Lima (3023 та 3022), де в картці 3022 вказано вартість квитка €13,55. Координати відповідають вулиці Kiamil Tozian Street у Пафосі (way/5405496 на OpenStreetMap; точний вхід оцінено приблизно). Квитки та реєстрація: https://www.tickettailor.com/events/dietechnologenberlin/2494483, https://ra.co/events/2569048?utm_source=lima та https://allevents.in/event/80001876048114?utm_source=lima (дубльоване джерело: https://lima.events/en/events/3022)',
     'Cliff Social, 1 Kiamil Tozian Street, 8016 Пафос (координата вулиці приблизна)',
     '1 Kiamil Tozian Street, 8016 Paphos, Cyprus',
     'https://lima.events/uploads/events/dbe0b499-f4a1-4e9b-a5bc-e94e5102928f.webp',
     '2026-11-07 17:00:00+02'::timestamptz, '2026-11-07 23:59:00+02'::timestamptz,
     34.7813714, 32.4148374, 'Квитки та реєстрація',
     'https://www.tickettailor.com/events/dietechnologenberlin/2494483',
     'https://lima.events/en/events/3023',
     '["NOX"]'::jsonb,
     '["https://lima.events/en/events/3022"]'::jsonb,
     '["https://lima.events/uploads/events/13d5d6a9-2eda-4d31-b4ee-5bf7018d8d43.webp"]'::jsonb),

    ('Гурт MLC у The Hunter Cafe Bar',
     'MLC @ The Hunter Cafe Bar',
     'Живий виступ рок-гурту MLC (Mid Life Crisis) у The Hunter Cafe Bar у селі Тремітуса з класичними рок-хітами. На місці пропонують бургери та піцу з дров’яної печі. Бронювання столиків рекомендоване за телефоном 26 652576. Координата наведена за даними джерела як приблизна оцінка в центрі Тремітуси. Сторінка події: https://allevents.in/event/200030800149133?utm_source=lima',
     'The Hunter - Cafe Bar, Тремітуса, Пафос (координата приблизна)',
     'The Hunter Cafe Bar, Tremithousa, Paphos, Cyprus',
     'https://lima.events/uploads/events/2c45033e-8346-4f19-a2b0-0323d072fab7.webp',
     '2026-11-07 20:30:00+02'::timestamptz, '2026-11-07 23:59:00+02'::timestamptz,
     34.81648253, 32.44581343, 'Сторінка події',
     'https://allevents.in/event/200030800149133?utm_source=lima',
     'https://lima.events/en/events/2495',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Кіпр. Оксамитовий сезон',
     'Кіпр. Оксамитовий сезон',
     'Опис (поле About) на сторінці Lima відсутній. У розкладі зазначено початок 12 листопада 2026 року о 13:00 та завершення 19 листопада о 09:00 (час закінчення у записі виставлено на 23:59 дати початку). У полі Location вказано лише «Кипр» без конкретної адреси чи закладу, тому координата з джерела (34.78043414, 32.52769165) є лише умовною приблизною оцінкою. Сторінка події: https://allevents.in/event/200030907545716?utm_source=lima',
     'Кіпр (точне місце не вказано; координата приблизна)',
     'Paphos District, Cyprus',
     'https://lima.events/uploads/events/ebf4c82d-e6a4-4119-a595-e9cc344daa9e.webp',
     '2026-11-12 13:00:00+02'::timestamptz, '2026-11-12 23:59:00+02'::timestamptz,
     34.78043414, 32.52769165, 'Сторінка події',
     'https://allevents.in/event/200030907545716?utm_source=lima',
     'https://lima.events/en/events/3024',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Різдвяний модний показ La Rimell',
     'La Rimell Christmas Fashion Show',
     'Різдвяний модний показ та обід від бутику La Rimell у банкетному комплексі Monte Liza Venue у Месогі (Пафос). Вартість квитка — €30, куди входить святковий буфет (різдвяна індичка та шинка у медовій глазурі). Квитки обов’язкові й продаються в магазині La Rimell у Корал-Бей; подія щороку збирає повний зал, тому організатори радять купувати квитки заздалегідь. Координати закладу Monte Liza підтверджено за OpenStreetMap (node/4317463889). Сторінка події: https://allevents.in/event/200030772558004?utm_source=lima',
     'Monte Liza, Месогі, Пафос',
     'Monte Liza, Mesogi, Paphos, Cyprus',
     'https://lima.events/uploads/events/ad72da4e-d346-412b-967e-f9e38ebe1a27.webp',
     '2026-11-13 12:00:00+02'::timestamptz, '2026-11-13 23:59:00+02'::timestamptz,
     34.8029601, 32.4436588, 'Сторінка події',
     'https://allevents.in/event/200030772558004?utm_source=lima',
     'https://lima.events/en/events/2466',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Вистава «Червона літера» (18/11)',
     'ΤΟ ΚΟΚΚΙΝΟ ΓΡΑΜΜΑ (18/11)',
     'Опис (поле About) на сторінці Lima відсутній. Подія із заголовком «ΤΟ ΚΟΚΚΙΝΟ ΓΡΑΜΜΑ (18/11)» («Червона літера») відбудеться у муніципальному театрі Маркідейо в Пафосі 18 листопада 2026 року о 20:00. Координати будівлі театру підтверджено за OpenStreetMap (way/824979277). Квитки: https://www.ticketmaster.cy/showEventInformation.html?idEvent=7787&utm_source=lima',
     'Театр Маркідейо (Μαρκίδειο Θέατρο Πάφου), Пафос',
     'Markideio Theatre, Paphos, Cyprus',
     'https://lima.events/uploads/events/d069facd-8f89-4fa8-ad07-32d221d697ac.webp',
     '2026-11-18 20:00:00+02'::timestamptz, '2026-11-18 23:59:00+02'::timestamptz,
     34.7781667, 32.4231959, 'Квитки',
     'https://www.ticketmaster.cy/showEventInformation.html?idEvent=7787&utm_source=lima',
     'https://lima.events/en/events/2941',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('6-й Глобальний конгрес регенеративної медицини в Пафосі',
     '6th Global Regenerative Congress, Paphos, Cyprus — Nov 20–22, 2026.',
     'Шостий Глобальний конгрес регенеративної медицини (6th Global Regenerative Congress) у Пафосі 20–22 листопада 2026 року (час закінчення у записі виставлено на 23:59 дати початку). Тема заходу — «Регенеративна медицина нового покоління: від клітинних інновацій до клінічного застосування» (біотехнології, клітинна терапія, регенеративна естетика, довголіття та жіноче здоров’я). У програмі — виступи понад 20 міжнародних спікерів, панельні дискусії, клінічні кейси та нетворкінг для лікарів і дослідників. Конкретний готель або конгрес-центр у полі Location не названо («Paphos, Paphos, Cyprus»), тому координата з джерела (34.75364468, 32.40693548) є приблизною оцінкою. Реєстрація та квитки: https://allevents.in/event/200030903665051?utm_source=lima',
     'Пафос (конкретний конгрес-центр не вказано; координата приблизна)',
     'Paphos Harbour, Paphos, Cyprus',
     'https://lima.events/uploads/events/e4aad475-e206-4bd6-ad6b-56b24b56c168.webp',
     '2026-11-20 08:00:00+02'::timestamptz, '2026-11-20 23:59:00+02'::timestamptz,
     34.75364468, 32.40693548, 'Реєстрація та квитки',
     'https://allevents.in/event/200030903665051?utm_source=lima',
     'https://lima.events/en/events/3018',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Різдвяне містечко в Статос-Агіос-Фотіос 2026: програма',
     'Statos-Agios Fotios Christmas Village 2026: Programme',
     'Опис (поле About) на сторінці Lima відсутній. Святкова програма різдвяного містечка на площі села Статос-Агіос-Фотіос у гірському районі Пафосу (у розкладі вказано період із 21 листопада до 20 грудня 2026 року; час закінчення у записі виставлено на 23:59 дати початку). Координата відповідає центральній частині села Статос-Агіос-Фотіос і є приблизною оцінкою площі. Деталі програми: https://rsrvin.com/events/6acb76e8ad6fdbadb544f305-Statos-Agios%20Fotios%20Christmas%20Village%202026%3A%20Programme?utm_source=lima',
     'Центральна площа села Статос-Агіос-Фотіос (координата приблизна)',
     'Statos-Agios Fotios Village Square, Paphos District, Cyprus',
     'https://lima.events/uploads/events/573ff45d-9304-4470-a687-e1714b04eeaf.webp',
     '2026-11-21 00:00:00+02'::timestamptz, '2026-11-21 23:59:00+02'::timestamptz,
     34.8842607, 32.620206, 'Деталі програми',
     'https://rsrvin.com/events/6acb76e8ad6fdbadb544f305-Statos-Agios%20Fotios%20Christmas%20Village%202026%3A%20Programme?utm_source=lima',
     'https://lima.events/en/events/2740',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Міжнародний зимовий ярмарок 2026 у Міжнародній школі Пафосу',
     'International Winter Fair 2026',
     'Щорічний міжнародний зимовий ярмарок у внутрішньому дворі та атріумі Міжнародної школи Пафосу (The International School of Paphos, 100 Aristotelous Savva Avenue, 8060 Paphos) з 11:00 до 17:00. У програмі — ятки з виробами ручної роботи, випічкою, книжками та подарунками, живі музичні й танцювальні виступи, активності для дітей та візит Санти, а також страви традиційної кіпрської та міжнародної кухні, глінтвейн і гарячий шоколад. Охочі орендувати ятку можуть заповнити форму до п’ятниці 6 листопада 2026 року (https://forms.office.com/e/qE3sX2sR1S); контакти: info@isop-ed.org, +357 26821700. Координати уточнено за кампусом школи на OpenStreetMap (way/301706722), оскільки початкова точка у Lima (34.88249, 32.37789) вказувала на інший район. Сторінка події: https://allevents.in/event/200030829817837?utm_source=lima',
     'The International School of Paphos, 100 Aristotelous Savva Avenue, 8060 Пафос',
     'The International School of Paphos, 100 Aristotelous Savva Avenue, Paphos, Cyprus',
     'https://lima.events/uploads/events/11e967a4-c309-4943-bf8f-2f9e784ed6f3.webp',
     '2026-11-21 11:00:00+02'::timestamptz, '2026-11-21 23:59:00+02'::timestamptz,
     34.7999293, 32.4506315, 'Сторінка події',
     'https://allevents.in/event/200030829817837?utm_source=lima',
     'https://lima.events/en/events/2771',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Берлінські біти в Berlin Meets (27 листопада)',
     'BERLIN BEATS AT BERLIN MEET',
     'Вечір електронної музики від Techno Island Cyprus у Berlin Meets (Coral Bay, Agiou Georgiou, 8560 Pegeia): techno, tech house, hard techno та schranz у виконанні змінного складу діджеїв (з 17:00 до півночі). Подія проходить за принципами спільноти PLUR (Peace, Love, Unity, Respect). Оскільки у Lima вказано загальну точку в центрі Пафосу (34.77201462, 32.42973709), використано приблизну оцінку координат у районі Coral Bay (34.853794, 32.369931). Безкоштовні квитки та реєстрація: https://www.tickettailor.com/events/dietechnologenberlin/2452913 та https://allevents.in/event/80003815508544?utm_source=lima',
     'Berlin Meets, Coral Bay, Пейя (координата приблизна)',
     'Coral Bay, Agiou Georgiou, Pegeia, Cyprus',
     'https://lima.events/uploads/events/ea0f79f8-d5a5-4f1a-a0e2-209fa868c375.webp',
     '2026-11-27 17:00:00+02'::timestamptz, '2026-11-27 23:59:00+02'::timestamptz,
     34.853794, 32.369931, 'Квитки та реєстрація',
     'https://www.tickettailor.com/events/dietechnologenberlin/2452913',
     'https://lima.events/en/events/2497',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Гурт MLC у The Frog & Toad',
     'MLC at The Frog & Toad',
     'Тригодинний живий виступ рок-гурту MLC (Mid Life Crisis) із класикою року у пабі The Frog & Toad у Coral Bay (Пейя). Страви подають із 14:00 до 17:00, початок музичної програми — о 15:00 (у полі Schedule вказано 14:00). Організатори радять бронювати столики заздалегідь. Координати закладу підтверджено за OpenStreetMap (node/6562897885). Сторінка події: https://allevents.in/event/200030636763600?utm_source=lima',
     'The Frog & Toad, Coral Bay, Пейя',
     'The Frog & Toad, Coral Bay, Peyia, Cyprus',
     'https://lima.events/uploads/events/f66daca0-84f4-4f60-9e51-e69d6f9ba3ba.webp',
     '2026-11-28 14:00:00+02'::timestamptz, '2026-11-28 23:59:00+02'::timestamptz,
     34.8581219, 32.3657229, 'Сторінка події',
     'https://allevents.in/event/200030636763600?utm_source=lima',
     'https://lima.events/en/events/2267',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    ('Вечірка закриття сезону на Sandy Beach',
     'CLOSING PARTY SANDY BEACH',
     'Вечірка закриття сезону у пляжному барі Sandy Beach (Пафос) з 16:00 до 22:00 із сетами електронної музики на заході сонця біля моря. Склад діджеїв: 16:00–18:00 — Paul Angelo & Don Argento; 18:00–20:00 — The Professor (tribute-сет пам’яті Paul Trouble Anderson); 20:00–22:00 — Jenia. Вхід вільний, бронювання не потрібне. Оскільки координати у Lima округлені до двох знаків після коми (34.81, 32.41), використано приблизну оцінку за пляжем Sandy Beach (Kotsia Beach) на OpenStreetMap (way/137702796, 34.8131207, 32.3937833). Квитки та деталі: https://ra.co/events/2566219?utm_source=lima',
     'Sandy Beach, Пафос (координата приблизна)',
     'Sandy Beach, Lempa, Paphos, Cyprus',
     'https://lima.events/uploads/events/17abd582-51bb-45e1-aecb-bf5504a5f4a1.webp',
     '2026-11-28 16:00:00+02'::timestamptz, '2026-11-28 23:59:00+02'::timestamptz,
     34.8131207, 32.3937833, 'Квитки та деталі',
     'https://ra.co/events/2566219?utm_source=lima',
     'https://lima.events/en/events/2858',
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
),
deduped_rows AS (
    SELECT
        source_rows.*,
        row_number() OVER (
            PARTITION BY lower(btrim(source_rows.title))
            ORDER BY source_rows.starts_at, source_rows.source_url
        ) AS title_rank,
        row_number() OVER (
            PARTITION BY source_rows.source_url
            ORDER BY source_rows.starts_at
        ) AS source_url_rank,
        row_number() OVER (
            PARTITION BY source_rows.image_url
            ORDER BY source_rows.starts_at
        ) AS image_url_rank
    FROM source_rows
)
INSERT INTO social_events (
    owner_id, description, event_type, image_urls, drink, visibility,
    latitude, longitude, location, photo_key, starts_at, expires_at,
    capacity, hidden
)
SELECT
    settings.owner_id,
    concat_ws(
        E'\n\n',
        deduped_rows.summary,
        'Місце: ' || deduped_rows.venue,
        'Google Maps: https://www.google.com/maps/search/?api=1&query='
            || replace(deduped_rows.map_query, ' ', '+'),
        CASE WHEN deduped_rows.resource_url IS NOT NULL
            THEN deduped_rows.resource_label || ': ' || deduped_rows.resource_url END,
        'Джерело: ' || deduped_rows.source_url
    ),
    'global',
    jsonb_build_array(deduped_rows.image_url),
    'spirits',
    'public',
    deduped_rows.latitude,
    deduped_rows.longitude,
    deduped_rows.title,
    NULL,
    deduped_rows.starts_at,
    deduped_rows.expires_at,
    NULL,
    FALSE
FROM deduped_rows
CROSS JOIN settings
WHERE deduped_rows.title_rank = 1
  AND deduped_rows.source_url_rank = 1
  AND deduped_rows.image_url_rank = 1
  AND NOT EXISTS (
      SELECT 1
      FROM social_events AS existing
      WHERE existing.event_type = 'global'
        AND (
            lower(btrim(existing.location)) IN (
                lower(btrim(deduped_rows.title)),
                lower(btrim(deduped_rows.original_title))
            )
            OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(deduped_rows.alias_titles) AS alias(title)
                WHERE lower(btrim(existing.location)) = lower(btrim(alias.title))
            )
            OR strpos(existing.description, deduped_rows.source_url) > 0
            OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(deduped_rows.alias_source_urls) AS alias(url)
                WHERE strpos(existing.description, alias.url) > 0
            )
            OR existing.image_urls @> jsonb_build_array(deduped_rows.image_url)
            OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(deduped_rows.alias_image_urls) AS alias(img)
                WHERE existing.image_urls @> jsonb_build_array(alias.img)
            )
        )
  );

COMMIT;
