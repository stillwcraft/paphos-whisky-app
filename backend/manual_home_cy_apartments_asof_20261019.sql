-- Manual-only home.cy property-advertisement import; snapshot 2026-10-19.
-- Search: https://home.cy/real-estate-for-sale?area%5B%5D=13&sort=relevance_desc&price_max=100000
-- Exhaustive pagination: 2 populated pages, 16 + 9 = 25 opened advertisements.
-- 25 distinct source advertisement IDs/URLs, NOT 25 verified distinct properties.
-- Different agencies can advertise the same property with different photos/prices.
-- Possible overlaps are explicitly noted in the cards, not silently merged:
-- 283580/236524, 283581/279880, 265115/255816 and Drouseia auction/project ads.
-- Generic titles, matching prices/coordinates, or shared import dates are NOT
-- duplicate keys: they would incorrectly suppress separate units in a complex.
-- Each row contains the first FIVE actual gallery photos, not appended floor plans.
-- The 11 requested attribute rows use actual source values; missing is Not specified.
-- Prose-derived facts are labelled; inconsistent source fields remain disclosed.
-- Covered area is the portal field and may include the covered veranda.
-- Prices are current advertised amounts, not completed transaction prices.
-- Discounted prices: 275734 EUR 90,000; 265036 EUR 39,000.
-- 279050 and 177592 explicitly say plus VAT; do not assume VAT-inclusive prices.
-- Drouseia ads include live bidding/auction on 2026-10-30, not fixed-price sales.
-- 264210 is a project-level ad for 26 residences, not 26 rows to import.
-- 265768 is an occupied house/1/3 undivided share; 268400 mentions fractional
-- ownership; 177592 is a detached house/villa. Included because the given search
-- contains these advertisements; their nature is explicitly disclosed.
-- Reconfirm availability, title deeds, share rights and auction results with agents.
-- Coordinates: 22 published source pins (not independently surveyed);
-- 279880 uses its source's approximate 1,000-metre-radius area center;
-- 283882/283880 use an APPROXIMATE Drouseia village point, 34.96139, 32.39750,
-- verified at https://en.wikipedia.org/wiki/Drouseia (34d57m41s N, 32d23m51s E).
-- Do NOT interpret any fallback point as a verified house location.
-- Several markers may overlap or cluster; no artificial position offsets are used.
-- Google Maps URLs are GENERATED from coordinates, not claimed as original links.
-- Only factual attributes and concise caveats are imported, not full agency prose.
-- Requires backend/migrations/029_social_event_map_layers.sql already applied.
-- Deploy apartment Markdown-table rendering before expecting an actual HTML table.
-- owner_id 8546526596 comes from backend/manual_ukrcy_october_2026.sql and
-- backend/manual_lima_paphos_october_2026_asof_20261016.sql, not a guessed ID.
-- No live project DB connection was available; existing DB rows were NOT inspected.
-- Duplicate guards execute only when the operator manually runs this transaction:
-- global source URL OR stable home.cy source ID marker OR ANY matching photo URL.
-- Checks include hidden/expired records and other layers/owners; reruns neither
-- overwrite existing rows nor extend their lifetime. Different-agency property
-- identity is not guaranteed to be deduplicated without a shared source identity.
-- Result includes one status per advertisement and the actual inserted/existing ID.
-- Starts at execution; expires 30 DAYS after execution. No auction-date inference.
-- Runtime timestamps are timestamptz; session display zone is Asia/Nicosia.
-- This file is for MANUAL execution only and has NOT been applied to the project DB.
BEGIN;
SET LOCAL TIME ZONE 'Asia/Nicosia';
SET LOCAL standard_conforming_strings = on;
SET LOCAL lock_timeout = '10s';
LOCK TABLE social_events IN SHARE ROW EXCLUSIVE MODE;

WITH source_rows (
    source_id, source_url, title, latitude, longitude, image_urls, description
) AS (
    VALUES
    (
        284114,
        'https://home.cy/real-estate-for-sale/ground-floor-apartment-for-sale-in-paphos-284114',
        'Ground floor apartment for sale - Drouseia - €60,000 - #284114',
        34.962786,
        32.397695,
        '["https://cdn.cy/1:e6e8ffab/284114/6ad22c506ce66.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/284114/6ad22c50b7623.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/284114/6ad22c5111551.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/284114/6ad22c5156535.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/284114/6ad22c51a2a31.jpg/w=1920"]'::jsonb,
        '**Advertised price: €60,000**

Location: Drouseia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | Studio |
| Bathrooms | 1 |
| Covered area | 45 m² |
| Veranda (covered) | 7 m² |
| Roof terrace | Not specified |
| Year of construction | Not specified |
| Title deed | Full |
| Condition | Resale |
| Floor | 0 |
| Pool | Yes |
| Sea view | Not specified |
| Veranda (uncovered) | 5 m² |
| Furnished | Fully |

Sale and data notes: Live bidding on 30 October 2026, not a fixed-price sale. Offers must exceed the applicable reserve; confirm it with the agent. Successful bidders must pay a EUR 5,000 reservation amount. Furnished studio.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/ground-floor-apartment-for-sale-in-paphos-284114
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.962786,32.397695

Home.cy listing ID: 284114
Source: https://home.cy/real-estate-for-sale/ground-floor-apartment-for-sale-in-paphos-284114
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        284110,
        'https://home.cy/real-estate-for-sale/ground-floor-apartment-for-sale-in-paphos-284110',
        'Ground floor apartment for sale - Drouseia - €50,000 - #284110',
        34.962786,
        32.397695,
        '["https://cdn.cy/1:e6e8ffab/284110/6ad22a41c2cb8.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/284110/6ad22a4243429.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/284110/6ad22a42e481d.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/284110/6ad22a434fab9.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/284110/6ad22a439f57a.jpg/w=1920"]'::jsonb,
        '**Advertised price: €50,000**

Location: Drouseia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | Studio |
| Bathrooms | 1 |
| Covered area | 43 m² |
| Veranda (covered) | 7 m² |
| Roof terrace | Not specified |
| Year of construction | Not specified |
| Title deed | Full |
| Condition | Resale |
| Floor | 0 |
| Pool | Yes |
| Sea view | Not specified |
| Veranda (uncovered) | 5 m² |

Sale and data notes: Live bidding on 30 October 2026, not a fixed-price sale. Offers must exceed the applicable reserve; confirm it with the agent. Successful bidders must pay a EUR 5,000 reservation amount. Unfurnished studio.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/ground-floor-apartment-for-sale-in-paphos-284110
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.962786,32.397695

Home.cy listing ID: 284110
Source: https://home.cy/real-estate-for-sale/ground-floor-apartment-for-sale-in-paphos-284110
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        283882,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-283882',
        'Apartment for sale - Drouseia - €70,000 - #283882',
        34.96139,
        32.3975,
        '["https://cdn.cy/1:e6e8ffab/283882/6ad0c9c1e0e55.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283882/6ad0c9c25cacf.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283882/6ad0c9c2d2888.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283882/6ad0c9c33afd3.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283882/6ad0c9c3ce911.jpg/w=1920"]'::jsonb,
        '**Advertised price: €70,000**

Location: Drouseia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 50 m² |
| Veranda (covered) | 8 m² |
| Roof terrace | 49 m² |
| Year of construction | 2011 |
| Title deed | Full |
| Condition | Resale |
| Floor | 1 |
| Pool | Yes |
| Sea view | Yes |

Sale and data notes: Auction on 30 October 2026 at 15:00. EUR 70,000 is the reserve, not a final sale price; bids must be higher. Registration is required. The stated auction time is reproduced as advertised; no explicit timezone was supplied.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: APPROXIMATE: Drouseia village reference point, based on the locality and development-on-the-edge-of-Droushia description. The card supplies no house coordinates or address; this is not a building pin.
Coordinate source: https://en.wikipedia.org/wiki/Drouseia
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.96139,32.3975

Home.cy listing ID: 283882
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-283882
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        283880,
        'https://home.cy/real-estate-for-sale/ground-floor-apartment-for-sale-in-paphos-283880',
        'Ground floor apartment for sale - Drouseia - €50,000 - #283880',
        34.96139,
        32.3975,
        '["https://cdn.cy/1:e6e8ffab/283880/6ad0c8b18adc1.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283880/6ad0c8b0b6e63.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283880/6ad0c8b1321bf.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283880/6ad0c8b223a15.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283880/6ad0c8b2ac73b.jpg/w=1920"]'::jsonb,
        '**Advertised price: €50,000**

Location: Drouseia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | Studio |
| Bathrooms | 1 |
| Covered area | 36 m² |
| Veranda (covered) | 7 m² |
| Roof terrace | Not specified |
| Year of construction | 2011 |
| Title deed | Full |
| Condition | Resale |
| Floor | 0 |
| Pool | Yes |
| Sea view | Not specified |
| Veranda (uncovered) | 5 m² |

Sale and data notes: Auction on 30 October 2026 at 15:00. EUR 50,000 is the reserve, not a final sale price; bids must be higher. Registration is required. The stated auction time is reproduced as advertised; no explicit timezone was supplied.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: APPROXIMATE: Drouseia village reference point, based on the locality and development-on-the-edge-of-Droushia description. The card supplies no house coordinates or address; this is not a building pin.
Coordinate source: https://en.wikipedia.org/wiki/Drouseia
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.96139,32.3975

Home.cy listing ID: 283880
Source: https://home.cy/real-estate-for-sale/ground-floor-apartment-for-sale-in-paphos-283880
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        283878,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-283878',
        'Apartment for sale - Drouseia - €65,000 - #283878',
        34.962786,
        32.397695,
        '["https://cdn.cy/1:e6e8ffab/283878/6ad0c6c285c5a.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283878/6ad0c6c3107b2.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283878/6ad0c6c36b1a1.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283878/6ad0c6c3d0d6c.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283878/6ad0c6c44a4fc.jpg/w=1920"]'::jsonb,
        '**Advertised price: €65,000**

Location: Drouseia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 58 m² |
| Veranda (covered) | 8 m² |
| Roof terrace | 8 m² |
| Year of construction | Not specified |
| Title deed | Full |
| Condition | Resale |
| Floor | 1 |
| Pool | Not specified |
| Sea view | Not specified |
| Veranda (uncovered) | 2 m² |

Sale and data notes: Live bidding on 30 October 2026, not a fixed-price sale. Offers must exceed the applicable reserve; confirm it with the agent. Successful bidders must pay a EUR 5,000 reservation amount. The structured area/roof-terrace fields are reproduced as published.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-283878
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.962786,32.397695

Home.cy listing ID: 283878
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-283878
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        283580,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-283580',
        'Apartment for sale - Peyia - €60,000 - #283580',
        34.886577159636,
        32.38688258344,
        '["https://cdn.cy/1:e6e8ffab/283580/6ace3b3a250bb.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283580/6ace3b3a89f12.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283580/6ace3b3b31f1e.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283580/6ace3b3ba8cf1.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283580/6ace3b3c46a0c.jpg/w=1920"]'::jsonb,
        '**Advertised price: €60,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 58 m² |
| Veranda (covered) | 7 m² |
| Roof terrace | Not specified |
| Year of construction | 2007 |
| Title deed | No separate title deed (description) |
| Condition | Resale |
| Floor | Ground floor (description) |
| Pool | Yes |
| Sea view | Not specified |
| Veranda (uncovered) | 11 m² |

Sale and data notes: PASCHALIS SUNSET APARTMENTS 2, Block A, door A2 (No. 12), ground floor. Internal area 51 m²; the portal''s Covered area includes the 7 m² covered veranda. Assignment of contract; no separate title deed and issuance is not guaranteed.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-283580
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.886577159636,32.38688258344

Home.cy listing ID: 283580
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-283580
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        283581,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-283581',
        'Apartment for sale - Peyia - €60,000 - #283581',
        34.886577159636,
        32.38688258344,
        '["https://cdn.cy/1:e6e8ffab/283581/6ace3b33716de.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283581/6ace3b33e2143.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283581/6ace3b344b442.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283581/6ace3b34b6c2b.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/283581/6ace3b358dcf5.jpg/w=1920"]'::jsonb,
        '**Advertised price: €60,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 61 m² |
| Veranda (covered) | 10 m² |
| Roof terrace | Not specified |
| Year of construction | 2007 |
| Title deed | No separate title deed (description) |
| Condition | Resale |
| Floor | Ground floor (description) |
| Pool | Yes |
| Sea view | Not specified |
| Veranda (uncovered) | 25 m² |

Sale and data notes: PASCHALIS SUNSET APARTMENTS 2, Block D, door D6 (No. 13), ground floor. Internal area 51 m²; the portal''s Covered area includes the 10 m² covered veranda. Assignment of contract; no separate title deed and issuance is not guaranteed.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-283581
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.886577159636,32.38688258344

Home.cy listing ID: 283581
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-283581
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        279880,
        'https://home.cy/real-estate-for-sale/ground-floor-apartment-for-sale-in-paphos-279880',
        'Ground floor apartment for sale - Peyia - €65,000 - #279880',
        34.886074,
        32.386669,
        '["https://cdn.cy/1:e6e8ffab/279880/6ac60db4d06c5.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279880/6ac60db536e90.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279880/6ac60db57aa2e.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279880/6ac60db5c7f7c.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279880/6ac60db622de4.jpg/w=1920"]'::jsonb,
        '**Advertised price: €65,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 51 m² |
| Veranda (covered) | 10 m² |
| Roof terrace | Not specified |
| Year of construction | 2007 |
| Title deed | No separate title deed (description) |
| Condition | Resale |
| Floor | 0 |
| Pool | Yes |
| Sea view | Not specified |
| Veranda (uncovered) | 25 m² |

Sale and data notes: Tender process; offers are considered on a scheduled basis. Assignment of contract; no separate title deed. No VAT according to the description. May overlap listing 283581: similar locality, year, layout and terrace areas, but this card does not supply a matching unit identifier.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: APPROXIMATE: center of the source''s 1,000-metre location circle, not a house coordinate.
Coordinate source: https://home.cy/real-estate-for-sale/ground-floor-apartment-for-sale-in-paphos-279880
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.886074,32.386669

Home.cy listing ID: 279880
Source: https://home.cy/real-estate-for-sale/ground-floor-apartment-for-sale-in-paphos-279880
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        279800,
        'https://home.cy/real-estate-for-sale/maisonette-for-sale-in-paphos-279800',
        'Maisonette for sale - Argaka - €70,000 - #279800',
        35.065362597317,
        32.482576380456,
        '["https://cdn.cy/1:e6e8ffab/279800/6ac500c45ccda.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279800/6ac500c4c3323.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279800/6ac500c52782b.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279800/6ac500c591e61.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279800/6ac500c5ee2d0.jpg/w=1920"]'::jsonb,
        '**Advertised price: €70,000**

Location: Argaka, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 52 m² |
| Veranda (covered) | Not specified |
| Roof terrace | Not specified |
| Year of construction | 2011 |
| Title deed | No separate title deed (description) |
| Condition | Resale |
| Floor | Not specified |
| Pool | Yes |
| Sea view | Not specified |
| Veranda (uncovered) | 28 m² |

Sale and data notes: Assignment of contract; no separate title deed and issuance is not guaranteed.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/maisonette-for-sale-in-paphos-279800
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=35.065362597317,32.482576380456

Home.cy listing ID: 279800
Source: https://home.cy/real-estate-for-sale/maisonette-for-sale-in-paphos-279800
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        279050,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-279050',
        'Apartment for sale - Peyia - €60,000 plus VAT - #279050',
        34.874093,
        32.372809,
        '["https://cdn.cy/1:e6e8ffab/279050/6ac466d466d82.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279050/6ac466d4b3108.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279050/6ac466d4ef85f.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279050/6ac466d532950.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/279050/6ac466d572213.jpg/w=1920"]'::jsonb,
        '**Advertised price: €60,000 plus VAT**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 60 m² |
| Veranda (covered) | 7 m² |
| Roof terrace | Not specified |
| Year of construction | 2007 |
| Title deed | No separate title deed (description) |
| Condition | Resale |
| Floor | 1 (description) |
| Pool | Not specified |
| Sea view | Not specified |

Sale and data notes: Superior 12, apartment No. 10, first floor. Assignment of contract; no separate title deed and issuance is not guaranteed. Advertised amount is plus VAT.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-279050
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.874093,32.372809

Home.cy listing ID: 279050
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-279050
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        275734,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-275734',
        'Apartment for sale - Peyia - €90,000 - #275734',
        34.864455367798,
        32.382218618698,
        '["https://cdn.cy/1:e6e8ffab/275734/6a97e4f0e18dc.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/275734/6a97e4f1357d6.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/275734/6a97e4f18cc52.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/275734/6a97e4f1e9f69.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/275734/6a97e4f23da9a.jpg/w=1920"]'::jsonb,
        '**Advertised price: €90,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 2 |
| Bathrooms | 2 |
| Covered area | 91 m² |
| Veranda (covered) | 13 m² |
| Roof terrace | Not specified |
| Year of construction | 2006 |
| Title deed | Full |
| Condition | Resale |
| Floor | 1 |
| Pool | Not specified |
| Sea view | Not specified |

Sale and data notes: Current asking price EUR 90,000; struck-through previous price EUR 110,000 is not the current price. Internal area 78 m²; Covered area 91 m² includes the 13 m² covered veranda. Separate title deed is stated to be available.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-275734
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.864455367798,32.382218618698

Home.cy listing ID: 275734
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-275734
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        268400,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-268400',
        'Apartment for sale - Latsi - €72,000 - #268400',
        35.0405881,
        32.3943387,
        '["https://cdn.cy/1:e6e8ffab/268400/6a60feb2e1224.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/268400/6a60feb346fe4.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/268400/6a60feb3b1caf.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/268400/6a60feb40eb95.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/268400/6a60feb45462d.jpg/w=1920"]'::jsonb,
        '**Advertised price: €72,000**

Location: Latsi, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | Studio |
| Bathrooms | 1 |
| Covered area | 28 m² |
| Veranda (covered) | 4 m² |
| Roof terrace | Not specified |
| Year of construction | Not specified |
| Title deed | No separate title deed (description) |
| Condition | Resale |
| Floor | Not specified |
| Pool | Yes, communal (description) |
| Sea view | Not specified |

Sale and data notes: No separate title deed. The description explicitly presents a co-ownership/fractional-ownership opportunity; confirm the actual interest being sold rather than assuming full ownership. A complex of 59 apartments with indoor/outdoor pools is described.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-268400
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=35.0405881,32.3943387

Home.cy listing ID: 268400
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-268400
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        265768,
        'https://home.cy/real-estate-for-sale/villa-for-sale-in-paphos-265768',
        'Villa for sale - Peyia - €70,000 - #265768',
        34.883172468374,
        32.381379045103,
        '["https://cdn.cy/1:e6e8ffab/265768/6a5f6bc51aedb.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265768/6a5f6bc58b408.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265768/6a5f6bc5f32cf.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265768/6a5f6bc66ffcd.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265768/6a5f6bc6daf45.jpg/w=1920"]'::jsonb,
        '**Advertised price: €70,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | Studio |
| Bathrooms | Not specified |
| Covered area | 90 m² |
| Veranda (covered) | Not specified |
| Roof terrace | Not specified |
| Year of construction | 1920 |
| Title deed | Full |
| Condition | Resale |
| Floor | Not specified |
| Pool | Not specified |
| Sea view | Not specified |
| Plot area | 274 m² |

Sale and data notes: IMPORTANT: the description offers a 1/3 undivided share, not an independently titled whole apartment. It describes an occupied single-storey house built around 1920 on an 822 m² parcel; the share corresponds to about 274 m² of land. The portal classifies Bedrooms as Studio. Confirm possession and the rights attached to the share.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/villa-for-sale-in-paphos-265768
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.883172468374,32.381379045103

Home.cy listing ID: 265768
Source: https://home.cy/real-estate-for-sale/villa-for-sale-in-paphos-265768
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        265035,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265035',
        'Apartment for sale - Peyia - €70,000 - #265035',
        34.884116,
        32.382063,
        '["https://cdn.cy/1:e6e8ffab/265035/6a577f5f0112f.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265035/6a577f5f47211.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265035/6a577f5f8becc.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265035/6a577f5feaf02.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265035/6a577f60720cf.jpg/w=1920"]'::jsonb,
        '**Advertised price: €70,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 81 m² |
| Veranda (covered) | 11 m² |
| Roof terrace | Not specified |
| Year of construction | 2007 (description) |
| Title deed | No |
| Condition | Resale |
| Floor | 1/3 |
| Pool | Not specified |
| Sea view | Not specified |
| Veranda (uncovered) | 7 m² |

Sale and data notes: Assignment of contract; no title deed. Source inconsistency: structured fields say Covered area 81 m², covered veranda 11 m² and uncovered veranda 7 m², whereas the description says internal area 51 m², covered veranda 7 m² and uncovered veranda 11 m². Values are not silently reconciled. The source Floor value 1/3 is retained verbatim.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265035
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.884116,32.382063

Home.cy listing ID: 265035
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265035
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        265036,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265036',
        'Apartment for sale - Peyia - €39,000 - #265036',
        34.884116,
        32.382063,
        '["https://cdn.cy/1:e6e8ffab/265036/6a577f5c444b6.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265036/6a577f5c9e32a.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265036/6a577f5cefd99.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265036/6a577f5d20c7d.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265036/6a577f5d8534c.jpg/w=1920"]'::jsonb,
        '**Advertised price: €39,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 51 m² |
| Veranda (covered) | 5 m² |
| Roof terrace | Not specified |
| Year of construction | 2007 |
| Title deed | No |
| Condition | Resale |
| Floor | 1/3 |
| Pool | Not specified |
| Sea view | Not specified |

Sale and data notes: Current asking price EUR 39,000; struck-through previous price EUR 59,000 is not the current price. Assignment of contract; no title deed. Source inconsistency: the structured field calls the 5 m² veranda covered, but the description calls it uncovered. The source Floor value 1/3 is retained verbatim.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265036
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.884116,32.382063

Home.cy listing ID: 265036
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265036
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        265115,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265115',
        'Apartment for sale - Moutallos - €100,000 - #265115',
        34.782301,
        32.417333,
        '["https://cdn.cy/1:e6e8ffab/265115/6a577d2524705.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265115/6a577d254c431.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265115/6a577d25a6bc7.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265115/6a577d261b3a6.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265115/6a577d269c38e.jpg/w=1920"]'::jsonb,
        '**Advertised price: €100,000**

Location: Moutallos, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 2 |
| Bathrooms | 1 |
| Covered area | 78 m² |
| Veranda (covered) | 22 m² |
| Roof terrace | Not specified |
| Year of construction | 2008 (description) |
| Title deed | No |
| Condition | Resale |
| Floor | 1/3 |
| Pool | Yes, communal (description) |
| Sea view | Not specified |
| Veranda (uncovered) | 16 m² |

Sale and data notes: Assignment of contract; no separate title deed. No VAT according to the description. Internal area 56 m²; Covered area 78 m² includes the 22 m² covered veranda. May overlap listing 255816: matching locality, year, floor, areas, bedrooms and price, but this card has no matching building/unit identifier. The source Floor value 1/3 is retained verbatim.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265115
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.782301,32.417333

Home.cy listing ID: 265115
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265115
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        265049,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265049',
        'Apartment for sale - Poli Chrysochous - €80,000 - #265049',
        35.02715476,
        32.43334961,
        '["https://cdn.cy/1:e6e8ffab/265049/6a577b87247cc.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265049/6a577b87a1912.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265049/6a577b88344b8.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265049/6a577b88a51ae.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/265049/6a577b894d2f8.jpg/w=1920"]'::jsonb,
        '**Advertised price: €80,000**

Location: Poli Chrysochous, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 2 |
| Bathrooms | 1 |
| Covered area | 80 m² |
| Veranda (covered) | 7 m² |
| Roof terrace | Not specified |
| Year of construction | 2010 |
| Title deed | Not specified |
| Condition | Resale |
| Floor | 1/3 |
| Pool | Not specified |
| Sea view | Not specified |

Sale and data notes: Assignment of contract. Internal area 73 m²; Covered area 80 m² includes the 7 m² covered veranda. Separate title-deed status is not specified. The source Floor value 1/3 is retained verbatim.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265049
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=35.02715476,32.43334961

Home.cy listing ID: 265049
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-265049
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        264350,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-264350',
        'Apartment for sale - Peyia - €70,000 - #264350',
        34.87387239621,
        32.372757582353,
        '["https://cdn.cy/1:e6e8ffab/264350/6abb2c573c2bf.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/264350/6abb2c57a387f.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/264350/6abb2c57e5fc5.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/264350/6abb2c582c3bf.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/264350/6abb2c5884c22.jpg/w=1920"]'::jsonb,
        '**Advertised price: €70,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 60 m² |
| Veranda (covered) | 7 m² |
| Roof terrace | Not specified |
| Year of construction | 2007 |
| Title deed | No separate title deed (description) |
| Condition | Resale |
| Floor | 1 (description) |
| Pool | Yes |
| Sea view | Not specified |

Sale and data notes: Superior 12, Block B, apartment No. 4, first floor. Assignment of contract; no separate title deed and issuance is not guaranteed.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-264350
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.87387239621,32.372757582353

Home.cy listing ID: 264350
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-264350
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        264210,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-264210',
        'Apartment for sale - Drouseia - €50,000 - #264210',
        34.967116889293,
        32.401675629286,
        '["https://cdn.cy/1:e6e8ffab/264210/6ad5607d5cca6.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/264210/6ad5607dc4d4a.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/264210/6ad5607e17dda.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/264210/6ad5607e69d2b.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/264210/6ad5607ec9639.jpg/w=1920"]'::jsonb,
        '**Advertised price: €50,000**

Location: Drouseia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | Studio |
| Bathrooms | 1 |
| Covered area | 36 m² |
| Veranda (covered) | 7 m² |
| Roof terrace | Not specified |
| Year of construction | 2011 |
| Title deed | Pending (description) |
| Condition | Resale |
| Floor | Not specified |
| Pool | Yes |
| Sea view | Yes |
| Veranda (uncovered) | 5 m² |
| Elevator | Yes |
| Balcony | Yes |

Sale and data notes: Project-level advertisement for a collection of 26 residences, not proof of an additional distinct apartment. EUR 50,000 is the advertised amount, not the price of the whole collection. Auction on 30 October 2026; separate title deeds are pending without a confirmed issue date. The structured studio attributes are retained as advertised. May overlap the other Drouseia auction advertisements.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-264210
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.967116889293,32.401675629286

Home.cy listing ID: 264210
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-264210
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        257344,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-257344',
        'Apartment for sale - Peyia - €75,000 - #257344',
        34.886329,
        32.387052,
        '["https://cdn.cy/1:e6e8ffab/257344/6abbbf98ec703.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/257344/6abbbf998a2d2.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/257344/6abbbf9a1645f.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/257344/6abbbf9a87a28.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/257344/6abbbf9ae697b.jpg/w=1920"]'::jsonb,
        '**Advertised price: €75,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 61 m² |
| Veranda (covered) | 10 m² |
| Roof terrace | Not specified |
| Year of construction | 2007 |
| Title deed | No separate title deed (description) |
| Condition | Resale |
| Floor | Not specified |
| Pool | Yes |
| Sea view | Not specified |
| Veranda (uncovered) | 22 m² |

Sale and data notes: Assignment of contract; no separate title deed and issuance is not guaranteed.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-257344
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.886329,32.387052

Home.cy listing ID: 257344
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-257344
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        255816,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-255816',
        'Apartment for sale - Moutallos - €100,000 - #255816',
        34.785504487033,
        32.413968788912,
        '["https://cdn.cy/1:e6e8ffab/255816/6ab494701cd5e.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/255816/6ab494706430d.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/255816/6ab49470a1b0a.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/255816/6ab49470dbd76.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/255816/6ab4947135f9b.jpg/w=1920"]'::jsonb,
        '**Advertised price: €100,000**

Location: Moutallos, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 2 |
| Bathrooms | 1 |
| Covered area | 78 m² |
| Veranda (covered) | 22 m² |
| Roof terrace | Not specified |
| Year of construction | 2008 |
| Title deed | No separate title deed (description) |
| Condition | Resale |
| Floor | 1 |
| Pool | Yes |
| Sea view | Not specified |
| Veranda (uncovered) | 16 m² |

Sale and data notes: Diana 51, door 103 (No. 3), first floor; covered parking No. 11. Internal area 56 m²; Covered area 78 m² includes the 22 m² covered veranda. Assignment of contract; no separate title deed and issuance is not guaranteed. May overlap listing 265115; its unit identity cannot be confirmed from that card.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-255816
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.785504487033,32.413968788912

Home.cy listing ID: 255816
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-255816
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        254223,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-254223',
        'Apartment for sale - Peyia - €70,000 - #254223',
        34.87972891374,
        32.387287605314,
        '["https://cdn.cy/1:e6e8ffab/254223/6a033f662a89e.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/254223/6a033f667ccb4.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/254223/6a033f66c90bf.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/254223/6a033f671d7a2.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/254223/6a033f676dfe4.jpg/w=1920"]'::jsonb,
        '**Advertised price: €70,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 50 m² |
| Veranda (covered) | Not specified |
| Roof terrace | Not specified |
| Year of construction | 2009 |
| Title deed | No separate title deed (description) |
| Condition | Resale |
| Floor | Ground floor (description) |
| Pool | Yes |
| Sea view | Not specified |
| Veranda (uncovered) | 49 m² |

Sale and data notes: Marina Hilltop Apartments, Block B, apartment No. 12, ground floor. Assignment of contract; no separate title deed and issuance is not guaranteed.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-254223
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.87972891374,32.387287605314

Home.cy listing ID: 254223
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-254223
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        236524,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-236524',
        'Apartment for sale - Peyia - €55,000 - #236524',
        34.886161785781,
        32.38669794841,
        '["https://cdn.cy/1:e6e8ffab/236524/6972eb9c4b9eb.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/236524/6972eb9c7fb48.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/236524/6972eb9ca791f.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/236524/6972eb9ce07e9.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/236524/6972eb9d20d46.jpg/w=1920"]'::jsonb,
        '**Advertised price: €55,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 1 |
| Bathrooms | 1 |
| Covered area | 58 m² |
| Veranda (covered) | 7 m² |
| Roof terrace | Not specified |
| Year of construction | 2007 |
| Title deed | Not specified |
| Condition | Resale |
| Floor | Not specified |
| Pool | Yes |
| Sea view | Not specified |
| Veranda (uncovered) | 11 m² |

Sale and data notes: Assignment of contract; no separate title deed and issuance is not guaranteed. May overlap listing 283580: same locality, construction year, covered/veranda areas and layout, but a matching unit identifier is not confirmed.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-236524
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.886161785781,32.38669794841

Home.cy listing ID: 236524
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-236524
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        223056,
        'https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-223056',
        'Apartment for sale - Peyia - €90,000 - #223056',
        34.884489416718,
        32.387513037765,
        '["https://cdn.cy/1:e6e8ffab/223056/699dc9443963c.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/223056/699dc94483a4f.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/223056/699dc944cc18f.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/223056/699dc9452a60d.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/223056/699dc94580ccc.jpg/w=1920"]'::jsonb,
        '**Advertised price: €90,000**

Location: Peyia, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 2 |
| Bathrooms | 2 |
| Covered area | 91 m² |
| Veranda (covered) | 13 m² |
| Roof terrace | Not specified |
| Year of construction | 2006 |
| Title deed | Separate title deed (description) |
| Condition | Resale |
| Floor | 1 |
| Pool | Yes |
| Sea view | Yes |

Sale and data notes: Coral View, Block E, door E104, first floor. Internal area 78 m²; Covered area 91 m² includes the 13 m² covered veranda. Separate title deed. The sea view is described as partial, although the structured field says Yes.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-223056
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.884489416718,32.387513037765

Home.cy listing ID: 223056
Source: https://home.cy/real-estate-for-sale/apartment-for-sale-in-paphos-223056
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    ),
    (
        177592,
        'https://home.cy/real-estate-for-sale/villa-for-sale-in-paphos-177592',
        'Villa for sale - Nata - €40,000 plus VAT - #177592',
        34.777024,
        32.568529,
        '["https://cdn.cy/1:e6e8ffab/177592/6aa92df0b7422.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/177592/6aa92df14b20d.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/177592/6aa92df1bac1d.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/177592/6aa92df21f23c.jpg/w=1920", "https://cdn.cy/1:e6e8ffab/177592/6aa92df2980fb.jpg/w=1920"]'::jsonb,
        '**Advertised price: €40,000 plus VAT**

Location: Nata, Paphos

| Feature | Value |
| --- | --- |
| Bedrooms | 3 |
| Bathrooms | 1 |
| Covered area | 173 m² |
| Veranda (covered) | 25 m² |
| Roof terrace | Not specified |
| Year of construction | 2006 |
| Title deed | No separate title deed (description) |
| Condition | Resale |
| Floor | Not specified |
| Pool | Not specified |
| Sea view | Not specified |
| Veranda (uncovered) | 27 m² |

Sale and data notes: Detached two-storey house/villa in Nata, house No. 2; not an apartment. Internal area 148 m²; Covered area 173 m² includes the 25 m² covered veranda. Assignment of contract; no separate title deed and issuance is not guaranteed. Advertised amount is plus VAT.

Missing attributes are shown as Not specified, never inferred as No. Structured portal fields are preserved; description-derived additions are labelled.

Coordinates: Published home.cy map pin; building-level accuracy has not been independently verified.
Coordinate source: https://home.cy/real-estate-for-sale/villa-for-sale-in-paphos-177592
Google Maps (generated coordinate link): https://www.google.com/maps/search/?api=1&query=34.777024,32.568529

Home.cy listing ID: 177592
Source: https://home.cy/real-estate-for-sale/villa-for-sale-in-paphos-177592
Snapshot: 19 October 2026. Availability, auction results, ownership and final price must be confirmed with the advertiser.'
    )
),
prepared AS (
    SELECT candidate.*, duplicate.id AS existing_id
    FROM source_rows AS candidate
    LEFT JOIN LATERAL (
        SELECT existing.id
        FROM social_events AS existing
        WHERE existing.event_type = 'global'
          AND (
              strpos(existing.description, candidate.source_url) > 0
              OR strpos(
                  existing.description,
                  'Home.cy listing ID: ' || candidate.source_id::text || E'\n'
              ) > 0
              OR existing.image_urls ?| ARRAY(
                  SELECT jsonb_array_elements_text(candidate.image_urls)
              )
          )
        ORDER BY existing.id
        LIMIT 1
    ) AS duplicate ON TRUE
),
inserted AS (
    INSERT INTO social_events (
        owner_id, description, event_type, map_layer, image_urls, drink,
        visibility, latitude, longitude, location, photo_key,
        starts_at, expires_at, capacity, hidden
    )
    SELECT
        8546526596::bigint, candidate.description, 'global', 'apartments',
        candidate.image_urls, 'spirits', 'public', candidate.latitude,
        candidate.longitude, candidate.title, NULL,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', NULL, FALSE
    FROM prepared AS candidate
    WHERE candidate.existing_id IS NULL
    RETURNING id, location, description, starts_at, expires_at
)
SELECT
    candidate.source_id,
    candidate.title,
    CASE WHEN added.id IS NOT NULL THEN 'inserted' ELSE 'already_exists' END AS import_status,
    COALESCE(added.id, candidate.existing_id) AS social_event_id,
    added.starts_at AS inserted_starts_at,
    added.expires_at AS inserted_expires_at
FROM prepared AS candidate
LEFT JOIN inserted AS added
    ON added.description = candidate.description
ORDER BY candidate.source_id;

COMMIT;
