"""
SoftWave — Create Users on Render Database
Run this ONCE from your local machine.

Steps:
1. Fill in your Render External Database URL below
2. Open PowerShell in the backend folder
3. Run: venv\Scripts\activate
4. Run: python setup_render.py
"""

import psycopg2
import bcrypt

# ── PASTE YOUR RENDER EXTERNAL DATABASE URL HERE ──────────
# Get it from: Render → your PostgreSQL → External Database URL
DATABASE_URL = "postgresql://softwave_db_user:OtLPXbtEIyWNejg4Q372q7Th1pyH0qyC@dpg-d70k03ndiees73dn1t1g-a.singapore-postgres.render.com/softwave_db"
# ──────────────────────────────────────────────────────────

USERS = [
    {"full_name": "Dhanuja Rehan", "username": "admin", "password": "1234", "role": "manager"},
    {"full_name": "Dhanuja Rehan", "username": "dba",   "password": "1234", "role": "dba"},
    {"full_name": "Nuwan",         "username": "nuwan", "password": "1234", "role": "nuwan"},
]

def hash_pw(plain):
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_pw(plain, hashed):
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

conn = psycopg2.connect(DATABASE_URL)
cur  = conn.cursor()

for u in USERS:
    hashed = hash_pw(u["password"])
    assert verify_pw(u["password"], hashed), "Hash failed!"
    cur.execute("""
        INSERT INTO users (full_name, username, password, role, branch_access, is_active)
        VALUES (%s, %s, %s, %s, 'ALL', TRUE)
        ON CONFLICT (username) DO UPDATE SET
            password = EXCLUDED.password,
            role     = EXCLUDED.role,
            is_active = TRUE
    """, (u["full_name"], u["username"], hashed, u["role"]))
    print(f"✓ {u['username']} ({u['role']}) — password: {u['password']}")

conn.commit()
cur.close()
conn.close()
print("\nDone! All users created. Login at your Render URL.")