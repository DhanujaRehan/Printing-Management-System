-- ============================================================
-- SoftWave Print Management System
-- Complete Database Schema — v3.0
-- Run once on a fresh database:
--   psql -U postgres -d tonerpro -f schema.sql
-- ============================================================


-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    password        VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL
                    CHECK (role IN ('manager','service','dba','store','nuwan')),
    branch_access   VARCHAR(100) DEFAULT 'ALL',
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Branches ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(10)  UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    location    VARCHAR(200),
    contact     VARCHAR(100),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Toner Models ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS toner_models (
    id           SERIAL PRIMARY KEY,
    model_code   VARCHAR(80) UNIQUE NOT NULL,
    brand        VARCHAR(60),
    yield_copies INT NOT NULL DEFAULT 10000,
    color        VARCHAR(20) DEFAULT 'black',
    min_stock    INT DEFAULT 3,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Printers ─────────────────────────────────────────────────
-- printer_code = serial number (e.g. PC083152, 2VM02780)
CREATE TABLE IF NOT EXISTS printers (
    id            SERIAL PRIMARY KEY,
    branch_id     INT NOT NULL REFERENCES branches(id),
    printer_code  VARCHAR(30) UNIQUE NOT NULL,
    model         VARCHAR(100),
    location_note VARCHAR(200),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Toner Stock ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS toner_stock (
    id             SERIAL PRIMARY KEY,
    toner_model_id INT NOT NULL REFERENCES toner_models(id),
    quantity       INT DEFAULT 0,
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(toner_model_id)
);

-- ── Toner Installations ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS toner_installations (
    id               SERIAL PRIMARY KEY,
    printer_id       INT NOT NULL REFERENCES printers(id),
    toner_model_id   INT NOT NULL REFERENCES toner_models(id),
    installed_by     INT REFERENCES users(id),
    yield_copies     INT NOT NULL,
    avg_daily_copies INT DEFAULT 50,
    current_pct      NUMERIC(5,2) DEFAULT 100,
    current_copies   INT,
    is_current       BOOLEAN DEFAULT TRUE,
    installed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Toner Stock Movements ────────────────────────────────────
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

-- ── Audit Log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id         SERIAL PRIMARY KEY,
    user_id    INT REFERENCES users(id),
    action     VARCHAR(100),
    detail     TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Paper Types ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paper_types (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(80) UNIQUE NOT NULL,
    size       VARCHAR(10) DEFAULT 'A4',
    gsm        INT DEFAULT 80,
    min_stock  INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Paper Warehouse Stock ────────────────────────────────────
CREATE TABLE IF NOT EXISTS paper_stock (
    id            SERIAL PRIMARY KEY,
    paper_type_id INT NOT NULL REFERENCES paper_types(id),
    quantity      INT DEFAULT 0,
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_type_id)
);

-- ── Paper Branch Stock ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS paper_branch_stock (
    id            SERIAL PRIMARY KEY,
    paper_type_id INT NOT NULL REFERENCES paper_types(id),
    branch_id     INT NOT NULL REFERENCES branches(id),
    quantity      INT DEFAULT 0,
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_type_id, branch_id)
);

-- ── Paper Printer Stock ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS paper_printer_stock (
    id            SERIAL PRIMARY KEY,
    paper_type_id INT NOT NULL REFERENCES paper_types(id),
    printer_id    INT NOT NULL REFERENCES printers(id),
    quantity      INT DEFAULT 0,
    capacity      INT DEFAULT 5,
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_type_id, printer_id)
);

-- ── Paper Movements ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paper_movements (
    id            SERIAL PRIMARY KEY,
    paper_type_id INT REFERENCES paper_types(id),
    movement_type VARCHAR(5) CHECK (movement_type IN ('IN','OUT')),
    quantity      INT NOT NULL,
    branch_id     INT REFERENCES branches(id),
    printer_id    INT REFERENCES printers(id),
    performed_by  INT REFERENCES users(id),
    notes         TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Replacement Requests ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS replacement_requests (
    id              SERIAL PRIMARY KEY,
    request_type    VARCHAR(10) NOT NULL CHECK (request_type IN ('toner','paper')),
    printer_id      INT NOT NULL REFERENCES printers(id),
    toner_model_id  INT REFERENCES toner_models(id),
    paper_type_id   INT REFERENCES paper_types(id),
    quantity        INT DEFAULT 1,
    priority        VARCHAR(10) DEFAULT 'normal'
                    CHECK (priority IN ('normal','urgent','critical')),
    notes           TEXT,
    status          VARCHAR(10) DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','dispatched')),
    requested_by    INT NOT NULL REFERENCES users(id),
    reviewed_by     INT REFERENCES users(id),
    review_note     TEXT,
    requested_at    TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    dispatched_by   INT REFERENCES users(id),
    dispatched_at   TIMESTAMPTZ,
    dispatch_note   TEXT
);

-- ── Print Logs ───────────────────────────────────────────────
-- print_count = total cumulative copies on the machine for that day
-- a4_single/double etc = optional paper size breakdown
CREATE TABLE IF NOT EXISTS print_logs (
    id             SERIAL PRIMARY KEY,
    printer_id     INT NOT NULL REFERENCES printers(id),
    logged_by      INT NOT NULL REFERENCES users(id),
    print_count    INT NOT NULL CHECK (print_count >= 0),
    log_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    notes          TEXT,
    a4_single      INT DEFAULT 0,
    a4_double      INT DEFAULT 0,
    b4_single      INT DEFAULT 0,
    b4_double      INT DEFAULT 0,
    letter_single  INT DEFAULT 0,
    letter_double  INT DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(printer_id, log_date)
);

-- ── Import Requests ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_requests (
    id           SERIAL PRIMARY KEY,
    import_type  VARCHAR(30) NOT NULL,
    filename     VARCHAR(200),
    row_count    INT DEFAULT 0,
    payload      JSONB,
    status       VARCHAR(10) DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
    submitted_by INT REFERENCES users(id),
    reviewed_by  INT REFERENCES users(id),
    review_note  TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at  TIMESTAMPTZ
);


-- ============================================================
-- VIEWS
-- ============================================================

DROP VIEW IF EXISTS v_printer_status CASCADE;
DROP VIEW IF EXISTS v_stock_summary   CASCADE;

-- v_printer_status
-- pct_remaining and copies_remaining are calculated live
-- from print_logs since last toner install — updates every day
CREATE VIEW v_printer_status AS
SELECT
    p.id             AS printer_id,
    p.printer_code,
    p.model          AS printer_model,
    p.location_note,
    p.branch_id,
    b.code           AS branch_code,
    b.name           AS branch_name,
    tm.model_code    AS toner_model,
    tm.id            AS toner_model_id,
    ti.yield_copies,
    ti.avg_daily_copies,
    ti.installed_at,
    ti.id            AS installation_id,

    -- Total prints logged since this toner was installed
    COALESCE((
        SELECT SUM(pl.print_count)
        FROM print_logs pl
        WHERE pl.printer_id = p.id
          AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
    ), 0) AS total_prints_since_install,

    -- Remaining copies = yield minus prints used
    GREATEST(0,
        ti.yield_copies - COALESCE((
            SELECT SUM(pl.print_count)
            FROM print_logs pl
            WHERE pl.printer_id = p.id
              AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
        ), 0)
    ) AS copies_remaining,

    -- Percentage remaining (0.0 – 100.0)
    ROUND(
        GREATEST(0.0,
            100.0 * (
                ti.yield_copies - COALESCE((
                    SELECT SUM(pl.print_count)
                    FROM print_logs pl
                    WHERE pl.printer_id = p.id
                      AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
                ), 0)
            ) / NULLIF(ti.yield_copies, 0)
        )
    , 1) AS pct_remaining,

    -- Alias for backward compatibility
    ROUND(
        GREATEST(0.0,
            100.0 * (
                ti.yield_copies - COALESCE((
                    SELECT SUM(pl.print_count)
                    FROM print_logs pl
                    WHERE pl.printer_id = p.id
                      AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
                ), 0)
            ) / NULLIF(ti.yield_copies, 0)
        )
    , 1) AS current_pct,

    -- Days remaining at avg_daily_copies rate
    CASE
        WHEN ti.avg_daily_copies > 0 THEN
            ROUND(
                GREATEST(0,
                    ti.yield_copies - COALESCE((
                        SELECT SUM(pl.print_count)
                        FROM print_logs pl
                        WHERE pl.printer_id = p.id
                          AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
                    ), 0)
                )::NUMERIC / ti.avg_daily_copies
            )
        ELSE NULL
    END AS days_remaining,

    -- Predicted date toner will run out
    CASE
        WHEN ti.avg_daily_copies > 0 THEN
            (NOW() + (
                ROUND(
                    GREATEST(0,
                        ti.yield_copies - COALESCE((
                            SELECT SUM(pl.print_count)
                            FROM print_logs pl
                            WHERE pl.printer_id = p.id
                              AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
                        ), 0)
                    )::NUMERIC / ti.avg_daily_copies
                ) * INTERVAL '1 day'
            ))::DATE
        ELSE NULL
    END AS next_toner_date

FROM printers p
JOIN branches b ON b.id = p.branch_id
LEFT JOIN toner_installations ti
       ON ti.printer_id = p.id AND ti.is_current = TRUE
LEFT JOIN toner_models tm ON tm.id = ti.toner_model_id
WHERE p.is_active = TRUE AND b.is_active = TRUE;


-- v_stock_summary
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
-- DEFAULT PAPER TYPES
-- ============================================================

INSERT INTO paper_types (name, size, gsm, min_stock) VALUES
  ('A4 80gsm',     'A4',     80, 20),
  ('A4 75gsm',     'A4',     75, 15),
  ('A3 80gsm',     'A3',     80, 10),
  ('Letter 75gsm', 'Letter', 75, 10)
ON CONFLICT (name) DO NOTHING;

INSERT INTO paper_stock (paper_type_id, quantity)
SELECT id, 0 FROM paper_types
ON CONFLICT (paper_type_id) DO NOTHING;


-- ============================================================
-- VERIFY
-- ============================================================

SELECT tbl, rows FROM (
    SELECT 'users'                   AS tbl, COUNT(*) AS rows FROM users
    UNION ALL SELECT 'branches',               COUNT(*) FROM branches
    UNION ALL SELECT 'toner_models',           COUNT(*) FROM toner_models
    UNION ALL SELECT 'printers',               COUNT(*) FROM printers
    UNION ALL SELECT 'print_logs',             COUNT(*) FROM print_logs
    UNION ALL SELECT 'replacement_requests',   COUNT(*) FROM replacement_requests
    UNION ALL SELECT 'import_requests',        COUNT(*) FROM import_requests
    UNION ALL SELECT 'paper_types',            COUNT(*) FROM paper_types
    UNION ALL SELECT 'toner_installations',    COUNT(*) FROM toner_installations
) t ORDER BY tbl;