"""
Run this ONCE locally to create the Head Office user with correct password hash.
Usage:
  cd backend
  venv\Scripts\activate
  python add_headoffice_user.py
"""
import bcrypt, psycopg2

# ── Paste your Render External Database URL here ──
DATABASE_URL = "postgresql://softwave_db_user:OtLPXbtEIyWNejg4Q372q7Th1pyH0qyC@dpg-d70k03ndiees73dn1t1g-a.singapore-postgres.render.com/softwave_db"

password = "12345"
hashed   = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

conn = psycopg2.connect(DATABASE_URL)
cur  = conn.cursor()

# 1. Add branch
cur.execute("""
    INSERT INTO branches (code, name, location, contact, is_active)
    VALUES ('HO', 'Head Office', 'Head Office', 'Head Office Contact', TRUE)
    ON CONFLICT (code) DO NOTHING
""")

# 2. Add toner model
cur.execute("""
    INSERT INTO toner_models (model_code, brand, yield_copies, color, min_stock)
    VALUES ('TOSHIBA T2508A', 'TOSHIBA', 20000, 'black', 3)
    ON CONFLICT (model_code) DO NOTHING
""")
cur.execute("""
    INSERT INTO toner_stock (toner_model_id, quantity)
    SELECT id, 0 FROM toner_models WHERE model_code = 'TOSHIBA T2508A'
    ON CONFLICT (toner_model_id) DO NOTHING
""")

# 3. Add printer
cur.execute("""
    INSERT INTO printers (branch_id, printer_code, model, location_note, is_active)
    SELECT b.id, 'PC061170', 'Toshiba E Studio 2508A', 'Toshiba E Studio 2508A', TRUE
    FROM branches b WHERE b.code = 'HO'
    ON CONFLICT (printer_code) DO NOTHING
""")

# 4. Add toner installation at 100%
cur.execute("""
    INSERT INTO toner_installations
        (printer_id, toner_model_id, yield_copies, avg_daily_copies,
         current_pct, current_copies, is_current)
    SELECT p.id, tm.id, 20000, 50, 100, 20000, TRUE
    FROM printers p
    JOIN toner_models tm ON tm.model_code = 'TOSHIBA T2508A'
    WHERE p.printer_code = 'PC061170'
    AND NOT EXISTS (
        SELECT 1 FROM toner_installations ti
        WHERE ti.printer_id = p.id AND ti.is_current = TRUE
    )
""")

# 5. Create user Gihan
cur.execute("""
    INSERT INTO users (full_name, username, password, role, branch_access, is_active)
    VALUES (%s, %s, %s, 'service', 'HO', TRUE)
    ON CONFLICT (username) DO UPDATE SET
        password      = EXCLUDED.password,
        branch_access = EXCLUDED.branch_access,
        is_active     = TRUE
""", ('Gihan', 'gihan', hashed))

conn.commit()
cur.close()
conn.close()

print("Done!")
print(f"  Branch  : Head Office (HO)")
print(f"  Printer : PC061170 — Toshiba E Studio 2508A — 100% toner")
print(f"  User    : gihan / 12345 (service, branch HO)")
