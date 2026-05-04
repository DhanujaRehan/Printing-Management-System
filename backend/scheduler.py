"""
SoftWave Print Management System — Email Scheduler
Jobs:
  1. 9:00 AM daily  — Missing EOD log alert
  2. Every hour     — Toner level alerts (≤25% warning, ≤10% critical)
  3. On-demand      — Toner request status emails (called from routes)
"""

import threading
import time
import smtplib
import os
import logging
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from db.database import query

logger = logging.getLogger("softwave.scheduler")

# ── Config ────────────────────────────────────────────────
SMTP_HOST    = os.getenv("SMTP_HOST",    "smtp.gmail.com")
SMTP_PORT    = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER    = os.getenv("SMTP_USER",    "")
SMTP_PASS    = os.getenv("SMTP_PASS",    "")
SMTP_FROM    = os.getenv("SMTP_FROM",    "noreply@softwave.lk")
ALERT_EMAIL  = os.getenv("ALERT_EMAIL",  "nuwan@softwave.lk")
CHECK_HOUR   = int(os.getenv("EOD_CHECK_HOUR",   "9"))
CHECK_MINUTE = int(os.getenv("EOD_CHECK_MINUTE", "0"))


# ── Core email sender ─────────────────────────────────────
def _send_email(to: str, subject: str, plain: str, html: str) -> bool:
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP not configured — skipping email")
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"SoftWave Print Management <{SMTP_FROM}>"
    msg["To"]      = to
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html,  "html"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
            s.ehlo(); s.starttls(); s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_FROM, [to], msg.as_string())
        logger.info(f"Email sent → {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Email failed → {to}: {e}")
        return False


# ════════════════════════════════════════════════════════════
# JOB 1 — Missing EOD Log Alert (9:00 AM daily)
# ════════════════════════════════════════════════════════════

def build_missing_log_email(missing_branches, yesterday):
    try:
        dt = datetime.strptime(yesterday, "%Y-%m-%d")
        pretty = dt.strftime("%d/%m/%Y")
        pretty_long = dt.strftime("%d %B %Y")
    except Exception:
        pretty = pretty_long = yesterday

    names = [b["branch_name"] for b in missing_branches]
    if len(names) == 1:   branch_str = names[0]
    elif len(names) == 2: branch_str = names[0] + " and " + names[1]
    else:                 branch_str = ", ".join(names[:-1]) + " and " + names[-1]

    subject = f"[SoftWave Alert] Missing Print Logs — {pretty}"
    plain   = (f"Dear Mr. Nuwan,\n\n{branch_str} has not submitted the daily logs of "
               f"{pretty} - previous day. Please follow up.\n\nSoftWave")

    rows = "".join([
        f'<tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;">'
        f'<span style="background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:700;'
        f'padding:2px 8px;border-radius:5px;font-family:monospace;">{b["branch_code"]}</span></td>'
        f'<td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;'
        f'font-weight:600;color:#0f172a;">{b["branch_name"]}</td></tr>'
        for b in missing_branches
    ])

    html = f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4fa;
font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4fa;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;background:#fff;border-radius:20px;
         overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.10);">
  <tr><td style="background:linear-gradient(135deg,#1e40af,#0ea5e9);padding:36px 40px;text-align:center;">
    <div style="font-size:36px;margin-bottom:10px;">🖨️</div>
    <div style="font-size:24px;font-weight:800;color:#fff;">SoftWave</div>
    <div style="font-size:11px;color:rgba(255,255,255,.75);letter-spacing:.08em;text-transform:uppercase;">Print Management System</div>
  </td></tr>
  <tr><td style="padding:24px 40px 0;">
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:12px 18px;">
      <span style="font-size:13px;font-weight:700;color:#92400e;">⚠️ &nbsp; Daily Print Log Missing — {pretty_long}</span>
    </div>
  </td></tr>
  <tr><td style="padding:28px 40px;">
    <p style="font-size:16px;color:#0f172a;font-weight:600;margin:0 0 14px;">Dear Mr. Nuwan,</p>
    <p style="font-size:15px;color:#334155;line-height:1.75;margin:0 0 24px;">
      <strong style="color:#dc2626;">{branch_str}</strong> has not submitted the daily logs of
      <strong>{pretty}</strong> - previous day. Please follow up.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:28px;">
      <tr><td colspan="2" style="padding:12px 16px;background:#f1f5f9;border-bottom:1.5px solid #e2e8f0;">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;">
          Missing Branches ({len(missing_branches)})
        </span>
      </td></tr>
      {rows}
    </table>
    <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0;">SoftWave Printing Management</p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
    <p style="font-size:11px;color:#94a3b8;margin:0;">This is an automated alert · Please do not reply.</p>
  </td></tr>
</table></td></tr></table></body></html>"""

    return subject, plain, html


def check_missing_logs():
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    logger.info(f"Checking print logs for {yesterday}...")
    try:
        all_branches = query("""
            SELECT b.id AS branch_id, b.code AS branch_code, b.name AS branch_name
            FROM branches b WHERE b.is_active = TRUE ORDER BY b.code
        """) or []
        if not all_branches: return

        logged = query("""
            SELECT DISTINCT p.branch_id FROM print_logs pl
            JOIN printers p ON p.id = pl.printer_id WHERE pl.log_date = %s::date
        """, (yesterday,)) or []

        logged_ids = {r["branch_id"] for r in logged}
        missing = [b for b in all_branches if b["branch_id"] not in logged_ids]

        if not missing:
            logger.info(f"All branches submitted for {yesterday} ✓")
            return

        logger.warning(f"{len(missing)} branch(es) missing for {yesterday}")
        subject, plain, html = build_missing_log_email(missing, yesterday)
        _send_email(ALERT_EMAIL, subject, plain, html)
    except Exception as e:
        logger.error(f"check_missing_logs error: {e}")


# ════════════════════════════════════════════════════════════
# JOB 2 — Toner Level Alerts (every hour)
# ════════════════════════════════════════════════════════════

def check_toner_levels():
    """Check all printers. Send alert if toner ≤25% or ≤10%. One email per threshold per installation."""
    logger.info("Checking toner levels...")
    try:
        printers = query("""
            SELECT
                p.id AS printer_id, p.printer_code,
                b.code AS branch_code, b.name AS branch_name,
                tm.model_code AS toner_model,
                ti.id AS installation_id,
                COALESCE(ti.yield_copies, 0) AS yield_copies,
                GREATEST(0, COALESCE(ti.yield_copies, 0) - COALESCE((
                    SELECT SUM(pl.print_count) FROM print_logs pl
                    WHERE pl.printer_id = p.id
                      AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
                ), 0)) AS copies_remaining,
                ROUND(GREATEST(0.0, 100.0 * (
                    COALESCE(ti.yield_copies, 0) - COALESCE((
                        SELECT SUM(pl.print_count) FROM print_logs pl
                        WHERE pl.printer_id = p.id
                          AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
                    ), 0)
                ) / NULLIF(ti.yield_copies, 0)), 1) AS current_pct,
                CASE WHEN COALESCE(ti.avg_daily_copies, 0) > 0 THEN
                    ROUND(GREATEST(0,
                        COALESCE(ti.yield_copies, 0) - COALESCE((
                            SELECT SUM(pl.print_count) FROM print_logs pl
                            WHERE pl.printer_id = p.id
                              AND pl.log_date >= COALESCE(ti.installed_at::date,'2000-01-01')
                        ), 0)
                    )::NUMERIC / ti.avg_daily_copies)
                ELSE NULL END AS days_remaining
            FROM printers p
            JOIN branches b ON b.id = p.branch_id AND b.is_active = TRUE
            LEFT JOIN toner_installations ti ON ti.printer_id = p.id AND ti.is_current = TRUE
            LEFT JOIN toner_models tm ON tm.id = ti.toner_model_id
            WHERE p.is_active = TRUE AND ti.id IS NOT NULL
        """) or []

        critical = []  # ≤10%
        warning  = []  # ≤25% but >10%

        for p in printers:
            pct = float(p["current_pct"] or 0)
            inst_id = p["installation_id"]

            if pct <= 10:
                # Check if we already sent a critical alert for this installation
                already = query(
                    "SELECT id FROM toner_alerts_sent WHERE printer_id=%s AND threshold=10 AND installation_id=%s",
                    (p["printer_id"], inst_id), fetch="one"
                )
                if not already:
                    critical.append(p)

            elif pct <= 25:
                already = query(
                    "SELECT id FROM toner_alerts_sent WHERE printer_id=%s AND threshold=25 AND installation_id=%s",
                    (p["printer_id"], inst_id), fetch="one"
                )
                if not already:
                    warning.append(p)

        if critical:
            _send_toner_alert_email(critical, "critical")
            for p in critical:
                query(
                    "INSERT INTO toner_alerts_sent (printer_id, threshold, installation_id) "
                    "VALUES (%s, 10, %s) ON CONFLICT DO NOTHING",
                    (p["printer_id"], p["installation_id"]), fetch="none"
                )

        if warning:
            _send_toner_alert_email(warning, "warning")
            for p in warning:
                query(
                    "INSERT INTO toner_alerts_sent (printer_id, threshold, installation_id) "
                    "VALUES (%s, 25, %s) ON CONFLICT DO NOTHING",
                    (p["printer_id"], p["installation_id"]), fetch="none"
                )

        logger.info(f"Toner check: {len(critical)} critical, {len(warning)} warning alerts sent")

    except Exception as e:
        logger.error(f"check_toner_levels error: {e}")


def _send_toner_alert_email(printers, level):
    is_critical = (level == "critical")
    color     = "#ef4444" if is_critical else "#f59e0b"
    bg_color  = "#fef2f2" if is_critical else "#fffbeb"
    icon      = "🚨" if is_critical else "⚠️"
    level_txt = "CRITICAL (≤10%)" if is_critical else "LOW (≤25%)"
    subject   = f"[SoftWave] {icon} Toner {level_txt} — {len(printers)} Printer(s)"

    plain = f"Toner {level_txt} alert:\n\n"
    for p in printers:
        days_txt = f"~{int(p['days_remaining'])} days left" if p.get("days_remaining") else "unknown days"
        plain += f"  • {p['printer_code']} ({p['branch_name']}) — {p['current_pct']}% — {days_txt}\n"
    plain += "\nPlease request toner replacement.\nSoftWave"

    rows = ""
    for p in printers:
        pct = float(p["current_pct"] or 0)
        bar_w = max(2, min(100, int(pct)))
        bar_col = "#ef4444" if pct <= 10 else "#f59e0b"
        days_txt = f"~{int(p['days_remaining'])} days" if p.get("days_remaining") else "—"
        rows += f"""
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:12px 16px;font-family:monospace;font-weight:700;color:#0ea5e9;">{p['printer_code']}</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;">{p['branch_name']}</td>
          <td style="padding:12px 16px;">
            <div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;width:100px;">
              <div style="height:100%;width:{bar_w}%;background:{bar_col};border-radius:4px;"></div>
            </div>
          </td>
          <td style="padding:12px 16px;font-family:monospace;font-weight:800;color:{bar_col};">{pct}%</td>
          <td style="padding:12px 16px;font-size:12px;color:#64748b;">{days_txt}</td>
          <td style="padding:12px 16px;font-size:12px;color:#475569;">{p.get('toner_model','—')}</td>
        </tr>"""

    html = f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4fa;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4fa;padding:40px 20px;">
<tr><td align="center">
<table width="650" cellpadding="0" cellspacing="0"
  style="max-width:650px;width:100%;background:#fff;border-radius:20px;
         overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.10);">
  <tr><td style="background:linear-gradient(135deg,#1e40af,#0ea5e9);padding:32px 40px;text-align:center;">
    <div style="font-size:32px;margin-bottom:8px;">{icon}</div>
    <div style="font-size:22px;font-weight:800;color:#fff;">Toner Level Alert</div>
    <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:4px;">SoftWave Print Management</div>
  </td></tr>
  <tr><td style="padding:24px 40px 0;">
    <div style="background:{bg_color};border-left:4px solid {color};border-radius:0 10px 10px 0;padding:14px 18px;">
      <span style="font-size:14px;font-weight:700;color:{color};">
        {icon} {len(printers)} printer(s) with {level_txt} toner — immediate attention required
      </span>
    </div>
  </td></tr>
  <tr><td style="padding:24px 40px;">
    <p style="font-size:16px;color:#0f172a;font-weight:600;margin:0 0 16px;">Dear Mr. Nuwan,</p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      The following printers have {level_txt} toner levels. Please arrange toner replacements promptly.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <tr style="background:#f8fafc;border-bottom:1.5px solid #e2e8f0;">
        <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Printer</td>
        <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Branch</td>
        <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Level</td>
        <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">%</td>
        <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Est. Days</td>
        <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Model</td>
      </tr>
      {rows}
    </table>
    <p style="font-size:13px;color:#94a3b8;margin-top:20px;margin-bottom:0;">
      Log in to <strong>SoftWave</strong> to submit toner requests.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 40px;text-align:center;">
    <p style="font-size:11px;color:#94a3b8;margin:0;">Automated alert · Do not reply to this email.</p>
  </td></tr>
</table></td></tr></table></body></html>"""

    _send_email(ALERT_EMAIL, subject, plain, html)


# ════════════════════════════════════════════════════════════
# JOB 3 — Toner Request Status Notification (on-demand)
# ════════════════════════════════════════════════════════════

def send_request_status_email(request_id: int):
    """Called from routes when manager approves/rejects. Emails Nuwan."""
    try:
        req = query("""
            SELECT rr.*, p.printer_code, b.code AS branch_code, b.name AS branch_name,
                   tm.model_code AS toner_model,
                   u_req.full_name AS requested_by, u_req.username AS req_username,
                   u_rev.full_name AS reviewed_by,
                   rr.review_note, rr.status, rr.priority
            FROM replacement_requests rr
            JOIN printers p ON p.id = rr.printer_id
            JOIN branches b ON b.id = p.branch_id
            LEFT JOIN toner_models tm ON tm.id = rr.toner_model_id
            LEFT JOIN users u_req ON u_req.id = rr.requested_by
            LEFT JOIN users u_rev ON u_rev.id = rr.reviewed_by
            WHERE rr.id = %s
        """, (request_id,), fetch="one")

        if not req:
            logger.warning(f"send_request_status_email: request {request_id} not found")
            return

        status = req["status"]
        if status not in ("approved", "rejected"):
            return

        is_approved = status == "approved"
        icon      = "✅" if is_approved else "❌"
        color     = "#10b981" if is_approved else "#ef4444"
        bg_color  = "#f0fdf4" if is_approved else "#fef2f2"
        status_txt = "APPROVED" if is_approved else "REJECTED"
        action_txt = "The store will dispatch the toner shortly." if is_approved else "Please submit a new request if needed."

        subject = f"[SoftWave] {icon} Toner Request {status_txt} — {req['printer_code']}"

        plain = (
            f"Dear Mr. Nuwan,\n\nYour toner request for {req['printer_code']} "
            f"({req['branch_name']}) has been {status_txt} by {req['reviewed_by']}.\n"
            f"Toner: {req['toner_model']}\n"
            + (f"Note: {req['review_note']}\n" if req.get('review_note') else "")
            + f"\n{action_txt}\n\nSoftWave"
        )

        note_html = (
            f'<div style="background:#f8fafc;border-left:3px solid #cbd5e1;'
            f'border-radius:0 8px 8px 0;padding:10px 14px;margin-top:14px;">'
            f'<span style="font-size:12px;color:#64748b;">Manager Note: </span>'
            f'<span style="font-size:13px;font-weight:600;color:#0f172a;">{req["review_note"]}</span>'
            f'</div>'
        ) if req.get("review_note") else ""

        pri_colors = {"critical": "#ef4444", "urgent": "#f59e0b", "normal": "#10b981"}
        pri_color = pri_colors.get(req.get("priority","normal"), "#94a3b8")

        html = f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4fa;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4fa;padding:40px 20px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0"
  style="max-width:580px;width:100%;background:#fff;border-radius:20px;
         overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.10);">
  <tr><td style="background:linear-gradient(135deg,#1e40af,#0ea5e9);padding:32px 40px;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">{icon}</div>
    <div style="font-size:22px;font-weight:800;color:#fff;">Toner Request {status_txt}</div>
    <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:4px;">SoftWave Print Management</div>
  </td></tr>
  <tr><td style="padding:28px 40px;">
    <p style="font-size:16px;font-weight:600;color:#0f172a;margin:0 0 20px;">Dear Mr. Nuwan,</p>
    <div style="background:{bg_color};border:1.5px solid {color}33;border-radius:14px;padding:20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:20px;">{icon}</span>
        <span style="font-size:16px;font-weight:800;color:{color};">Request {status_txt}</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;font-size:12px;color:#64748b;width:120px;">Printer</td>
            <td style="padding:4px 0;font-size:13px;font-weight:700;color:#0f172a;font-family:monospace;">{req['printer_code']}</td></tr>
        <tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Branch</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:#0f172a;">{req['branch_name']}</td></tr>
        <tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Toner</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:#0f172a;">{req.get('toner_model','—')}</td></tr>
        <tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Priority</td>
            <td style="padding:4px 0;"><span style="background:{pri_color}22;color:{pri_color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;">{(req.get('priority','normal')).upper()}</span></td></tr>
        <tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Reviewed by</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:#0f172a;">{req.get('reviewed_by','—')}</td></tr>
      </table>
      {note_html}
    </div>
    <p style="font-size:14px;color:#475569;margin:0 0 6px;">{action_txt}</p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 40px;text-align:center;">
    <p style="font-size:11px;color:#94a3b8;margin:0;">Automated notification · Do not reply.</p>
  </td></tr>
</table></td></tr></table></body></html>"""

        _send_email(ALERT_EMAIL, subject, plain, html)

    except Exception as e:
        logger.error(f"send_request_status_email error: {e}")


# ════════════════════════════════════════════════════════════
# Scheduler loop
# ════════════════════════════════════════════════════════════

def _scheduler_loop():
    logger.info(f"Scheduler started — EOD check at {CHECK_HOUR:02d}:{CHECK_MINUTE:02d}")
    last_eod_date   = None
    last_toner_hour = None

    while True:
        try:
            now  = datetime.now()
            today = now.date()

            # EOD missing log — once per day at CHECK_HOUR:CHECK_MINUTE
            if (now.hour == CHECK_HOUR and now.minute == CHECK_MINUTE
                    and last_eod_date != today):
                last_eod_date = today
                check_missing_logs()

            # Toner levels — once per hour
            cur_hour = (today, now.hour)
            if last_toner_hour != cur_hour:
                last_toner_hour = cur_hour
                check_toner_levels()

            time.sleep(30)

        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
            time.sleep(60)


def start_scheduler():
    t = threading.Thread(target=_scheduler_loop, daemon=True, name="softwave-scheduler")
    t.start()
    logger.info("Scheduler thread started.")
    return t

# ════════════════════════════════════════════════════════════
# DBA ACTION EMAILS — User management notifications to Nuwan
# ════════════════════════════════════════════════════════════

LOGIN_URL = os.getenv("APP_URL", "https://softwave-reprographers.duckdns.org")
FROM_NAME = "SoftWave System"
SYSTEM_FROM = os.getenv("SYSTEM_FROM", "system@softwave.lk")


def _send_system_email(subject: str, plain: str, html: str) -> bool:
    """Send from system@softwave.lk to nuwan@softwave.lk"""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP not configured — skipping system email")
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"SoftWave System <{SMTP_FROM}>"
    msg["To"]      = ALERT_EMAIL
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html,  "html"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
            s.ehlo(); s.starttls(); s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_FROM, [ALERT_EMAIL], msg.as_string())
        logger.info(f"System email sent → {ALERT_EMAIL}: {subject}")
        return True
    except Exception as e:
        logger.error(f"System email failed: {e}")
        return False


def _base_html(icon: str, title: str, subtitle: str, body_rows: str, accent_color: str = "#0ea5e9") -> str:
    return f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4fa;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4fa;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;
         overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.10);">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,{accent_color} 100%);padding:36px 40px;text-align:center;">
    <div style="font-size:40px;margin-bottom:10px;">{icon}</div>
    <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-.01em;">SoftWave</div>
    <div style="font-size:11px;color:rgba(255,255,255,.70);letter-spacing:.09em;text-transform:uppercase;margin-top:4px;">Print Management System</div>
  </td></tr>

  <!-- TITLE BAND -->
  <tr><td style="background:#f8fafc;border-bottom:2px solid #e2e8f0;padding:18px 40px;">
    <div style="font-size:18px;font-weight:800;color:#0f172a;">{title}</div>
    <div style="font-size:13px;color:#64748b;margin-top:4px;">{subtitle}</div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="padding:30px 40px;">
    {body_rows}
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f1f5f9;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
    <div style="font-size:12px;color:#64748b;font-weight:600;">SoftWave Reprographers</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:4px;">system@softwave.lk &nbsp;·&nbsp; Automated notification — do not reply</div>
  </td></tr>

</table></td></tr></table></body></html>"""


def _detail_row(label: str, value: str, mono: bool = False) -> str:
    val_style = "font-family:monospace;font-weight:700;" if mono else "font-weight:600;"
    return f"""<tr>
      <td style="padding:8px 0;font-size:12px;color:#64748b;width:140px;vertical-align:top;">{label}</td>
      <td style="padding:8px 0;font-size:14px;{val_style}color:#0f172a;">{value}</td>
    </tr>"""


def _credentials_block(users_list: list) -> str:
    """Build the login credentials block used in user_created emails."""
    rows = ""
    for u in users_list:
        rows += f"""
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:13px;font-weight:800;color:#0f172a;">👤 {u['full_name']}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">
              &nbsp;&nbsp;Username: <span style="font-family:monospace;font-weight:700;color:#0ea5e9;">{u['username']}</span>
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">
              &nbsp;&nbsp;Password: <span style="font-family:monospace;font-weight:700;color:#7c3aed;">{u['password']}</span>
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
              &nbsp;&nbsp;Role: {u.get('role','—').title()} &nbsp;·&nbsp; Branch: {u.get('branch','All')}
            </div>
          </td>
        </tr>"""
    return f"""
    <div style="background:#1e293b;border-radius:14px;padding:20px 20px 4px;margin:20px 0;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
                  color:#94a3b8;margin-bottom:12px;">🔐 LOGIN CREDENTIALS</div>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#0f172a;border-radius:10px;overflow:hidden;">
        {rows}
      </table>
    </div>
    <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:14px 18px;margin:16px 0;">
      <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:8px;">⚠️ IMPORTANT</div>
      <ul style="margin:0;padding-left:18px;font-size:12px;color:#78350f;line-height:2;">
        <li>Please change your password after first login</li>
        <li>Do not share your credentials with anyone</li>
        <li>If you face any issues, contact your system administrator</li>
      </ul>
    </div>
    <div style="text-align:center;margin:20px 0 8px;">
      <a href="{LOGIN_URL}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);
         color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:12px;
         text-decoration:none;letter-spacing:.01em;">🌐 Login to SoftWave →</a>
      <div style="font-size:11px;color:#94a3b8;margin-top:10px;">{LOGIN_URL}</div>
    </div>"""


# ── Email: User Created ───────────────────────────────────────────────────────

def send_user_created_email(full_name: str, username: str, password: str,
                             role: str, branch: str, created_by: str):
    subject = "SoftWave — New User Account Created"
    plain = (f"New user created by {created_by}:\n\n"
             f"Name: {full_name}\nUsername: {username}\nPassword: {password}\n"
             f"Role: {role}\nBranch: {branch}\n\nLogin: {LOGIN_URL}")

    body = f"""
    <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 6px;">Dear Mr. Nuwan,</p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      A new user account has been created by <strong>{created_by}</strong>.
      Here are the login credentials:
    </p>
    {_credentials_block([{{'full_name': full_name, 'username': username,
                           'password': password, 'role': role, 'branch': branch}}])}
    <table cellpadding="0" cellspacing="0" style="margin-top:20px;width:100%;">
      {_detail_row('Created By', created_by)}
    </table>"""

    html = _base_html("👤", "New User Account Created",
                      f"Account for {full_name} is now active", body, "#6366f1")
    _send_system_email(subject, plain, html)


# ── Email: Password Reset ─────────────────────────────────────────────────────

def send_password_reset_email(full_name: str, username: str, new_password: str, reset_by: str):
    subject = f"SoftWave — Password Reset: {username}"
    plain = (f"Password reset by {reset_by}:\n\n"
             f"User: {full_name}\nUsername: {username}\nNew Password: {new_password}\n\n"
             f"Login: {LOGIN_URL}")

    body = f"""
    <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 6px;">Dear Mr. Nuwan,</p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      A password has been reset by <strong>{reset_by}</strong>.
    </p>
    <div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:14px;padding:20px;margin-bottom:20px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        {_detail_row('Full Name', full_name)}
        {_detail_row('Username', username, mono=True)}
        {_detail_row('New Password', f'<span style="background:#1e293b;color:#a3e635;font-family:monospace;font-weight:800;padding:4px 12px;border-radius:6px;font-size:15px;">{new_password}</span>')}
        {_detail_row('Reset By', reset_by)}
      </table>
    </div>
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:12px 18px;">
      <span style="font-size:12px;font-weight:700;color:#92400e;">
        ⚠️ Please inform the user to log in with these new credentials and change their password immediately.
      </span>
    </div>"""

    html = _base_html("🔑", "Password Reset", f"Password changed for {full_name}", body, "#7c3aed")
    _send_system_email(subject, plain, html)


# ── Email: User Activated / Deactivated ──────────────────────────────────────

def send_user_status_email(full_name: str, username: str, action: str, changed_by: str):
    is_activated = (action == "activated")
    icon    = "✅" if is_activated else "🚫"
    color   = "#10b981" if is_activated else "#ef4444"
    bg      = "#f0fdf4" if is_activated else "#fef2f2"
    border  = "#bbf7d0" if is_activated else "#fecaca"
    status  = "ACTIVATED" if is_activated else "DEACTIVATED"
    subject = f"SoftWave — User Account {status}: {username}"

    plain = (f"User account {action} by {changed_by}:\n\n"
             f"User: {full_name}\nUsername: {username}\nStatus: {status}")

    body = f"""
    <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 6px;">Dear Mr. Nuwan,</p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      A user account has been <strong style="color:{color};">{action}</strong> by <strong>{changed_by}</strong>.
    </p>
    <div style="background:{bg};border:1.5px solid {border};border-radius:14px;padding:20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <span style="font-size:28px;">{icon}</span>
        <div>
          <div style="font-size:16px;font-weight:800;color:{color};">Account {status}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">
            {"This user can now log in to the system." if is_activated else "This user can no longer log in to the system."}
          </div>
        </div>
      </div>
      <table cellpadding="0" cellspacing="0" width="100%">
        {_detail_row('Full Name', full_name)}
        {_detail_row('Username', username, mono=True)}
        {_detail_row('New Status', f'<span style="background:{color};color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">{status}</span>')}
        {_detail_row('Changed By', changed_by)}
      </table>
    </div>"""

    html = _base_html(icon, f"User Account {status}",
                      f"{full_name} (@{username})", body, color)
    _send_system_email(subject, plain, html)


# ── Email: Custom System Message ──────────────────────────────────────────────

def send_custom_system_email(subject: str, message: str, sent_by: str):
    plain = f"Message from {sent_by}:\n\n{message}"
    body = f"""
    <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 6px;">Dear Mr. Nuwan,</p>
    <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;
                padding:24px;margin:16px 0;min-height:80px;">
      <p style="font-size:15px;color:#1e293b;line-height:1.75;margin:0;white-space:pre-wrap;">{message}</p>
    </div>
    <div style="font-size:12px;color:#94a3b8;margin-top:8px;">Sent by: <strong>{sent_by}</strong></div>"""
    html = _base_html("💬", "System Message", subject, body, "#0ea5e9")
    _send_system_email(subject, plain, html)