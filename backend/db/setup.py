"""
TonerPro Ultra — Database Setup Script
Run this ONCE after creating your PostgreSQL database.

Usage:
    python db/setup.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", 5432)),
    "dbname":   os.getenv("DB_NAME", "tonerpro"),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}

USERS = [
    {"full_name": "Ahmad Manager",  "username": "admin",  "password": "1234", "role": "manager", "branch_access": "ALL"},
    {"full_name": "Sarah Service",  "username": "sarah",  "password": "1234", "role": "service", "branch_access": "ALL"},
    {"full_name": "Mike Chen DBA",  "username": "mchen",  "password": "1234", "role": "dba",     "branch_access": "ALL"},
]


def hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def run():
    print("\n" + "="*55)
    print("   TonerPro Ultra — Database Setup")
    print("="*55)

    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # ── Step 1: Schema ──────────────────────────────────────
    print("\n[1/4] Creating tables and seeding base data...", end=" ", flush=True)
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r") as f:
        cur.execute(f.read())
    conn.commit()
    print("✓ OK")

    # ── Step 2: Users ────────────────────────────────────────
    print("[2/4] Creating users with hashed passwords...", end=" ", flush=True)
    for u in USERS:
        hashed = hash_pw(u["password"])
        # Verify hash immediately
        assert verify_pw(u["password"], hashed), f"Hash verify failed for {u['username']}"
        cur.execute("""
            INSERT INTO users (full_name, username, password, role, branch_access)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (username) DO UPDATE SET
                password = EXCLUDED.password,
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role
        """, (u["full_name"], u["username"], hashed, u["role"], u["branch_access"]))
    conn.commit()
    print(f"✓ OK — {', '.join(u['username'] for u in USERS)}")

    # ── Step 3: Toner Installations ───────────────────────────
    print("[3/4] Seeding toner installations for all printers...", end=" ", flush=True)

    cur.execute("SELECT id FROM users WHERE username = 'admin' LIMIT 1")
    admin = cur.fetchone()
    admin_id = admin["id"]

    cur.execute("SELECT id FROM toner_models LIMIT 1")
    model = cur.fetchone()
    model_id = model["id"]

    cur.execute("SELECT id FROM printers ORDER BY id")
    printers = cur.fetchall()

    import random
    random.seed(42)
    count = 0
    for p in printers:
        cur.execute("SELECT COUNT(*) AS c FROM toner_installations WHERE printer_id=%s AND is_current=TRUE", (p["id"],))
        existing = cur.fetchone()["c"]
        if existing > 0:
            continue
        pct = random.randint(8, 95)
        yield_copies = 3000
        copies_left = int(yield_copies * pct / 100)
        avg_daily = random.randint(80, 250)
        cur.execute("""
            INSERT INTO toner_installations
                (printer_id, toner_model_id, installed_by, yield_copies, avg_daily_copies, current_pct, current_copies, is_current)
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
        """, (p["id"], model_id, admin_id, yield_copies, avg_daily, pct, copies_left))
        count += 1
    conn.commit()
    print(f"✓ OK — {count} printers seeded")

    # ── Step 4: Verify ───────────────────────────────────────
    print("[4/4] Verifying logins...", end=" ", flush=True)
    for u in USERS:
        cur.execute("SELECT password FROM users WHERE username = %s", (u["username"],))
        row = cur.fetchone()
        assert row, f"User {u['username']} not found!"
        assert verify_pw(u["password"], row["password"]), f"Password mismatch for {u['username']}"
    print(f"✓ OK — all {len(USERS)} users verified\n")

    cur.close()
    conn.close()

    print("="*55)
    print("  Setup complete! Run: python main.py")
    print("  Then open:  http://localhost:4000")
    print("="*55 + "\n")


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        print("\nCheck your .env file — DB_HOST, DB_NAME, DB_USER, DB_PASSWORD")
        sys.exit(1)
