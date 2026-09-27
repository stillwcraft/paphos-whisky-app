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
    port_ellen_id integer;
    timeline jsonb := $port_ellen_data$
{
  "steps": [
    {
      "id": "founding-1825",
      "badge": null,
      "title": {
        "en": "Official founding",
        "ru": "Официальное основание",
        "uk": "Офіційне заснування"
      },
      "subtitle": "",
      "dateOrYear": "1825",
      "description": {
        "en": "Alexander Ker officially founds the distillery in the port town of Port Ellen on the southern coast of Islay.",
        "ru": "Основание винокурни Александром Кэром в портовом городке Порт-Эллен на юге острова Айлей.",
        "uk": "Заснування винокурні Александром Кером у портовому містечку Порт-Еллен на півдні острова Айлей."
      }
    },
    {
      "id": "john-ramsay-1836",
      "badge": null,
      "title": {
        "en": "John Ramsay era & innovations",
        "ru": "Эра Джона Рамзи и инновации",
        "uk": "Ера Джона Рамзі та інновації"
      },
      "subtitle": "",
      "dateOrYear": "1836",
      "description": {
        "en": "21-year-old John Ramsay takes over Port Ellen, pioneering the spirit safe, direct US exports, and Islay maritime infrastructure.",
        "ru": "Управление переходит к 21-летнему Джону Рамзи. Он внедряет закрытый спиртовой сейф, организует экспорт в США и морскую инфраструктуру.",
        "uk": "Управління переходить до 21-річного Джона Рамзі. Він впроваджує закритий спиртовий сейф, організовує експорт до США та морську інфраструктуру."
      }
    },
    {
      "id": "dcl-1925",
      "badge": null,
      "title": {
        "en": "Buchanan-Dewar & DCL",
        "ru": "Buchanan-Dewar и вхождение в DCL",
        "uk": "Buchanan-Dewar та входження до DCL"
      },
      "subtitle": "",
      "dateOrYear": "1925",
      "description": {
        "en": "Ownership transfers to Buchanan-Dewar, which joins Distillers Company Limited (DCL, predecessor to Diageo) the same year.",
        "ru": "Винокурня переходит к компании Buchanan-Dewar, которая в том же году входит в состав DCL (предшественника Diageo).",
        "uk": "Винокурня переходить до компанії Buchanan-Dewar, яка того ж року входить до складу DCL (попередника Diageo)."
      }
    },
    {
      "id": "depression-closure-1930",
      "badge": null,
      "title": {
        "en": "Great Depression closure",
        "ru": "Закрытие из-за кризиса",
        "uk": "Закриття через кризу"
      },
      "subtitle": "",
      "dateOrYear": "1930",
      "description": {
        "en": "Production halts due to the Great Depression and US Prohibition; the distillery remains silent for nearly 40 years.",
        "ru": "Закрытие производства из-за Великой депрессии и «сухого закона» в США. Винокурня останавливается почти на 40 лет.",
        "uk": "Закриття виробництва через Велику депресію та «сухий закон» у США. Винокурня зупиняється майже на 40 років."
      }
    },
    {
      "id": "first-revival-1966-1967",
      "badge": null,
      "title": {
        "en": "First revival & expansion",
        "ru": "Первое возрождение и расширение",
        "uk": "Перше відродження та розширення"
      },
      "subtitle": "",
      "dateOrYear": "1966–1967",
      "description": {
        "en": "DCL fully modernizes Port Ellen amid the global whisky boom, expanding the number of pot stills from two to four.",
        "ru": "Первое возрождение: DCL полностью модернизирует Port Ellen, увеличивая количество кубов с 2 до 4.",
        "uk": "Перше відродження: DCL повністю модернізує Port Ellen, збільшуючи кількість кубів з 2 до 4."
      }
    },
    {
      "id": "port-ellen-maltings-1973",
      "badge": null,
      "title": {
        "en": "Port Ellen Maltings built",
        "ru": "Солодовня Port Ellen Maltings",
        "uk": "Солодорня Port Ellen Maltings"
      },
      "subtitle": "",
      "dateOrYear": "1973",
      "description": {
        "en": "Construction of a major central maltings supplying peated barley to Islay distilleries like Ardbeg, Lagavulin, Caol Ila, and Laphroaig.",
        "ru": "Строительство централизованной солодовни Port Ellen Maltings, обеспечивающей торфяным ячменём дистиллерии острова Айлей.",
        "uk": "Будівництво централізованої солодорні Port Ellen Maltings, що забезпечує торф'яним ячменем дистилерії острова Айлей."
      }
    },
    {
      "id": "tragic-closure-1983",
      "badge": null,
      "title": {
        "en": "Tragic closure & dismantling",
        "ru": "Закрытие и демонтаж",
        "uk": "Закриття та демонтаж"
      },
      "subtitle": "",
      "dateOrYear": "1983",
      "description": {
        "en": "Port Ellen closes during the 'Whisky Loch' crisis. In 1992 the distilling license is cancelled and the stills are dismantled.",
        "ru": "В мае 1983 года DCL закрывает Port Ellen. В 1992 году лицензия аннулируется, а перегонные кубы демонтируются.",
        "uk": "У травні 1983 року DCL закриває Port Ellen. У 1992 році ліцензія анулюється, а перегонні куби демонтуються."
      }
    },
    {
      "id": "ghost-distillery-1983-2000s",
      "badge": null,
      "title": {
        "en": "Cult ghost distillery & Annual Releases",
        "ru": "«Призрачная винокурня» и Annual Release",
        "uk": "«Примарна винокурня» та Annual Release"
      },
      "subtitle": "",
      "dateOrYear": "1983–2000s",
      "description": {
        "en": "Port Ellen achieves legendary 'ghost distillery' status; Diageo launches the annual collector's release series in 2001.",
        "ru": "Винокурня получает статус культовой «призрачной дистиллерии». С 2001 года Diageo начинает выпуск серии Annual Release.",
        "uk": "Винокурня отримує статус культової «примарної дистилерії». З 2001 року Diageo розпочинає випуск серії Annual Release."
      }
    },
    {
      "id": "diageo-pledge-2017",
      "badge": null,
      "title": {
        "en": "Diageo £35m rebirth pledge",
        "ru": "Заявление о возрождении £35 млн",
        "uk": "Заява про відродження £35 млн"
      },
      "subtitle": "",
      "dateOrYear": "2017",
      "description": {
        "en": "Diageo announces a £35 million investment to fully rebuild and reopen iconic ghost distilleries Brora and Port Ellen.",
        "ru": "Diageo объявляет об инвестициях в £35 млн на полное восстановление легендарных винокурен Brora и Port Ellen.",
        "uk": "Diageo оголошує про інвестиції в £35 млн на повне відновлення легендарних винокурень Brora та Port Ellen."
      }
    },
    {
      "id": "second-reopening-2024",
      "badge": null,
      "title": {
        "en": "Grand reopening & Gemini release",
        "ru": "Второе возрождение и Port Ellen Gemini",
        "uk": "Друге відродження та Port Ellen Gemini"
      },
      "subtitle": "",
      "dateOrYear": "2024",
      "description": {
        "en": "Port Ellen reopens in March 2024 with Phoenix Stills (1983 replicas) and Experimental Stills, debuting the ultra-rare 44 YO Gemini set.",
        "ru": "Официальное открытие перестроенной винокурни с кубами Phoenix Stills и Experimental Stills. Выпущен релиз Port Ellen Gemini (44 YO).",
        "uk": "Офіційне відкриття перебудованої винокурні з кубами Phoenix Stills та Experimental Stills. Випущено реліз Port Ellen Gemini (44 YO)."
      }
    },
    {
      "id": "innovation-hub-2025-2026",
      "badge": null,
      "title": {
        "en": "Futuristic innovation hub",
        "ru": "Центр инноваций и редкие релизы",
        "uk": "Центр інновацій та рідкісні релізи"
      },
      "subtitle": "",
      "dateOrYear": "2025–2026",
      "description": {
        "en": "Port Ellen operates as a futuristic innovation center and a home for ultra-rare old stock releases (Untold Stories, Prima & Ultima).",
        "ru": "Port Ellen работает как «центр инноваций» и дом для редких релизов из старых запасов (Untold Stories, Prima & Ultima).",
        "uk": "Port Ellen працює як «центр інновацій» та домівка для рідкісних релізів зі старих запасів (Untold Stories, Prima & Ultima)."
      }
    }
  ]
}
$port_ellen_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT port_ellen_id
    FROM distilleries
    WHERE lower(trim(name)) = 'port ellen';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 11 THEN
        RAISE EXCEPTION 'Expected 11 Port Ellen timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = port_ellen_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Port Ellen already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Port Ellen History', 'timeline', timeline, port_ellen_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'port ellen';
