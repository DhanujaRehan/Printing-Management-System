"""
Run this script ONCE on your local machine to create initial users.
It calls the live Render API to create users properly.

Usage:
  cd backend
  python create_users.py
"""

import requests

BASE_URL = "https://softwave.onrender.com"  # ← replace with your Render URL

# Step 1 — login as existing user won't work yet
# So we use the db/setup approach — run this locally against Render DB

import bcrypt
import psycopg2

# Render External Database URL — paste yours here
DATABASE_URL = "postgresql://softwave_db_user:OtLPXbtEIyWNejg4Q372q7Th1pyH0qyC@dpg-d70k03ndiees73dn1t1g-a.singapore-postgres.render.com/softwave_db"

def hash_password(plain):
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

conn = psycopg2.connect(DATABASE_URL)
cur  = conn.cursor()

users = [
    ("Dhanuja Rehan", "admin", "1234", "manager"),
    ("Dhanuja Rehan", "dba",   "1234", "dba"),
    ("Nuwan",         "nuwan", "1234", "nuwan"),
]

for full_name, username, password, role in users:
    hashed = hash_password(password)
    cur.execute("""
        INSERT INTO users (full_name, username, password, role, branch_access, is_active)
        VALUES (%s, %s, %s, %s, 'ALL', TRUE)
        ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password
    """, (full_name, username, hashed, role))
    print(f"Created: {username} ({role})")

conn.commit()
cur.close()
conn.close()
print("\nDone! Login with password: 1234")