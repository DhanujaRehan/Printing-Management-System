# TonerPro Ultra v4.2 — Enterprise Print Management System

## Technology Stack

| Layer      | Technology                  |
|------------|-----------------------------|
| Backend    | **Python + FastAPI**         |
| Database   | **PostgreSQL**               |
| Auth       | **JWT + bcrypt**             |
| Frontend   | HTML + CSS + JavaScript      |
| Server     | **Uvicorn** (ASGI server)    |

---

## Project File Structure

```
tonerpro_v2/
│
├── backend/
│   ├── db/
│   │   ├── database.py        ← PostgreSQL connection pool
│   │   ├── schema.sql         ← Tables, views, seed data
│   │   └── setup.py           ← Run once: creates tables + users
│   │
│   ├── middleware/
│   │   └── auth.py            ← JWT token verify + role guards
│   │
│   ├── routes/
│   │   ├── auth.py            ← POST /login, GET /me
│   │   ├── branches.py        ← CRUD /api/branches
│   │   ├── printers.py        ← CRUD /api/printers
│   │   ├── toner.py           ← Stock, installs, alerts, movements
│   │   └── users.py           ← User management + audit log
│   │
│   ├── main.py                ← FastAPI app entry point
│   ├── requirements.txt       ← Python packages
│   └── .env.example           ← Environment config template
│
└── frontend/
    └── public/
        ├── index.html         ← Main HTML shell
        ├── css/
        │   ├── main.css       ← Layout, sidebar, shared components
        │   ├── login.css      ← Login page styles
        │   └── pages.css      ← Dashboard, branches, stock styles
        └── js/
            ├── api.js         ← API calls + auth + login logic
            ├── nav.js         ← Navigation, modals, toast, utils
            ├── dashboard.js   ← Dashboard KPIs + printer table
            ├── branches.js    ← Branch grid + CRUD
            ├── printers.js    ← Printer table + CRUD
            ├── stock.js       ← Stock tubes + receive + models
            ├── service.js     ← Toner replacement form
            └── dba.js         ← User management + audit log
```

---

## Step-by-Step Setup (Windows)

### Prerequisites

1. **Python 3.11+** — Download from https://www.python.org/downloads/
   - During install: ✅ Check "Add Python to PATH"

2. **PostgreSQL 15+** — Download from https://www.postgresql.org/download/windows/
   - Remember the password you set for the `postgres` user

3. **pgAdmin 4** (comes with PostgreSQL installer)
   - Open pgAdmin → right-click Databases → Create → Database
   - Name it: `tonerpro`

---

### Step 1 — Configure your .env file

Open `backend\.env.example`, copy it and rename it to `backend\.env`

Edit it and fill in your details:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tonerpro
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD_HERE
JWT_SECRET=tonerpro_jwt_secret_2024
JWT_EXPIRES_HOURS=8
PORT=4000
```

---

### Step 2 — Open Command Prompt in the backend folder

```cmd
cd "C:\Users\YourName\Downloads\tonerpro_v2\backend"
```

---

### Step 3 — Create a Python virtual environment

```cmd
python -m venv venv
```

This creates an isolated environment for this project.

---

### Step 4 — Activate the virtual environment

```cmd
venv\Scripts\activate
```

You should see `(venv)` appear at the start of the command line.

---

### Step 5 — Install required packages

```cmd
pip install -r requirements.txt
```

This installs: FastAPI, Uvicorn, psycopg2 (PostgreSQL), JWT, bcrypt, etc.

---

### Step 6 — Run the database setup (one time only)

```cmd
python db/setup.py
```

Expected output:
```
=======================================================
   TonerPro Ultra — Database Setup
=======================================================

[1/4] Creating tables and seeding base data...  ✓ OK
[2/4] Creating users with hashed passwords...   ✓ OK — admin, sarah, mchen
[3/4] Seeding toner installations...             ✓ OK — 40 printers seeded
[4/4] Verifying logins...                        ✓ OK — all 3 users verified

=======================================================
  Setup complete! Run: python main.py
  Then open:  http://localhost:4000
=======================================================
```

---

### Step 7 — Start the server

```cmd
python main.py
```

Expected output:
```
🖨️  TonerPro Ultra API starting on http://localhost:4000
📚 API Docs available at http://localhost:4000/docs
```

---

### Step 8 — Open the application

Open your browser and go to:

```
http://localhost:4000
```

---

## Login Credentials

| Role    | Username | Password |
|---------|----------|----------|
| Manager | `admin`  | `1234`   |
| Service | `sarah`  | `1234`   |
| DBA     | `mchen`  | `1234`   |

---

## API Documentation

FastAPI automatically generates interactive API docs.
When the server is running, visit:

```
http://localhost:4000/docs
```

---

## Running Again Later

Every time you want to run the system again:

```cmd
cd "C:\Users\YourName\Downloads\tonerpro_v2\backend"
venv\Scripts\activate
python main.py
```

Then open: http://localhost:4000

> You do NOT need to run `db/setup.py` again unless you want to reset the database.

---

## Stopping the Server

Press `Ctrl + C` in the Command Prompt window.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `python not found` | Reinstall Python and check "Add to PATH" |
| `pip not found` | Run `python -m pip install -r requirements.txt` |
| `Connection refused` | Check DB_PASSWORD in .env file |
| `Database does not exist` | Create `tonerpro` database in pgAdmin |
| `Module not found` | Make sure you activated venv with `venv\Scripts\activate` |
| Login says invalid | Re-run `python db/setup.py` |

---

## API Endpoints

```
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/change-password

GET    /api/branches
POST   /api/branches
PUT    /api/branches/{id}
DELETE /api/branches/{id}

GET    /api/printers
GET    /api/printers/branch/{branch_id}
POST   /api/printers
PUT    /api/printers/{id}
DELETE /api/printers/{id}

GET    /api/toner/models
POST   /api/toner/models
GET    /api/toner/stock
POST   /api/toner/stock/receive
POST   /api/toner/install
PATCH  /api/toner/update-level
GET    /api/toner/alerts
GET    /api/toner/movements

GET    /api/users
POST   /api/users
PUT    /api/users/{id}
DELETE /api/users/{id}
GET    /api/users/audit-log
```
