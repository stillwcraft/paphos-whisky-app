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
    glenmorangie_id integer;
    timeline jsonb := $glenmorangie_data$
{
  "steps": [
    {
      "id": "morangie-farm-1703",
      "badge": null,
      "title": {
        "en": "First documented brewing",
        "ru": "Первые упоминания",
        "uk": "Перші згадки"
      },
      "subtitle": "",
      "dateOrYear": "1703 / 1738",
      "description": {
        "en": "First documented records of brewing at Morangie Farm near the town of Tain.",
        "ru": "Первые документальные упоминания о пивоварении на ферме Моранджи неподалёку от города Тайн.",
        "uk": "Перші документальні згадки про пивоваріння на фермі Моранджі неподалік від міста Тайн."
      }
    },
    {
      "id": "matheson-1843",
      "badge": null,
      "title": {
        "en": "Glenmorangie founded",
        "ru": "Основание Glenmorangie",
        "uk": "Заснування Glenmorangie"
      },
      "subtitle": "",
      "dateOrYear": "1843",
      "description": {
        "en": "Farmer William Matheson and his wife Anne acquire the farm and convert the brewery into the Glenmorangie distillery.",
        "ru": "Фермер Уильям Мэтесон с женой Энн приобретает ферму и переоборудует пивоварню в винокурню Glenmorangie.",
        "uk": "Фермер Вільям Метесон із дружиною Енн купує ферму та переобладнує пивоварню на винокурню Glenmorangie."
      }
    },
    {
      "id": "tall-stills-1849",
      "badge": null,
      "title": {
        "en": "Tallest stills in Scotland",
        "ru": "Самые высокие кубы",
        "uk": "Найвищі куби"
      },
      "subtitle": "",
      "dateOrYear": "1849",
      "description": {
        "en": "Distillation begins using two gin stills measuring 5.14 meters—the tallest in Scotland—creating a light, floral spirit.",
        "ru": "Запуск дистилляции на кубах высотой 5,14 метра — самых высоких в Шотландии, формирующих лёгкий и элегантный стиль спиртов.",
        "uk": "Запуск дистиляції на кубах висотою 5,14 метра — найвищих у Шотландії, що формують легкий та елегантний стиль спиртів."
      }
    },
    {
      "id": "steam-heating-1887",
      "badge": null,
      "title": {
        "en": "Steam heating innovation",
        "ru": "Паровой обогрев кубов",
        "uk": "Паровий обігрів кубів"
      },
      "subtitle": "",
      "dateOrYear": "1887",
      "description": {
        "en": "The Glenmorangie Distillery Co. is founded and becomes the first in Scotland to introduce internal steam-heated coils for stills.",
        "ru": "Основание Glenmorangie Ltd. Винокурня первой в Шотландии устанавливает паровой обогрев кубов с помощью змеевиков.",
        "uk": "Заснування Glenmorangie Ltd. Винокурня першою в Шотландії встановлює паровий обігрів кубів за допомогою змійовиків."
      }
    },
    {
      "id": "macdonald-muir-1918",
      "badge": null,
      "title": {
        "en": "Macdonald & Muir era",
        "ru": "Эра Macdonald & Muir",
        "uk": "Ера Macdonald & Muir"
      },
      "subtitle": "",
      "dateOrYear": "1918",
      "description": {
        "en": "Edinburgh-based Macdonald & Muir buys a 40% stake, taking full control by 1930 and managing the brand for nearly 90 years.",
        "ru": "Компания Macdonald & Muir выкупает 40% акций, а к 1930 году полностью берёт контроль. Семья управляет брендом почти 90 лет.",
        "uk": "Компанія Macdonald & Muir купує 40% акцій, а до 1930 року повністю бере контроль. Родина керує брендом майже 90 років."
      }
    },
    {
      "id": "mothballed-1931-1936",
      "badge": null,
      "title": {
        "en": "Depression closure",
        "ru": "Консервация из-за кризиса",
        "uk": "Консервація через кризу"
      },
      "subtitle": "",
      "dateOrYear": "1931–1936",
      "description": {
        "en": "The distillery is mothballed due to the combined effects of the Great Depression and US Prohibition.",
        "ru": "Винокурня законсервирована из-за Великой депрессии и «сухого закона» в США.",
        "uk": "Винокурня законсервована через Велику депресію та «сухий закон» у США."
      }
    },
    {
      "id": "ww2-closure-1941-1945",
      "badge": null,
      "title": {
        "en": "Wartime shutdown",
        "ru": "Приостановка в годы войны",
        "uk": "Призупинення в роки війни"
      },
      "subtitle": "",
      "dateOrYear": "1941–1945",
      "description": {
        "en": "World War II forces production to halt once more due to severe shortages of barley and fuel.",
        "ru": "Вторая мировая война вынуждает снова остановить производство из-за дефицита ячменя и угля.",
        "uk": "Друга світова війна змушує знову зупинити виробництво через дефіцит ячменю та вугілля."
      }
    },
    {
      "id": "expansion-1979",
      "badge": null,
      "title": {
        "en": "Capacity doubled",
        "ru": "Удвоение мощностей",
        "uk": "Подвоєння потужностей"
      },
      "subtitle": "",
      "dateOrYear": "1979",
      "description": {
        "en": "Booming single malt demand prompts Glenmorangie to double its capacity, expanding from two to four stills.",
        "ru": "На фоне бума спроса на односолодовый виски мощность удваивается: количество кубов увеличивают с 2 до 4.",
        "uk": "На тлі буму попиту на односолодовий віскі потужність подвоюється: кількість кубів збільшують з 2 до 4."
      }
    },
    {
      "id": "cask-finishing-1980s-1990s",
      "badge": null,
      "title": {
        "en": "Cask finishing pioneers",
        "ru": "Пионеры каск-финишинга",
        "uk": "Піонери каск-фінішингу"
      },
      "subtitle": "",
      "dateOrYear": "1980s–1990s",
      "description": {
        "en": "Dr. Bill Lumsden and the team pioneer cask finishing (sherry, port, sauternes, madeira) and designer oak casks.",
        "ru": "Dr. Bill Lumsden и команда становятся пионерами довыдержки виски в бочках из-под хереса, портвейна, сотерна и мадеры.",
        "uk": "Dr. Bill Lumsden та команда стають піонерами довитримки віскі в бочках з-під хересу, портвейну, сотерну й мадери."
      }
    },
    {
      "id": "eight-stills-1990",
      "badge": null,
      "title": {
        "en": "Expansion to eight stills",
        "ru": "Расширение до 8 кубов",
        "uk": "Розширення до 8 кубів"
      },
      "subtitle": "",
      "dateOrYear": "1990",
      "description": {
        "en": "The number of stills at Glenmorangie is increased to eight to meet growing global demand.",
        "ru": "Количество перегонных кубов на винокурне увеличивается до 8 для удовлетворения мирового спроса.",
        "uk": "Кількість перегонних кубів на винокурні зростає до 8 для задоволення світового попиту."
      }
    },
    {
      "id": "ardbeg-acquisition-1997",
      "badge": null,
      "title": {
        "en": "Acquisition of Ardbeg",
        "ru": "Покупка Ardbeg",
        "uk": "Купівля Ardbeg"
      },
      "subtitle": "",
      "dateOrYear": "1997",
      "description": {
        "en": "Macdonald & Muir purchases the legendary closed Ardbeg Distillery on Islay and revives production.",
        "ru": "Компания Macdonald & Muir выкупает закрытую винокурню Ardbeg на острове Айлей и возвращает её к жизни.",
        "uk": "Компанія Macdonald & Muir купує закриту винокурню Ardbeg на острові Айлей і повертає її до життя."
      }
    },
    {
      "id": "lvmh-2004",
      "badge": null,
      "title": {
        "en": "LVMH acquisition",
        "ru": "Покупка концерном LVMH",
        "uk": "Купівля концерном LVMH"
      },
      "subtitle": "",
      "dateOrYear": "2004",
      "description": {
        "en": "French luxury goods giant LVMH (Louis Vuitton Moët Hennessy) acquires The Glenmorangie Company for £300 million.",
        "ru": "Французский гигант товаров роскоши LVMH выкупает The Glenmorangie Company за £300 млн.",
        "uk": "Французький гігант товарів розкоші LVMH купує The Glenmorangie Company за £300 млн."
      }
    },
    {
      "id": "rebrand-signet-2007",
      "badge": null,
      "title": {
        "en": "Global rebrand & Signet",
        "ru": "Ребрендинг и Signet",
        "uk": "Ребрендинг та Signet"
      },
      "subtitle": "",
      "dateOrYear": "2007",
      "description": {
        "en": "Major luxury rebrand introducing curved bottles, the Extra Matured range, and the iconic Glenmorangie Signet.",
        "ru": "Премиальный ребрендинг: новые изогнутые бутылки, линейки Extra Matured и флагманский релиз Signet.",
        "uk": "Преміальний ребрендинг: нові вигнуті пляшки, лінійки Extra Matured та флагманський реліз Signet."
      }
    },
    {
      "id": "private-edition-2009",
      "badge": null,
      "title": {
        "en": "Private Edition series",
        "ru": "Серия Private Edition",
        "uk": "Серія Private Edition"
      },
      "subtitle": "",
      "dateOrYear": "2009",
      "description": {
        "en": "Launch of the annual Private Edition series showcasing rare cask finishes and experimental barley, starting with Sonnalta PX.",
        "ru": "Старт ежегодной серии Private Edition, исследующей редкие бочки и сорта ячменя (начиная с Sonnalta PX).",
        "uk": "Старт щорічної серії Private Edition, що досліджує рідкісні бочки та сорти ячменю (починаючи з Sonnalta PX)."
      }
    },
    {
      "id": "giraffe-partnership-2020",
      "badge": null,
      "title": {
        "en": "Giraffe mascot & partnership",
        "ru": "Партнёрство и жираф-маскот",
        "uk": "Партнерство та жираф-маскот"
      },
      "subtitle": "",
      "dateOrYear": "2020",
      "description": {
        "en": "Partnership with Giraffe Conservation Foundation, adopting the giraffe as official mascot due to equal still height.",
        "ru": "Официальное партнёрство с Giraffe Conservation Foundation; жираф ставит официальным маскотом в честь высоты кубов.",
        "uk": "Офіційне партнерство з Giraffe Conservation Foundation; жираф стає офіційним маскотом на честь висоти кубів."
      }
    },
    {
      "id": "lighthouse-2021",
      "badge": null,
      "title": {
        "en": "The Lighthouse distillery",
        "ru": "Экспериментальный «Маяк»",
        "uk": "Експериментальний «Маяк»"
      },
      "subtitle": "",
      "dateOrYear": "2021",
      "description": {
        "en": "Opening of The Lighthouse, a 20m innovation distillery-laboratory for experiments in yeast, wood, and kilning.",
        "ru": "Открытие The Lighthouse — 20-метровой стеклянной лаборатории для экспериментов с дрожжами, обжаркой солода и древесиной.",
        "uk": "Відкриття The Lighthouse — 20-метрової скляної лабораторії для експериментів із дріжджами, обсмажуванням солоду та деревиною."
      }
    },
    {
      "id": "tale-of-series-2022-2023",
      "badge": null,
      "title": {
        "en": "A Tale of... series & new look",
        "ru": "Серия A Tale of... и новый дизайн",
        "uk": "Серія A Tale of... та новий дизайн"
      },
      "subtitle": "",
      "dateOrYear": "2022–2023",
      "description": {
        "en": "Vibrant packaging refresh and global success of the narrative 'A Tale of...' series (Cake, Forest, Tokyo).",
        "ru": "Обновление упаковки с яркими этикетками и успех концептуальной серии A Tale of... (A Tale of Cake, Forest, Tokyo).",
        "uk": "Оновлення упаковки з яскравими етикетками та успіх концептуальної серії A Tale of... (A Tale of Cake, Forest, Tokyo)."
      }
    },
    {
      "id": "signet-reserve-deep-2024-2026",
      "badge": null,
      "title": {
        "en": "Signet Reserve & DEEP project",
        "ru": "Signet Reserve и экопроект DEEP",
        "uk": "Signet Reserve та екопроєкт DEEP"
      },
      "subtitle": "",
      "dateOrYear": "2024–2026",
      "description": {
        "en": "Release of Signet Reserve and ongoing expansion of the DEEP environmental project restoring oyster reefs in Dornoch Firth.",
        "ru": "Презентация Signet Reserve и развитие экологической инициативы DEEP по восстановлению устричных рифов в заливе Дорнох-Ферт.",
        "uk": "Презентація Signet Reserve та розвиток екологічної ініціативи DEEP із відновлення устричних рифів у затоці Дорнох-Ферт."
      }
    }
  ]
}
$glenmorangie_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT glenmorangie_id
    FROM distilleries
    WHERE lower(trim(name)) = 'glenmorangie';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 18 THEN
        RAISE EXCEPTION 'Expected 18 Glenmorangie timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = glenmorangie_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Glenmorangie already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Glenmorangie History', 'timeline', timeline, glenmorangie_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'glenmorangie';
