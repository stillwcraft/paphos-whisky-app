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
    ardnahoe_id integer;
    timeline jsonb := $ardnahoe_data$
{
  "steps": [
    {
      "id": "hunter-laing-2013",
      "badge": null,
      "title": {
        "en": "Hunter Laing & Co. founded",
        "ru": "Основание Hunter Laing & Co.",
        "uk": "Заснування Hunter Laing & Co."
      },
      "subtitle": "",
      "dateOrYear": "2013",
      "description": {
        "en": "Stewart Laing and his sons Andrew and Scott establish independent bottler Hunter Laing & Co. Ltd in Glasgow, planning their own distillery.",
        "ru": "Стюарт Лэнг с сыновьями Эндрю и Скоттом основывают Hunter Laing & Co. Ltd в Глазго с целью построить собственную винокурню.",
        "uk": "Стюарт Ленґ із синами Ендрю та Скоттом засновують Hunter Laing & Co. Ltd у Ґлазго з метою побудувати власну винокурню."
      }
    },
    {
      "id": "islay-site-2015",
      "badge": null,
      "title": {
        "en": "Securing the site on Islay",
        "ru": "Участок на острове Айлей",
        "uk": "Ділянка на острові Айлей"
      },
      "subtitle": "",
      "dateOrYear": "2015",
      "description": {
        "en": "The family selects a 4-acre site near Loch Ardnahoe on Islay's northeast coast, overlooking the Sound of Islay and the Paps of Jura.",
        "ru": "Семья приобретает участок 4 акра возле озера Лох-Арднахо на северо-востоке Айлея с видом на пролив и горы острова Джура.",
        "uk": "Родина купує ділянку 4 акри біля озера Лох-Арднахо на північному сході Айлею з видом на протоку та гори острова Джура."
      }
    },
    {
      "id": "planning-swan-2016",
      "badge": null,
      "title": {
        "en": "Planning & Dr. Jim Swan",
        "ru": "Разрешение и доктор Джим Сван",
        "uk": "Дозвіл та доктор Джим Сван"
      },
      "subtitle": "",
      "dateOrYear": "2016",
      "description": {
        "en": "Planning permission is granted and ground is broken. Legendary consultant Dr. Jim Swan is brought in to design the spirit profile.",
        "ru": "Получено разрешение на строительство. К проектированию профиля спиртов и оборудования привлекается доктор Джим Сван.",
        "uk": "Отримано дозвіл на будівництво. До проєктування профілю спиртів та обладнання залучається доктор Джим Сван."
      }
    },
    {
      "id": "equipment-2017",
      "badge": null,
      "title": {
        "en": "Traditional equipment installed",
        "ru": "Установка оборудования",
        "uk": "Встановлення обладнання"
      },
      "subtitle": "",
      "dateOrYear": "2017",
      "description": {
        "en": "Installation of a 100-year-old Boby mill, Oregon Pine washbacks, stills with long lyne arms, and Islay's only traditional worm tubs.",
        "ru": "Установка 100-летней мельницы Boby, чанов из орегонской сосны, кубов с длинными lyne arms и единственных на Айлее змеевиков worm tubs.",
        "uk": "Встановлення 100-річного млина Boby, чанів з орегонської сосни, кубів із довгими lyne arms та єдиних на Айлеї змійовиків worm tubs."
      }
    },
    {
      "id": "first-cask-2018",
      "badge": null,
      "title": {
        "en": "First spirit & Cask No. 001",
        "ru": "Первый спирт и Cask No. 001",
        "uk": "Перший спирт та Cask No. 001"
      },
      "subtitle": "",
      "dateOrYear": "2018",
      "description": {
        "en": "First distillation takes place in October 2018, and official Cask No. 001 is filled on 9 November 2018.",
        "ru": "В октябре 2018 года прошли первые перегонки, а 9 ноября 2018 года официально заполнена первая бочка Cask No. 001.",
        "uk": "У жовтні 2018 року пройшли перші перегонки, а 9 листопада 2018 року офіційно заповнено першу бочку Cask No. 001."
      }
    },
    {
      "id": "visitor-centre-2019",
      "badge": null,
      "title": {
        "en": "Visitor Centre opening",
        "ru": "Открытие Центра посетителей",
        "uk": "Відкриття Центру відвідувачів"
      },
      "subtitle": "",
      "dateOrYear": "2019",
      "description": {
        "en": "Official opening of the state-of-the-art Visitor Centre in April, featuring panoramic views over the Sound of Islay.",
        "ru": "В апреле проходит официальное открытие Центрa посетителей с панорамными окнами на пролив Саунд-оф-Айлей.",
        "uk": "У квітня відбувається офіційне відкриття Центру відвідувачів із панорамними вікнами на протоку Саунд-оф-Айлей."
      }
    },
    {
      "id": "inaugural-release-2024",
      "badge": null,
      "title": {
        "en": "5 Year Old Inaugural Release",
        "ru": "Релиз Ardnahoe 5 YO",
        "uk": "Реліз Ardnahoe 5 YO"
      },
      "subtitle": "",
      "dateOrYear": "2024",
      "description": {
        "en": "On 10 May 2024, Ardnahoe releases its 5 Year Old Inaugural Release (50% ABV, peated, bourbon & sherry casks), its first official single malt.",
        "ru": "10 мая 2024 года выпущен первый виски — Ardnahoe 5 Year Old Inaugural Release (50% ABV, торфяной, бочки из-под бурбона и хереса Oloroso).",
        "uk": "10 травня 2024 року випущено перший віскі — Ardnahoe 5 Year Old Inaugural Release (50% ABV, торф'яний, бочки з-під бурбону та хересу Oloroso)."
      }
    },
    {
      "id": "family-craft-2025-2026",
      "badge": null,
      "title": {
        "en": "Craft single malt focus",
        "ru": "Ремесленное развитие бренда",
        "uk": "Ремісничий розвиток бренду"
      },
      "subtitle": "",
      "dateOrYear": "2025–2026",
      "description": {
        "en": "Brothers Andrew and Scott Laing lead Ardnahoe, building the core range while upholding traditional craft methods (no chill-filtering or caramel coloring).",
        "ru": "Братья Эндрю и Скотт Лэнг развивают линейку односолодового виски, сохраняя ремесленный подход (без холодной фильтрации и красителей).",
        "uk": "Брати Ендрю та Скотт Ленґ розвивають лінійку односолодового віскі, зберігаючи ремісничий підхід (без холодної фільтрації та барвників)."
      }
    }
  ]
}
$ardnahoe_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT ardnahoe_id
    FROM distilleries
    WHERE lower(trim(name)) = 'ardnahoe';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 8 THEN
        RAISE EXCEPTION 'Expected 8 Ardnahoe timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = ardnahoe_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Ardnahoe already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Ardnahoe History', 'timeline', timeline, ardnahoe_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'ardnahoe';
