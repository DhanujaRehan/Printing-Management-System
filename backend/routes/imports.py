from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.database import query
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/imports", tags=["Imports"])


class ImportSubmitBody(BaseModel):
    import_type: str
    filename: Optional[str] = None
    payload: list


class ImportReviewBody(BaseModel):
    status: str
    review_note: Optional[str] = None


@router.get("/pending-count")
def get_pending_import_count(current_user: dict = Depends(get_current_user)):
    try:
        r = query("SELECT COUNT(*) AS cnt FROM import_requests WHERE status='pending'", fetch="one")
        return {"count": r["cnt"] if r else 0}
    except Exception:
        return {"count": 0}


@router.get("/all")
def get_all_imports(current_user: dict = Depends(require_role("manager", "dba"))):
    try:
        return query(
            "SELECT ir.id, ir.import_type, ir.filename, ir.row_count, ir.status, "
            "ir.review_note, ir.submitted_at, ir.reviewed_at, "
            "u.full_name AS submitted_by_name, rv.full_name AS reviewed_by_name "
            "FROM import_requests ir "
            "JOIN users u ON u.id = ir.submitted_by "
            "LEFT JOIN users rv ON rv.id = ir.reviewed_by "
            "ORDER BY CASE ir.status WHEN 'pending' THEN 0 ELSE 1 END, ir.submitted_at DESC "
            "LIMIT 100"
        )
    except Exception:
        return []


@router.get("/{import_id}/preview")
def get_import_preview(import_id: int, current_user: dict = Depends(require_role("manager", "dba"))):
    row = query("SELECT * FROM import_requests WHERE id=%s", (import_id,), fetch="one")
    if not row:
        raise HTTPException(status_code=404, detail="Import not found")
    return row


@router.post("/submit")
def submit_import(body: ImportSubmitBody, current_user: dict = Depends(require_role("dba"))):
    if body.import_type not in ("branches", "printers", "toner_models", "toner_stock"):
        raise HTTPException(status_code=400, detail="Invalid import type")
    if not body.payload:
        raise HTTPException(status_code=400, detail="No data to import")

    import json
    row = query(
        "INSERT INTO import_requests (import_type, filename, row_count, payload, submitted_by) "
        "VALUES (%s, %s, %s, %s::jsonb, %s) RETURNING id",
        (body.import_type, body.filename, len(body.payload),
         json.dumps(body.payload), int(current_user["sub"])),
        fetch="one"
    )
    return {"message": "Import submitted for manager approval", "id": row["id"], "row_count": len(body.payload)}


@router.patch("/{import_id}/review")
def review_import(
    import_id: int,
    body: ImportReviewBody,
    current_user: dict = Depends(require_role("manager", "dba"))
):
    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be approved or rejected")

    imp = query("SELECT * FROM import_requests WHERE id=%s", (import_id,), fetch="one")
    if not imp:
        raise HTTPException(status_code=404, detail="Import request not found")
    if imp["status"] != "pending":
        raise HTTPException(status_code=400, detail="Already reviewed")

    query(
        "UPDATE import_requests SET status=%s, reviewed_by=%s, review_note=%s, reviewed_at=NOW() WHERE id=%s",
        (body.status, int(current_user["sub"]), body.review_note, import_id),
        fetch="none"
    )

    if body.status == "approved":
        import json
        payload = imp["payload"] if isinstance(imp["payload"], list) else json.loads(imp["payload"])
        itype   = imp["import_type"]
        errors  = []
        success = 0

        if itype == "branches":
            for row in payload:
                try:
                    query(
                        "INSERT INTO branches (code, name, location, contact) "
                        "VALUES (%s, %s, %s, %s) ON CONFLICT (code) DO UPDATE "
                        "SET name=EXCLUDED.name, location=EXCLUDED.location, contact=EXCLUDED.contact",
                        (row.get("code","").upper(), row.get("name",""),
                         row.get("location",""), row.get("contact","")),
                        fetch="none"
                    )
                    success += 1
                except Exception as e:
                    errors.append(str(e))

        elif itype == "printers":
            for row in payload:
                try:
                    branch = query("SELECT id FROM branches WHERE code=%s",
                                   (row.get("branch_code","").upper(),), fetch="one")
                    if not branch:
                        errors.append("Branch not found: " + str(row.get("branch_code","")))
                        continue
                    query(
                        "INSERT INTO printers (branch_id, printer_code, model, location_note) "
                        "VALUES (%s, %s, %s, %s) ON CONFLICT (printer_code) DO UPDATE "
                        "SET model=EXCLUDED.model, location_note=EXCLUDED.location_note",
                        (branch["id"], row.get("printer_code","").upper(),
                         row.get("model",""), row.get("location_note","")),
                        fetch="none"
                    )
                    success += 1
                except Exception as e:
                    errors.append(str(e))

        elif itype == "toner_models":
            for row in payload:
                try:
                    m = query(
                        "INSERT INTO toner_models (model_code, brand, yield_copies, min_stock) "
                        "VALUES (%s, %s, %s, %s) ON CONFLICT (model_code) DO UPDATE "
                        "SET brand=EXCLUDED.brand, yield_copies=EXCLUDED.yield_copies, min_stock=EXCLUDED.min_stock "
                        "RETURNING id",
                        (row.get("model_code","").upper(), row.get("brand","HP"),
                         int(row.get("yield_copies", 3000)), int(row.get("min_stock", 5))),
                        fetch="one"
                    )
                    query(
                        "INSERT INTO toner_stock (toner_model_id, quantity) VALUES (%s, 0) "
                        "ON CONFLICT (toner_model_id) DO NOTHING",
                        (m["id"],), fetch="none"
                    )
                    success += 1
                except Exception as e:
                    errors.append(str(e))

        elif itype == "toner_stock":
            for row in payload:
                try:
                    qty = int(row.get("quantity", 0))
                    m   = query("SELECT id FROM toner_models WHERE model_code=%s",
                                (row.get("model_code","").upper(),), fetch="one")
                    if not m:
                        errors.append("Toner model not found: " + str(row.get("model_code","")))
                        continue
                    query(
                        "INSERT INTO toner_stock (toner_model_id, quantity) VALUES (%s, %s) "
                        "ON CONFLICT (toner_model_id) DO UPDATE SET quantity=toner_stock.quantity+EXCLUDED.quantity, updated_at=NOW()",
                        (m["id"], qty), fetch="none"
                    )
                    success += 1
                except Exception as e:
                    errors.append(str(e))

        query(
            "UPDATE import_requests SET review_note=%s WHERE id=%s",
            (f"Imported {success} rows. Errors: {len(errors)}" + ((" — " + "; ".join(errors[:3])) if errors else ""), import_id),
            fetch="none"
        )
        return {"message": "Approved and imported", "success": success, "errors": errors}

    return {"message": "Import rejected"}