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
    ardmore_id integer;
    timeline jsonb := $ardmore_data$
{
  "steps": [
    {
      "id": "founding-1898",
      "badge": null,
      "title": {
        "en": "Official founding",
        "ru": "Официальное основание",
        "uk": "Офіційне заснування"
      },
      "subtitle": "",
      "dateOrYear": "1898",
      "description": {
        "en": "Adam Teacher founds the distillery in Kennethmont to supply high-quality single malt for the family's Teacher's blended whisky.",
        "ru": "Основание винокурни Адамом Тичером в посёлке Кеннетмонт для обеспечения высококачественным солодовым виски купажей Teacher’s.",
        "uk": "Заснування винокурні Адамом Тічером у селищі Кеннетмонт для забезпечення високоякісним солодовим віскі купажів Teacher’s."
      }
    },
    {
      "id": "expansion-1927",
      "badge": null,
      "title": {
        "en": "Expansion to four stills",
        "ru": "Расширение до 4 кубов",
        "uk": "Розширення до 4 кубів"
      },
      "subtitle": "",
      "dateOrYear": "1927",
      "description": {
        "en": "Major expansion amid growing demand for Teacher's blend, increasing the number of pot stills from two to four.",
        "ru": "Масштабная модернизация на фоне роста популярности бренда Teacher’s: увеличение количества кубов с 2 до 4.",
        "uk": "Масштабна модернізація на тлі зростання популярності бренду Teacher’s: збільшення кількості кубів з 2 до 4."
      }
    },
    {
      "id": "six-stills-1955",
      "badge": null,
      "title": {
        "en": "Expansion to six stills",
        "ru": "Расширение до 6 кубов",
        "uk": "Розширення до 6 кубів"
      },
      "subtitle": "",
      "dateOrYear": "1955",
      "description": {
        "en": "Further production expansion, bringing the total number of pot stills to six.",
        "ru": "Дальнейшее расширение производства: количество перегонных кубов увеличивают до 6.",
        "uk": "Подальше розширення виробництва: кількість перегонних кубів збільшують до 6."
      }
    },
    {
      "id": "eight-stills-allied-1974-1976",
      "badge": null,
      "title": {
        "en": "Eight stills & Allied Breweries",
        "ru": "Восемь кубов и Allied Breweries",
        "uk": "Вісім кубів та Allied Breweries"
      },
      "subtitle": "",
      "dateOrYear": "1974–1976",
      "description": {
        "en": "Stills increase to eight, floor maltings close, and Wm. Teacher & Sons joins Allied Breweries (later Allied Domecq).",
        "ru": "Число кубов возрастает до 8, закрываются напольные солодовни, а Wm. Teacher & Sons входит в состав Allied Breweries.",
        "uk": "Кількість кубів зростає до 8, закриваються підлогові солодорні, а Wm. Teacher & Sons входить до складу Allied Breweries."
      }
    },
    {
      "id": "steam-heating-2001-2002",
      "badge": null,
      "title": {
        "en": "Switch to steam heating",
        "ru": "Переход на паровой обогрев",
        "uk": "Перехід на паровий обігрів"
      },
      "subtitle": "",
      "dateOrYear": "2001–2002",
      "description": {
        "en": "End of direct coal firing as one of Scotland's last coal-heated distilleries transitions to steam heating.",
        "ru": "Конец эпохи прямого угля: одна из последних винокурен Шотландии с угольным обогревом кубов переходит на пар.",
        "uk": "Кінець епохи прямого вугілля: одна з останніх винокурень Шотландії з вугільним обігрівом кубів переходить на пару."
      }
    },
    {
      "id": "fortune-brands-2005",
      "badge": null,
      "title": {
        "en": "Fortune Brands acquisition",
        "ru": "Переход к Fortune Brands",
        "uk": "Перехід до Fortune Brands"
      },
      "subtitle": "",
      "dateOrYear": "2005",
      "description": {
        "en": "Following Allied Domecq's breakup, the distillery is acquired by US-based Fortune Brands (later Beam Inc.).",
        "ru": "В результате раздела активов Allied Domecq винокурня переходит в собственность американской Fortune Brands (позже Beam Inc.).",
        "uk": "У результаті розділу активів Allied Domecq винокурня переходить у власність американської Fortune Brands (пізніше Beam Inc.)."
      }
    },
    {
      "id": "traditional-cask-2007",
      "badge": null,
      "title": {
        "en": "Ardmore Traditional Cask launch",
        "ru": "Запуск Traditional Cask",
        "uk": "Запуск Traditional Cask"
      },
      "subtitle": "",
      "dateOrYear": "2007",
      "description": {
        "en": "Launch of Ardmore Traditional Cask (46% ABV, non-chill filtered, quarter casks), the distillery's first official single malt release.",
        "ru": "Выпуск первого официального односолодового релиза Ardmore Traditional Cask (46% ABV, quarter casks), начавший историю бренда.",
        "uk": "Випуск першого офіційного односолодового релізу Ardmore Traditional Cask (46% ABV, quarter casks), що розпочав історію бренду."
      }
    },
    {
      "id": "beam-suntory-legacy-2014",
      "badge": null,
      "title": {
        "en": "Beam Suntory & Ardmore Legacy",
        "ru": "Beam Suntory и Ardmore Legacy",
        "uk": "Beam Suntory та Ardmore Legacy"
      },
      "subtitle": "",
      "dateOrYear": "2014",
      "description": {
        "en": "Suntory acquires Beam Inc. to form Beam Suntory, introducing the new flagship single malt Ardmore Legacy.",
        "ru": "Suntory приобретает Beam Inc., создавая Beam Suntory. Презентуется новый флагманский розлив Ardmore Legacy.",
        "uk": "Suntory купує Beam Inc., створюючи Beam Suntory. Презентується новий флагманський реліз Ardmore Legacy."
      }
    },
    {
      "id": "suntory-global-spirits-2024",
      "badge": null,
      "title": {
        "en": "Suntory Global Spirits rebranding",
        "ru": "Переименование в Suntory Global Spirits",
        "uk": "Перейменування на Suntory Global Spirits"
      },
      "subtitle": "",
      "dateOrYear": "2024",
      "description": {
        "en": "Global corporate rebranding of Beam Suntory to Suntory Global Spirits.",
        "ru": "Глобальный ребрендинг управляющей компании Beam Suntory в Suntory Global Spirits.",
        "uk": "Глобальний ребрендинг керуючої компанії Beam Suntory на Suntory Global Spirits."
      }
    },
    {
      "id": "highland-peat-legacy-2025-2026",
      "badge": null,
      "title": {
        "en": "Highland peated giant",
        "ru": "Дымный гигант Хайленда",
        "uk": "Димний гігант Хайленду"
      },
      "subtitle": "",
      "dateOrYear": "2025–2026",
      "description": {
        "en": "Ardmore remains a major Highland distillery (~5.5m L/year), famed for traditional mainland peated malt and Teacher's blend core.",
        "ru": "Ardmore остается крупнейшей дистиллерией Хайленда (~5,5 млн л/год), славящейся континентальным торфом и релизами Ardmore Legacy.",
        "uk": "Ardmore залишається великою дистилерією Хайленду (~5,5 млн л/рік), відомою континентальним торфом та релізами Ardmore Legacy."
      }
    }
  ]
}
$ardmore_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT ardmore_id
    FROM distilleries
    WHERE lower(name) LIKE '%ardmore%';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 10 THEN
        RAISE EXCEPTION 'Expected 10 Ardmore timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = ardmore_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Ardmore already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Ardmore History', 'timeline', timeline, ardmore_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(d.name) LIKE '%ardmore%';
