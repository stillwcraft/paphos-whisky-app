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
    bowmore_id integer;
    timeline jsonb := $bowmore_data$
{
  "steps": [
    {
      "id": "founding-1779",
      "badge": null,
      "title": {
        "en": "Oldest legal distillery on Islay",
        "ru": "Старейшая винокурня Айлеи",
        "uk": "Найстаріша винокурня Айлею"
      },
      "subtitle": "",
      "dateOrYear": "1779",
      "description": {
        "en": "Local merchant David Simson officially founds Bowmore in Islay's capital, making it the island's oldest legal distillery and one of Scotland's oldest.",
        "ru": "Основание винокурни Дэвидом Симсоном в столице острова — Боморе. Bowmore является самой старой легальной винокурней на Айлее.",
        "uk": "Заснування винокурні Девідом Сімсоном у столиці острова — Боморі. Bowmore є найстарішою легальною винокурнею на Айлеї."
      }
    },
    {
      "id": "mutter-1837",
      "badge": null,
      "title": {
        "en": "James Mutter era & steam power",
        "ru": "Эра Джеймса Маттера",
        "uk": "Ера Джеймса Маттера"
      },
      "subtitle": "",
      "dateOrYear": "1837",
      "description": {
        "en": "Industrialist James Mutter acquires Bowmore, modernizing production with steam power and building a dam and aqueduct from the River Laggan.",
        "ru": "Винокурню приобретает Джеймс Маттер. Он модернизирует производство, внедряет пар и строит плотину с каналом от реки Лагган.",
        "uk": "Винокурню купує Джеймс Маттер. Він модернізує виробництво, впроваджує пару та будує греблю з каналом від річки Лагган."
      }
    },
    {
      "id": "sherriff-1925",
      "badge": null,
      "title": {
        "en": "J.B. Sherriff & Co. acquisition",
        "ru": "Покупка компанией J.B. Sherriff & Co.",
        "uk": "Купівля компанією J.B. Sherriff & Co."
      },
      "subtitle": "",
      "dateOrYear": "1925",
      "description": {
        "en": "Acquired by J.B. Sherriff & Co., steering the distillery through the interwar economic slump and US Prohibition.",
        "ru": "Покупка компанией J.B. Sherriff & Co., управлявшей дистиллерией в период межвоенного кризиса и «сухого закона» в США.",
        "uk": "Купівля компанією J.B. Sherriff & Co., яка керувала дистилерією у період міжвоєнної кризи та «сухого закону» в США."
      }
    },
    {
      "id": "raf-ww2-1940-1945",
      "badge": null,
      "title": {
        "en": "WWII & RAF Coastal Command",
        "ru": "Вторая мировая война и ВВС",
        "uk": "Друга світова війна та ВПС"
      },
      "subtitle": "",
      "dateOrYear": "1940–1945",
      "description": {
        "en": "Production halts during World War II as the buildings are handed to the RAF Coastal Command for Atlantic flying boat patrols.",
        "ru": "В годы Второй мировой войны производство остановлено. Здания переданы ВВС Великобритании (RAF) для штаба береговой авиации.",
        "uk": "У роки Другої світової війни виробництво зупинено. Будівлі передано ВПС Великої Британії (RAF) для штабу берегової авіації."
      }
    },
    {
      "id": "morrison-1963",
      "badge": null,
      "title": {
        "en": "Morrison Bowmore era",
        "ru": "Покупка Стэнли Моррисоном",
        "uk": "Купівля Стенлі Моррісоном"
      },
      "subtitle": "",
      "dateOrYear": "1963",
      "description": {
        "en": "Stanley P. Morrison purchases Bowmore, founding Morrison Bowmore Distillers and initiating a major overhaul focused on premium cask maturation.",
        "ru": "Винокурню приобретает Стэнли П. Моррисон. Начинается масштабная реконструкция и фокус на выдержке в бочках премиум-качества.",
        "uk": "Винокурню купує Стенлі П. Моррісон. Розпочинається масштабна реконструкція та фокус на витримці у бочках преміум-якості."
      }
    },
    {
      "id": "no1-vaults-1964",
      "badge": null,
      "title": {
        "en": "Legendary No. 1 Vaults caskings",
        "ru": "Заполнение бочек в No. 1 Vaults",
        "uk": "Заповнення бочок у No. 1 Vaults"
      },
      "subtitle": "",
      "dateOrYear": "1964",
      "description": {
        "en": "Casks filled in 1964 mature in the seaside No. 1 Vaults—Scotland's only below-sea-level warehouse—giving birth to Black Bowmore.",
        "ru": "Спирты 1964 года отправляются на выдержку в No. 1 Vaults (склад ниже уровня моря), давая начало легендарному Black Bowmore.",
        "uk": "Спирти 1964 року відправляються на витримку до No. 1 Vaults (склад нижче рівня моря), даючи початок легендарному Black Bowmore."
      }
    },
    {
      "id": "swimming-pool-1980s",
      "badge": null,
      "title": {
        "en": "Eco-innovation & leisure centre",
        "ru": "Эко-инновация и бассейн",
        "uk": "Еко-інновація та басейн"
      },
      "subtitle": "",
      "dateOrYear": "1980s",
      "description": {
        "en": "Waste heat from pot stills is pioneered to heat the local Mactaggart Leisure Centre swimming pool, converted from a Bowmore warehouse.",
        "ru": "Тепловая энергия перегонных кубов начинает использоваться для нагрева воды в местном бассейне Mactaggart Leisure Centre.",
        "uk": "Теплова енергія перегонних кубів починає використовуватися для нагріву води у місцевому басейні Mactaggart Leisure Centre."
      }
    },
    {
      "id": "suntory-1989-1994",
      "badge": null,
      "title": {
        "en": "Suntory acquisition",
        "ru": "Покупка концерном Suntory",
        "uk": "Купівля концерном Suntory"
      },
      "subtitle": "",
      "dateOrYear": "1989–1994",
      "description": {
        "en": "Japanese giant Suntory buys 35% of Morrison Bowmore in 1989 and acquires full ownership in 1994, expanding global reach.",
        "ru": "Suntory выкупает 35% акций Morrison Bowmore в 1989, а в 1994 году полностью приобретает компанию, выведя Bowmore на мировой рынок.",
        "uk": "Suntory викуповує 35% акцій Morrison Bowmore у 1989, а в 1994 році повністю купує компанію, вивівши Bowmore на світовий ринок."
      }
    },
    {
      "id": "black-bowmore-1993-1995",
      "badge": null,
      "title": {
        "en": "Black Bowmore 1964 releases",
        "ru": "Релиз Black Bowmore 1964",
        "uk": "Реліз Black Bowmore 1964"
      },
      "subtitle": "",
      "dateOrYear": "1993–1995",
      "description": {
        "en": "First vintage releases of Black Bowmore 1964 cause an auction sensation, establishing Bowmore as a premier whisky collector's icon.",
        "ru": "Первые винтажные бутылки Black Bowmore 1964 производят фурор на аукционах, делая бренд иконой коллекционирования.",
        "uk": "Перші вінтажні пляшки Black Bowmore 1964 викликають фурор на аукціонах, роблячи бренд іконою колекціонування."
      }
    },
    {
      "id": "aston-martin-2019",
      "badge": null,
      "title": {
        "en": "Aston Martin partnership",
        "ru": "Партнёрство с Aston Martin",
        "uk": "Партнерство з Aston Martin"
      },
      "subtitle": "",
      "dateOrYear": "2019",
      "description": {
        "en": "Bowmore enters into an exclusive long-term luxury partnership with British supercar manufacturer Aston Martin.",
        "ru": "Запуск эксклюзивного долгосрочного партнёрства с британским производителем суперкаров Aston Martin.",
        "uk": "Запуск ексклюзивного довгострокового партнерства з британським виробником суперкарів Aston Martin."
      }
    },
    {
      "id": "arc52-db5-2020-2023",
      "badge": null,
      "title": {
        "en": "DB5 1964 & ARC-52 decanters",
        "ru": "Релизы DB5 1964 и ARC-52",
        "uk": "Релізи DB5 1964 та ARC-52"
      },
      "subtitle": "",
      "dateOrYear": "2020–2023",
      "description": {
        "en": "Release of iconic Aston Martin design collaborations, including Bowmore DB5 1964, Masters' Selection, and the ARC-52 decanter.",
        "ru": "Выпуск уникальных дизайнерских релизов: Bowmore DB5 1964, линейка Masters' Selection и декантер ARC-52.",
        "uk": "Випуск унікальних дизайнерських релізів: Bowmore DB5 1964, лінійка Masters' Selection та декантер ARC-52."
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
        "en": "Parent company Beam Suntory is officially renamed Suntory Global Spirits.",
        "ru": "Переименование управляющей компании Beam Suntory в Suntory Global Spirits.",
        "uk": "Перейменування керуючої компанії Beam Suntory на Suntory Global Spirits."
      }
    },
    {
      "id": "islay-legend-2025-2026",
      "badge": null,
      "title": {
        "en": "Islay legend & No. 1 Vaults",
        "ru": "Легенда Айлеи и No. 1 Vaults",
        "uk": "Легенда Айлею та No. 1 Vaults"
      },
      "subtitle": "",
      "dateOrYear": "2025–2026",
      "description": {
        "en": "Bowmore maintains its status as an Islay icon, combining floor maltings, No. 1 Vaults aging, core classics (12, 15, 18 YO), and ultra-rare auction releases.",
        "ru": "Bowmore сохраняет статус легенды Айлеи, сочетая собственное солодование, подвалы No. 1 Vaults, классику (12, 15, 18 YO) и редкие релизы.",
        "uk": "Bowmore зберігає статус легенди Айлею, поєднуючи власне солодування, підвали No. 1 Vaults, класику (12, 15, 18 YO) та рідкісні релізи."
      }
    }
  ]
}
$bowmore_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT bowmore_id
    FROM distilleries
    WHERE lower(trim(name)) = 'bowmore';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 13 THEN
        RAISE EXCEPTION 'Expected 13 Bowmore timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = bowmore_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Bowmore already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Bowmore History', 'timeline', timeline, bowmore_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'bowmore';
