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
    caol_ila_id integer;
    timeline jsonb := $caol_ila_data$
{
  "steps": [
    {
      "id": "founding-1846",
      "badge": null,
      "title": {
        "en": "Official founding",
        "ru": "Официальное основание",
        "uk": "Офіційне заснування"
      },
      "subtitle": "",
      "dateOrYear": "1846",
      "description": {
        "en": "Hector Henderson officially founds Caol Ila on the northeast coast of Islay. The name means 'Sound of Islay' in Gaelic.",
        "ru": "Гектор Хендерсон основывает винокурню Caol Ila на северо-востоке острова Айлей. Название означает «Пролив Айлей» на гэльском.",
        "uk": "Гектор Хендерсон засновує винокурню Caol Ila на північному сході острова Айлей. Назва означає «Протока Айлей» ґельською."
      }
    },
    {
      "id": "buchanan-1854",
      "badge": null,
      "title": {
        "en": "Norman Buchanan era",
        "ru": "Переход к Норману Бьюкенену",
        "uk": "Перехід до Нормана Б'юкенена"
      },
      "subtitle": "",
      "dateOrYear": "1854",
      "description": {
        "en": "Ownership transfers to Norman Buchanan, who was also the owner of the Isle of Jura distillery.",
        "ru": "Винокурня переходит во владение Нормана Бьюкенена, владельца дистиллерии Isle of Jura.",
        "uk": "Винокурня переходить у власність Нормана Б'юкенена, власника дистилерії Isle of Jura."
      }
    },
    {
      "id": "bulloch-lade-1863",
      "badge": null,
      "title": {
        "en": "Bulloch Lade acquisition & pier",
        "ru": "Покупка Bulloch Lade и пирс",
        "uk": "Купівля Bulloch Lade та пірс"
      },
      "subtitle": "",
      "dateOrYear": "1863",
      "description": {
        "en": "Acquired by Glasgow firm Bulloch Lade & Co., undergoing modernization with a dedicated pier constructed for steamships.",
        "ru": "Покупка фирмой Bulloch Lade & Co. из Глазго. Проводится модернизация, строятся пристань и пирс для пароходов.",
        "uk": "Купівля фірмою Bulloch Lade & Co. з Ґлазго. Проводиться модернізація, будуються пристань та пірс для пароплавів."
      }
    },
    {
      "id": "dcl-1920-1927",
      "badge": null,
      "title": {
        "en": "Caol Ila Distillery Co. & DCL",
        "ru": "Образование Caol Ila Ltd. и DCL",
        "uk": "Утворення Caol Ila Ltd. та DCL"
      },
      "subtitle": "",
      "dateOrYear": "1920–1927",
      "description": {
        "en": "Bulloch Lade liquidates. Caol Ila Distillery Co. Ltd is formed and joins Distillers Company Limited (DCL, predecessor to Diageo) in 1927.",
        "ru": "Ликвидация Bulloch Lade. Создаётся Caol Ila Distillery Co. Ltd., которая в 1927 году входит в состав DCL.",
        "uk": "Ліквідація Bulloch Lade. Створюється Caol Ila Distillery Co. Ltd., яка у 1927 році входить до складу DCL."
      }
    },
    {
      "id": "depression-closure-1930-1937",
      "badge": null,
      "title": {
        "en": "Great Depression closure",
        "ru": "Консервация из-за кризиса",
        "uk": "Консервація через кризу"
      },
      "subtitle": "",
      "dateOrYear": "1930–1937",
      "description": {
        "en": "The distillery is mothballed due to the combined impact of the Great Depression and US Prohibition.",
        "ru": "Винокурню консервируют из-за Великой депрессии и «сухого закона» в США.",
        "uk": "Винокурню законсервовують через Велику депресію та «сухий закон» у США."
      }
    },
    {
      "id": "ww2-closure-1941-1945",
      "badge": null,
      "title": {
        "en": "Wartime shutdown",
        "ru": "Остановка в годы войны",
        "uk": "Зупинка в роки війни"
      },
      "subtitle": "",
      "dateOrYear": "1941–1945",
      "description": {
        "en": "Production halts again during World War II due to wartime barley restrictions.",
        "ru": "Повторная остановка производства во время Второй мировой войны из-за ограничений на ячмень.",
        "uk": "Повторна зупинка виробництва під час Другої світової війни через обмеження на ячмінь."
      }
    },
    {
      "id": "rebuilding-expansion-1972-1974",
      "badge": null,
      "title": {
        "en": "Complete rebuild & expansion",
        "ru": "Полная перестройка и расширение",
        "uk": "Повна перебудова та розширення"
      },
      "subtitle": "",
      "dateOrYear": "1972–1974",
      "description": {
        "en": "The old distillery is demolished and rebuilt for £1m with panoramic windows. Stills increase from 2 to 6, making Caol Ila Islay's largest distillery.",
        "ru": "Старое здание сносится и перестраивается за £1 млн. Число кубов растёт с 2 до 6, делая Caol Ila крупнейшей дистиллерией на Айлее.",
        "uk": "Стару будівлю зносять і перебудовують за £1 млн. Кількість кубів зростає з 2 до 6, роблячи Caol Ila найбільшою дистилерією на Айлеї."
      }
    },
    {
      "id": "unpeated-runs-1980s",
      "badge": null,
      "title": {
        "en": "Unpeated production runs",
        "ru": "Запуск неторфяного стиля",
        "uk": "Запуск неторф'яного стилю"
      },
      "subtitle": "",
      "dateOrYear": "1980s",
      "description": {
        "en": "Regular unpeated distillation runs begin for several weeks a year to supply key blended whiskies.",
        "ru": "Запуск регулярного производства неторфяного виски (Unpeated), производимого несколько недель в году для купажей.",
        "uk": "Запуск регулярного виробництва неторф'яного віскі (Unpeated), що виганяється кілька тижнів на рік для купажів."
      }
    },
    {
      "id": "single-malt-launch-2002",
      "badge": null,
      "title": {
        "en": "Core Single Malt launch",
        "ru": "Запуск односолодовой линейки",
        "uk": "Запуск односолодової лінійки"
      },
      "subtitle": "",
      "dateOrYear": "2002",
      "description": {
        "en": "Diageo launches Caol Ila's core single malt range (12 YO, 18 YO, Cask Strength), shifting from purely supplying blends like Johnnie Walker Black Label.",
        "ru": "Diageo запускает регулярную линейку односолодового виски (12 YO, 18 YO, Cask Strength), завоюющую мировое признание.",
        "uk": "Diageo запускає регулярну лінійку односолодового віскі (12 YO, 18 YO, Cask Strength), що здобуває світове визнання."
      }
    },
    {
      "id": "moch-distillers-edition-2011",
      "badge": null,
      "title": {
        "en": "Caol Ila Moch & Distillers Edition",
        "ru": "Caol Ila Moch и Distillers Edition",
        "uk": "Caol Ila Moch та Distillers Edition"
      },
      "subtitle": "",
      "dateOrYear": "2011",
      "description": {
        "en": "Release of the accessible Caol Ila Moch expression and expansion of the annual Moscatel-finished Distillers Edition range.",
        "ru": "Выпуск популярного релиза Caol Ila Moch и расширение серии Distillers Edition с финишем в бочках из-под москателя.",
        "uk": "Випуск популярного релізу Caol Ila Moch та розширення серії Distillers Edition із фінішем у бочках з-під москателю."
      }
    },
    {
      "id": "johnnie-walker-four-corners-2018",
      "badge": null,
      "title": {
        "en": "Johnnie Walker Four Corners",
        "ru": "Four Corners of Johnnie Walker",
        "uk": "Four Corners of Johnnie Walker"
      },
      "subtitle": "",
      "dateOrYear": "2018",
      "description": {
        "en": "Caol Ila is selected as Islay's 'flavor home' in Diageo's £185m Johnnie Walker Four Corners whisky tourism initiative.",
        "ru": "Caol Ila выбирается «домом-символом» острова Айлей в концепции Four Corners of Johnnie Walker от Diageo.",
        "uk": "Caol Ila обирається «домом-символом» острова Айлей у концепції Four Corners of Johnnie Walker від Diageo."
      }
    },
    {
      "id": "visitor-centre-2022",
      "badge": null,
      "title": {
        "en": "New Visitor Centre",
        "ru": "Новый Центр посетителей",
        "uk": "Новий Центр відвідувачів"
      },
      "subtitle": "",
      "dateOrYear": "2022",
      "description": {
        "en": "Opening of a transformed 4-story Visitor Centre featuring a panoramic tasting bar overlooking the Sound of Islay.",
        "ru": "Торжественное открытие обновлённого 4-этажного Центра посетителей с панорамным баром над проливом Саунд-оф-Айлей.",
        "uk": "Урочисте відкриття оновленого 4-поверхового Центру відвідувачів із панорамним баром над протокою Саунд-оф-Айлей."
      }
    },
    {
      "id": "islay-giant-2024-2026",
      "badge": null,
      "title": {
        "en": "Islay's distilling giant",
        "ru": "Гигант острова Айлей",
        "uk": "Гігант острова Айлей"
      },
      "subtitle": "",
      "dateOrYear": "2024–2026",
      "description": {
        "en": "Caol Ila remains Islay's largest distillery (~6.5m liters/year), serving as the backbone for Johnnie Walker while excelling as a globally acclaimed single malt.",
        "ru": "Caol Ila удерживает статус крупнейшего гиганта Айлея (~6,5 млн л/год), являясь основой Johnnie Walker и признанным односолодовым брендом.",
        "uk": "Caol Ila утримує статус найбільшого гіганта Айлею (~6,5 млн л/рік), залишаючись основою Johnnie Walker та визнаним односолодовим брендом."
      }
    }
  ]
}
$caol_ila_data$::jsonb;
    existing_type text;
    existing_schema jsonb;
BEGIN
    SELECT id INTO STRICT caol_ila_id
    FROM distilleries
    WHERE lower(trim(name)) = 'caol ila';

    IF jsonb_typeof(timeline->'steps') <> 'array' OR jsonb_array_length(timeline->'steps') <> 13 THEN
        RAISE EXCEPTION 'Expected 13 Caol Ila timeline steps';
    END IF;

    SELECT type, schema_data INTO existing_type, existing_schema
    FROM infographics WHERE distillery_id = caol_ila_id FOR UPDATE;
    IF FOUND THEN
        IF existing_type <> 'timeline' OR existing_schema <> timeline THEN
            RAISE EXCEPTION 'Caol Ila already has a different infographic; refusing to overwrite';
        END IF;
    ELSE
        INSERT INTO infographics (id, title, type, schema_data, distillery_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Caol Ila History', 'timeline', timeline, caol_ila_id, now(), now());
    END IF;
END $seed$;

COMMIT;

SELECT i.id, i.distillery_id, i.type, jsonb_array_length(i.schema_data->'steps') AS steps
FROM infographics i JOIN distilleries d ON d.id = i.distillery_id
WHERE lower(trim(d.name)) = 'caol ila';
