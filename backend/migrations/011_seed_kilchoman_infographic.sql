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
    kilchoman_id integer;
    timeline jsonb := $kilchoman_data$
{
  "steps": [
    {
      "id": "founding-2001",
      "badge": null,
      "title": {
        "en": "Idea and company registration",
        "ru": "Идея и регистрация компании",
        "uk": "Ідея та реєстрація компанії"
      },
      "subtitle": "",
      "dateOrYear": "2001",
      "description": {
        "en": "Drinks expert Anthony Wills conceives a full-cycle 'farm distillery'. Kilchoman Distillery Company Ltd is officially registered on 12 November.",
        "ru": "Энтони Уиллс задумывает независимую «фермерскую винокурню». 12 ноября официально регистрируется Kilchoman Distillery Company Ltd.",
        "uk": "Ентоні Віллс задумує незалежну «фермерську винокурню». 12 листопада офіційно реєструється Kilchoman Distillery Company Ltd."
      }
    },
    {
      "id": "rockside-farm-2004",
      "badge": null,
      "title": {
        "en": "Construction at Rockside Farm",
        "ru": "Строительство на Rockside Farm",
        "uk": "Будівництво на Rockside Farm"
      },
      "subtitle": "",
      "dateOrYear": "2004",
      "description": {
        "en": "Anthony and Kathy Wills move to Islay and begin construction at Rockside Farm, making Kilchoman the first new Islay distillery since 1881.",
        "ru": "Семья Уиллс начинает строительство на ферме Rockside Farm. Kilchoman становится первой новой винокурней на Айлее с 1881 года.",
        "uk": "Родина Віллс розпочинає будівництво на фермі Rockside Farm. Kilchoman стає першою новою винокурнею на Айлеї з 1881 року."
      }
    },
    {
      "id": "first-cask-2005",
      "badge": null,
      "title": {
        "en": "First cask filled",
        "ru": "Заполнение первой бочки",
        "uk": "Заповнення першої бочки"
      },
      "subtitle": "",
      "dateOrYear": "2005",
      "description": {
        "en": "On 14 December, Cask No. 1 is officially filled, initiating Kilchoman's core 'barley-to-bottle' philosophy.",
        "ru": "14 декабря официально заполнена первая бочка (Cask No. 1), давая старт философии «от ячменя до бутылки».",
        "uk": "14 грудня офіційно заповнено першу бочку (Cask No. 1), даючи старт філософії «від ячменю до пляшки»."
      }
    },
    {
      "id": "fire-swan-2006",
      "badge": null,
      "title": {
        "en": "First full year & Dr. Jim Swan",
        "ru": "Первый год и доктор Джим Сван",
        "uk": "Перший рік та доктор Джим Сван"
      },
      "subtitle": "",
      "dateOrYear": "2006",
      "description": {
        "en": "Despite a kiln fire slowing floor malting, 353 casks are produced in the first year with guidance from legendary consultant Dr. Jim Swan.",
        "ru": "Несмотря на пожар в сушильне, за первый год производится 353 бочки. К созданию профиля спиртов привлекается доктор Джим Сван.",
        "uk": "Незважаючи на пожежу в сушарці, за перший рік виробляється 353 бочки. До створення профілю спиртів залучається доктор Джим Сван."
      }
    },
    {
      "id": "inaugural-release-2009",
      "badge": null,
      "title": {
        "en": "Inaugural Release",
        "ru": "Первый официальный релиз",
        "uk": "Перший офіційний реліз"
      },
      "subtitle": "",
      "dateOrYear": "2009",
      "description": {
        "en": "Release of the first official 3-year-old single malt (Inaugural Release), causing great excitement among whisky enthusiasts.",
        "ru": "Выпуск первого официального 3-летнего односолодового виски (Inaugural Release), вызвавшего высокий интерес экспертов.",
        "uk": "Випуск першого офіційного 3-річного односолодового віскі (Inaugural Release), що викликав високий інтерес експертів."
      }
    },
    {
      "id": "100-islay-2011",
      "badge": null,
      "title": {
        "en": "First 100% Islay release",
        "ru": "Релиз 100% Islay",
        "uk": "Реліз 100% Islay"
      },
      "subtitle": "",
      "dateOrYear": "2011",
      "description": {
        "en": "Launch of the 100% Islay edition—whisky fully grown, malted, distilled, matured, and bottled on the farm.",
        "ru": "Запуск первого релиза 100% Islay: виски, полностью выращенный, осоложенный, дистиллированный и разлитый на ферме.",
        "uk": "Запуск першого релізу 100% Islay: віскі, повністю вирощений, осороджений, дистильований та розлитий на фермі."
      }
    },
    {
      "id": "machir-bay-2012",
      "badge": null,
      "title": {
        "en": "Machir Bay debut",
        "ru": "Дебют Machir Bay",
        "uk": "Дебют Machir Bay"
      },
      "subtitle": "",
      "dateOrYear": "2012",
      "description": {
        "en": "Debut of the flagship Machir Bay, combining peat smoke, citrus, and maritime freshness into Kilchoman's core signature style.",
        "ru": "Дебют регулярного розлива Machir Bay, ставшего визитной карточкой с балансом дыма, торфа, цитрусов и свежести.",
        "uk": "Дебют регулярного розливу Machir Bay, що став візитівкою з балансом диму, торфу, цитрусів та свіжості."
      }
    },
    {
      "id": "loch-gorm-2013",
      "badge": null,
      "title": {
        "en": "Loch Gorm & Conisby warehouses",
        "ru": "Loch Gorm и склады Conisby",
        "uk": "Loch Gorm та склади Conisby"
      },
      "subtitle": "",
      "dateOrYear": "2013",
      "description": {
        "en": "Release of the first sherry-matured Loch Gorm edition and construction of new maturation warehouses at Conisby.",
        "ru": "Выпуск первого издания серии Loch Gorm (выдержка в бочках Oloroso) и строительство новых складов Conisby.",
        "uk": "Випуск першого видання серії Loch Gorm (витримка у бочках Oloroso) та будівництво нових складів Conisby."
      }
    },
    {
      "id": "rockside-purchase-2015",
      "badge": null,
      "title": {
        "en": "Rockside Farm acquisition",
        "ru": "Выкуп Rockside Farm",
        "uk": "Викуп Rockside Farm"
      },
      "subtitle": "",
      "dateOrYear": "2015",
      "description": {
        "en": "The Wills family buys Rockside Farm (155 hectares), securing complete independence and full control over their barley crop.",
        "ru": "Семья Уиллс полностью выкупает ферму Rockside Farm (155 га), гарантируя независимость и контроль над урожаем ячменя.",
        "uk": "Родина Віллс повністю викуповує ферму Rockside Farm (155 га), гарантуючи незалежність та контроль над врожаєм ячменю."
      }
    },
    {
      "id": "sanaig-2016",
      "badge": null,
      "title": {
        "en": "Sanaig global launch",
        "ru": "Запуск релиза Sanaig",
        "uk": "Запуск релізу Sanaig"
      },
      "subtitle": "",
      "dateOrYear": "2016",
      "description": {
        "en": "Global launch of Sanaig, featuring a higher proportion of sherry cask maturation alongside bourbon casks.",
        "ru": "Глобальный запуск релиза Sanaig с увеличенной долей выдержки в хересных бочках.",
        "uk": "Глобальний запуск релізу Sanaig із збільшеною часткою витримки у хересних бочках."
      }
    },
    {
      "id": "expansion-2019",
      "badge": null,
      "title": {
        "en": "Distillery expansion",
        "ru": "Модернизация и расширение",
        "uk": "Модернізація та розширення"
      },
      "subtitle": "",
      "dateOrYear": "2019",
      "description": {
        "en": "Installation of a second pair of stills and expansion of the malting floor, doubling capacity to 600,000–650,000 liters per year.",
        "ru": "Установка второй пары кубов и расширение солодовни, увеличившие мощности до 600–650 тыс. литров спирта в год.",
        "uk": "Встановлення другої пари кубів та розширення солодовні, що збільшили потужності до 600–650 тис. літрів спирту на рік."
      }
    },
    {
      "id": "kilchoman-16yo-2022",
      "badge": null,
      "title": {
        "en": "16 Year Old & rare casks",
        "ru": "Kilchoman 16 YO и редкие бочки",
        "uk": "Kilchoman 16 YO та рідкісні бочки"
      },
      "subtitle": "",
      "dateOrYear": "2022",
      "description": {
        "en": "Release of Kilchoman 16 Year Old, opening of a new racked warehouse, and experiments with Madeira, Marsala, and Sauternes casks.",
        "ru": "Выпуск первого 16-летнего релиза, запуск стеллажного склада и эксперименты с редкими бочками (Мадейра, Марсала, Сотерн).",
        "uk": "Випуск першого 16-річного релізу, запуск стелажного складу та експерименти з рідкісними бочками (Мадейра, Марсала, Сотерн)."
      }
    },
    {
      "id": "breckenridge-2023",
      "badge": null,
      "title": {
        "en": "Breckenridge partnership",
        "ru": "Партнёрство с Breckenridge",
        "uk": "Партнерство з Breckenridge"
      },
      "subtitle": "",
      "dateOrYear": "2023",
      "description": {
        "en": "Establishment of direct bourbon cask sourcing from Colorado's craft Breckenridge Distillery.",
        "ru": "Переход на прямые поставки бочек из-под бурбона от крафтовой винокурни Breckenridge Distillery (Колорадо).",
        "uk": "Перехід на прямі поставки бочок з-під бурбону від крафтової винокурні Breckenridge Distillery (Колорадо)."
      }
    },
    {
      "id": "20th-anniversary-2025",
      "badge": null,
      "title": {
        "en": "20th Anniversary",
        "ru": "20-летний юбилей",
        "uk": "20-річний ювілей"
      },
      "subtitle": "",
      "dateOrYear": "2025",
      "description": {
        "en": "Celebration of 20 years of distilling (2005–2025) with the 20th Anniversary Cask Series and a charity raffle for Cask No. 1.",
        "ru": "20-летний юбилей винокурни (2005–2025): выпуск серии 20th Anniversary Cask Series и благотворительный розыгрыш бутылки из Cask No. 1.",
        "uk": "20-річний ювілей винокурні (2005–2025): випуск серії 20th Anniversary Cask Series та доброчинний розіграш пляшки з Cask No. 1."
      }
    },
    {
      "id": "family-legacy-2026",
      "badge": null,
      "title": {
        "en": "Independent family legacy",
        "ru": "Семейное наследие",
        "uk": "Сімейна спадщина"
      },
      "subtitle": "",
      "dateOrYear": "2026",
      "description": {
        "en": "Kilchoman remains one of Scotland's premier independent family-run farm distilleries, managed by Anthony, Kathy, and their sons George, James, and Peter.",
        "ru": "Kilchoman остаётся успешной семейной винокурней Шотландии, управляемой Энтони, Кэти и их сыновьями — Джорджем, Джеймсом и Питером.",
        "uk": "Kilchoman залишається успішною сімейною винокурнею Шотландії, якою керують Ентоні, Кеті та їхні сини — Джордж, Джеймс і Пітер."
      }
    }
  ]
}
$kilchoman_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT kilchoman_id
    FROM distilleries
    WHERE lower(trim(name)) = 'kilchoman';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 15 THEN
        RAISE EXCEPTION 'Expected 15 Kilchoman timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = kilchoman_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Kilchoman already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Kilchoman History', 'timeline', timeline, kilchoman_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'kilchoman';
