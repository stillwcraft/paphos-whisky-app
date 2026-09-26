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
    springbank_id integer;
    timeline jsonb := $springbank_data$
{
  "steps": [
    {
      "id": "founding-1828",
      "badge": null,
      "title": {
        "en": "Official founding",
        "ru": "Официальное основание",
        "uk": "Офіційне заснування"
      },
      "subtitle": "",
      "dateOrYear": "1828",
      "description": {
        "en": "Brothers Archibald and Hugh Mitchell officially found the distillery on the site of a former illicit still.",
        "ru": "Официальное основание винокурни братьями Арчибальдом и Хью Митчеллами на месте бывшего нелегального перегонного куба.",
        "uk": "Офіційне заснування винокурні братами Арчібальдом та Х'ю Мітчеллами на місці колишнього підпільного куба."
      }
    },
    {
      "id": "mitchell-brothers-1837",
      "badge": null,
      "title": {
        "en": "Mitchell Brothers acquisition",
        "ru": "Приобретение братьями Митчелл",
        "uk": "Придбання братами Мітчелл"
      },
      "subtitle": "",
      "dateOrYear": "1837",
      "description": {
        "en": "Brothers John and William Mitchell buy the rights to Springbank, laying the foundation for centuries of family ownership.",
        "ru": "Права на винокурню выкупают братья Джон и Уильям Митчеллы, закладывая основу семейного бизнеса на века.",
        "uk": "Права на винокурню викуповують брати Джон та Вільям Мітчелли, закладаючи основу сімейного бізнесу на століття."
      }
    },
    {
      "id": "glengyle-split-1872",
      "badge": null,
      "title": {
        "en": "Family split and Glengyle",
        "ru": "Раскол и J. & A. Mitchell",
        "uk": "Розкол та J. & A. Mitchell"
      },
      "subtitle": "",
      "dateOrYear": "1872",
      "description": {
        "en": "William Mitchell leaves to build Glengyle. John continues with his sons, establishing J. & A. Mitchell & Co. Ltd in 1897.",
        "ru": "Уильям Митчелл уходит и строит Glengyle. Джон управляет Springbank с сыновьями, создав в 1897 году J. & A. Mitchell & Co. Ltd.",
        "uk": "Вільям Мітчелл йде та будує Glengyle. Джон керує Springbank із синами, створивши у 1897 році J. & A. Mitchell & Co. Ltd."
      }
    },
    {
      "id": "depression-prohibition-1920s-1930s",
      "badge": null,
      "title": {
        "en": "Campbeltown crisis & survival",
        "ru": "Кризис в Кэмпбелтауне",
        "uk": "Криза у Кемпбелтауні"
      },
      "subtitle": "",
      "dateOrYear": "1920s–1930s",
      "description": {
        "en": "Prohibition and the Great Depression collapse Campbeltown's industry. Springbank pauses in 1926 but fully resumes in 1933.",
        "ru": "Крах индустрии в Кэмпбелтауне из-за Великой депрессии и «сухого закона». В 1926 году производство замирает, но в 1933 возобновляется.",
        "uk": "Крах індустрії у Кемпбелтауні через Велику депресію та «сухий закон». У 1926 році виробництво завмирає, але у 1933 відновлюється."
      }
    },
    {
      "id": "cadenhead-acquisition-1969",
      "badge": null,
      "title": {
        "en": "Wm. Cadenhead acquisition",
        "ru": "Покупка Wm. Cadenhead",
        "uk": "Купівля Wm. Cadenhead"
      },
      "subtitle": "",
      "dateOrYear": "1969",
      "description": {
        "en": "J. & A. Mitchell acquires Wm. Cadenhead Ltd, Scotland's oldest independent bottler (established in 1842).",
        "ru": "Компания J. & A. Mitchell приобретает Wm. Cadenhead Ltd. — старейшего независимого боттлера Шотландии (основан в 1842 году).",
        "uk": "Компанія J. & A. Mitchell купує Wm. Cadenhead Ltd. — найстарішого незалежного ботлера Шотландії (заснований у 1842 році)."
      }
    },
    {
      "id": "longrow-launch-1973",
      "badge": null,
      "title": {
        "en": "Launch of Longrow",
        "ru": "Запуск марки Longrow",
        "uk": "Запуск марки Longrow"
      },
      "subtitle": "",
      "dateOrYear": "1973",
      "description": {
        "en": "Production of Longrow begins—a heavily peated, double-distilled single malt named after a nearby closed distillery.",
        "ru": "Запуск производства марки Longrow — сильноторфяного виски двойной дистилляции в честь закрывшейся по соседству винокурни.",
        "uk": "Запуск виробництва марки Longrow — сильноторф'яного віскі подвійної дистиляції на честь закритої по сусідству винокурні."
      }
    },
    {
      "id": "hedley-wright-revival-1979-1989",
      "badge": null,
      "title": {
        "en": "Whisky Loch & Hedley Wright",
        "ru": "Whisky Loch и Хедли Райт",
        "uk": "Whisky Loch та Хедлі Райт"
      },
      "subtitle": "",
      "dateOrYear": "1979–1989",
      "description": {
        "en": "During the 'Whisky Loch' crisis, production slows. In 1989, Hedley Wright resumes full production and focuses on single malts.",
        "ru": "Кризис «Whisky Loch» снижает объёмы. В 1989 году Хедли Райт возобновляет полномасштабное производство и развивает односолодовый виски.",
        "uk": "Криза «Whisky Loch» знижує обсяги. У 1989 році Хедлі Райт відновлює повномасштабне виробництво та розвиток односолодового віскі."
      }
    },
    {
      "id": "100-percent-onsite-1992",
      "badge": null,
      "title": {
        "en": "100% On-site production",
        "ru": "100% процессов на месте",
        "uk": "100% процесів на місці"
      },
      "subtitle": "",
      "dateOrYear": "1992",
      "description": {
        "en": "Springbank reinstates its bottling line, becoming one of Scotland's few distilleries carrying out 100% of production on one site.",
        "ru": "Возврат собственной линии розлива делает Springbank редчайшей винокурней с 100% процессов (от солодования до розлива) на месте.",
        "uk": "Повернення власної лінії розливу робить Springbank рідкісною винокурнею з 100% процесів (від солодування до розливу) на місці."
      }
    },
    {
      "id": "hazelburn-trio-1997",
      "badge": null,
      "title": {
        "en": "Hazelburn & the trio of styles",
        "ru": "Релиз Hazelburn и трио стилей",
        "uk": "Реліз Hazelburn та тріо стилів"
      },
      "subtitle": "",
      "dateOrYear": "1997",
      "description": {
        "en": "First distillation of Hazelburn (triple-distilled, unpeated), completing Springbank's unique trio of single malt styles.",
        "ru": "Запуск Hazelburn (тройная дистилляция, без торфа), окончательно сформировавший трио стилей: Springbank, Longrow и Hazelburn.",
        "uk": "Запуск Hazelburn (потрійна дистиляція, без торфу), що остаточно сформував тріо стилів: Springbank, Longrow та Hazelburn."
      }
    },
    {
      "id": "glengyle-revival-2000-2004",
      "badge": null,
      "title": {
        "en": "Glengyle revival & region status",
        "ru": "Возрождение Glengyle и статус региона",
        "uk": "Відродження Glengyle та статус регіону"
      },
      "subtitle": "",
      "dateOrYear": "2000–2004",
      "description": {
        "en": "Hedley Wright buys and reopens Glengyle (Kilkerran), securing Campbeltown's official status as an independent whisky region.",
        "ru": "Хедли Райт выкупает и возрождает Glengyle (Kilkerran), сохраняя за Кэмпбелтауном статус официального региона виски.",
        "uk": "Хедлі Райт викуповує та відроджує Glengyle (Kilkerran), зберігаючи за Кемпбелтауном статус офіційного регіону віскі."
      }
    },
    {
      "id": "100-floor-malting-2008",
      "badge": null,
      "title": {
        "en": "100% floor maltings",
        "ru": "100% собственного солодования",
        "uk": "100% власного солодування"
      },
      "subtitle": "",
      "dateOrYear": "2008",
      "description": {
        "en": "Springbank transitions to 100% traditional floor maltings on-site to cover all of its production requirements.",
        "ru": "Springbank полностью переходит на собственное напольное солодование, покрывая 100% потребностей производства.",
        "uk": "Springbank повністю переходить на власне підлогове солодування, покриваючи 100% потреб виробництва."
      }
    },
    {
      "id": "hedley-wright-legacy-2023",
      "badge": null,
      "title": {
        "en": "Hedley Wright's legacy",
        "ru": "Наследие Хедли Райта",
        "uk": "Спадщина Хедлі Райта"
      },
      "subtitle": "",
      "dateOrYear": "2023",
      "description": {
        "en": "Hedley Wright passes away at age 92. Ownership transfers to the Mitchell family trust to ensure protection from corporate takeovers.",
        "ru": "Уходит из жизни Хедли Райт (92 года). Управление переходит к семейному трасту Митчеллов для защиты от корпоративных поглощений.",
        "uk": "Іде з життя Хедлі Райт (92 роки). Управління переходить до сімейного трасту Мітчеллів для захисту від корпоративних поглинань."
      }
    },
    {
      "id": "craft-icon-2024-2026",
      "badge": null,
      "title": {
        "en": "Craft icon & collectible status",
        "ru": "Икона ремесленного виски",
        "uk": "Ікона ремісничого віскі"
      },
      "subtitle": "",
      "dateOrYear": "2024–2026",
      "description": {
        "en": "Springbank maintains its status as the ultimate craft whisky icon, adhering strictly to traditional 19th-century methods.",
        "ru": "Springbank удерживает статус главной иконы ремесленного вискиделия, сохраняя традиционные методы XIX века и высокий спрос.",
        "uk": "Springbank утримує статус головної ікони ремісничого віскіробництва, зберігаючи традиційні методи XIX століття та високий попит."
      }
    }
  ]
}
$springbank_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT springbank_id
    FROM distilleries
    WHERE lower(trim(name)) = 'springbank';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 13 THEN
        RAISE EXCEPTION 'Expected 13 Springbank timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = springbank_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Springbank already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Springbank History', 'timeline', timeline, springbank_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'springbank';
