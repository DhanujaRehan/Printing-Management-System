-- ============================================================
-- TonerPro Ultra v4.2 — PostgreSQL Schema
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    password        VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('manager','service','dba')),
    branch_access   VARCHAR(100) DEFAULT 'ALL',
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(10)  UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    location    VARCHAR(200),
    contact     VARCHAR(100),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Toner Models
CREATE TABLE IF NOT EXISTS toner_models (
    id          SERIAL PRIMARY KEY,
    model_code  VARCHAR(80) UNIQUE NOT NULL,
    brand       VARCHAR(60),
    yield_copies INT NOT NULL DEFAULT 3000,
    color       VARCHAR(20) DEFAULT 'Black',
    min_stock   INT DEFAULT 5,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Printers
CREATE TABLE IF NOT EXISTS printers (
    id              SERIAL PRIMARY KEY,
    branch_id       INT NOT NULL REFERENCES branches(id),
    printer_code    VARCHAR(20) UNIQUE NOT NULL,
    model           VARCHAR(100),
    location_note   VARCHAR(200),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Toner Stock (one row per toner model)
CREATE TABLE IF NOT EXISTS toner_stock (
    id              SERIAL PRIMARY KEY,
    toner_model_id  INT NOT NULL REFERENCES toner_models(id),
    quantity        INT DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint on toner_model_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'toner_stock_toner_model_id_key'
    ) THEN
        ALTER TABLE toner_stock ADD CONSTRAINT toner_stock_toner_model_id_key UNIQUE (toner_model_id);
    END IF;
END $$;

-- Toner Installations
CREATE TABLE IF NOT EXISTS toner_installations (
    id              SERIAL PRIMARY KEY,
    printer_id      INT NOT NULL REFERENCES printers(id),
    toner_model_id  INT NOT NULL REFERENCES toner_models(id),
    installed_by    INT REFERENCES users(id),
    yield_copies    INT NOT NULL,
    avg_daily_copies INT DEFAULT 150,
    current_pct     NUMERIC(5,2) DEFAULT 100,
    current_copies  INT,
    is_current      BOOLEAN DEFAULT TRUE,
    installed_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
    id              SERIAL PRIMARY KEY,
    toner_model_id  INT REFERENCES toner_models(id),
    movement_type   VARCHAR(5) CHECK (movement_type IN ('IN','OUT')),
    quantity        INT NOT NULL,
    branch_id       INT REFERENCES branches(id),
    printer_id      INT REFERENCES printers(id),
    installation_id INT REFERENCES toner_installations(id),
    performed_by    INT REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id),
    action      VARCHAR(100),
    detail      TEXT,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VIEWS (drop first to avoid column conflicts on re-run)
-- ============================================================

DROP VIEW IF EXISTS v_printer_status CASCADE;
DROP VIEW IF EXISTS v_stock_summary CASCADE;

CREATE VIEW v_printer_status AS
SELECT
    p.id            AS printer_id,
    p.printer_code,
    p.model         AS printer_model,
    p.location_note,
    p.branch_id,
    b.code          AS branch_code,
    b.name          AS branch_name,
    tm.model_code   AS toner_model,
    tm.id           AS toner_model_id,
    ti.current_pct,
    ti.current_copies,
    ti.avg_daily_copies,
    ti.yield_copies,
    CASE
        WHEN ti.avg_daily_copies > 0 AND ti.current_copies IS NOT NULL
        THEN ROUND(ti.current_copies::NUMERIC / ti.avg_daily_copies)
        ELSE NULL
    END             AS days_remaining,
    CASE
        WHEN ti.avg_daily_copies > 0 AND ti.current_copies IS NOT NULL
        THEN (NOW() + (ROUND(ti.current_copies::NUMERIC / ti.avg_daily_copies) * INTERVAL '1 day'))::DATE
        ELSE NULL
    END             AS next_toner_date
FROM printers p
JOIN branches b ON b.id = p.branch_id
LEFT JOIN toner_installations ti ON ti.printer_id = p.id AND ti.is_current = TRUE
LEFT JOIN toner_models tm ON tm.id = ti.toner_model_id
WHERE p.is_active = TRUE AND b.is_active = TRUE;

CREATE VIEW v_stock_summary AS
SELECT
    tm.id,
    tm.model_code,
    tm.brand,
    tm.yield_copies,
    tm.color,
    tm.min_stock,
    COALESCE(ts.quantity, 0) AS quantity
FROM toner_models tm
LEFT JOIN toner_stock ts ON ts.toner_model_id = tm.id;

-- ============================================================
-- SEED DATA — Branches A-J
-- ============================================================

INSERT INTO branches (code, name, location, contact) VALUES
('A','Branch Alpha',  'Main Building Floor 1', 'Ahmad Rashid'),
('B','Branch Beta',   'Main Building Floor 2', 'Siti Aisyah'),
('C','Branch Charlie','North Wing Floor 1',     'Rajan Kumar'),
('D','Branch Delta',  'North Wing Floor 2',     'Nurul Huda'),
('E','Branch Echo',   'South Wing Floor 1',     'David Lim'),
('F','Branch Foxtrot','South Wing Floor 2',     'Fatimah Zahra'),
('G','Branch Golf',   'East Block Floor 1',     'Tan Wei Ming'),
('H','Branch Hotel',  'East Block Floor 2',     'Rohani Yusof'),
('I','Branch India',  'West Block Floor 1',     'Suresh Pillai'),
('J','Branch Juliet', 'West Block Floor 2',     'Mei Ling Ong')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SEED DATA — Toner Models
-- ============================================================

INSERT INTO toner_models (model_code, brand, yield_copies, min_stock) VALUES
('HP CF226A',       'HP',     3100,  5),
('HP CF226X',       'HP',     9000,  4),
('HP CE505A',       'HP',     2300,  6),
('Canon CRG-052',   'Canon',  3100,  5),
('Canon CRG-052H',  'Canon',  9200,  4)
ON CONFLICT (model_code) DO NOTHING;

-- ============================================================
-- SEED DATA — Stock (safe insert using DO block)
-- ============================================================

DO $$
DECLARE m RECORD;
BEGIN
    FOR m IN SELECT id FROM toner_models LOOP
        IF NOT EXISTS (SELECT 1 FROM toner_stock WHERE toner_model_id = m.id) THEN
            INSERT INTO toner_stock (toner_model_id, quantity) VALUES (m.id, 15);
        END IF;
    END LOOP;
END $$;

-- ============================================================
-- SEED DATA — Printers (4 per branch = 40 total)
-- ============================================================

DO $$
DECLARE br RECORD; i INT;
BEGIN
    FOR br IN SELECT id, code FROM branches WHERE is_active = TRUE ORDER BY code LOOP
        FOR i IN 1..4 LOOP
            INSERT INTO printers (branch_id, printer_code, model, location_note)
            VALUES (
                br.id,
                br.code || i::TEXT,
                CASE (i % 3)
                    WHEN 1 THEN 'HP LaserJet Pro M404'
                    WHEN 2 THEN 'HP LaserJet Enterprise M507'
                    ELSE 'Canon imageCLASS LBP6230'
                END,
                'Floor ' || i || ' — Room ' || (i * 10 + br.id)
            )
            ON CONFLICT (printer_code) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================
-- TonerPro Ultra — Paper Stock Migration
-- Run once: psql -d your_db -f paper_migration.sql
-- ============================================================

-- Paper types (A4 80gsm, A3 75gsm, etc.)
CREATE TABLE IF NOT EXISTS paper_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80) UNIQUE NOT NULL,
    size        VARCHAR(10) DEFAULT 'A4',
    gsm         INT DEFAULT 80,
    min_stock   INT DEFAULT 10,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Warehouse stock per paper type
CREATE TABLE IF NOT EXISTS paper_stock (
    id              SERIAL PRIMARY KEY,
    paper_type_id   INT NOT NULL REFERENCES paper_types(id),
    quantity        INT DEFAULT 0,         -- reams
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_type_id)
);

-- Per-branch stock (after dispatch from warehouse)
CREATE TABLE IF NOT EXISTS paper_branch_stock (
    id              SERIAL PRIMARY KEY,
    paper_type_id   INT NOT NULL REFERENCES paper_types(id),
    branch_id       INT NOT NULL REFERENCES branches(id),
    quantity        INT DEFAULT 0,         -- reams
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_type_id, branch_id)
);

-- Every IN (receive) and OUT (dispatch) movement
CREATE TABLE IF NOT EXISTS paper_movements (
    id              SERIAL PRIMARY KEY,
    paper_type_id   INT REFERENCES paper_types(id),
    movement_type   VARCHAR(5) CHECK (movement_type IN ('IN','OUT')),
    quantity        INT NOT NULL,
    branch_id       INT REFERENCES branches(id),
    printer_id      INT REFERENCES printers(id),
    performed_by    INT REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Seed default paper types ──────────────────────────────
INSERT INTO paper_types (name, size, gsm, min_stock) VALUES
  ('A4 80gsm',  'A4', 80, 20),
  ('A4 75gsm',  'A4', 75, 15),
  ('A3 80gsm',  'A3', 80, 10),
  ('Letter 75gsm', 'Letter', 75, 10)
ON CONFLICT (name) DO NOTHING;

-- Create warehouse stock rows for each type
INSERT INTO paper_stock (paper_type_id, quantity)
SELECT id, 0 FROM paper_types
ON CONFLICT (paper_type_id) DO NOTHING;

-- ============================================================
-- TonerPro Ultra — Paper Stock Migration
-- Run once: psql -d your_db -f paper_migration.sql
-- ============================================================

-- Paper types (A4 80gsm, A3 75gsm, etc.)
CREATE TABLE IF NOT EXISTS paper_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80) UNIQUE NOT NULL,
    size        VARCHAR(10) DEFAULT 'A4',
    gsm         INT DEFAULT 80,
    min_stock   INT DEFAULT 10,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Warehouse stock per paper type
CREATE TABLE IF NOT EXISTS paper_stock (
    id              SERIAL PRIMARY KEY,
    paper_type_id   INT NOT NULL REFERENCES paper_types(id),
    quantity        INT DEFAULT 0,         -- reams
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_type_id)
);

-- Per-branch stock (after dispatch from warehouse)
CREATE TABLE IF NOT EXISTS paper_branch_stock (
    id              SERIAL PRIMARY KEY,
    paper_type_id   INT NOT NULL REFERENCES paper_types(id),
    branch_id       INT NOT NULL REFERENCES branches(id),
    quantity        INT DEFAULT 0,         -- reams
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_type_id, branch_id)
);

-- Every IN (receive) and OUT (dispatch) movement
CREATE TABLE IF NOT EXISTS paper_movements (
    id              SERIAL PRIMARY KEY,
    paper_type_id   INT REFERENCES paper_types(id),
    movement_type   VARCHAR(5) CHECK (movement_type IN ('IN','OUT')),
    quantity        INT NOT NULL,
    branch_id       INT REFERENCES branches(id),
    printer_id      INT REFERENCES printers(id),
    performed_by    INT REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Seed default paper types ──────────────────────────────
INSERT INTO paper_types (name, size, gsm, min_stock) VALUES
  ('A4 80gsm',  'A4', 80, 20),
  ('A4 75gsm',  'A4', 75, 15),
  ('A3 80gsm',  'A3', 80, 10),
  ('Letter 75gsm', 'Letter', 75, 10)
ON CONFLICT (name) DO NOTHING;

-- Create warehouse stock rows for each type
INSERT INTO paper_stock (paper_type_id, quantity)
SELECT id, 0 FROM paper_types
ON CONFLICT (paper_type_id) DO NOTHING;


-- ── Printer-level paper stock (added in v2) ───────────────
-- Tracks reams loaded into / assigned to each specific printer
CREATE TABLE IF NOT EXISTS paper_printer_stock (
    id              SERIAL PRIMARY KEY,
    paper_type_id   INT NOT NULL REFERENCES paper_types(id),
    printer_id      INT NOT NULL REFERENCES printers(id),
    quantity        INT DEFAULT 0,         -- reams currently at printer
    capacity        INT DEFAULT 5,         -- max reams a printer tray holds
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_type_id, printer_id)
);