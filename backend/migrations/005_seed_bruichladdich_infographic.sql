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
    bruichladdich_id integer;
    timeline jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT bruichladdich_id
    FROM distilleries
    WHERE lower(trim(name)) IN ('bruichladdich', 'bruichladdie');

    SELECT jsonb_build_object('steps', jsonb_agg(
        jsonb_build_object(
            'id', 'bruichladdich-' || item.ordinality,
            'dateOrYear', item.value->>'dateOrYear',
            'title', jsonb_build_object('en', headings.en, 'ru', headings.ru, 'uk', headings.uk),
            'subtitle', item.value->>'subtitle',
            'description', item.value->'description',
            'badge', NULL
        ) ORDER BY item.ordinality
    )) INTO timeline
    FROM jsonb_array_elements($bruichladdich_data$
[
  {
    "subtitle": "",
    "dateOrYear": "1881",
    "description": {
      "en": "Brothers William, John, and Robert Harvey build Bruichladdich on the western shore of Loch Indaal on the Isle of Islay.",
      "ru": "Братья Уильям, Джон и Роберт Харви строят винокурню Бруклади на западном берегу озера Лох-Индаал на острове Айлей.",
      "uk": "Брати Вільям, Джон і Роберт Гарві будують броварню Брукладді на західному березі озера Лох-Індаал на острові Айлей."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1886",
    "description": {
      "en": "Reconstructed as the Bruichladdich Distillery Co. Ltd. with Harvey family shareholdings.",
      "ru": "Реконструирована как компания Bruichladdich Distillery Co. Ltd. с долевым участием семьи Харви.",
      "uk": "Реконструйовано як компанію Bruichladdich Distillery Co. Ltd. із часткою власності родини Гарві."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1907–1918",
    "description": {
      "en": "The distillery is closed due to financial struggles and a glut of unsold stock.",
      "ru": "Винокурня закрыта из-за финансовых трудностей и избытка нераспроданных запасов.",
      "uk": "Винокурню закрито через фінансові труднощі та надлишок нерозпроданих запасів."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1929–1935",
    "description": {
      "en": "Closed again during the global economic crisis; sold in 1938 to Joseph Hobbs, Hatim Attari, and Alexander Tolmie.",
      "ru": "Снова закрыта во время глобального экономического кризиса; продана в 1938 году Джозефу Хоббсу, Хатиму Аттари и Александру Толми.",
      "uk": "Знову закрита під час глобальної економічної кризи; продана у 1938 році Джозефу Гоббсу, Гатиму Аттарі та Александру Толмі."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1941–1945",
    "description": {
      "en": "Temporarily closed during World War II.",
      "ru": "Временно закрыта во время Второй мировой войны.",
      "uk": "Тимчасово закрита під час Другої світової війни."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1952",
    "description": {
      "en": "Sold to Glasgow-based whisky brokers Ross & Coulter.",
      "ru": "Продана глазговским виски-брокерам Ross & Coulter.",
      "uk": "Продана віскі-брокерам із Глазго Ross & Coulter."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1954",
    "description": {
      "en": "Becomes part of the Distillers Company Ltd. (DCL) portfolio.",
      "ru": "Становится частью портфеля компании Distillers Company Ltd. (DCL).",
      "uk": "Стає частиною портфеля компанії Distillers Company Ltd. (DCL)."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1960",
    "description": {
      "en": "Acquired by A.B. Grant.",
      "ru": "Приобретена А. Б. Грантом.",
      "uk": "Придбана А. Б. Грантом."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1968",
    "description": {
      "en": "Taken over by Invergordon Distillers.",
      "ru": "Поглощена компанией Invergordon Distillers.",
      "uk": "Поглинена компанією Invergordon Distillers."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1975",
    "description": {
      "en": "Production capacity is doubled with an increase from two to four stills.",
      "ru": "Производственная мощность удвоена за счет увеличения количества перегонных кубов с двух до четырех.",
      "uk": "Виробничу потужність подвоєно завдяки збільшенню кількості перегінних кубів із двох до чотирьох."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1993",
    "description": {
      "en": "Whyte & Mackay acquires Invergordon Distillers, bringing Bruichladdich into its portfolio.",
      "ru": "Компания Whyte & Mackay приобретает Invergordon Distillers, включая Бруклади в свой портфель.",
      "uk": "Компанія Whyte & Mackay купує Invergordon Distillers, додаючи Брукладді до свого портфеля."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "1995",
    "description": {
      "en": "The distillery is closed (mothballed) by Whyte & Mackay.",
      "ru": "Винокурня консервируется (закрывается) компанией Whyte & Mackay.",
      "uk": "Винокурню законсервовано (закрито) компанією Whyte & Mackay."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2000",
    "description": {
      "en": "Independent bottling company Murray McDavid (led by Mark Reynier) buys the distillery for £6.5 million.",
      "ru": "Независимая боттлерская компания Murray McDavid (под руководством Марка Рейнье) покупает винокурню за 6,5 млн фунтов стерлингов.",
      "uk": "Незалежна ботлерська компанія Murray McDavid (під керівництвом Марка Рейньє) купує винокурню за 6,5 млн фунтів стерлінгів."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2001",
    "description": {
      "en": "Production resumes with the first new distillation in July.",
      "ru": "Производство возобновляется с первой новой дистилляцией в июле.",
      "uk": "Виробництво відновлюється з першою новою дистиляцією в липні."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2002",
    "description": {
      "en": "The distillery produces Octomore, launched as the world's most heavily peated single malt.",
      "ru": "Винокурня производит Octomore, представленный как самый сильно торфяной односолодовый виски в мире.",
      "uk": "Винокурня виробляє Octomore, випущений як найбільш торф'яний односолодовий віскі у світі."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2004",
    "description": {
      "en": "Becomes the first Islay distillery to grow barley locally on the island for its single malts.",
      "ru": "Становится первой винокурней на Айлее, выращивающей ячмень локально на острове для своих односолодовых виски.",
      "uk": "Стає першою винокурнею на Айлеї, що вирощує ячмінь локально на острові для своїх односолодових віскі."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2006",
    "description": {
      "en": "Launches the inaugural official bottling of Port Charlotte.",
      "ru": "Выпускает первый официальный релиз (розлив) Port Charlotte.",
      "uk": "Випускає первинний офіційний розлив Port Charlotte."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2011",
    "description": {
      "en": "Begins production of The Botanist gin.",
      "ru": "Начинает производство джина The Botanist.",
      "uk": "Починає виробництво джину The Botanist."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2012",
    "description": {
      "en": "French spirits group Rémy Cointreau purchases Bruichladdich for £58 million.",
      "ru": "Французская алкогольная группа Rémy Cointreau покупает Бруклади за 58 млн фунтов стерлингов.",
      "uk": "Французька алкогольна група Rémy Cointreau купує Брукладді за 58 млн фунтів стерлінгів."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2020",
    "description": {
      "en": "Becomes a certified B Corporation and shifts to 100% green electricity.",
      "ru": "Получает сертификат B Corporation и переходит на 100% зеленую электроэнергию.",
      "uk": "Отримує сертифікат B Corporation та переходить на 100% зелену електроенергію."
    }
  },
  {
    "subtitle": "",
    "dateOrYear": "2023",
    "description": {
      "en": "Introduces updated core packaging and a new bottle design.",
      "ru": "Представляет обновленную базовую упаковку и новый дизайн бутылки.",
      "uk": "Представляє оновлену базову упаковку та новий дизайн пляшки."
    }
  }
]
$bruichladdich_data$::jsonb) WITH ORDINALITY AS item(value, ordinality)
    JOIN (VALUES
        (1, 'The Harvey brothers build Bruichladdich', 'Братья Харви строят винокурню', 'Брати Гарві будують винокурню'),
        (2, 'A family company', 'Семейная компания', 'Родинна компанія'),
        (3, 'First closure', 'Первое закрытие', 'Перше закриття'),
        (4, 'The Great Depression', 'Великая депрессия', 'Велика депресія'),
        (5, 'World War II', 'Вторая мировая война', 'Друга світова війна'),
        (6, 'Ross & Coulter', 'Ross & Coulter', 'Ross & Coulter'),
        (7, 'Distillers Company Ltd.', 'Distillers Company Ltd.', 'Distillers Company Ltd.'),
        (8, 'A.B. Grant', 'А. Б. Грант', 'А. Б. Грант'),
        (9, 'Invergordon Distillers', 'Invergordon Distillers', 'Invergordon Distillers'),
        (10, 'Capacity doubles', 'Мощность удваивается', 'Потужність подвоюється'),
        (11, 'Whyte & Mackay', 'Whyte & Mackay', 'Whyte & Mackay'),
        (12, 'Mothballed', 'Консервация винокурни', 'Консервація винокурні'),
        (13, 'A new beginning', 'Новое начало', 'Новий початок'),
        (14, 'Production resumes', 'Возобновление производства', 'Відновлення виробництва'),
        (15, 'Octomore', 'Octomore', 'Octomore'),
        (16, 'Islay-grown barley', 'Ячмень с Айлея', 'Ячмінь з Айлею'),
        (17, 'Port Charlotte', 'Port Charlotte', 'Port Charlotte'),
        (18, 'The Botanist', 'The Botanist', 'The Botanist'),
        (19, 'Rémy Cointreau', 'Rémy Cointreau', 'Rémy Cointreau'),
        (20, 'B Corp and green electricity', 'B Corp и зелёная энергия', 'B Corp і зелена енергія'),
        (21, 'A new bottle design', 'Новый дизайн бутылки', 'Новий дизайн пляшки')
    ) AS headings(ordinality, en, ru, uk) ON headings.ordinality = item.ordinality;

    IF jsonb_array_length(timeline->'steps') <> 21 THEN
        RAISE EXCEPTION 'Expected 21 Bruichladdich timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = bruichladdich_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Bruichladdich already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Bruichladdich History', 'timeline', timeline, bruichladdich_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) IN ('bruichladdich', 'bruichladdie');
