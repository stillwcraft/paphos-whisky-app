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
    laphroaig_id integer;
    timeline jsonb := $laphroaig_data$
{
  "steps": [
    {
      "id": "founding-1815",
      "badge": null,
      "title": {
        "en": "Official founding",
        "ru": "Официальное основание",
        "uk": "Офіційне заснування"
      },
      "subtitle": "",
      "dateOrYear": "1815",
      "description": {
        "en": "Brothers Donald and Alexander Johnston officially found the distillery on the southern coast of the Isle of Islay.",
        "ru": "Официальное основание винокурни братьями Дональдом и Александром Джонстонами на южном побережье острова Айлей.",
        "uk": "Офіційне заснування винокурні братами Дональдом та Александром Джонстонами на південному узбережжі острова Айлей."
      }
    },
    {
      "id": "johnston-tragedy-1847",
      "badge": null,
      "title": {
        "en": "Tragic death of Donald Johnston",
        "ru": "Трагическая гибель основателя",
        "uk": "Трагічна загибель засновника"
      },
      "subtitle": "",
      "dateOrYear": "1847",
      "description": {
        "en": "Donald Johnston tragically dies after falling into a vat of boiling spent wash. Management temporarily transfers to Lagavulin.",
        "ru": "Трагическая гибель Дональда Джонстона. Управление винокурней временно переходит к менеджменту соседней Lagavulin.",
        "uk": "Трагічна загибель Дональда Джонстона. Управління винокурнею тимчасово переходить до менеджменту сусідньої Lagavulin."
      }
    },
    {
      "id": "dugald-johnston-1857",
      "badge": null,
      "title": {
        "en": "Dugald Johnston takes charge",
        "ru": "Дугалд Джонстон берет управление",
        "uk": "Дугалд Джонстон бере управління"
      },
      "subtitle": "",
      "dateOrYear": "1857",
      "description": {
        "en": "Dugald Johnston (Donald's son) takes over the family business alongside his cousin Walter Macfarlane.",
        "ru": "Дугалд Джонстон (сын Дональда) берет управление семейным делом в свои руки вместе с кузеном Уолтером Макмилланом.",
        "uk": "Дугалд Джонстон (син Дональда) бере управління сімейною справою у свої руки разом із кузеном Волтером Макмілланом."
      }
    },
    {
      "id": "water-war-1907-1908",
      "badge": null,
      "title": {
        "en": "The Water War",
        "ru": "«Война за воду»",
        "uk": "«Війна за воду»"
      },
      "subtitle": "",
      "dateOrYear": "1907–1908",
      "description": {
        "en": "Conflict with Peter Mackie (Lagavulin), who attempted to block Kilbride stream and built Malt Mill to replicate Laphroaig's medicinal style.",
        "ru": "Конфликт с Питером Макки (Lagavulin): попытка перекрыть источник Килбрайд и постройка Malt Mill для копирования стиля Laphroaig.",
        "uk": "Конфлікт із Пітером Маккі (Lagavulin): спроба перекрити джерело Кілбрайд та будівництво Malt Mill для копіювання стилю Laphroaig."
      }
    },
    {
      "id": "ian-hunter-1921",
      "badge": null,
      "title": {
        "en": "Ian Hunter era",
        "ru": "Эра Иэна Хантера",
        "uk": "Ера Іена Хантера"
      },
      "subtitle": "",
      "dateOrYear": "1921",
      "description": {
        "en": "Management passes to Ian Hunter (Dugald's nephew). He modernizes production, increases stills, and protects the secret recipe.",
        "ru": "Управление переходит к Иэну Хантеру. Он модернизирует производство, увеличивает число кубов и защищает секретную рецептуру.",
        "uk": "Управління переходить до Іена Хантера. Він модернізує виробництво, збільшує кількість кубів та захищає секретну рецептуру."
      }
    },
    {
      "id": "medicinal-prohibition-1930s",
      "badge": null,
      "title": {
        "en": "Medicinal whisky during Prohibition",
        "ru": "«Лекарство» во время Сухого закона",
        "uk": "«Ліки» під час Сухого закону"
      },
      "subtitle": "",
      "dateOrYear": "1930s",
      "description": {
        "en": "Ian Hunter exports Laphroaig to US pharmacies as medicine, as customs believed its intense peaty smell could not be ordinary alcohol.",
        "ru": "Иэн Хантер поставляет Laphroaig в аптеки США как лекарство: таможенники верили, что этот сильный торфяной запах не может быть просто спиртным.",
        "uk": "Іен Хантер постачає Laphroaig в аптеки США як ліки: митники вірили, що цей сильний торф'яний запах не може бути звичайним алкоголем."
      }
    },
    {
      "id": "bessie-williamson-1954",
      "badge": null,
      "title": {
        "en": "Bessie Williamson takes over",
        "ru": "Бесси Уильямсон у руля",
        "uk": "Бессі Вільямсон біля керма"
      },
      "subtitle": "",
      "dateOrYear": "1954",
      "description": {
        "en": "Ian Hunter leaves the distillery to manager Bessie Williamson, who becomes the first female Scottish distillery owner of the 20th century.",
        "ru": "Иэн Хантер завещает винокурню управляющей Бесси Уильямсон — первой женщине-владелице винокурни в Шотландии XX века.",
        "uk": "Іен Хантер заповідає винокурню управительці Бессі Вільямсон — першій жінці-власниці винокурні в Шотландії XX століття."
      }
    },
    {
      "id": "long-john-retirement-1967-1972",
      "badge": null,
      "title": {
        "en": "Long John Distillers & retirement",
        "ru": "Long John и выход на пенсию",
        "uk": "Long John та вихід на пенсію"
      },
      "subtitle": "",
      "dateOrYear": "1967–1972",
      "description": {
        "en": "Bessie Williamson sells shares to Long John Distillers and retires in 1972 as a revered industry legend.",
        "ru": "Бесси Уильямсон продает акции Long John Distillers и в 1972 году уходит на пенсию в статусе легенды индустрии.",
        "uk": "Бессі Вільямсон продає акції Long John Distillers та у 1972 році йде на пенсію у статусі легенди індустрії."
      }
    },
    {
      "id": "friends-royal-warrant-1994",
      "badge": null,
      "title": {
        "en": "Friends of Laphroaig & Royal Warrant",
        "ru": "Friends of Laphroaig и Royal Warrant",
        "uk": "Friends of Laphroaig та Royal Warrant"
      },
      "subtitle": "",
      "dateOrYear": "1994",
      "description": {
        "en": "Founding of the Friends of Laphroaig club (granting a square foot of Islay land) and receipt of HRH Prince Charles's Royal Warrant.",
        "ru": "Основание клуба Friends of Laphroaig и вручение винокурне королевского патента Royal Warrant принцем Чарльзом.",
        "uk": "Заснування клубу Friends of Laphroaig та вручення винокурні королівського патенту Royal Warrant принцом Чарльзом."
      }
    },
    {
      "id": "quarter-cask-2004",
      "badge": null,
      "title": {
        "en": "Laphroaig Quarter Cask launch",
        "ru": "Запуск Laphroaig Quarter Cask",
        "uk": "Запуск Laphroaig Quarter Cask"
      },
      "subtitle": "",
      "dateOrYear": "2004",
      "description": {
        "en": "Launch of the iconic Quarter Cask, reviving maturation in smaller 125-litre casks for a more dynamic wood interaction.",
        "ru": "Запуск культового релиза Laphroaig Quarter Cask, возродившего традицию выдержки в небольших 125-литровых бочках.",
        "uk": "Запуск культового релізу Laphroaig Quarter Cask, що відродив традицію витримки у невеликих 125-літрових бочках."
      }
    },
    {
      "id": "beam-suntory-2014",
      "badge": null,
      "title": {
        "en": "Acquisition by Suntory",
        "ru": "Вхождение в Beam Suntory",
        "uk": "Входження до Beam Suntory"
      },
      "subtitle": "",
      "dateOrYear": "2014",
      "description": {
        "en": "Japanese drinks giant Suntory acquires Beam Inc., creating Beam Suntory, which includes the Laphroaig distillery.",
        "ru": "Японский гигант Suntory приобретает компанию Beam Inc., создавая концерн Beam Suntory, куда входит и Laphroaig.",
        "uk": "Японський гігант Suntory купує компанію Beam Inc., створюючи концерн Beam Suntory, куди входить і Laphroaig."
      }
    },
    {
      "id": "bicentenary-2015",
      "badge": null,
      "title": {
        "en": "Bicentenary celebration",
        "ru": "Двухсотлетний юбилей",
        "uk": "Двохсотрічний ювілей"
      },
      "subtitle": "",
      "dateOrYear": "2015",
      "description": {
        "en": "Laphroaig celebrates its 200th anniversary (1815–2015), releasing a limited 15 Year Old as Friends of Laphroaig passes 700,000 members.",
        "ru": "Двухсотлетний юбилей (1815–2015): выпуск 15 Year Old, а число членов Friends of Laphroaig превышает 700 000 человек.",
        "uk": "Двохсотрічний ювілей (1815–2015): випуск 15 Year Old, а кількість членів Friends of Laphroaig перевищує 700 000 осіб."
      }
    },
    {
      "id": "laphroaig-lore-2016",
      "badge": null,
      "title": {
        "en": "Laphroaig Lore launch",
        "ru": "Дебют Laphroaig Lore",
        "uk": "Дебют Laphroaig Lore"
      },
      "subtitle": "",
      "dateOrYear": "2016",
      "description": {
        "en": "Debut of Laphroaig Lore, crafted by Distillery Manager John Campbell as the richest, deepest Laphroaig ever created.",
        "ru": "Дебют релиза Laphroaig Lore, задуманного Джоном Кэмпбеллом как самый богатый и глубокий Laphroaig из когда-либо созданных.",
        "uk": "Дебют релізу Laphroaig Lore, задуманого Джоном Кемпбеллом як найбагатший та найглибший Laphroaig із коли-небудь створених."
      }
    },
    {
      "id": "barry-macaffer-2021",
      "badge": null,
      "title": {
        "en": "New Distillery Manager",
        "ru": "Новый управляющий",
        "uk": "Новий керівник"
      },
      "subtitle": "",
      "dateOrYear": "2021",
      "description": {
        "en": "John Campbell departs after 25 years; Islay native Barry MacAffer is appointed as the new Distillery Manager.",
        "ru": "Джон Кэмпбелл покидает винокурню после 25 лет работы. Новым управляющим назначается уроженец Айлея Барри Макэффер.",
        "uk": "Джон Кемпбелл залишає винокурню після 25 років роботи. Новим керівником призначається уродженець Айлею Баррі Макеффер."
      }
    },
    {
      "id": "eco-rebrand-2023-2024",
      "badge": null,
      "title": {
        "en": "Sustainable packaging & Suntory Global Spirits",
        "ru": "Эко-ребрендинг и Suntory Global Spirits",
        "uk": "Еко-ребрендинг та Suntory Global Spirits"
      },
      "subtitle": "",
      "dateOrYear": "2023–2024",
      "description": {
        "en": "Global sustainable packaging refresh (100% recyclable tubes, lightened bottles) and parent company rename to Suntory Global Spirits.",
        "ru": "Экологический ребрендинг (отказ от пластика, перерабатываемая упаковка) и переименование компании в Suntory Global Spirits.",
        "uk": "Екологічний ребрендинг (відмова від пластику, упаковка, що переробляється) та перейменування компанії на Suntory Global Spirits."
      }
    },
    {
      "id": "peatland-legacy-2025-2026",
      "badge": null,
      "title": {
        "en": "Peatland conservation & floor maltings",
        "ru": "Восстановление торфяников и традиции",
        "uk": "Відновлення торфовищ та традиції"
      },
      "subtitle": "",
      "dateOrYear": "2025–2026",
      "description": {
        "en": "Laphroaig funds Islay peatland restoration programs while upholding traditional floor maltings as a global peated malt icon.",
        "ru": "Laphroaig финансирует программы по восстановлению торфяников острова Айлей и поддерживает традиции ручного напольного солодования.",
        "uk": "Laphroaig фінансує програми з відновлення торфовищ острова Айлей та підтримує традиції підлогового солодування."
      }
    }
  ]
}
$laphroaig_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT laphroaig_id
    FROM distilleries
    WHERE lower(trim(name)) = 'laphroaig';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 16 THEN
        RAISE EXCEPTION 'Expected 16 Laphroaig timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = laphroaig_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Laphroaig already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Laphroaig History', 'timeline', timeline, laphroaig_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'laphroaig';
