"""
SoftWave Print Management System — Email Scheduler
Sends one combined email to Nuwan at 9:00 AM listing ALL branches
that did not submit their daily print log for the previous day.
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

# ── Config from environment ───────────────────────────────
SMTP_HOST    = os.getenv("SMTP_HOST",    "smtp.gmail.com")
SMTP_PORT    = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER    = os.getenv("SMTP_USER",    "")
SMTP_PASS    = os.getenv("SMTP_PASS",    "")
SMTP_FROM    = os.getenv("SMTP_FROM",    "noreply@softwave.lk")
ALERT_EMAIL  = os.getenv("ALERT_EMAIL",  "nuwan@softwave.lk")
CHECK_HOUR   = int(os.getenv("EOD_CHECK_HOUR",   "9"))
CHECK_MINUTE = int(os.getenv("EOD_CHECK_MINUTE", "0"))


# ── Build email ───────────────────────────────────────────
def build_email(missing_branches: list, yesterday: str) -> tuple:
    """Returns (subject, plain_text, html) for the alert email."""

    try:
        dt = datetime.strptime(yesterday, "%Y-%m-%d")
        pretty_date = dt.strftime("%d/%m/%Y")
        pretty_date_long = dt.strftime("%d %B %Y")
    except Exception:
        pretty_date = yesterday
        pretty_date_long = yesterday

    # Build branch list string  e.g. "Gampaha, Kandy and Jaffna"
    names = [b["branch_name"] for b in missing_branches]
    if len(names) == 1:
        branch_list_str = names[0]
    elif len(names) == 2:
        branch_list_str = names[0] + " and " + names[1]
    else:
        branch_list_str = ", ".join(names[:-1]) + " and " + names[-1]

    subject = f"[SoftWave Alert] Missing Print Logs — {pretty_date}"

    # ── Plain text ────────────────────────────────────────
    plain = (
        f"Dear Mr. Nuwan,\n\n"
        f"{branch_list_str} has not submitted the daily logs of "
        f"{pretty_date} - previous day. Please follow up and inform "
        f"to log the daily records accordingly.\n\n"
        f"Thank you.\n"
        f"SoftWave Printing Management"
    )

    # ── Branch rows for HTML table ────────────────────────
    branch_rows_html = "".join([
        f"""<tr>
              <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;">
                <span style="background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:700;
                             padding:2px 8px;border-radius:5px;font-family:monospace;">
                  {b['branch_code']}
                </span>
              </td>
              <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;
                         font-size:14px;font-weight:600;color:#0f172a;">
                {b['branch_name']}
              </td>
            </tr>"""
        for b in missing_branches
    ])

    # ── HTML email ────────────────────────────────────────
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f0f4fa;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4fa;padding:40px 20px;">
  <tr><td align="center">

    <table width="600" cellpadding="0" cellspacing="0"
      style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;
             overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.10);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#1e40af 0%,#0ea5e9 100%);
                   padding:36px 40px;text-align:center;">
          <div style="font-size:36px;margin-bottom:10px;">🖨️</div>
          <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-.02em;">SoftWave</div>
          <div style="font-size:11px;color:rgba(255,255,255,.75);margin-top:4px;
                      letter-spacing:.08em;text-transform:uppercase;">
            Print Management System
          </div>
        </td>
      </tr>

      <!-- Alert badge -->
      <tr>
        <td style="padding:24px 40px 0;">
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;
                      border-radius:0 10px 10px 0;padding:12px 18px;">
            <span style="font-size:13px;font-weight:700;color:#92400e;">
              ⚠️ &nbsp; Daily Print Log Missing — {pretty_date_long}
            </span>
          </div>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:28px 40px;">

          <p style="font-size:16px;color:#0f172a;font-weight:600;margin:0 0 14px;">
            Dear Mr. Nuwan,
          </p>

          <p style="font-size:15px;color:#334155;line-height:1.75;margin:0 0 24px;">
            <strong style="color:#dc2626;">{branch_list_str}</strong>
            has not submitted the daily logs of
            <strong>{pretty_date}</strong> - previous day.
            Please follow up and inform to log the daily records accordingly.
          </p>

          <!-- Branch table -->
          <table width="100%" cellpadding="0" cellspacing="0"
            style="background:#f8fafc;border:1.5px solid #e2e8f0;
                   border-radius:12px;overflow:hidden;margin-bottom:28px;">
            <tr>
              <td colspan="2"
                style="padding:12px 16px;background:#f1f5f9;border-bottom:1.5px solid #e2e8f0;">
                <span style="font-size:11px;font-weight:700;text-transform:uppercase;
                             letter-spacing:.07em;color:#64748b;">
                  Missing Branches ({len(missing_branches)})
                </span>
              </td>
            </tr>
            {branch_rows_html}
          </table>

          <p style="font-size:15px;color:#334155;margin:0 0 6px;">
            Thank you.
          </p>
          <p style="font-size:15px;font-weight:700;color:#0f172a;margin:0;">
            SoftWave Printing Management
          </p>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;border-top:1px solid #e2e8f0;
                   padding:20px 40px;text-align:center;">
          <p style="font-size:11px;color:#94a3b8;margin:0;">
            This is an automated alert · Please do not reply to this email.
          </p>
        </td>
      </tr>

    </table>

    <p style="font-size:11px;color:#94a3b8;margin:16px 0 0;text-align:center;">
      © {datetime.now().year} SoftWave · Print Management System
    </p>

  </td></tr>
</table>
</body>
</html>"""

    return subject, plain, html


# ── Send email ────────────────────────────────────────────
def send_missing_log_email(missing_branches: list, yesterday: str) -> bool:
    """Send one combined email listing all missing branches."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP credentials not configured — cannot send email")
        return False

    subject, plain, html = build_email(missing_branches, yesterday)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"SoftWave Print Management <{SMTP_FROM}>"
    msg["To"]      = ALERT_EMAIL

    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html,  "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [ALERT_EMAIL], msg.as_string())
        names = [b["branch_code"] for b in missing_branches]
        logger.info(f"Alert email sent for {len(missing_branches)} branch(es): {names}")
        return True
    except Exception as e:
        logger.error(f"Failed to send alert email: {e}")
        return False


# ── Check missing logs ────────────────────────────────────
def check_missing_logs():
    """
    Find all active branches that did NOT submit a print log yesterday.
    Sends ONE combined email to Nuwan listing all missing branches.
    """
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    logger.info(f"Checking print logs for {yesterday}...")

    try:
        # All active branches
        all_branches = query("""
            SELECT
                b.id   AS branch_id,
                b.code AS branch_code,
                b.name AS branch_name
            FROM branches b
            WHERE b.is_active = TRUE
            ORDER BY b.code
        """) or []

        if not all_branches:
            logger.info("No active branches found.")
            return

        # Branches that DID submit yesterday
        logged = query("""
            SELECT DISTINCT p.branch_id
            FROM print_logs pl
            JOIN printers p ON p.id = pl.printer_id
            WHERE pl.log_date = %s::date
        """, (yesterday,)) or []

        logged_ids = {row["branch_id"] for row in logged}

        # Branches that did NOT submit
        missing = [b for b in all_branches if b["branch_id"] not in logged_ids]

        if not missing:
            logger.info(f"All branches submitted logs for {yesterday}. ✓")
            return

        names = [b["branch_code"] for b in missing]
        logger.warning(f"{len(missing)} branch(es) missing for {yesterday}: {names}")

        # Send ONE combined email
        send_missing_log_email(missing, yesterday)

    except Exception as e:
        logger.error(f"Error checking missing logs: {e}")


# ── Scheduler loop ────────────────────────────────────────
def _scheduler_loop():
    """Background thread — fires daily at CHECK_HOUR:CHECK_MINUTE."""
    logger.info(
        f"Email scheduler started — checks at "
        f"{CHECK_HOUR:02d}:{CHECK_MINUTE:02d} every day"
    )
    last_run_date = None

    while True:
        try:
            now   = datetime.now()
            today = now.date()

            if (now.hour   == CHECK_HOUR
                    and now.minute == CHECK_MINUTE
                    and last_run_date != today):
                last_run_date = today
                check_missing_logs()

            time.sleep(30)   # check every 30 seconds for minute accuracy

        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
            time.sleep(60)


def start_scheduler():
    """Launch the scheduler in a daemon background thread."""
    t = threading.Thread(
        target=_scheduler_loop, daemon=True, name="eod-scheduler"
    )
    t.start()
    logger.info("Scheduler thread started.")
    return t