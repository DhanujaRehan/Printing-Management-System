-- ============================================================
-- SoftWave — Full Cleanup & Re-seed
-- Run this in pgAdmin Query Tool
-- ============================================================

-- Step 1: Clear all data (keep tables and users)
TRUNCATE TABLE
    toner_installations,
    stock_movements,
    toner_stock,
    replacement_requests,
    print_logs,
    paper_printer_stock,
    paper_branch_stock,
    paper_movements,
    paper_stock,
    import_requests,
    audit_log
RESTART IDENTITY CASCADE;

DELETE FROM printers;
DELETE FROM branches;
DELETE FROM toner_models;
DELETE FROM paper_types;

-- Reset sequences
ALTER SEQUENCE branches_id_seq     RESTART WITH 1;
ALTER SEQUENCE printers_id_seq     RESTART WITH 1;
ALTER SEQUENCE toner_models_id_seq RESTART WITH 1;
ALTER SEQUENCE paper_types_id_seq  RESTART WITH 1;

-- ============================================================
-- Step 2: Insert 7 real toner models
-- ============================================================
INSERT INTO toner_models (model_code, brand, yield_copies, color, min_stock) VALUES
    ('TOSHIBA T2309A',     'TOSHIBA',        5000,  'black', 3),
    ('TOSHIBA T3008A',     'TOSHIBA',        10000, 'black', 3),
    ('TOSHIBA T5018A',     'TOSHIBA',        15000, 'black', 3),
    ('TOSHIBA T3028',      'TOSHIBA',        12000, 'black', 3),
    ('CANNON NPG 84',      'CANON',          10000, 'black', 3),
    ('CANNON NPG 51',      'CANON',          8000,  'black', 3),
    ('Konica Minolta 367', 'Konica Minolta', 15000, 'black', 3);

-- Stock rows
INSERT INTO toner_stock (toner_model_id, quantity)
SELECT id, 5 FROM toner_models;

-- ============================================================
-- Step 3: Insert 32 branches
-- ============================================================
INSERT INTO branches (code, name, location, contact) VALUES
    ('ANUR', 'Anuradhapura',     'Anuradhapura',     'Branch Contact'),
    ('AVI',  'Avissawella',      'Avissawella',      'Branch Contact'),
    ('BAT',  'Battaramulla',     'Battaramulla',     'Branch Contact'),
    ('BATT', 'Batticaloa',       'Batticaloa',       'Branch Contact'),
    ('COL7', 'Colombo 07',       'Colombo 07',       'Branch Contact'),
    ('CO10', 'Colombo 10',       'Colombo 10',       'Branch Contact'),
    ('DELK', 'Delkanda Nugegoda','Delkanda Nugegoda','Branch Contact'),
    ('ELP',  'Elpitiya',         'Elpitiya',         'Branch Contact'),
    ('GAM',  'Gampaha',          'Gampaha',          'Branch Contact'),
    ('GAPO', 'Gampola',          'Gampola',          'Branch Contact'),
    ('HAM',  'Hambantota',       'Hambantota',       'Branch Contact'),
    ('HOR',  'Horana',           'Horana',           'Branch Contact'),
    ('JAF',  'Jaffna',           'Jaffna',           'Branch Contact'),
    ('KAD',  'Kaduwela',         'Kaduwela',         'Branch Contact'),
    ('KAL',  'Kalutara',         'Kalutara',         'Branch Contact'),
    ('KAN',  'Kandy',            'Kandy',            'Branch Contact'),
    ('KEG',  'Kegalle',          'Kegalle',          'Branch Contact'),
    ('KIL',  'Kilinochchi',      'Kilinochchi',      'Branch Contact'),
    ('KOTP', 'Kotapola',         'Kotapola',         'Branch Contact'),
    ('KOT',  'Kottawa',          'Kottawa',          'Branch Contact'),
    ('KUR',  'Kurunegala',       'Kurunegala',       'Branch Contact'),
    ('KURZ', 'Kurunegala Zonal', 'Kurunegala Zonal', 'Branch Contact'),
    ('MAH',  'Mahara',           'Mahara',           'Branch Contact'),
    ('MAN',  'Mannar',           'Mannar',           'Branch Contact'),
    ('MAT',  'Matara',           'Matara',           'Branch Contact'),
    ('MUL',  'Mullathivu',       'Mullathivu',       'Branch Contact'),
    ('NEG',  'Negombo',          'Negombo',          'Branch Contact'),
    ('PAN',  'Panadura',         'Panadura',         'Branch Contact'),
    ('PPE',  'Point Pedro',      'Point Pedro',      'Branch Contact'),
    ('RAT',  'Rathnapura',       'Rathnapura',       'Branch Contact'),
    ('VAV',  'Vavuniya',         'Vavuniya',         'Branch Contact'),
    ('WAL',  'Walasmulla',       'Walasmulla',       'Branch Contact');

-- ============================================================
-- Step 4: Insert 59 printers
-- ============================================================
INSERT INTO printers (branch_id, printer_code, model, location_note, is_active)
SELECT b.id, p.serial, p.model, p.model, TRUE
FROM (VALUES
    ('PC42190',       'Mannar',           'DP2303A'           ),
    ('PC057215',      'Point Pedro',      'DP3008A'           ),
    ('PC057216',      'Elpitiya',         'DP3008A'           ),
    ('PC061222',      'Horana',           'DP3008A'           ),
    ('PC058772',      'Point Pedro',      'DP3008A'           ),
    ('PC061168',      'Hambantota',       'DP3008A'           ),
    ('PC060609',      'Kotapola',         'DP3008A'           ),
    ('PC058773',      'Kurunegala',       'DP3008A'           ),
    ('PC059199',      'Kurunegala Zonal', 'DP3008A'           ),
    ('PC070304',      'Kotapola',         'DP3018A'           ),
    ('PC070298',      'Batticaloa',       'DP3018A'           ),
    ('PC070277',      'Elpitiya',         'DP3018A'           ),
    ('PC070386',      'Mullathivu',       'DP3518A'           ),
    ('PC061169',      'Hambantota',       'DP3008A'           ),
    ('PC083152',      'Gampaha',          'DP3028A'           ),
    ('PC083153',      'Gampaha',          'DP3028A'           ),
    ('PC082573',      'Negombo',          'DP3028A'           ),
    ('PC064691',      'Negombo',          'DP2518A'           ),
    ('PC086922',      'Avissawella',      'DP2528A'           ),
    ('PC087128',      'Jaffna',           'DP2528A'           ),
    ('PC087409',      'Anuradhapura',     'DP2528A'           ),
    ('PC087399',      'Kurunegala',       'DP2528A'           ),
    ('PC087401',      'Kandy',            'DP2528A'           ),
    ('PC087481',      'Gampaha',          'DP2528A'           ),
    ('PC087400',      'Kegalle',          'DP2528A'           ),
    ('PC087505',      'Rathnapura',       'DP2528A'           ),
    ('PC087408',      'Mannar',           'DP2528A'           ),
    ('PC087416',      'Matara',           'DP2528A'           ),
    ('PC082521',      'Kaduwela',         'DP3028A'           ),
    ('PC44922',       'Kaduwela',         'DP3008A'           ),
    ('PC082522',      'Kottawa',          'DP3028A'           ),
    ('PC083161',      'Kottawa',          'DP3028A'           ),
    ('PC083158',      'Delkanda Nugegoda','DP3028A'           ),
    ('PC083160',      'Delkanda Nugegoda','DP3028A'           ),
    ('PC083159',      'Delkanda Nugegoda','DP3028A'           ),
    ('PC083155',      'Mahara',           'DP3028A'           ),
    ('PC083154',      'Mahara',           'DP3028A'           ),
    ('PC082523',      'Panadura',         'DP3028A'           ),
    ('PC082529',      'Battaramulla',     'DP3028A'           ),
    ('PC061221',      'Panadura',         'DP3008A'           ),
    ('PC061216',      'Kaduwela',         'DP3008A'           ),
    ('PC060632',      'Kottawa',          'DP3008A'           ),
    ('PC086920',      'Delkanda Nugegoda','DP3528A'           ),
    ('PC060631',      'Colombo 10',       'DP3008A'           ),
    ('PC057567',      'Colombo 07',       'DP3008A'           ),
    ('PC055367',      'Colombo 10',       'DP2309A'           ),
    ('PC082520',      'Colombo 07',       'DP3028A'           ),
    ('PC082519',      'Colombo 07',       'DP3028A'           ),
    ('PC082518',      'Colombo 07',       'DP3028A'           ),
    ('2VM02780',      'Gampola',          'IR2625I'           ),
    ('2VM02778',      'Kottawa',          'IR2625I'           ),
    ('2VG01342',      'Walasmulla',       'IR2630I'           ),
    ('2VMO1732',      'Kilinochchi',      'IR2625I'           ),
    ('WMK10643',      'Vavuniya',         'IR2520W'           ),
    ('2VG01219',      'Vavuniya',         'IR2630I'           ),
    ('WMK10649',      'Gampola',          'IR2520W'           ),
    ('WMK06474',      'Walasmulla',       'IR2520W'           ),
    ('WMK05284',      'Kalutara',         'IR2520W'           ),
    ('A789047004365', 'Gampaha',          'Konica Minolta 367')
) AS p(serial, branch_name, model)
JOIN branches b ON b.name = p.branch_name;

-- ============================================================
-- Step 5: Toner installations with March 2026 data
-- ============================================================
INSERT INTO toner_installations
    (printer_id, toner_model_id, yield_copies, avg_daily_copies, current_pct, current_copies, is_current)
SELECT pr.id, tm.id, tm.yield_copies, 50,
       p.toner_pct,
       ROUND(tm.yield_copies * p.toner_pct / 100.0),
       TRUE
FROM (VALUES
    ('PC42190',       'TOSHIBA T2309A',     100),
    ('PC057215',      'TOSHIBA T3008A',     10 ),
    ('PC057216',      'TOSHIBA T3008A',     100),
    ('PC061222',      'TOSHIBA T3008A',     81 ),
    ('PC058772',      'TOSHIBA T3008A',     65 ),
    ('PC061168',      'TOSHIBA T3008A',     100),
    ('PC060609',      'TOSHIBA T3008A',     100),
    ('PC058773',      'TOSHIBA T3008A',     100),
    ('PC059199',      'TOSHIBA T3008A',     100),
    ('PC070304',      'TOSHIBA T5018A',     100),
    ('PC070298',      'TOSHIBA T5018A',     100),
    ('PC070277',      'TOSHIBA T5018A',     100),
    ('PC070386',      'TOSHIBA T5018A',     100),
    ('PC061169',      'TOSHIBA T3008A',     30 ),
    ('PC083152',      'TOSHIBA T3028',      0  ),
    ('PC083153',      'TOSHIBA T3028',      100),
    ('PC082573',      'TOSHIBA T3028',      60 ),
    ('PC064691',      'TOSHIBA T5018A',     100),
    ('PC086922',      'TOSHIBA T3028',      60 ),
    ('PC087128',      'TOSHIBA T3028',      50 ),
    ('PC087409',      'TOSHIBA T3028',      60 ),
    ('PC087399',      'TOSHIBA T3028',      60 ),
    ('PC087401',      'TOSHIBA T3028',      10 ),
    ('PC087481',      'TOSHIBA T3028',      10 ),
    ('PC087400',      'TOSHIBA T3028',      50 ),
    ('PC087505',      'TOSHIBA T3028',      100),
    ('PC087408',      'TOSHIBA T3028',      100),
    ('PC087416',      'TOSHIBA T3028',      100),
    ('PC082521',      'TOSHIBA T3028',      30 ),
    ('PC44922',       'TOSHIBA T3008A',     100),
    ('PC082522',      'TOSHIBA T3028',      100),
    ('PC083161',      'TOSHIBA T3028',      10 ),
    ('PC083158',      'TOSHIBA T3028',      100),
    ('PC083160',      'TOSHIBA T3028',      100),
    ('PC083159',      'TOSHIBA T3028',      10 ),
    ('PC083155',      'TOSHIBA T3028',      100),
    ('PC083154',      'TOSHIBA T3028',      70 ),
    ('PC082523',      'TOSHIBA T3028',      100),
    ('PC082529',      'TOSHIBA T3028',      100),
    ('PC061221',      'TOSHIBA T3008A',     100),
    ('PC061216',      'TOSHIBA T3008A',     100),
    ('PC060632',      'TOSHIBA T3008A',     100),
    ('PC086920',      'TOSHIBA T3028',      50 ),
    ('PC060631',      'TOSHIBA T3008A',     100),
    ('PC057567',      'TOSHIBA T3008A',     44 ),
    ('PC055367',      'TOSHIBA T2309A',     100),
    ('PC082520',      'TOSHIBA T3028',      100),
    ('PC082519',      'TOSHIBA T3028',      100),
    ('PC082518',      'TOSHIBA T3028',      100),
    ('2VM02780',      'CANNON NPG 84',      45 ),
    ('2VM02778',      'CANNON NPG 84',      89 ),
    ('2VG01342',      'CANNON NPG 84',      100),
    ('2VMO1732',      'CANNON NPG 84',      100),
    ('WMK10643',      'CANNON NPG 51',      100),
    ('2VG01219',      'CANNON NPG 84',      100),
    ('WMK10649',      'CANNON NPG 51',      100),
    ('WMK06474',      'CANNON NPG 51',      100),
    ('WMK05284',      'CANNON NPG 51',      100),
    ('A789047004365', 'Konica Minolta 367', 100)
) AS p(serial, toner_model, toner_pct)
JOIN printers pr     ON pr.printer_code = p.serial
JOIN toner_models tm ON tm.model_code   = p.toner_model;

-- ============================================================
-- Step 6: Correct 3 paper types (A4, B4, Letter only)
-- ============================================================
INSERT INTO paper_types (name, size, gsm, min_stock) VALUES
    ('A4 80gsm',     'A4',     80, 20),
    ('B4 80gsm',     'B4',     80, 15),
    ('Letter 75gsm', 'Letter', 75, 10)
ON CONFLICT (name) DO UPDATE SET
    size      = EXCLUDED.size,
    gsm       = EXCLUDED.gsm,
    min_stock = EXCLUDED.min_stock;

INSERT INTO paper_stock (paper_type_id, quantity)
SELECT id, 0 FROM paper_types
ON CONFLICT (paper_type_id) DO NOTHING;

-- ============================================================
-- Verify final counts
-- ============================================================
SELECT tbl, rows FROM (
    SELECT 'branches'               AS tbl, COUNT(*) AS rows FROM branches
    UNION ALL SELECT 'toner_models',          COUNT(*) FROM toner_models
    UNION ALL SELECT 'printers',              COUNT(*) FROM printers
    UNION ALL SELECT 'toner_installations',   COUNT(*) FROM toner_installations
    UNION ALL SELECT 'toner_stock',           COUNT(*) FROM toner_stock
    UNION ALL SELECT 'paper_types',           COUNT(*) FROM paper_types
    UNION ALL SELECT 'users',                 COUNT(*) FROM users
) t ORDER BY tbl;