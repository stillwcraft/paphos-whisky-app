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
    glengyle_id integer;
    timeline jsonb := $glengyle_data$
{
  "steps": [
    {
      "id": "founding-1872",
      "badge": null,
      "title": {
        "en": "Distillery founded",
        "ru": "Основание винокурни",
        "uk": "Заснування винокурні"
      },
      "subtitle": "",
      "dateOrYear": "1872",
      "description": {
        "en": "William Mitchell founds Glengyle after a dispute with his brother John at Springbank. Construction completes in 1873.",
        "ru": "Уильям Митчелл основывает Glengyle после ссоры с братом Джоном из Springbank. Строительство завершается в 1873 году.",
        "uk": "Вільям Мітчелл засновує Glengyle після сварки з братом Джоном зі Springbank. Будівництво завершується у 1873 році."
      }
    },
    {
      "id": "whmd-1919",
      "badge": null,
      "title": {
        "en": "Sale to WHMD",
        "ru": "Продажа альянсу WHMD",
        "uk": "Продаж альянсу WHMD"
      },
      "subtitle": "",
      "dateOrYear": "1919",
      "description": {
        "en": "Due to the post-war economic downturn, the distillery is sold to West Highland Malt Distillers Ltd (WHMD).",
        "ru": "В связи с послевоенным экономическим спадом винокурня продаётся альянсу West Highland Malt Distillers Ltd (WHMD).",
        "uk": "У зв'язку з післявоєнним економічним спадом винокурню продають альянсу West Highland Malt Distillers Ltd (WHMD)."
      }
    },
    {
      "id": "closure-1924-1925",
      "badge": null,
      "title": {
        "en": "Bankruptcy and closure",
        "ru": "Банкротство и закрытие",
        "uk": "Банкрутство та закриття"
      },
      "subtitle": "",
      "dateOrYear": "1924–1925",
      "description": {
        "en": "Financial crisis and US Prohibition cause WHMD's bankruptcy. Production stops in late 1925, and remaining stocks are auctioned.",
        "ru": "Финансовый кризис и «сухой закон» приводят к банкротству WHMD. В 1925 году производство останавливают, а спирты распродают.",
        "uk": "Фінансова криза та «сухий закон» призводять до банкрутства WHMD. У 1925 році виробництво зупиняють, а спирти розпродають."
      }
    },
    {
      "id": "silent-years-1925-1999",
      "badge": null,
      "title": {
        "en": "The silent years",
        "ru": "Период «великого молчания»",
        "uk": "Період «великого мовчання»"
      },
      "subtitle": "",
      "dateOrYear": "1925–1999",
      "description": {
        "en": "For 75 years, the buildings serve as a garage, shooting range, and agricultural warehouse. Revival attempts fail.",
        "ru": "В течение 75 лет здания используют как тир, гараж и склад. Все попытки возобновить производство терпят неудачу.",
        "uk": "Протягом 75 років будівлі використовують як тир, гараж і склад. Усі спроби відновити виробництво зазнають невдачі."
      }
    },
    {
      "id": "saving-campbeltown-2000",
      "badge": null,
      "title": {
        "en": "Saving Campbeltown",
        "ru": "Спасение Кэмпбелтауна",
        "uk": "Порятунок Кемпбелтауна"
      },
      "subtitle": "",
      "dateOrYear": "2000",
      "description": {
        "en": "Springbank owner Hedley Wright buys Glengyle, creating the essential 3rd active distillery to save Campbeltown's official region status.",
        "ru": "Хедли Райт (Springbank) выкупает Glengyle, создавая 3-ю действующую винокурню в городе и спасая статус Кэмпбелтауна как региона виски.",
        "uk": "Хедлі Райт (Springbank) викуповує Glengyle, створюючи 3-ю діючу винокурню в місті та рятуючи статус Кемпбелтауна як регіону віскі."
      }
    },
    {
      "id": "reopening-2004",
      "badge": null,
      "title": {
        "en": "Official reopening",
        "ru": "Официальное открытие",
        "uk": "Офіційне відкриття"
      },
      "subtitle": "",
      "dateOrYear": "2004",
      "description": {
        "en": "Glengyle reopens on 25 March 2004 with equipment from Ben Wyvis and Craigellachie, flowing its first new spirit.",
        "ru": "25 марта 2004 года происходит открытие восстановленной винокурни с оборудованием Ben Wyvis и Craigellachie; вытекает первый спирт.",
        "uk": "25 березня 2004 року відбувається відкриття відновленої винокурні з обладнанням Ben Wyvis та Craigellachie; витікає перший спирт."
      }
    },
    {
      "id": "kilkerran-wip1-2009",
      "badge": null,
      "title": {
        "en": "Kilkerran brand & WIP 1",
        "ru": "Бренд Kilkerran и WIP 1",
        "uk": "Бренд Kilkerran та WIP 1"
      },
      "subtitle": "",
      "dateOrYear": "2009",
      "description": {
        "en": "Release of Kilkerran Work in Progress 1 (5 YO). The single malt is named Kilkerran as the Glengyle trademark belonged to Loch Lomond.",
        "ru": "Выпуск Kilkerran Work in Progress 1 (5 YO). Виски выходит под брендом Kilkerran, так как марка Glengyle принадлежала Loch Lomond.",
        "uk": "Випуск Kilkerran Work in Progress 1 (5 YO). Віскі виходить під брендом Kilkerran, оскільки марка Glengyle належала Loch Lomond."
      }
    },
    {
      "id": "wip-series-2009-2015",
      "badge": null,
      "title": {
        "en": "Work in Progress series",
        "ru": "Серия Work in Progress",
        "uk": "Серія Work in Progress"
      },
      "subtitle": "",
      "dateOrYear": "2009–2015",
      "description": {
        "en": "Annual Work in Progress releases (WIP 1 to WIP 7) allow enthusiasts to track the maturation of Glengyle's spirit year by year.",
        "ru": "Ежегодные выпуски серии Work in Progress (с WIP 1 по WIP 7) позволяют ценителям отслеживать созревание спиртов из года в год.",
        "uk": "Щорічні випуски серії Work in Progress (з WIP 1 по WIP 7) дозволяють поціновувачам відстежувати дозрівання спиртів з року в рік."
      }
    },
    {
      "id": "kilkerran-12yo-2016",
      "badge": null,
      "title": {
        "en": "Kilkerran 12 Year Old launch",
        "ru": "Релиз Kilkerran 12 Year Old",
        "uk": "Реліз Kilkerran 12 Year Old"
      },
      "subtitle": "",
      "dateOrYear": "2016",
      "description": {
        "en": "Launch of the flagship Kilkerran 12 Year Old to critical acclaim, solidifying Glengyle's place among top single malt producers.",
        "ru": "Релиз флагманского Kilkerran 12 Year Old получает высочайшие оценки критиков и возвращает бренд в элиту шотландского виски.",
        "uk": "Реліз флагманського Kilkerran 12 Year Old отримує найвищі оцінки критиків і повертає бренд до еліти шотландського віскі."
      }
    },
    {
      "id": "cask-strength-2017",
      "badge": null,
      "title": {
        "en": "Kilkerran 8 YO Cask Strength",
        "ru": "Kilkerran 8 YO Cask Strength",
        "uk": "Kilkerran 8 YO Cask Strength"
      },
      "subtitle": "",
      "dateOrYear": "2017",
      "description": {
        "en": "Introduction of the popular Kilkerran 8 Year Old Cask Strength series, bottled at natural cask strength.",
        "ru": "Запуск популярной релизной линейки Kilkerran 8 Year Old Cask Strength бочковой крепости.",
        "uk": "Запуск популярної релізної лінійки Kilkerran 8 Year Old Cask Strength бочкової міцності."
      }
    },
    {
      "id": "heavily-peated-2019",
      "badge": null,
      "title": {
        "en": "Kilkerran Heavily Peated",
        "ru": "Kilkerran Heavily Peated",
        "uk": "Kilkerran Heavily Peated"
      },
      "subtitle": "",
      "dateOrYear": "2019",
      "description": {
        "en": "Debut of the 'Peat in Progress' Heavily Peated range, featuring significantly higher peat smoke levels.",
        "ru": "Дебют линейки Kilkerran Heavily Peated (серия «Peat in Progress») с повышенным содержанием торфяного дыма.",
        "uk": "Дебют лінійки Kilkerran Heavily Peated (серія «Peat in Progress») із підвищеним вмістом торф'яного диму."
      }
    },
    {
      "id": "kilkerran-16yo-2020",
      "badge": null,
      "title": {
        "en": "Kilkerran 16 Year Old",
        "ru": "Релиз Kilkerran 16 Year Old",
        "uk": "Реліз Kilkerran 16 Year Old"
      },
      "subtitle": "",
      "dateOrYear": "2020",
      "description": {
        "en": "Release of the distillery's first 16-year-old expression, Kilkerran 16 Year Old.",
        "ru": "Выпуск первого 16-летнего релиза — Kilkerran 16 Year Old.",
        "uk": "Випуск першого 16-річного релізу — Kilkerran 16 Year Old."
      }
    },
    {
      "id": "anniversary-2024",
      "badge": null,
      "title": {
        "en": "20th anniversary of revival",
        "ru": "20-летие возрождения",
        "uk": "20-річчя відродження"
      },
      "subtitle": "",
      "dateOrYear": "2024",
      "description": {
        "en": "Glengyle celebrates 20 years since its historic reopening and rebirth in 2004.",
        "ru": "Винокурня торжественно отмечает 20-летие с момента своего возрождения (2004–2024).",
        "uk": "Винокурня урочисто святкує 20-річчя з моменту свого відродження (2004–2024)."
      }
    },
    {
      "id": "craft-status-2025-2026",
      "badge": null,
      "title": {
        "en": "Craft status & high demand",
        "ru": "Статус крафтовой легенды",
        "uk": "Статус крафтової легенди"
      },
      "subtitle": "",
      "dateOrYear": "2025–2026",
      "description": {
        "en": "Glengyle remains a highly prized craft distillery (~750,000L/year capacity), with traditional production making Kilkerran a collector favorite.",
        "ru": "Glengyle (Kilkerran) остаётся одной из самых аутентичных и дефицитных винокурен Шотландии с объёмом ~750 тыс. литров в год.",
        "uk": "Glengyle (Kilkerran) залишається однією з найавтентичніших і найдефіцитніших винокурень Шотландії з обсягом ~750 тис. літрів на рік."
      }
    }
  ]
}
$glengyle_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT glengyle_id
    FROM distilleries
    WHERE lower(trim(name)) = 'glengyle';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 14 THEN
        RAISE EXCEPTION 'Expected 14 Glengyle timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = glengyle_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Glengyle already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Glengyle History', 'timeline', timeline, glengyle_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'glengyle';
