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
from routes.printers import router as printers_router
from routes.toner    import router as toner_router
from routes.users    import router as users_router
from routes.paper    import router as paper_router

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="TonerPro Ultra API",
    description="Enterprise Toner Management System — v4.2",
    version="4.2.0",
)

# ── Global error handler — always return JSON, never plain text ───────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal error: {str(exc)}"}
    )

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(branches_router)
app.include_router(printers_router)
app.include_router(toner_router)
app.include_router(users_router)
app.include_router(paper_router)

# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "4.2.0"}

# ── Serve frontend ────────────────────────────────────────────────────────────

FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "public"

if FRONTEND_DIR.exists():
    app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
    app.mount("/js",  StaticFiles(directory=str(FRONTEND_DIR / "js")),  name="js")

    @app.get("/", response_class=FileResponse)
    def serve_index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/{full_path:path}", response_class=FileResponse)
    def serve_spa(full_path: str):
        return FileResponse(str(FRONTEND_DIR / "index.html"))

# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 4000))
    print(f"\n  TonerPro Ultra API starting on http://localhost:{port}")
    print(f"  API Docs: http://localhost:{port}/docs\n")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)