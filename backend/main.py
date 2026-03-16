"""
TonerPro Ultra v4.2 — FastAPI Backend
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
from routes.printers import router as printers_router
from routes.toner    import router as toner_router
from routes.users    import router as users_router
from routes.paper    import router as paper_router
from routes.requests import router as requests_router

app = FastAPI(
    title="TonerPro Ultra API",
    description="Enterprise Toner Management System — v4.2",
    version="4.2.0",
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal error: {str(exc)}"}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(branches_router)
app.include_router(printers_router)
app.include_router(toner_router)
app.include_router(users_router)
app.include_router(paper_router)
app.include_router(requests_router)

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "4.2.0"}

FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "public"

if FRONTEND_DIR.exists():
    app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
    app.mount("/js",  StaticFiles(directory=str(FRONTEND_DIR / "js")),  name="js")

    @app.get("/", response_class=FileResponse)
    def serve_index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    # SPA fallback — only serve index.html for GET requests to non-API paths
    # All methods allowed so POST/PATCH/DELETE to /api/* don't get 405
    @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    async def serve_spa(request: Request, full_path: str):
        # Only serve frontend for GET requests to non-API paths
        if request.method == "GET" and not full_path.startswith("api/"):
            return FileResponse(str(FRONTEND_DIR / "index.html"))
        return JSONResponse(status_code=404, content={"detail": "Not found"})

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 4000))
    print(f"\n  TonerPro Ultra API starting on http://localhost:{port}")
    print(f"  API Docs: http://localhost:{port}/docs\n")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)