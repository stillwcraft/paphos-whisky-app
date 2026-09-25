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
    arran_id integer;
    timeline jsonb := $arran_payload$
{
  "steps": [
    {
      "id": "illicit-stills-1800",
      "badge": null,
      "title": {
        "en": "Early distilling on Arran",
        "ru": "Ранняя история виски на Арране",
        "uk": "Рання історія віскі на Аррані"
      },
      "subtitle": "",
      "dateOrYear": "1800",
      "description": {
        "en": "In the early 1800s, dozens of small illicit stills operated across Arran, but whisky production eventually ceased by 1840.",
        "ru": "В начале XIX века на острове Арран работали десятки нелегальных производств, но к 1840 году вискиварение полностью прекратилось.",
        "uk": "На початку XIX століття на острові Арран працювали десятки нелегальних виробництв, але до 1840 року виготовлення віскі повністю припинилося."
      }
    },
    {
      "id": "site-search-1993",
      "badge": null,
      "title": {
        "en": "Finding the site",
        "ru": "Поиск идеального места",
        "uk": "Пошук ідеального місця"
      },
      "subtitle": "",
      "dateOrYear": "1993",
      "description": {
        "en": "The search began to find the perfect location for a new distillery on Arran, settling on Lochranza for its exceptionally pure water.",
        "ru": "Начался поиск идеального места для новой винокурни на Арране, и выбор пал на Лохранзу из-за чистейшей родниковой воды.",
        "uk": "Розпочався пошук ідеального місця для нової винокурні на Аррані, і вибір впав на Лохранзу через найчистішу джерельну воду."
      }
    },
    {
      "id": "construction-1994",
      "badge": null,
      "title": {
        "en": "Construction begins",
        "ru": "Начало строительства",
        "uk": "Початок будівництва"
      },
      "subtitle": "",
      "dateOrYear": "1994",
      "description": {
        "en": "Building work on the new distillery in Lochranza starts on 16 December.",
        "ru": "16 декабря официально начинается строительство новой винокурни в деревне Лохранза.",
        "uk": "16 грудня офіційно розпочинається будівництво нової винокурні в селищі Лохранза."
      }
    },
    {
      "id": "first-spirit-1995",
      "badge": null,
      "title": {
        "en": "First spirit flows",
        "ru": "Первый дистиллят",
        "uk": "Перший дистилят"
      },
      "subtitle": "",
      "dateOrYear": "1995",
      "description": {
        "en": "First spirit runs through the spirit safe at 2:29 pm on 29 June 1995, reviving legal distilling after over 150 years.",
        "ru": "29 июня 1995 года в 14:29 через спиртовой сейф проходит первый дистиллят, возрождая легальное производство спустя более 150 лет.",
        "uk": "29 червня 1995 року о 14:29 через спиртовий сейф проходить перший дистилят, відроджуючи легальне виробництво через понад 150 років."
      }
    },
    {
      "id": "royal-opening-1997",
      "badge": null,
      "title": {
        "en": "Royal opening",
        "ru": "Королевское открытие",
        "uk": "Королівське відкриття"
      },
      "subtitle": "",
      "dateOrYear": "1997",
      "description": {
        "en": "The Visitor Centre is opened on 9 August by Her Majesty The Queen, who is presented with two casks for Princes William and Harry.",
        "ru": "9 августа Центр посетителей открывает Королева Елизавета II, которой дарят две бочки для принцев Уильяма и Гарри.",
        "uk": "9 серпня Центр відвідувачів відкриває Королева Єлизавета II, якій дарують дві бочки для принців Вільяма та Гаррі."
      }
    },
    {
      "id": "first-single-malt-1998",
      "badge": null,
      "title": {
        "en": "First 3-Year-Old release",
        "ru": "Первый релиз 3 YO",
        "uk": "Перший реліз 3 YO"
      },
      "subtitle": "",
      "dateOrYear": "1998",
      "description": {
        "en": "Scottish actor Ewan McGregor opens the first cask on 25 July, marking the release of the first 3-year-old Arran Single Malt.",
        "ru": "Шотландский актёр Юэн Макгрегор 25 июля открывает первую бочку, ознаменовав выход первого 3-летнего односолодового виски Arran.",
        "uk": "Шотландський актор Юен Макгрегор 25 липня відкриває першу бочку, що ознаменувало вихід першого 3-річного односолодового віскі Arran."
      }
    },
    {
      "id": "ten-years-old-2006",
      "badge": null,
      "title": {
        "en": "Arran 10 Year Old",
        "ru": "Релиз Arran 10 Year Old",
        "uk": "Реліз Arran 10 Year Old"
      },
      "subtitle": "",
      "dateOrYear": "2006",
      "description": {
        "en": "The official commercially available Arran Single Malt 10 Year Old launches in the spring.",
        "ru": "Весной выходит первый официальный коммерческий релиз флагманского Arran Single Malt 10 Year Old.",
        "uk": "Навесні виходить перший офіційний комерційний реліз флагманського Arran Single Malt 10 Year Old."
      }
    },
    {
      "id": "mactaggart-2007",
      "badge": null,
      "title": {
        "en": "Distillery of the Year",
        "ru": "Винокурня года",
        "uk": "Винокурня року"
      },
      "subtitle": "",
      "dateOrYear": "2007",
      "description": {
        "en": "Isle of Arran Distillers is named Scottish Distillery of the Year, and James MacTaggart takes over as Distillery Manager.",
        "ru": "Isle of Arran Distillers признают «Винокурней года в Шотландии», а Джеймс Мактаггарт становится управляющим производства.",
        "uk": "Isle of Arran Distillers визнають «Винокурнею року в Шотландії», а Джеймс Мактаггарт стає керівником виробництва."
      }
    },
    {
      "id": "fourteen-machrie-2010",
      "badge": null,
      "title": {
        "en": "Arran 14 YO & Machrie Moor",
        "ru": "Arran 14 YO и Machrie Moor",
        "uk": "Arran 14 YO та Machrie Moor"
      },
      "subtitle": "",
      "dateOrYear": "2010",
      "description": {
        "en": "The official Arran 14 Year Old launches in August, followed by the first peated expression, Machrie Moor, in December.",
        "ru": "В августе выходит Arran 14 Year Old, а в декабре представлен первый торфяной релиз винокурни — Machrie Moor.",
        "uk": "У серпні виходить Arran 14 Year Old, а у грудні представлено перший торф'яний реліз винокурні — Machrie Moor."
      }
    },
    {
      "id": "white-stag-2015",
      "badge": null,
      "title": {
        "en": "White Stag community",
        "ru": "Клуб White Stag",
        "uk": "Клуб White Stag"
      },
      "subtitle": "",
      "dateOrYear": "2015",
      "description": {
        "en": "The White Stag Tasting Panel is formed, giving birth to an exclusive global community of Arran enthusiasts.",
        "ru": "Формируется дегустационная группа White Stag, положившая начало международному сообществу фанатов бренда.",
        "uk": "Формується дегустаційна група White Stag, що започаткувала міжнародну спільноту фанатів бренду."
      }
    },
    {
      "id": "eighteen-years-2016",
      "badge": null,
      "title": {
        "en": "Arran 18 Year Old",
        "ru": "Релиз Arran 18 Year Old",
        "uk": "Реліз Arran 18 Year Old"
      },
      "subtitle": "",
      "dateOrYear": "2016",
      "description": {
        "en": "The 18-year-old expression joins the core range in February, marking a major milestone in aged whiskies.",
        "ru": "В феврале в постоянную линейку входит 18-летний виски, выводя бренд в категорию выдержанных релизов.",
        "uk": "У лютому до постійної лінійки входить 18-річний віскі, що виводить бренд у категорію витриманих релізів."
      }
    },
    {
      "id": "lagg-construction-2018",
      "badge": null,
      "title": {
        "en": "Lagg Distillery construction",
        "ru": "Строительство Lagg",
        "uk": "Будівництво Lagg"
      },
      "subtitle": "",
      "dateOrYear": "2018",
      "description": {
        "en": "Construction of the company's second site, Lagg Distillery on the south of Arran, gets fully underway.",
        "ru": "На юге острова разворачивается активное строительство второй винокурни компании — Lagg Distillery.",
        "uk": "На півдні острова розгортається активне будівництво другої винокурні компанії — Lagg Distillery."
      }
    },
    {
      "id": "lagg-opening-2019",
      "badge": null,
      "title": {
        "en": "Lagg opens & Brand Rebrand",
        "ru": "Открытие Lagg и ребрендинг",
        "uk": "Відкриття Lagg та ребрендинг"
      },
      "subtitle": "",
      "dateOrYear": "2019",
      "description": {
        "en": "Production begins at Lagg Distillery in March for peated spirits, while Lochranza undergoes a major brand refresh.",
        "ru": "В марте запускается винокурня Lagg (для торфяного спирта), а линейка в Лохранзе проходит масштабный ребрендинг.",
        "uk": "У березні запускається винокурня Lagg (для торф'яного спирту), а лінійка у Лохранзі проходить масштабний ребрендинг."
      }
    }
  ]
}
$arran_payload$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT arran_id FROM distilleries WHERE lower(trim(name)) = 'arran';
    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 13 THEN
        RAISE EXCEPTION 'Expected 13 Arran timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = arran_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Arran already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Arran History', 'timeline', timeline, arran_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'arran';
