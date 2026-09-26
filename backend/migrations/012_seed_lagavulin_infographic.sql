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
    lagavulin_id integer;
    timeline jsonb := $lagavulin_data$
{
  "steps": [
    {
      "id": "illicit-stills-1742",
      "badge": null,
      "title": {
        "en": "Illicit distilling in Lagavulin Bay",
        "ru": "Первые подпольные кубы",
        "uk": "Перші підпільні куби"
      },
      "subtitle": "",
      "dateOrYear": "1742",
      "description": {
        "en": "First documented records of illicit whisky distilling in Lagavulin Bay, where at least 10 illegal stills were operating.",
        "ru": "Первые документальные упоминания о нелегальном производстве виски в бухте Лагавулин (не менее 10 подпольных кубов).",
        "uk": "Перші документальні згадки про нелегальне виробництво віскі у бухті Лагавулін (щонайменше 10 підпільних кубів)."
      }
    },
    {
      "id": "johnston-1816",
      "badge": null,
      "title": {
        "en": "Lagavulin officially founded",
        "ru": "Официальное основание Lagavulin",
        "uk": "Офіційне заснування Lagavulin"
      },
      "subtitle": "",
      "dateOrYear": "1816",
      "description": {
        "en": "Local farmer John Johnston founds the first official legal Lagavulin distillery (meaning 'Hollow by the mill' in Gaelic).",
        "ru": "Местный фермер Джон Джонстон основывает первую официальную легальную винокурню Lagavulin («Лощина возле мельницы»).",
        "uk": "Місцевий фермер Джон Джонстон засновує першу офіційну легальну винокурню Lagavulin («Улоговина біля млина»)."
      }
    },
    {
      "id": "ardmore-1817",
      "badge": null,
      "title": {
        "en": "Ardmore distillery built",
        "ru": "Строительство соседей Ardmore",
        "uk": "Будівництво сусідів Ardmore"
      },
      "subtitle": "",
      "dateOrYear": "1817",
      "description": {
        "en": "Archibald Campbell builds a second legal distillery, Ardmore, nearby.",
        "ru": "Арчибальд Кэмпбелл строит по соседству вторую легальную винокурню — Ardmore.",
        "uk": "Арчібальд Кемпбелл будує по сусідству другу легальну винокурню — Ardmore."
      }
    },
    {
      "id": "merger-1825",
      "badge": null,
      "title": {
        "en": "Merger with Ardmore",
        "ru": "Объединение с Ardmore",
        "uk": "Об'єднання з Ardmore"
      },
      "subtitle": "",
      "dateOrYear": "1825",
      "description": {
        "en": "John Johnston buys neighboring Ardmore, merging both distilleries into the single Lagavulin complex.",
        "ru": "Джон Джонстон выкупает соседнее производство Ardmore и объединяет заводы в единый комплекс Lagavulin.",
        "uk": "Джон Джонстон викуповує сусіднє виробництво Ardmore та об'єднує заводи у єдиний комплекс Lagavulin."
      }
    },
    {
      "id": "graham-1836",
      "badge": null,
      "title": {
        "en": "Alexander Graham acquisition",
        "ru": "Покупка Александром Грэмом",
        "uk": "Купівля Александром Ґремом"
      },
      "subtitle": "",
      "dateOrYear": "1836",
      "description": {
        "en": "Following Johnston's death, Glasgow whisky merchant Alexander Graham acquires the distillery.",
        "ru": "После смерти Джонстона винокурню приобретает торговец виски из Глазго Александр Грэм.",
        "uk": "Після смерті Джонстона винокурню купує торговець віскі з Ґлазго Александр Ґрем."
      }
    },
    {
      "id": "mackie-1852",
      "badge": null,
      "title": {
        "en": "James Logan Mackie & Co.",
        "ru": "Приход James Logan Mackie & Co.",
        "uk": "Прихід James Logan Mackie & Co."
      },
      "subtitle": "",
      "dateOrYear": "1852",
      "description": {
        "en": "Management of Lagavulin transfers to James Logan Mackie & Co.",
        "ru": "Управление винокурней переходит к компании James Logan Mackie & Co.",
        "uk": "Управління винокурнею переходить до компанії James Logan Mackie & Co."
      }
    },
    {
      "id": "peter-mackie-1862",
      "badge": null,
      "title": {
        "en": "Peter Mackie arrives",
        "ru": "Приход Питера Макки",
        "uk": "Прихід Пітера Маккі"
      },
      "subtitle": "",
      "dateOrYear": "1862",
      "description": {
        "en": "Peter Mackie, nephew of James Logan Mackie, joins the distillery; he later creates the famous White Horse blend.",
        "ru": "На винокурню приходит Питер Макки, племянник Джеймса Логана Макки и будущий создатель купажа White Horse.",
        "uk": "На винокурню приходить Пітер Маккі, племінник Джеймса Логана Маккі та майбутній творець купажу White Horse."
      }
    },
    {
      "id": "malt-mill-1908",
      "badge": null,
      "title": {
        "en": "Malt Mill distillery built",
        "ru": "Легендарная Malt Mill",
        "uk": "Легендарна Malt Mill"
      },
      "subtitle": "",
      "dateOrYear": "1908",
      "description": {
        "en": "Peter Mackie builds Malt Mill within Lagavulin to replicate Laphroaig; it operates until 1962 as a collector's legend.",
        "ru": "Питер Макки строит отдельную мини-винокурню Malt Mill, чтобы повторить стиль Laphroaig. Она проработала до 1962 года.",
        "uk": "Пітер Маккі будує окрему міні-винокурню Malt Mill, щоб відтворити стиль Laphroaig. Вона пропрацювала до 1962 року."
      }
    },
    {
      "id": "white-horse-dcl-1927",
      "badge": null,
      "title": {
        "en": "White Horse & DCL",
        "ru": "White Horse и вхождение в DCL",
        "uk": "White Horse та входження до DCL"
      },
      "subtitle": "",
      "dateOrYear": "1927",
      "description": {
        "en": "Mackie & Co. renames to White Horse Distillers, later joining The Distillers Company Limited (DCL, predecessor to Diageo).",
        "ru": "Mackie & Co. переименовывается в White Horse Distillers и позже входит в состав DCL (предшественника Diageo).",
        "uk": "Mackie & Co. перейменовується на White Horse Distillers і пізніше входить до складу DCL (попередника Diageo)."
      }
    },
    {
      "id": "floor-maltings-1974",
      "badge": null,
      "title": {
        "en": "Floor maltings close",
        "ru": "Закрытие напольных солодовен",
        "uk": "Закриття підлогових солодорень"
      },
      "subtitle": "",
      "dateOrYear": "1974",
      "description": {
        "en": "Floor maltings cease at Lagavulin; peated malt supplies shift to Port Ellen Maltings.",
        "ru": "Напольные солодовни закрываются; Лагавулин начинает получать торфяной ячмень из солодовни Порт-Эллен.",
        "uk": "Підлогові солодорні закриваються; Лагавулін починає отримувати торф'яний ячмінь із солодорні Порт-Еллен."
      }
    },
    {
      "id": "classic-malts-1988",
      "badge": null,
      "title": {
        "en": "Classic Malts & Lagavulin 16",
        "ru": "Classic Malts и Lagavulin 16",
        "uk": "Classic Malts та Lagavulin 16"
      },
      "subtitle": "",
      "dateOrYear": "1988",
      "description": {
        "en": "Lagavulin 16 Year Old is selected for the Classic Malts of Scotland series, propelling the brand to worldwide fame.",
        "ru": "Lagavulin 16 YO входит в легендарную серию Classic Malts of Scotland, что приносит винокурне мировую славу.",
        "uk": "Lagavulin 16 YO входить до легендарної серії Classic Malts of Scotland, що приносить винокурні світову славу."
      }
    },
    {
      "id": "distillers-edition-1997",
      "badge": null,
      "title": {
        "en": "Distillers Edition debut",
        "ru": "Дебют Distillers Edition",
        "uk": "Дебют Distillers Edition"
      },
      "subtitle": "",
      "dateOrYear": "1997",
      "description": {
        "en": "Debut of the annual Distillers Edition finished in sweet Pedro Ximénez (PX) sherry casks.",
        "ru": "Дебют ежегодного релиза Distillers Edition с финишной довыдержкой в бочках из-под хереса Pedro Ximénez (PX).",
        "uk": "Дебют щорічного релізу Distillers Edition з фінішною довитримкою у бочках з-під хересу Pedro Ximénez (PX)."
      }
    },
    {
      "id": "twelve-cask-strength-2002",
      "badge": null,
      "title": {
        "en": "Lagavulin 12 Cask Strength",
        "ru": "Lagavulin 12 Cask Strength",
        "uk": "Lagavulin 12 Cask Strength"
      },
      "subtitle": "",
      "dateOrYear": "2002",
      "description": {
        "en": "Launch of the iconic Lagavulin 12 Year Old Cask Strength range as part of Diageo Special Releases.",
        "ru": "Запуск культовой серии Lagavulin 12 Year Old Cask Strength в рамках релизов Diageo Special Releases.",
        "uk": "Запуск культової серії Lagavulin 12 Year Old Cask Strength у рамках релізів Diageo Special Releases."
      }
    },
    {
      "id": "bicentenary-eightyo-2016",
      "badge": null,
      "title": {
        "en": "Bicentenary & Lagavulin 8 YO",
        "ru": "200-летие и Lagavulin 8 YO",
        "uk": "200-річчя та Lagavulin 8 YO"
      },
      "subtitle": "",
      "dateOrYear": "2016",
      "description": {
        "en": "Bicentenary celebration marked by Lagavulin 8 Year Old, which becomes a permanent core expression due to huge demand.",
        "ru": "К 200-летию выпускается Lagavulin 8 Year Old (в честь Альфреда Барнарда), вошедший в постоянную линейку из-за огромного успеха.",
        "uk": "До 200-річчя випускається Lagavulin 8 Year Old (на честь Альфреда Барнарда), що увійшов до постійної лінійки через великий успіх."
      }
    },
    {
      "id": "offerman-edition-2019",
      "badge": null,
      "title": {
        "en": "Nick Offerman partnership",
        "ru": "Серия Lagavulin Offerman Edition",
        "uk": "Серія Lagavulin Offerman Edition"
      },
      "subtitle": "",
      "dateOrYear": "2019",
      "description": {
        "en": "Partnership with actor Nick Offerman launches the Offerman Edition range (Guinness cask, charred oak, Caribbean rum finishes).",
        "ru": "Сотрудничество с актёром Ником Офферманом запускает серию Offerman Edition (финиши в бочках из-под эля Guinness, обожжённого дуба и рома).",
        "uk": "Співпраця з актором Ніком Офферманом запускає серію Offerman Edition (фініші у бочках з-під елю Guinness, обпаленого дуба та рому)."
      }
    },
    {
      "id": "sustainability-2022",
      "badge": null,
      "title": {
        "en": "Visitor centre & green standards",
        "ru": "Модернизация и экостандарты",
        "uk": "Модернізація та екостандарти"
      },
      "subtitle": "",
      "dateOrYear": "2022",
      "description": {
        "en": "Global modernization of the visitor centre and implementation of eco-standards toward Diageo's net-zero carbon strategy.",
        "ru": "Модернизация центра посетителей и внедрение экологических стандартов в рамках нулевого углеродного следа Diageo.",
        "uk": "Модернізація центру відвідувачів та впровадження екологічних стандартів у рамках нульового вуглецевого сліду Diageo."
      }
    },
    {
      "id": "feis-ile-legacy-2024-2026",
      "badge": null,
      "title": {
        "en": "Feis Ile & Islay icon",
        "ru": "Икона Айлеи и Feis Ile",
        "uk": "Ікона Айлеї та Feis Ile"
      },
      "subtitle": "",
      "dateOrYear": "2024–2026",
      "description": {
        "en": "Lagavulin remains a cornerstone of Feis Ile and a globally prized iconic peated Islay single malt.",
        "ru": "Lagavulin остаётся неотъемлемой частью фестиваля Feis Ile и культовым торфяным виски с острова Айлей.",
        "uk": "Lagavulin залишається невід'ємною частиною фестивалю Feis Ile та культовим торф'яним віскі з острова Айлей."
      }
    }
  ]
}
$lagavulin_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT lagavulin_id
    FROM distilleries
    WHERE lower(trim(name)) = 'lagavulin';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 17 THEN
        RAISE EXCEPTION 'Expected 17 Lagavulin timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = lagavulin_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Lagavulin already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Lagavulin History', 'timeline', timeline, lagavulin_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'lagavulin';
