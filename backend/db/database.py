import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

# Render provides DATABASE_URL as an environment variable
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Render/Railway style — single connection string
    # Fix for psycopg2: replace postgres:// with postgresql://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    DB_CONFIG = {"dsn": DATABASE_URL}
else:
    # Local development — individual variables from .env
    DB_CONFIG = {
        "host":     os.getenv("DB_HOST", "localhost"),
        "port":     int(os.getenv("DB_PORT", 5432)),
        "dbname":   os.getenv("DB_NAME", "tonerpro"),
        "user":     os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", ""),
    }


def get_conn():
    """Open a fresh connection."""
    return psycopg2.connect(**DB_CONFIG)


def query(sql: str, params=None, fetch: str = "all"):
    """
    Execute a SQL query and return results.
    fetch: 'all' | 'one' | 'none'
    """
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            conn.commit()
            if fetch == "all":
                return [dict(row) for row in cur.fetchall()]
            elif fetch == "one":
                row = cur.fetchone()
                return dict(row) if row else None
            else:
                return None
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()