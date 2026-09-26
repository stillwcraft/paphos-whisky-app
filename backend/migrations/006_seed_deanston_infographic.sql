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
    deanston_id integer;
    timeline jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT deanston_id
    FROM distilleries
    WHERE lower(trim(name)) = 'deanston';

    SELECT jsonb_build_object('steps', jsonb_agg(
        jsonb_build_object(
            'id', 'deanston-' || item.ordinality,
            'dateOrYear', item.value->>'dateOrYear',
            'title', jsonb_build_object('en', headings.en, 'ru', headings.ru, 'uk', headings.uk),
            'subtitle', item.value->>'subtitle',
            'description', item.value->'description',
            'badge', NULL
        ) ORDER BY item.ordinality
    )) INTO timeline
    FROM jsonb_array_elements($deanston_data$
[
  {
    "subtitle": "",
    "dateOrYear": "1500",
    "description": {
      "en": "The lands now known as Deanston get their name when Walter Drummond (Dean of Dunblane) inherits the area.",
      "ru": "Земли, известные ныне как Динстон, получают свое название, когда Уолтер Драммонд (декан Данблейна) наследует эту территорию.",
      "uk": "Землі, відомі нині як Дінстон, отримують свою назву, коли Волтер Драммонд (декан Данблейна) успадковує цю територію."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1785",
    "description": {
      "en": "The site is established as a cotton mill designed by inventor Sir Richard Arkwright, powered by the River Teith.",
      "ru": "На этом месте создается хлопчатобумажная фабрика по проекту изобретателя сэра Ричарда Аркрайта, работающая от реки Тейт.",
      "uk": "На цьому місці створюється бавовняна фабрика за проєктом винахідника сера Річарда Аркрайта, що працює від річки Тейт."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1813",
    "description": {
      "en": "Advanced gas lighting is installed in the Deanston village years ahead of the surrounding region.",
      "ru": "В деревне Динстон устанавливается передовое газовое освещение на годы раньше окружающего региона.",
      "uk": "У селі Дінстон встановлюється передове газове освітлення на роки раніше за навколишній регіон."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1833",
    "description": {
      "en": "A massive water wheel named \"Hercules\"—for a time the largest in Europe—is installed to drive the cotton looms.",
      "ru": "Для привода ткацких станков устанавливается массивное водяное колесо по имени «Геркулес», некоторое время бывшее крупнейшим в Европе.",
      "uk": "Для приводу ткацьких верстатів встановлюється масивне водяне колесо на ім'я «Геркулес», яке деякий час було найбільшим у Європі."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1964",
    "description": {
      "en": "Following the decline of the local textile industry, the mill closes and is purchased by Brodie Hepburn to convert into a distillery.",
      "ru": "После упадка местной текстильной промышленности фабрика закрывается и покупается Броди Хепберном для переоборудования в винокурню.",
      "uk": "Після занепаду місцевої текстильної промисловості фабрика закривається і купується Броді Гепберном для переобладнання на винокурню."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1965–1966",
    "description": {
      "en": "The industrial buildings are carefully rebuilt; four copper pot stills are installed, and the first casks are filled.",
      "ru": "Промышленные здания бережно перестраиваются; устанавливаются четыре медных перегонных куба, и наполняются первые бочки.",
      "uk": "Промислові будівлі дбайливо перебудовуються; встановлюються чотири мідні перегінні куби, і наповнюються перші бочки."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1966 (October 17)",
    "description": {
      "en": "Deanston Distillery officially opens for production.",
      "ru": "Винокурня Динстон официально открывается для производства.",
      "uk": "Винокурня Дінстон офіційно відкривається для виробництва."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1971",
    "description": {
      "en": "The first single malt from the site is bottled and named Old Bannockburn.",
      "ru": "Первый односолодовый виски с этого места разливается в бутылки под названием Old Bannockburn.",
      "uk": "Перший односолодовий віскі з цього місця розливається в пляшки під назвою Old Bannockburn."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1972",
    "description": {
      "en": "Invergordon Distillers takes full control of the distillery.",
      "ru": "Компания Invergordon Distillers берет под полный контроль винокурню.",
      "uk": "Компанія Invergordon Distillers бере під повний контроль винокурню."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1974",
    "description": {
      "en": "The first single malt officially bearing the Deanston name hits the market.",
      "ru": "Первый односолодовый виски, официально носящий имя Динстон, выходит на рынок.",
      "uk": "Перший односолодовий віскі, що офіційно носить ім'я Дінстон, виходить на ринок."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1982",
    "description": {
      "en": "A severe market downturn and industry crisis force Deanston to close and halt production.",
      "ru": "Серьезный спад на рынке и отраслевой кризис заставляют Динстон закрыться и остановить производство.",
      "uk": "Серйозний спад на ринку та галузева криза змушують Дінстон закритися та зупинити виробництво."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1990",
    "description": {
      "en": "Burn Stewart Distillers purchases the dormant distillery for £2.1 million.",
      "ru": "Компания Burn Stewart Distillers покупает законсервированную винокурню за 2,1 миллиона фунтов стерлингов.",
      "uk": "Компанія Burn Stewart Distillers купує законсервовану винокурню за 2,1 мільйона фунтів стерлінгів."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1991",
    "description": {
      "en": "Distilling operations officially restart at Deanston.",
      "ru": "Дистилляция на Динстоне официально возобновляется.",
      "uk": "Дистиляція на Дінстоні офіційно відновлюється."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2009–2010",
    "description": {
      "en": "The core range is revamped, highlighted by the 2010 launch of Deanston Virgin Oak.",
      "ru": "Базовая линейка обновляется, главным событием становится выпуск Deanston Virgin Oak в 2010 году.",
      "uk": "Базова лінійка оновлюється, головною подією стає випуск Deanston Virgin Oak у 2010 році."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2012",
    "description": {
      "en": "The official visitor centre opens its doors to the public.",
      "ru": "Официальный центр для посетителей открывает свои двери для публики.",
      "uk": "Офіційний центр для відвідувачів відкриває свої двері для публіки."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2013 onwards",
    "description": {
      "en": "Ownership transitions under Distell Group (and later Heineken/Distell structures), with the site continuing its heritage of self-sufficient hydro-electric green energy.",
      "ru": "Право собственности переходит к группе Distell (и позднее к структурам Heineken/Distell), при этом предприятие продолжает традиции самообеспечения экологически чистой гидроэлектроэнергией.",
      "uk": "Право власності переходить до групи Distell (і згодом до структур Heineken/Distell), при цьому підприємство продовжує традиції самозабезпечення екологічно чистою гідроелектроенергією."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2015",
    "description": {
      "en": "The distillery significantly expands its sales geography and launches premium releases, such as the popular Deanston 18 Year Old Cognac Finish.",
      "ru": "Винокурня значительно расширяет географию продаж и запускает премиальные релизы, такие как популярный Deanston 18 Year Old Cognac Finish.",
      "uk": "Винокурня значно розширює географію продажів і запускає преміальні релізи, такі як популярний Deanston 18 Year Old Cognac Finish."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2016",
    "description": {
      "en": "In honor of its 50th anniversary, the distillery releases an organic expression (Deanston Organic), emphasizing its focus on sustainability and environmental stewardship.",
      "ru": "В честь своего 50-летия винокурня выпускает органический релиз (Deanston Organic), подчеркивая свой фокус на экологичности и бережном отношении к природе.",
      "uk": "На честь свого 50-річчя винокурня випускає органічний реліз (Deanston Organic), підкреслюючи свій фокус на екологічності та дбайливому ставленні до природи."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2021",
    "description": {
      "en": "A major restructuring begins. Global brewing giant Heineken announces the acquisition of parent company Distell for €2.2 billion.",
      "ru": "Начинается масштабная реструктуризация. Глобальный пивоваренный гигант Heineken объявляет о поглощении материнской компании Distell за €2.2 миллиарда.",
      "uk": "Починається масштабніша реструктуризація. Глобальний пивоварний гігант Heineken оголошує про поглинання материнської компанії Distell за €2.2 мільярда."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2023",
    "description": {
      "en": "The deal process is completed. Since Heineken focuses on beer and cider, Distell's spirits (including Deanston, Bunnahabhain, and Tobermory) are spun off into the independent company CVH Spirits (Cape Vin Holdings), with investment group Remgro becoming the primary owner.",
      "ru": "Процесс сделки завершается. Поскольку Heineken сфокусирован на пиве и сидре, крепкий алкоголь Distell (включая Deanston, Bunnahabhain и Tobermory) выделяется в независимую компанию CVH Spirits (Cape Vin Holdings). Основным владельцем становится инвестиционная группа Remgro.",
      "uk": "Процес угоди завершується. Оскільки Heineken сфокусований на пиві та сидрі, міцний алкоголь Distell (включаючи Deanston, Bunnahabhain та Tobermory) виділяється в незалежну компанію CVH Spirits (Cape Vin Holdings). Основним власником стає інвестиційна група Remgro."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2024–2026",
    "description": {
      "en": "Deanston continues to be one of Scotland's greenest distilleries, fully self-powered by upgraded hydro-turbines on the River Teith, while actively promoting exclusive limited series such as The Chronicles Series for vintage and waxy flavor profile enthusiasts.",
      "ru": "Deanston продолжает оставаться одной из самых экологически чистых винокурен Шотландии, полностью обеспечивая себя электроэнергией благодаря модернизированным гидротурбинам на реке Тейт. Параллельно винокурня активно продвигает эксклюзивные лимитированные серии, такие как The Chronicles Series, созданные для ценителей винтажных релизов и глубоких маслянистых («восковых») вкусовых профилей.",
      "uk": "Deanston продовжує залишатися однією з найбільш екологічно чистих винокурень Шотландії, повністю забезпечуючи себе електроенергією завдяки модернізованим гідротурбінам на річці Тейт. Паралельно винокурня активно просуває ексклюзивні лімітовані серії, такі як The Chronicles Series, створені для поціновувачів вінтажних релізів та глибоких маслянистих («воскових») смакових профілів."
    }
  }
]
$deanston_data$::jsonb) WITH ORDINALITY AS item(value, ordinality)
    JOIN (VALUES
        (1, 'The Deanston name', 'Происхождение названия', 'Походження назви'),
        (2, 'The cotton mill', 'Хлопчатобумажная фабрика', 'Бавовняна фабрика'),
        (3, 'Gas lighting', 'Газовое освещение', 'Газове освітлення'),
        (4, 'The Hercules water wheel', 'Водяное колесо «Геркулес»', 'Водяне колесо «Геркулес»'),
        (5, 'From mill to distillery', 'От фабрики к винокурне', 'Від фабрики до винокурні'),
        (6, 'The first casks', 'Первые бочки', 'Перші бочки'),
        (7, 'Deanston opens', 'Открытие Deanston', 'Відкриття Deanston'),
        (8, 'Old Bannockburn', 'Old Bannockburn', 'Old Bannockburn'),
        (9, 'Invergordon Distillers', 'Invergordon Distillers', 'Invergordon Distillers'),
        (10, 'Deanston single malt', 'Односолодовый Deanston', 'Односолодовий Deanston'),
        (11, 'Production stops', 'Остановка производства', 'Зупинка виробництва'),
        (12, 'Burn Stewart Distillers', 'Burn Stewart Distillers', 'Burn Stewart Distillers'),
        (13, 'Distilling resumes', 'Возобновление дистилляции', 'Відновлення дистиляції'),
        (14, 'Deanston Virgin Oak', 'Deanston Virgin Oak', 'Deanston Virgin Oak'),
        (15, 'Visitor centre opens', 'Открытие центра для посетителей', 'Відкриття центру для відвідувачів'),
        (16, 'Distell and hydro power', 'Distell и гидроэнергия', 'Distell і гідроенергія'),
        (17, 'Premium releases', 'Премиальные релизы', 'Преміальні релізи'),
        (18, 'Deanston Organic', 'Deanston Organic', 'Deanston Organic'),
        (19, 'Heineken announces acquisition', 'Heineken объявляет о поглощении', 'Heineken оголошує про поглинання'),
        (20, 'CVH Spirits', 'CVH Spirits', 'CVH Spirits'),
        (21, 'Green energy and limited editions', 'Зелёная энергия и лимитированные серии', 'Зелена енергія та лімітовані серії')
    ) AS headings(ordinality, en, ru, uk) ON headings.ordinality = item.ordinality;

    IF jsonb_array_length(timeline->'steps') <> 21 THEN
        RAISE EXCEPTION 'Expected 21 Deanston timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = deanston_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Deanston already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Deanston History', 'timeline', timeline, deanston_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'deanston';
