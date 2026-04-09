"""
SoftWave Print Management System — FastAPI Backend
Entry point: python main.py
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from routes.auth     import router as auth_router
from routes.branches import router as branches_router
from routes.hardware import router as hardware_router
from routes.printers import router as printers_router
from routes.toner    import router as toner_router
from routes.users    import router as users_router
from routes.paper    import router as paper_router
from routes.requests import router as requests_router
from routes.nuwan    import router as nuwan_router
from routes.rentals  import router as rentals_router
from routes.export   import router as export_router

from routes.imports import router as imports_router
from routes.audit  import router as audit_router # type: ignore

try:
    from scheduler import start_scheduler
    _has_scheduler = True
except Exception:
    _has_scheduler = False

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SoftWave Print Management API",
    version="1.0.0",
)

# ── Global error handler ──────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": f"Internal error: {str(exc)}"})

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(hardware_router)
app.include_router(auth_router)
app.include_router(branches_router)
app.include_router(printers_router)
app.include_router(toner_router)
app.include_router(users_router)
app.include_router(paper_router)
app.include_router(requests_router)
app.include_router(nuwan_router)
app.include_router(rentals_router)
app.include_router(export_router)

app.include_router(imports_router)
app.include_router(audit_router)

# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    if _has_scheduler:
        start_scheduler()

# ── Test email endpoint (manager/dba only) ───────────────────────────────────

@app.get("/api/test-email")
def test_email():
    """Manually trigger the missing log check — for testing only."""
    try:
        from scheduler import check_missing_logs
        check_missing_logs()
        return {"status": "ok", "message": "Email check triggered — check server logs and inbox"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}

# ── Serve frontend ────────────────────────────────────────────────────────────

FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "public"

if FRONTEND_DIR.exists():
    app.mount("/css",    StaticFiles(directory=str(FRONTEND_DIR / "css")),    name="css")
    app.mount("/js",     StaticFiles(directory=str(FRONTEND_DIR / "js")),     name="js")
    app.mount("/images", StaticFiles(directory=str(FRONTEND_DIR / "images")), name="images")

    @app.get("/monitor", response_class=FileResponse)
    def serve_monitor():
        return FileResponse(str(FRONTEND_DIR / "nuwan.html"))

    @app.get("/", response_class=FileResponse)
    def serve_index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/{full_path:path}", response_class=FileResponse)
    def serve_spa(full_path: str):
        f = FRONTEND_DIR / full_path
        if f.exists() and f.is_file():
            return FileResponse(str(f))
        return FileResponse(str(FRONTEND_DIR / "index.html"))

# ── Test email endpoint (manager/dba only) ───────────────────────────────────

from fastapi import Depends as _Depends
from middleware.auth import require_role as _require_role

@app.get("/api/test-email-alert")
def test_email_alert(current_user: dict = _Depends(_require_role("manager", "dba"))):
    """Manually trigger the missing log email check — for testing only."""
    try:
        from scheduler import check_missing_logs
        check_missing_logs()
        return {"status": "ok", "message": "Email check triggered — check Nuwan inbox and server logs"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 4000))
    print(f"\n  SoftWave API starting on http://localhost:{port}")
    print(f"  API Docs: http://localhost:{port}/docs\n")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)