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
    glen_scotia_id integer;
    timeline jsonb := $glen_scotia_data$
{
  "steps": [
    {
      "id": "founding-1832",
      "badge": null,
      "title": {
        "en": "Distillery founded",
        "ru": "Основание винокурни",
        "uk": "Заснування винокурні"
      },
      "subtitle": "",
      "dateOrYear": "1832",
      "description": {
        "en": "The distillery is founded as Scotia by Stewart, Galbraith & Co., as Campbeltown begins its rise as Scotland's whisky capital.",
        "ru": "Основание дистиллерии под названием Scotia компанией Stewart, Galbraith & Co. Кэмпбелтаун начинает превращаться в «столицу виски» Шотландии.",
        "uk": "Заснування дистилерії під назвою Scotia компанією Stewart, Galbraith & Co. Кемпбелтаун починає перетворюватися на «столицу віскі» Шотландії."
      }
    },
    {
      "id": "maccallum-1895",
      "badge": null,
      "title": {
        "en": "Duncan MacCallum era",
        "ru": "Эпоха Дункана Маккаллама",
        "uk": "Епоха Дункана Маккаллама"
      },
      "subtitle": "",
      "dateOrYear": "1895",
      "description": {
        "en": "Businessman Duncan MacCallum takes charge, leading the distillery through a period of expansion during the regional whisky boom.",
        "ru": "Руководство принимает бизнесмен Дункан Маккаллам. Винокурня активно расширяется и процветает во время бума вискипромышленности.",
        "uk": "Керівництво перебирає бізнесмен Дункан Маккаллам. Винокурня активно розширюється та процвітає під час буму віскі-промисловості."
      }
    },
    {
      "id": "whmd-1919",
      "badge": null,
      "title": {
        "en": "The WHMD alliance",
        "ru": "Альянс WHMD",
        "uk": "Альянс WHMD"
      },
      "subtitle": "",
      "dateOrYear": "1919",
      "description": {
        "en": "To survive the post-war crisis, Scotia merges with four local distilleries to form the West Highland Malt Distillers (WHMD) alliance.",
        "ru": "Чтобы выжить в условиях послевоенного кризиса, Scotia объединяется с четырьмя другими винокурнями в альянс West Highland Malt Distillers (WHMD).",
        "uk": "Щоб вижити в умовах післявоєнної кризи, Scotia об'єднується з чотирма іншими винокурнями в альянс West Highland Malt Distillers (WHMD)."
      }
    },
    {
      "id": "buyback-1924",
      "badge": null,
      "title": {
        "en": "MacCallum buys back Scotia",
        "ru": "Возврат в собственность",
        "uk": "Повернення у власність"
      },
      "subtitle": "",
      "dateOrYear": "1924",
      "description": {
        "en": "Following the bankruptcy of the WHMD alliance, Duncan MacCallum buys Scotia back into sole ownership.",
        "ru": "После банкротства альянса WHMD Дункан Маккаллам выкупает Scotia обратно в единоличную собственность.",
        "uk": "Після банкрутства альянсу WHMD Дункан Маккаллам викуповує Scotia назад у одноосібну власність."
      }
    },
    {
      "id": "tragedy-1928-1930",
      "badge": null,
      "title": {
        "en": "Closure and tragedy",
        "ru": "Закрытие и трагедия",
        "uk": "Закриття та трагедія"
      },
      "subtitle": "",
      "dateOrYear": "1928–1930",
      "description": {
        "en": "Prohibition and the Great Depression halt production in 1928. In 1930, 83-year-old Duncan MacCallum tragically dies in Campbeltown Loch.",
        "ru": "«Сухой закон» и Великая депрессия останавливают производство в 1928 году. В 1930 году 83-летний Дункан Маккаллам трагически погибает в водах Кэмпбелтаун-Лох.",
        "uk": "«Сухий закон» та Велика депресія зупиняють виробництво у 1928 році. У 1930 році 83-річний Дункан Маккаллам трагічно гине у водах Кемпбелтаун-Лох."
      }
    },
    {
      "id": "glen-scotia-1933",
      "badge": null,
      "title": {
        "en": "Renamed Glen Scotia",
        "ru": "Переименование в Glen Scotia",
        "uk": "Перейменування на Glen Scotia"
      },
      "subtitle": "",
      "dateOrYear": "1933",
      "description": {
        "en": "Bloch Brothers purchase the distillery, changing the name to Glen Scotia and resuming production.",
        "ru": "Винокурню выкупает компания Bloch Brothers. Название меняется на Glen Scotia, а производство возобновляется.",
        "uk": "Винокурню купує компанія Bloch Brothers. Назву змінюють на Glen Scotia, а виробництво відновлюється."
      }
    },
    {
      "id": "hiram-walker-1954",
      "badge": null,
      "title": {
        "en": "Ownership changes",
        "ru": "Смена владельцев",
        "uk": "Зміна власників"
      },
      "subtitle": "",
      "dateOrYear": "1954",
      "description": {
        "en": "Acquired by industry giant Hiram Walker, then sold just a year later (1955) to A. Gillies & Co.",
        "ru": "Переход в собственность гиганта Hiram Walker, а всего через год (1955) — продажа компании A. Gillies & Co.",
        "uk": "Перехід у власність гіганта Hiram Walker, а вже за рік (1955) — продаж компанії A. Gillies & Co."
      }
    },
    {
      "id": "adp-1970",
      "badge": null,
      "title": {
        "en": "Part of ADP",
        "ru": "Вхождение в ADP",
        "uk": "Входження до ADP"
      },
      "subtitle": "",
      "dateOrYear": "1970",
      "description": {
        "en": "A. Gillies & Co. becomes part of Amalgamated Distillers Products (ADP).",
        "ru": "A. Gillies & Co. входит в состав Amalgamated Distillers Products (ADP).",
        "uk": "A. Gillies & Co. входить до складу Amalgamated Distillers Products (ADP)."
      }
    },
    {
      "id": "mothballed-1979-1982",
      "badge": null,
      "title": {
        "en": "Reconstruction & mothballing",
        "ru": "Реконструкция и консервация",
        "uk": "Реконструкція та консервація"
      },
      "subtitle": "",
      "dateOrYear": "1979–1982",
      "description": {
        "en": "A £1 million reconstruction takes place, but the global 'Whisky Loch' overproduction crisis forces a mothballing in 1984.",
        "ru": "Проводится реконструкция стоимостью £1 млн, но из-за кризиса «Whisky Loch» в 1984 году винокурню снова консервируют.",
        "uk": "Проводиться реконструкція вартістю £1 млн, але через кризу перевиробництва («Whisky Loch») у 1984 році винокурню знову консервують."
      }
    },
    {
      "id": "gibson-1989",
      "badge": null,
      "title": {
        "en": "Gibson International",
        "ru": "Приход Gibson International",
        "uk": "Прихід Gibson International"
      },
      "subtitle": "",
      "dateOrYear": "1989",
      "description": {
        "en": "Purchased by Gibson International, leading to a restart of operations.",
        "ru": "Покупка компанией Gibson International и возобновление работы.",
        "uk": "Купівля компанією Gibson International та відновлення роботи."
      }
    },
    {
      "id": "loch-lomond-1994",
      "badge": null,
      "title": {
        "en": "Loch Lomond Group",
        "ru": "Переход к Loch Lomond Group",
        "uk": "Перехід до Loch Lomond Group"
      },
      "subtitle": "",
      "dateOrYear": "1994",
      "description": {
        "en": "Following Gibson International's bankruptcy, Glen Scotia is acquired by Glen Catrine Bonded Warehouse Ltd. (part of Loch Lomond Group).",
        "ru": "После банкротства Gibson International винокурню приобретает Glen Catrine Bonded Warehouse Ltd. (часть группы Loch Lomond).",
        "uk": "Після банкрутства Gibson International Glen Scotia купує компанія Glen Catrine Bonded Warehouse Ltd. (частина групи Loch Lomond)."
      }
    },
    {
      "id": "distilling-resumes-1999",
      "badge": null,
      "title": {
        "en": "Distillation resumes",
        "ru": "Возобновление дистилляции",
        "uk": "Відновлення дистиляції"
      },
      "subtitle": "",
      "dateOrYear": "1999",
      "description": {
        "en": "Regular distillation resumes, with staff traveling from Loch Lomond distillery in shifts for production runs.",
        "ru": "Регулярное возобновление дистилляции. Первое время мастера с Loch Lomond приезжали посменно для проведения сезонов перегонки.",
        "uk": "Регулярне відновлення дистиляції. Перший час майстри з Loch Lomond приїжджали посмінно для проведення сезонів перегонки."
      }
    },
    {
      "id": "full-time-2006",
      "badge": null,
      "title": {
        "en": "Permanent staff appointed",
        "ru": "Постоянный штат",
        "uk": "Постійний штат"
      },
      "subtitle": "",
      "dateOrYear": "2006",
      "description": {
        "en": "A full-time site manager and local staff are appointed, shifting to a complete production cycle.",
        "ru": "Назначение постоянного штата сотрудников и управляющего на месте, переход к полноценному циклу производства.",
        "uk": "Призначення постійного штату працівників і керівника на місці, перехід до повноцінного циклу виробництва."
      }
    },
    {
      "id": "rebrand-2014",
      "badge": null,
      "title": {
        "en": "Major investment & rebrand",
        "ru": "Инвестиции и ребрендинг",
        "uk": "Інвестиції та ребрендинг"
      },
      "subtitle": "",
      "dateOrYear": "2014",
      "description": {
        "en": "Exponent Private Equity acquires Loch Lomond Group, investing heavily in a global rebrand, a Visitor Centre, and a new core range.",
        "ru": "Exponent Private Equity приобретает Loch Lomond Group. В Glen Scotia вливаются крупные инвестиции: проводится ребрендинг, открывается Центр посетителей и новая линейка.",
        "uk": "Exponent Private Equity купує Loch Lomond Group. У Glen Scotia інвестують значні кошти: проводиться ребрендинг, відкривається Центр відвідувачів та нова лінійка."
      }
    },
    {
      "id": "hillhouse-2019",
      "badge": null,
      "title": {
        "en": "Hillhouse Capital",
        "ru": "Hillhouse Capital",
        "uk": "Hillhouse Capital"
      },
      "subtitle": "",
      "dateOrYear": "2019",
      "description": {
        "en": "Loch Lomond Group is acquired by the international investment firm Hillhouse Capital.",
        "ru": "Переход Loch Lomond Group под контроль международного фонда Hillhouse Capital.",
        "uk": "Перехід Loch Lomond Group під контроль міжнародного фонду Hillhouse Capital."
      }
    },
    {
      "id": "best-whisky-2021",
      "badge": null,
      "title": {
        "en": "Distillery of the Year",
        "ru": "Винокурня года",
        "uk": "Винокурня року"
      },
      "subtitle": "",
      "dateOrYear": "2021",
      "description": {
        "en": "Glen Scotia Victoriana wins 'World's Best Whisky' at SFWSC, and Glen Scotia is named 'Distillery of the Year' at the Scottish Whisky Awards.",
        "ru": "Релиз Victoriana получает высшую награду «World's Best Whisky» на SFWSC, а Glen Scotia признаётся «Distillery of the Year» на Scottish Whisky Awards.",
        "uk": "Реліз Victoriana отримує найвищу нагороду «World's Best Whisky» на SFWSC, а Glen Scotia визнається «Distillery of the Year» на Scottish Whisky Awards."
      }
    },
    {
      "id": "festival-expansion-2022-2024",
      "badge": null,
      "title": {
        "en": "Festivals and sustainability",
        "ru": "Фестивали и экоинициативы",
        "uk": "Фестивалі та екоініціативи"
      },
      "subtitle": "",
      "dateOrYear": "2022–2024",
      "description": {
        "en": "Expansion of exclusive Campbeltown Malts Festival releases, adoption of green carbon-reduction initiatives, and global growth.",
        "ru": "Развитие эксклюзивных релизов для Campbeltown Malts Festival, внедрение экологических инициатив по снижению углеродного следа и глобальная экспансия.",
        "uk": "Розвиток ексклюзивних релізів для Campbeltown Malts Festival, впровадження екологічних ініціатив зі зниження вуглецевого сліду та глобальна експансія."
      }
    },
    {
      "id": "campbeltown-pillar-2025-2026",
      "badge": null,
      "title": {
        "en": "Pillar of Campbeltown",
        "ru": "Столп Кэмпбелтауна",
        "uk": "Стовп Кемпбелтауна"
      },
      "subtitle": "",
      "dateOrYear": "2025–2026",
      "description": {
        "en": "Glen Scotia solidifies its status as a cornerstone of the revived Campbeltown region, producing classic oily, maritime single malt.",
        "ru": "Glen Scotia закрепила статус одного из главных столпов возрождённого региона Кэмпбелтаун, выпуская классический маслянистый, морской виски.",
        "uk": "Glen Scotia закріпила статус одного з головних стовпів відродженого регіону Кемпбелтаун, випускаючи класичний маслянистий, морський віскі."
      }
    }
  ]
}
$glen_scotia_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT glen_scotia_id
    FROM distilleries
    WHERE lower(trim(name)) = 'glen scotia';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 18 THEN
        RAISE EXCEPTION 'Expected 18 Glen Scotia timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = glen_scotia_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Glen Scotia already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Glen Scotia History', 'timeline', timeline, glen_scotia_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'glen scotia';
