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
    raasay_id integer;
    timeline jsonb := $raasay_data$
{
  "steps": [
    {
      "id": "rb-distillers-2014",
      "badge": null,
      "title": {
        "en": "R&B Distillers founded",
        "ru": "Основание R&B Distillers",
        "uk": "Заснування R&B Distillers"
      },
      "subtitle": "",
      "dateOrYear": "2014",
      "description": {
        "en": "Entrepreneurs Bill Dobbie and Alasdair Day establish R&B Distillers to build an innovative craft distillery on the Isle of Raasay.",
        "ru": "Предприниматели Билл Добби и Аласдер Дэй основывают R&B Distillers с целью построить крафтовую винокурню на острове Раасей.",
        "uk": "Підприємці Білл Доббі та Аласдер Дей засновують R&B Distillers з метою побудувати крафтову винокурню на острові Раасей."
      }
    },
    {
      "id": "borodale-house-2015",
      "badge": null,
      "title": {
        "en": "Borodale House acquisition",
        "ru": "Покупка Borodale House",
        "uk": "Купівля Borodale House"
      },
      "subtitle": "",
      "dateOrYear": "2015",
      "description": {
        "en": "The company acquires the 19th-century Borodale House mansion on Raasay and secures official planning permission for the distillery.",
        "ru": "Компания приобретает особняк XIX века Borodale House на Раасее и получает разрешение на постройку перегонного цеха.",
        "uk": "Компанія купує особняк XIX століття Borodale House на Раасеї та отримує дозвіл на будівництво перегонного цеху."
      }
    },
    {
      "id": "while-we-wait-2016",
      "badge": null,
      "title": {
        "en": "Construction & While We Wait",
        "ru": "Строительство и While We Wait",
        "uk": "Будівництво та While We Wait"
      },
      "subtitle": "",
      "dateOrYear": "2016",
      "description": {
        "en": "Construction begins, and R&B Distillers launches the independent blend series 'Raasay While We Wait' to preview their whisky style.",
        "ru": "Начало строительства и запуск серии независимых блендов «Raasay While We Wait» для знакомства со стилем будущей винокурни.",
        "uk": "Початок будівництва та запуск серії незалежних блендів «Raasay While We Wait» для знайомства зі стилем майбутньої винокурні."
      }
    },
    {
      "id": "first-spirit-2017",
      "badge": null,
      "title": {
        "en": "First spirit flows on Raasay",
        "ru": "Первый спирт на Раасее",
        "uk": "Перший спирт на Раасеї"
      },
      "subtitle": "",
      "dateOrYear": "2017",
      "description": {
        "en": "On 14 September 2017, construction finishes and the first spirit flows, marking the first legal distillation in Isle of Raasay history.",
        "ru": "14 сентября 2017 года завершается строительство и вытекает первый спирт — первая официальная дистилляция в истории острова Раасей.",
        "uk": "14 вересня 2017 року завершується будівництво та витікає перший спирт — перша офіційна дистиляція в історії острова Раасей."
      }
    },
    {
      "id": "visitor-centre-hotel-2018",
      "badge": null,
      "title": {
        "en": "Visitor Centre & luxury hotel",
        "ru": "Центр посетителей и отель",
        "uk": "Центр відвідувачів та готель"
      },
      "subtitle": "",
      "dateOrYear": "2018",
      "description": {
        "en": "Opening of the 5-star VisitScotland-accredited Visitor Centre and 6-bedroom luxury hotel integrated directly into the distillery.",
        "ru": "Открытие Центрa посетителей с дегустационным залом и премиальным отелем на 6 номеров, получившего высшую категорию 5 звезд.",
        "uk": "Відкриття Центру відвідувачів із дегустаційним залом та преміальним готелем на 6 номерів, що отримав вищу категорію 5 зірок."
      }
    },
    {
      "id": "raasay-gin-2019",
      "badge": null,
      "title": {
        "en": "Isle of Raasay Gin launch",
        "ru": "Запуск Isle of Raasay Gin",
        "uk": "Запуск Isle of Raasay Gin"
      },
      "subtitle": "",
      "dateOrYear": "2019",
      "description": {
        "en": "Launch of Isle of Raasay Gin, distilled using water from the ancient Celtic Tobar na Bà Bàine well and local botanicals.",
        "ru": "Запуск производства джина Isle of Raasay Gin на воде из кельтского источника Tobar na Bà Bàine и местных ботаникалах.",
        "uk": "Запуск виробництва джину Isle of Raasay Gin на воді з кельтського джерела Tobar na Bà Bàine та місцевих ботанікалах."
      }
    },
    {
      "id": "inaugural-release-2020",
      "badge": null,
      "title": {
        "en": "Inaugural Release Single Malt",
        "ru": "Inaugural Release Single Malt",
        "uk": "Inaugural Release Single Malt"
      },
      "subtitle": "",
      "dateOrYear": "2020",
      "description": {
        "en": "Release of the long-awaited Isle of Raasay Single Malt Inaugural Release (7,500 bottles, Tennessee whiskey casks with Bordeaux finish).",
        "ru": "Релиз первого виски Isle of Raasay Single Malt Inaugural Release (7 500 бутылок, выдержанный в бочках из-под теннессийского виски и бордо).",
        "uk": "Реліз першого віскі Isle of Raasay Single Malt Inaugural Release (7 500 пляшок, витриманий у бочках з-під теннессійського віскі та бордо)."
      }
    },
    {
      "id": "na-sia-concept-2021",
      "badge": null,
      "title": {
        "en": "Na Sia core range concept",
        "ru": "Концепция Na Sia и регулярная линейка",
        "uk": "Концепція Na Sia та регулярна лінійка"
      },
      "subtitle": "",
      "dateOrYear": "2021",
      "description": {
        "en": "Debut of the core Isle of Raasay Single Malt based on the 'Na Sia' ('Six') recipe concept, combining peated/unpeated spirits in three cask types.",
        "ru": "Дебют флагманской линейки Isle of Raasay Single Malt на базе концепции Na Sia («Шесть») с объединением 6 комбинаций спиртов и бочек.",
        "uk": "Дебют флагманської лінійки Isle of Raasay Single Malt на базі концепції Na Sia («Шість») з об'єднанням 6 комбінацій спиртів та бочок."
      }
    },
    {
      "id": "hebridean-trail-2022-2023",
      "badge": null,
      "title": {
        "en": "Hebridean Whisky Trail & top 3 craft",
        "ru": "Hebridean Whisky Trail и топ-3",
        "uk": "Hebridean Whisky Trail та топ-3"
      },
      "subtitle": "",
      "dateOrYear": "2022–2023",
      "description": {
        "en": "Launch of the Private Cask Programme and Single Cask Series; Raasay joins the Hebridean Whisky Trail as a top 3 visited Scottish craft distillery.",
        "ru": "Запуск программ Private Cask и Single Cask Series; вхождение в маршрут Hebridean Whisky Trail и топ-3 посещаемых крафтовых дистиллерий.",
        "uk": "Запуск програм Private Cask та Single Cask Series; входження до маршруту Hebridean Whisky Trail та топ-3 відвідуваних крафтових дистилерій."
      }
    },
    {
      "id": "na-bothain-marsala-2024-2025",
      "badge": null,
      "title": {
        "en": "Na Bothain cabins & exotic casks",
        "ru": "Эко-кабины Na Bothain и редкие бочки",
        "uk": "Еко-кабіни Na Bothain та рідкісні бочки"
      },
      "subtitle": "",
      "dateOrYear": "2024–2025",
      "description": {
        "en": "Opening of Na Bothain eco-cabins for guests and release of limited editions finished in Sicilian Marsala and Colombian oak casks.",
        "ru": "Открытие эко-кабин Na Bothain для гостей и выпуски лимитированных коллекций с довыдержкой в бочках из-под марсалы и колумбийского дуба.",
        "uk": "Відкриття еко-кабін Na Bothain для гостей та випуски лімітованих колекцій із довитримкою у бочках з-під марсали та колумбійського дуба."
      }
    },
    {
      "id": "bere-barley-innovations-2026",
      "badge": null,
      "title": {
        "en": "Bere Barley & Hebridean pioneer",
        "ru": "Ячмень Bere Barley и статус новатора",
        "uk": "Ячмінь Bere Barley та статус новатора"
      },
      "subtitle": "",
      "dateOrYear": "2026",
      "description": {
        "en": "Release of 100% Bere Barley expressions, experiments with Hungarian Oak, and 3.4x distillation, cementing Raasay's status as a Hebridean pioneer.",
        "ru": "Релизы из 100% ячменя Bere Barley, эксперименты с венгерским дубом и 3.4x дистилляцией. Закрепление статуса главного новатора Гебрид.",
        "uk": "Релізи з 100% ячменю Bere Barley, експерименти з угорським дубом та 3.4x дистиляцією. Закріплення статусу головного новатора Гебридів."
      }
    }
  ]
}
$raasay_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT raasay_id
    FROM distilleries
    WHERE lower(name) LIKE '%raasay%';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 11 THEN
        RAISE EXCEPTION 'Expected 11 Raasay timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = raasay_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Raasay already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Raasay History', 'timeline', timeline, raasay_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(d.name) LIKE '%raasay%';
