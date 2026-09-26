BEGIN;

CREATE TABLE IF NOT EXISTS infographics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('chart', 'timeline', 'map_overlay')),
    schema_data jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE infographics
    ADD COLUMN IF NOT EXISTS distillery_id integer REFERENCES distilleries(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ix_infographics_distillery_id_unique
    ON infographics (distillery_id);

DO $seed$
DECLARE
    talisker_id integer;
    timeline jsonb := $talisker_data$
{
  "steps": [
    {
      "id": "founding-1830",
      "badge": null,
      "title": {
        "en": "Official founding",
        "ru": "Официальное основание",
        "uk": "Офіційне заснування"
      },
      "subtitle": "",
      "dateOrYear": "1830",
      "description": {
        "en": "Hugh and Kenneth MacAskill officially found the distillery in Carbost on the shores of Loch Harport.",
        "ru": "Официальное основание винокурни братьями Хью и Кеннетом МакАскиллами в посёлке Карбост на берегу залива Лох-Харпорт.",
        "uk": "Офіційне заснування винокурні братами Х'ю та Кеннетом МакАскіллами у селищі Карбост на березі затоки Лох-Харпорт."
      }
    },
    {
      "id": "bank-control-1848",
      "badge": null,
      "title": {
        "en": "Financial distress & bank control",
        "ru": "Переход под контроль банка",
        "uk": "Перехід під контроль банку"
      },
      "subtitle": "",
      "dateOrYear": "1848",
      "description": {
        "en": "Financial difficulties force management to transfer to North of Scotland Bank, and later to Donald MacLennan.",
        "ru": "Из-за финансовых трудностей управление переходит к North of Scotland Bank, а затем к Дональду МакЛеннану.",
        "uk": "Через фінансові труднощі управління переходить до North of Scotland Bank, а згодом до Дональда МакЛеннана."
      }
    },
    {
      "id": "kemp-allan-1880",
      "badge": null,
      "title": {
        "en": "Kemp & Allan acquisition",
        "ru": "Покупка Кемпом и Алланом",
        "uk": "Купівля Кемпом та Алланом"
      },
      "subtitle": "",
      "dateOrYear": "1880",
      "description": {
        "en": "Roderick Kemp and Alexander Allan purchase Talisker. Kemp later buys Macallan, while Allan modernizes the distillery.",
        "ru": "Покупка винокурни Родериком Кемпом и Александром Алланом. Позже Кемп приобретает Macallan, а Аллан проводит модернизацию.",
        "uk": "Купівля винокурні Родериком Кемпом та Александром Алланом. Пізніше Кемп купує Macallan, а Аллан проводить модернізацію."
      }
    },
    {
      "id": "dailuaine-merger-1898",
      "badge": null,
      "title": {
        "en": "Dailuaine merger & pier",
        "ru": "Слияние с Dailuaine и пирс",
        "uk": "Злиття з Dailuaine та пірс"
      },
      "subtitle": "",
      "dateOrYear": "1898",
      "description": {
        "en": "Merger with Dailuaine forms Dailuaine-Talisker Distillers Ltd. A dedicated pier is constructed in Carbost for transport.",
        "ru": "Слияние с Dailuaine и создание Dailuaine-Talisker Distillers Ltd. В Карбосте строится собственный пирс для транспортировки.",
        "uk": "Злиття з Dailuaine та створення Dailuaine-Talisker Distillers Ltd. У Карбості будується власний пірс для транспортування."
      }
    },
    {
      "id": "dcl-1925",
      "badge": null,
      "title": {
        "en": "Joining DCL",
        "ru": "Вхождение в DCL",
        "uk": "Входження до DCL"
      },
      "subtitle": "",
      "dateOrYear": "1925",
      "description": {
        "en": "Dailuaine-Talisker joins Distillers Company Limited (DCL, predecessor to modern-day Diageo).",
        "ru": "Dailuaine-Talisker входит в состав концерна DCL (предшественника современного гиганта Diageo).",
        "uk": "Dailuaine-Talisker входить до складу концерну DCL (попередника сучасного гіганта Diageo)."
      }
    },
    {
      "id": "stills-switch-1928",
      "badge": null,
      "title": {
        "en": "Unique 5-still distillation system",
        "ru": "Новая схема дистилляции",
        "uk": "Нова схема дистиляції"
      },
      "subtitle": "",
      "dateOrYear": "1928",
      "description": {
        "en": "Triple distillation is replaced by an asymmetrical 5-still system with traditional worm tubs, creating Talisker's signature peppery profile.",
        "ru": "Отказ от тройной дистилляции в пользу асимметричной системы из 5 кубов с внешними змеевиками, создающей «перечный» профиль.",
        "uk": "Відмова від потрійної дистиляції на користь асиметричної системи з 5 кубів із зовнішніми змійовиками, що створює «перцевий» профіль."
      }
    },
    {
      "id": "fire-1960",
      "badge": null,
      "title": {
        "en": "Disastrous stillhouse fire",
        "ru": "Разрушительный пожар",
        "uk": "Руйнівна пожежа"
      },
      "subtitle": "",
      "dateOrYear": "1960",
      "description": {
        "en": "On 22 November, a spirit leak causes a catastrophic fire that completely destroys the stillhouse.",
        "ru": "22 ноября 1960 года из-за утечки спирта полностью сгорает перегонный цех (stillhouse).",
        "uk": "22 листопада 1960 року через витік спирту повністю згоряє перегонний цех (stillhouse)."
      }
    },
    {
      "id": "rebuilding-1962",
      "badge": null,
      "title": {
        "en": "Rebuilding exact replicas",
        "ru": "Восстановление кубов",
        "uk": "Відновлення кубів"
      },
      "subtitle": "",
      "dateOrYear": "1962",
      "description": {
        "en": "Distillery reopens with exact replicas of all 5 stills, preserving their u-bend pipes and worm tubs to safeguard the flavor.",
        "ru": "Возобновление работы. Все 5 кубов воссоздаются в точнейших копиях с u-bend трубами и змеевиками, чтобы сохранить вкус.",
        "uk": "Відновлення роботи. Усі 5 кубів відтворюються у точних копіях із u-bend трубами та змійовиками, щоб зберегти смак."
      }
    },
    {
      "id": "floor-maltings-1972",
      "badge": null,
      "title": {
        "en": "Floor maltings closure",
        "ru": "Закрытие солодовен",
        "uk": "Закриття солодорень"
      },
      "subtitle": "",
      "dateOrYear": "1972",
      "description": {
        "en": "On-site floor maltings close, with peated malt supply shifting to the centralized Glen Ord maltings.",
        "ru": "Закрытие собственных напольных солодовен. Винокурня переходит на закупку торфяного ячменя с солодовни Глен-Орд.",
        "uk": "Закриття власних підлогових солодорень. Винокурня переходить на закупівлю торф'яного ячменю із солодорні Ґлен-Орд."
      }
    },
    {
      "id": "classic-malts-1988",
      "badge": null,
      "title": {
        "en": "Classic Malts & Made by the Sea",
        "ru": "Classic Malts и Made by the Sea",
        "uk": "Classic Malts та Made by the Sea"
      },
      "subtitle": "",
      "dateOrYear": "1988",
      "description": {
        "en": "Talisker 10 Year Old is selected for the original Classic Malts of Scotland, establishing the 'Made by the Sea' slogan.",
        "ru": "Talisker 10 YO входит в число Classic Malts of Scotland, что приносит мировую славу и слоган «Made by the Sea».",
        "uk": "Talisker 10 YO входить до складу Classic Malts of Scotland, що приносить світову славу та слоган «Made by the Sea»."
      }
    },
    {
      "id": "distillers-edition-1998",
      "badge": null,
      "title": {
        "en": "Distillers Edition debut",
        "ru": "Дебют Distillers Edition",
        "uk": "Дебют Distillers Edition"
      },
      "subtitle": "",
      "dateOrYear": "1998",
      "description": {
        "en": "Debut of the popular Talisker Distillers Edition, finished in sweet Amoroso sherry casks.",
        "ru": "Дебют популярной серии Talisker Distillers Edition с финишной довыдержкой в бочках из-под испанского вина Amoroso.",
        "uk": "Дебют популярної серії Talisker Distillers Edition з фінішною довитримкою у бочках з-під іспанського вина Amoroso."
      }
    },
    {
      "id": "eighteen-yo-2004-2007",
      "badge": null,
      "title": {
        "en": "Talisker 18 YO World's Best",
        "ru": "Talisker 18 YO — Лучший в мире",
        "uk": "Talisker 18 YO — Найкращий у світі"
      },
      "subtitle": "",
      "dateOrYear": "2004–2007",
      "description": {
        "en": "Release of Talisker 18 Year Old, which wins World's Best Single Malt at the World Whiskies Awards in 2007.",
        "ru": "Выпуск Talisker 18 Year Old, завоевавшего в 2007 году титул «World's Best Single Malt» на World Whiskies Awards.",
        "uk": "Випуск Talisker 18 Year Old, що здобув у 2007 році титул «World's Best Single Malt» на World Whiskies Awards."
      }
    },
    {
      "id": "nas-releases-2013-2015",
      "badge": null,
      "title": {
        "en": "NAS releases era",
        "ru": "Эра релизов без возраста",
        "uk": "Ера релізів без віку"
      },
      "subtitle": "",
      "dateOrYear": "2013–2015",
      "description": {
        "en": "Launch of successful No Age Statement (NAS) expressions, including Talisker Storm, Port Ruighe, and 57° North.",
        "ru": "Запуск успешных релизов без указания возраста (NAS): Talisker Storm, Port Ruighe и высокоградусного 57° North.",
        "uk": "Запуск успішних релізів без вказівки віку (NAS): Talisker Storm, Port Ruighe та високоградусного 57° North."
      }
    },
    {
      "id": "parley-partnership-2020",
      "badge": null,
      "title": {
        "en": "Parley for the Oceans partnership",
        "ru": "Партнёрство с Parley for the Oceans",
        "uk": "Партнерство з Parley for the Oceans"
      },
      "subtitle": "",
      "dateOrYear": "2020",
      "description": {
        "en": "Global environmental partnership with Parley for the Oceans to protect and restore marine kelp forests and ocean ecosystems.",
        "ru": "Начало экологического партнёрства с Parley for the Oceans для защиты и восстановления подводных лесов ламинарии.",
        "uk": "Початок екологічного партнерства з Parley for the Oceans для захисту та відновлення підводних лісів ламінарії."
      }
    },
    {
      "id": "visitor-centre-2022",
      "badge": null,
      "title": {
        "en": "New Visitor Centre in Carbost",
        "ru": "Обновлённый Visitor Centre",
        "uk": "Оновлений Visitor Centre"
      },
      "subtitle": "",
      "dateOrYear": "2022",
      "description": {
        "en": "Opening of the state-of-the-art Visitor Centre in Carbost as part of Diageo's £185m investment in Scottish whisky tourism.",
        "ru": "Открытие ультрасовременного центра посетителей в Карбосте в рамках инвестиционной программы Diageo (£185 млн).",
        "uk": "Відкриття ультрасучасного центру відвідувачів у Карбості в рамках інвестиційної програми Diageo (£185 млн)."
      }
    },
    {
      "id": "xpedition-oak-2023-2024",
      "badge": null,
      "title": {
        "en": "Xpedition Oak ultra-premiums",
        "ru": "Серия Xpedition Oak",
        "uk": "Серія Xpedition Oak"
      },
      "subtitle": "",
      "dateOrYear": "2023–2024",
      "description": {
        "en": "Release of ultra-premium Xpedition Oak expressions (Talisker 44 YO Glacial Edge, 45 YO) matured in ocean-exposed casks.",
        "ru": "Выпуск премиальной серии Xpedition Oak (Talisker 44 YO, 45 YO) в бочках, подвергшихся воздействию морских стихий.",
        "uk": "Випуск преміальної серії Xpedition Oak (Talisker 44 YO, 45 YO) у бочках, що зазнали впливу морських стихій."
      }
    },
    {
      "id": "skye-icon-2025-2026",
      "badge": null,
      "title": {
        "en": "Icon of Skye",
        "ru": "Икона острова Скай",
        "uk": "Ікона острова Скай"
      },
      "subtitle": "",
      "dateOrYear": "2025–2026",
      "description": {
        "en": "Talisker maintains its status as Skye's historic distillery, renowned worldwide for its maritime peppery-peat style.",
        "ru": "Talisker сохраняет статус единственной исторической винокурни острова Скай и флагмана морского торфяно-перечного стиля.",
        "uk": "Talisker зберігає статус єдиної історичної винокурні острова Скай та флагмана морського торф'яно-перцевого стилю."
      }
    }
  ]
}
$talisker_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT talisker_id
    FROM distilleries
    WHERE lower(trim(name)) = 'talisker';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 17 THEN
        RAISE EXCEPTION 'Expected 17 Talisker timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = talisker_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Talisker already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Talisker History', 'timeline', timeline, talisker_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'talisker';
