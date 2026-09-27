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
    bunnahabhain_id integer;
    timeline jsonb := $bunnahabhain_data$
{
  "steps": [
    {
      "id": "founding-1881",
      "badge": null,
      "title": {
        "en": "Official founding",
        "ru": "Официальное основание",
        "uk": "Офіційне заснування"
      },
      "subtitle": "",
      "dateOrYear": "1881",
      "description": {
        "en": "William Robertson and the Greenlees brothers found the distillery under Islay Distillery Co. Bunnahabhain means 'Mouth of the river' in Gaelic.",
        "ru": "Основание винокурни Уильямом Робертсоном и братьями Гринлиз в Islay Distillery Co. Bunnahabhain означает «Устье реки» на гэльском.",
        "uk": "Заснування винокурні Вільямом Робертсоном та братами Грінліз у Islay Distillery Co. Bunnahabhain означає «Гирло річки» гельською."
      }
    },
    {
      "id": "first-spirit-1883",
      "badge": null,
      "title": {
        "en": "Distillation starts by sea",
        "ru": "Старт дистилляции по морю",
        "uk": "Старт дистиляції морем"
      },
      "subtitle": "",
      "dateOrYear": "1883",
      "description": {
        "en": "Distillation officially starts. Without road access, all barley, coal, casks, and whisky are transported exclusively by sea on company steamships.",
        "ru": "Запуск дистилляции. Из-за отсутствия сухопутных дорог всё сырьё, уголь и виски транспортируются по морю на собственном пароходе.",
        "uk": "Запуск дистиляції. Через відсутність сухопутних доріг уся сировина, вугілля та віскі транспортуються морем на власному пароплаві."
      }
    },
    {
      "id": "highland-distillers-1887",
      "badge": null,
      "title": {
        "en": "Highland Distillers merger",
        "ru": "Создание Highland Distillers",
        "uk": "Створення Highland Distillers"
      },
      "subtitle": "",
      "dateOrYear": "1887",
      "description": {
        "en": "Merger with Glenrothes-Glenlivet Distillery Company forms the major spirits company Highland Distillers Co. Ltd.",
        "ru": "Слияние с Glenrothes-Glenlivet Distillery Company и создание крупного концерна Highland Distillers Co. Ltd.",
        "uk": "Злиття з Glenrothes-Glenlivet Distillery Company та створення великого концерну Highland Distillers Co. Ltd."
      }
    },
    {
      "id": "mothballed-1930-1937",
      "badge": null,
      "title": {
        "en": "Great Depression closure",
        "ru": "Закрытие из-за депрессии",
        "uk": "Закриття через депресію"
      },
      "subtitle": "",
      "dateOrYear": "1930–1937",
      "description": {
        "en": "The Great Depression and global trade crisis force the distillery to mothball operations for 7 years.",
        "ru": "Великая депрессия и кризис мировой торговли вынуждают законсервировать производство на 7 лет.",
        "uk": "Велика депресія та криза світової торгівлі змушують законсервувати виробництво на 7 років."
      }
    },
    {
      "id": "first-road-1960",
      "badge": null,
      "title": {
        "en": "First road connection",
        "ru": "Первая автомобильная дорога",
        "uk": "Перша автомобільна дорога"
      },
      "subtitle": "",
      "dateOrYear": "1960",
      "description": {
        "en": "A full road connection is constructed through Islay's hills, reducing the distillery's complete reliance on sea transport.",
        "ru": "К винокурне впервые прокладывают автомобильную дорогу через холмы острова, ослабив зависимость от морских перевозок.",
        "uk": "До винокурні вперше прокладають автомобільну дорогу через пагорби острова, послабивши залежність від морських перевезень."
      }
    },
    {
      "id": "expansion-1963",
      "badge": null,
      "title": {
        "en": "Expansion to four stills",
        "ru": "Расширение до 4 кубов",
        "uk": "Розширення до 4 кубів"
      },
      "subtitle": "",
      "dateOrYear": "1963",
      "description": {
        "en": "A major modernization expands the stillhouse, increasing the number of pot stills from two to four.",
        "ru": "Масштабная модернизация завода: расширение перегонного цеха и увеличение количества кубов с 2 до 4.",
        "uk": "Масштабна модернізація заводу: розширення перегонного цеху та збільшення кількості кубів з 2 до 4."
      }
    },
    {
      "id": "edrington-1999",
      "badge": null,
      "title": {
        "en": "Acquisition by Edrington",
        "ru": "Вхождение в Edrington Group",
        "uk": "Входження до Edrington Group"
      },
      "subtitle": "",
      "dateOrYear": "1999",
      "description": {
        "en": "Highland Distillers is acquired by The Edrington Group holding company.",
        "ru": "Компания Highland Distillers входит в состав холдинга The Edrington Group.",
        "uk": "Компанія Highland Distillers входить до складу холдингу The Edrington Group."
      }
    },
    {
      "id": "burn-stewart-2003",
      "badge": null,
      "title": {
        "en": "Burn Stewart acquisition",
        "ru": "Покупка Burn Stewart",
        "uk": "Купівля Burn Stewart"
      },
      "subtitle": "",
      "dateOrYear": "2003",
      "description": {
        "en": "The distillery is sold to Burn Stewart Distillers for £10 million.",
        "ru": "Продажа винокурни компании Burn Stewart Distillers за 10 млн фунтов.",
        "uk": "Продаж винокурні компанії Burn Stewart Distillers за 10 млн фунтів."
      }
    },
    {
      "id": "unpeated-philosophy-2006",
      "badge": null,
      "title": {
        "en": "Unpeated sherry focus & 46.3% ABV",
        "ru": "Неторфяная философия и 46,3% ABV",
        "uk": "Неторф'яна філософія та 46,3% ABV"
      },
      "subtitle": "",
      "dateOrYear": "2006",
      "description": {
        "en": "Pivotal shift to unpeated sherry-matured single malt, eliminating chill-filtration and caramel coloring, raising minimum ABV to 46.3%.",
        "ru": "Переход на неторфяной виски в хересных бочках, отказ от холодной фильтрации и красителей, повышение крепости розлива до 46,3% ABV.",
        "uk": "Перехід на неторф'яний віскі у хересних бочках, відмова від холодної фільтрації та барвників, підвищення міцності розливу до 46,3% ABV."
      }
    },
    {
      "id": "distell-2013",
      "badge": null,
      "title": {
        "en": "Acquisition by Distell",
        "ru": "Покупка концерном Distell",
        "uk": "Купівля концерном Distell"
      },
      "subtitle": "",
      "dateOrYear": "2013",
      "description": {
        "en": "South African spirits giant Distell Group Limited acquires Burn Stewart Distillers, taking control of Bunnahabhain.",
        "ru": "Южноафриканский гигант Distell Group Limited приобретает Burn Stewart Distillers со всеми винокурнями.",
        "uk": "Південноафриканський гігант Distell Group Limited купує Burn Stewart Distillers з усіма винокурнями."
      }
    },
    {
      "id": "investment-visitor-centre-2017-2021",
      "badge": null,
      "title": {
        "en": "£11m investment & Visitor Centre",
        "ru": "Инвестиции £11 млн и Центр посетителей",
        "uk": "Інвестиції £11 млн та Центр відвідувачів"
      },
      "subtitle": "",
      "dateOrYear": "2017–2021",
      "description": {
        "en": "Completion of an £11m transformation, building a new Visitor Centre overlooking the Sound of Islay and restoring coastal warehouses.",
        "ru": "Инвестиционная программа на £11 млн: новое здание Центра посетителей на берегу пролива и реставрация прибрежных складов.",
        "uk": "Інвестиційна програма на £11 млн: нове приміщення Центру відвідувачів на березі протоки та реставрація прибережних складів."
      }
    },
    {
      "id": "cvh-spirits-2023-2024",
      "badge": null,
      "title": {
        "en": "Formation of CVH Spirits",
        "ru": "Образование CVH Spirits",
        "uk": "Утворення CVH Spirits"
      },
      "subtitle": "",
      "dateOrYear": "2023–2024",
      "description": {
        "en": "Following Heineken's acquisition of Distell, spirits assets form CVH Spirits (Consolidated Vinarchy Holdings) as Bunnahabhain's manager.",
        "ru": "Реорганизация активов Distell концерном Heineken: спиртовое подразделение выделяется в CVH Spirits.",
        "uk": "Реорганізація активів Distell концерном Heineken: спиртовий підрозділ виділяється у CVH Spirits."
      }
    },
    {
      "id": "unpeated-jewel-2025-2026",
      "badge": null,
      "title": {
        "en": "Islay's unpeated jewel",
        "ru": "Неторфяная жемчужина Айлеи",
        "uk": "Неторф'яна перлина Айлею"
      },
      "subtitle": "",
      "dateOrYear": "2025–2026",
      "description": {
        "en": "Bunnahabhain remains Islay's premier unpeated single malt, renowned for sherry-matured core expressions and peated Mòine experiments.",
        "ru": "Bunnahabhain сохраняет статус неторфяной жемчужины Айлеи, славясь орехово-хересными релизами и торфяными экспериментами.",
        "uk": "Bunnahabhain зберігає статус неторф'яної перлини Айлею, славлячись горіхово-хересними релізами та торф'яними експериментами."
      }
    }
  ]
}
$bunnahabhain_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT bunnahabhain_id
    FROM distilleries
    WHERE lower(trim(name)) = 'bunnahabhain';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 13 THEN
        RAISE EXCEPTION 'Expected 13 Bunnahabhain timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = bunnahabhain_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Bunnahabhain already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Bunnahabhain History', 'timeline', timeline, bunnahabhain_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'bunnahabhain';
