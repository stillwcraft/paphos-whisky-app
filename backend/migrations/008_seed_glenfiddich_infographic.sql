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
    glenfiddich_id integer;
    timeline jsonb := $glenfiddich_data$
{
  "steps": [
    {
      "id": "founding-1886",
      "badge": null,
      "title": {
        "en": "Distillery construction",
        "ru": "Строительство винокурни",
        "uk": "Будівництво винокурні"
      },
      "subtitle": "",
      "dateOrYear": "1886",
      "description": {
        "en": "William Grant leaves his role as manager at Mortlach and, together with his family, begins building his own distillery in the Glen of Fiddich.",
        "ru": "Уильям Грант оставляет пост управляющего Mortlach и вместе с семьёй начинает строить собственную дистиллерию в долине реки Фиддих («Оленья долина»).",
        "uk": "Вільям Ґрант залишає посаду керівника Mortlach і разом із родиною починає будувати власну дистилерію в долині річки Фіддіх («Долина оленів»)."
      }
    },
    {
      "id": "first-spirit-1887",
      "badge": null,
      "title": {
        "en": "First spirit flows",
        "ru": "Первый дистиллят",
        "uk": "Перший дистилят"
      },
      "subtitle": "",
      "dateOrYear": "1887",
      "description": {
        "en": "On Christmas Day, 25 December 1887, the first drops of spirit flow from the stills.",
        "ru": "В Рождество, 25 декабря 1887 года, из перегонных кубов вытекают первые капли нового спирта.",
        "uk": "У Різдво, 25 грудня 1887 року, з перегонних кубів витікають перші краплі нового спирту."
      }
    },
    {
      "id": "grants-blend-1898",
      "badge": null,
      "title": {
        "en": "Birth of Grant's Blend",
        "ru": "Создание купажа Grant’s",
        "uk": "Створення купажу Grant’s"
      },
      "subtitle": "",
      "dateOrYear": "1898",
      "description": {
        "en": "Following the Pattisons collapse, William Grant creates his own Grant’s blended whisky and establishes independent distribution.",
        "ru": "После краха Pattisons Уильям Грант создаёт собственный купажированный виски Grant’s и выстраивает независимую дистрибуцию.",
        "uk": "Після краху Pattisons Вільям Ґрант створює власний купажований віскі Grant’s та будує незалежну дистрибуцію."
      }
    },
    {
      "id": "prohibition-1923",
      "badge": null,
      "title": {
        "en": "Prohibition expansion",
        "ru": "Ставка во время Сухого закона",
        "uk": "Ставка під час Сухого закону"
      },
      "subtitle": "",
      "dateOrYear": "1923",
      "description": {
        "en": "During US Prohibition, Grant Gordon increases production, leaving Glenfiddich well-stocked with aged whisky when Prohibition ends in 1933.",
        "ru": "В разгар «сухого закона» в США Грант Гордон увеличивает производство, обеспечив Glenfiddich огромным запасом выдержанных спиртов к 1933 году.",
        "uk": "У розпал «сухого закону» в США Ґрант Ґордон збільшує виробництво, забезпечивши Glenfiddich великим запасом витриманих спиртів до 1933 року."
      }
    },
    {
      "id": "triangular-bottle-1957-1961",
      "badge": null,
      "title": {
        "en": "Triangular bottle design",
        "ru": "Треугольная бутылка",
        "uk": "Трикутна пляшка"
      },
      "subtitle": "",
      "dateOrYear": "1957–1961",
      "description": {
        "en": "Hans Schleger creates the iconic triangular Glenfiddich bottle, representing water, air, and malted barley.",
        "ru": "Ханс Шлегер создаёт легендарную треугольную бутылку Glenfiddich. Три грани символизируют воду, воздух и ячмень.",
        "uk": "Ганс Шлеґер створює легендарну трикутну пляшку Glenfiddich. Три грані символізують воду, повітря та ячмінь."
      }
    },
    {
      "id": "single-malt-pioneer-1963",
      "badge": null,
      "title": {
        "en": "Pioneering Single Malt",
        "ru": "Прорыв односолодового виски",
        "uk": "Прорив односолодового віскі"
      },
      "subtitle": "",
      "dateOrYear": "1963",
      "description": {
        "en": "Sandy and Charles Grant Gordon promote Single Malt outside Scotland, effectively pioneering the modern single malt whisky category.",
        "ru": "Сэнди и Чарли Грант Гордоны начинают продвигать односолодовый виски за пределами Шотландии, фактически создав современную категорию Single Malt.",
        "uk": "Сенді та Чарлі Ґрант Ґордони починають просувати односолодовий віскі за межами Шотландії, фактично створивши сучасну категорію Single Malt."
      }
    },
    {
      "id": "visitor-centre-1969",
      "badge": null,
      "title": {
        "en": "First Visitor Centre",
        "ru": "Первый туристический центр",
        "uk": "Перший туристичний центр"
      },
      "subtitle": "",
      "dateOrYear": "1969",
      "description": {
        "en": "Glenfiddich becomes the first Scottish distillery to open a dedicated Visitor Centre, pioneering modern whisky tourism.",
        "ru": "Glenfiddich первой среди шотландских винокурен открывает полноценный туристический центр, заложив основы виски-туризма.",
        "uk": "Glenfiddich першою серед шотландських дистилерій відкриває повноцінний туристичний центр, започаткувавши сучасний віскі-туризм."
      }
    },
    {
      "id": "solera-vat-1998",
      "badge": null,
      "title": {
        "en": "Solera Vat innovation",
        "ru": "Инновация Solera Vat",
        "uk": "Інновація Solera Vat"
      },
      "subtitle": "",
      "dateOrYear": "1998",
      "description": {
        "en": "Malt Master David Stewart introduces the Solera Vat system for Glenfiddich 15 Year Old, which is never fully emptied.",
        "ru": "Мастер купажа Дэвид Стюарт внедряет систему Solera Vat для создания 15-летнего виски Glenfiddich, которая никогда не опустошается полностью.",
        "uk": "Майстер купажу Девід Стюарт впроваджує систему Solera Vat для створення 15-річного віскі Glenfiddich, яка ніколи не спорожняється повністю."
      }
    },
    {
      "id": "rare-collection-1937-2001",
      "badge": null,
      "title": {
        "en": "Glenfiddich 1937 release",
        "ru": "Релиз Glenfiddich 1937",
        "uk": "Реліз Glenfiddich 1937"
      },
      "subtitle": "",
      "dateOrYear": "2001–2002",
      "description": {
        "en": "Release of the 64-year-old Glenfiddich 1937 (61 bottles), which was the oldest single malt whisky in the world at the time.",
        "ru": "Выпуск 64-летнего Glenfiddich 1937 тиражом всего 61 бутылка — на тот момент самого старого односолодового виски в мире.",
        "uk": "Випуск 64-річного Glenfiddich 1937 тиражем лише 61 пляшка — на тот момент найстарішого односолодового віскі у світі."
      }
    },
    {
      "id": "experimental-grand-series-2016-2019",
      "badge": null,
      "title": {
        "en": "Experimental & Grand Series",
        "ru": "Experimental и Grand Series",
        "uk": "Experimental та Grand Series"
      },
      "subtitle": "",
      "dateOrYear": "2016–2019",
      "description": {
        "en": "Launch of the Experimental Series (IPA Cask, Project XX) and the luxury Grand Series (Cognac and French wine cask finishes).",
        "ru": "Запуск серий Experimental Series (эксперименты с бочками из-под IPA, Project XX) и премиальной Grand Series (довыдержка в коньячных и винных бочках).",
        "uk": "Запуск серій Experimental Series (експерименти з бочками з-під IPA, Project XX) та преміальної Grand Series (довитримка в коньячних і винних бочках)."
      }
    },
    {
      "id": "biogas-sustainability-2021-2022",
      "badge": null,
      "title": {
        "en": "Biogas sustainability initiative",
        "ru": "Экологические технологии",
        "uk": "Екологічні технології"
      },
      "subtitle": "",
      "dateOrYear": "2021–2022",
      "description": {
        "en": "Glenfiddich launches a green initiative converting liquid distillation waste into biogas to fuel its transport trucks.",
        "ru": "Запуск переработки жидких отходов дистилляции в биогаз, на котором работают собственные грузовики компании.",
        "uk": "Запуск переробки рідких відходів дистиляції на біогаз, на якому працюють власні вантажівки компанії."
      }
    },
    {
      "id": "archive-reimagined-2023-2026",
      "badge": null,
      "title": {
        "en": "Time Reimagined & Archive",
        "ru": "Коллекции Time Reimagined и Archive",
        "uk": "Колекції Time Reimagined та Archive"
      },
      "subtitle": "",
      "dateOrYear": "2023–2026",
      "description": {
        "en": "Launch of the Time Reimagined and Archive Collections. Glenfiddich remains an independent family-owned brand under William Grant & Sons.",
        "ru": "Запуск коллекций Time Reimagined и Archive Collection. Glenfiddich сохраняет статус независимой семейной компании в William Grant & Sons.",
        "uk": "Запуск колекцій Time Reimagined та Archive Collection. Glenfiddich зберігає статус незалежної сімейної компанії у складі William Grant & Sons."
      }
    }
  ]
}
$glenfiddich_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT glenfiddich_id
    FROM distilleries
    WHERE lower(trim(name)) = 'glenfiddich';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 12 THEN
        RAISE EXCEPTION 'Expected 12 Glenfiddich timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = glenfiddich_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Glenfiddich already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Glenfiddich History', 'timeline', timeline, glenfiddich_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'glenfiddich';
