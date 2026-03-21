"""
SoftWave Print Management System — Email Scheduler
Checks every morning at 9:00 AM if any branch service person
has not logged their print counts for the previous day.
Sends an alert email to nuwan@softwave.lk for each missing branch.
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

# ── Email config from environment ────────────────────────
SMTP_HOST     = os.getenv("SMTP_HOST",     "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER",     "")
SMTP_PASS     = os.getenv("SMTP_PASS",     "")
SMTP_FROM     = os.getenv("SMTP_FROM",     "noreply@softwave.lk")
ALERT_EMAIL   = os.getenv("ALERT_EMAIL",   "nuwan@softwave.lk")
CHECK_HOUR    = int(os.getenv("EOD_CHECK_HOUR", "9"))   # 9:00 AM
CHECK_MINUTE  = int(os.getenv("EOD_CHECK_MINUTE", "0"))


# ── HTML email template ───────────────────────────────────
def build_email_html(branch_name: str, branch_code: str, yesterday: str) -> str:
    # Format date nicely e.g. "Monday, 20 March 2025"
    try:
        dt = datetime.strptime(yesterday, "%Y-%m-%d")
        pretty_date = dt.strftime("%A, %d %B %Y")
    except Exception:
        pretty_date = yesterday

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Print Log Alert</title>
</head>
<body style="margin:0;padding:0;background:#f0f4fa;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4fa;padding:40px 20px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

          <!-- Header gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af 0%,#0ea5e9 100%);padding:36px 40px;text-align:center;">
              <!-- Logo placeholder — shows company initials if image fails -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="width:64px;height:64px;background:rgba(255,255,255,0.2);border-radius:16px;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:64px;">🖨️</span>
                  </td>
                </tr>
              </table>
              <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">SoftWave</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px;letter-spacing:0.06em;text-transform:uppercase;">Print Management System</div>
            </td>
          </tr>

          <!-- Alert badge -->
          <tr>
            <td style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:14px 20px;margin-top:-1px;">
                    <span style="font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">⚠️ &nbsp; Print Log Missing</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 24px;">

              <p style="font-size:16px;color:#0f172a;font-weight:600;margin:0 0 18px;">Hello,</p>

              <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">
                The branch listed below has <strong style="color:#dc2626;">not submitted</strong> their end-of-day print log for yesterday. Please follow up with them as soon as possible.
              </p>

              <!-- Branch info card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:14px;border-bottom:1px solid #e2e8f0;">
                          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:6px;">Branch</div>
                          <div style="font-size:20px;font-weight:800;color:#0f172a;">
                            <span style="background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;padding:3px 10px;border-radius:6px;vertical-align:middle;font-family:monospace;">{branch_code}</span>
                            &nbsp; {branch_name}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top:14px;">
                          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:6px;">Missing Date</div>
                          <div style="font-size:16px;font-weight:700;color:#dc2626;">📅 &nbsp; {pretty_date}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Message -->
              <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 28px;">
                <strong>{branch_name}</strong> has not updated the print amount of <strong>{pretty_date}</strong> still. Please inform them.
              </p>

              <p style="font-size:15px;color:#334155;margin:0;">
                Thank you,<br>
                <strong style="color:#0f172a;">SoftWave Print Management System</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
              <p style="font-size:12px;color:#94a3b8;margin:0 0 4px;">This is an automated alert from SoftWave Print Management System.</p>
              <p style="font-size:12px;color:#94a3b8;margin:0;">Please do not reply to this email.</p>
            </td>
          </tr>

        </table>

        <!-- Bottom note -->
        <p style="font-size:11px;color:#94a3b8;margin:20px 0 0;text-align:center;">
          © {datetime.now().year} SoftWave · Print Management System · Enterprise Edition
        </p>

      </td>
    </tr>
  </table>

</body>
</html>"""


def send_alert_email(branch_name: str, branch_code: str, yesterday: str) -> bool:
    """Send missing print log alert email. Returns True if sent successfully."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP credentials not configured — cannot send email alert")
        return False

    try:
        dt = datetime.strptime(yesterday, "%Y-%m-%d")
        pretty_date = dt.strftime("%A, %d %B %Y")
    except Exception:
        pretty_date = yesterday

    subject = f"[SoftWave Alert] {branch_name} — Print Log Missing for {pretty_date}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"SoftWave Print Management <{SMTP_FROM}>"
    msg["To"]      = ALERT_EMAIL

    # Plain text fallback
    plain = (
        f"Hello,\n\n"
        f"{branch_name} has not updated the print amount of {pretty_date} still. "
        f"Please inform them.\n\n"
        f"Thank You\n"
        f"SoftWave Print Management System"
    )
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(build_email_html(branch_name, branch_code, yesterday), "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [ALERT_EMAIL], msg.as_string())
        logger.info(f"Alert sent for branch {branch_code} — {branch_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email for branch {branch_code}: {e}")
        return False


def check_missing_logs():
    """
    Check if any active branch's service person(s) have NOT submitted
    a print log for yesterday. Runs once per day at CHECK_HOUR:CHECK_MINUTE.
    """
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    logger.info(f"Checking print logs for {yesterday}...")

    try:
        # Get all active branches that have active service persons assigned
        # A branch needs a log if it has at least one printer and
        # at least one service user assigned to it
        branches = query("""
            SELECT DISTINCT
                b.id        AS branch_id,
                b.code      AS branch_code,
                b.name      AS branch_name
            FROM branches b
            JOIN printers p ON p.branch_id = b.id AND p.is_active = TRUE
            JOIN users u ON (
                u.branch_access = b.code
                OR u.branch_access = b.id::text
            )
            AND u.role = 'service'
            AND u.is_active = TRUE
            WHERE b.is_active = TRUE
            ORDER BY b.code
        """)

        if not branches:
            logger.info("No branches with assigned service persons found.")
            return

        # Get branches that DID log yesterday
        logged = query("""
            SELECT DISTINCT p.branch_id
            FROM print_logs pl
            JOIN printers p ON p.id = pl.printer_id
            WHERE pl.log_date = %s::date
        """, (yesterday,))

        logged_ids = {row["branch_id"] for row in (logged or [])}

        # Find branches that did NOT log
        missing = [b for b in branches if b["branch_id"] not in logged_ids]

        if not missing:
            logger.info(f"All branches submitted print logs for {yesterday}. ✓")
            return

        logger.warning(f"{len(missing)} branch(es) missing print log for {yesterday}: "
                       f"{[b['branch_code'] for b in missing]}")

        for branch in missing:
            send_alert_email(
                branch_name=branch["branch_name"],
                branch_code=branch["branch_code"],
                yesterday=yesterday,
            )

    except Exception as e:
        logger.error(f"Error in check_missing_logs: {e}")


def _scheduler_loop():
    """Background thread — waits until CHECK_HOUR:CHECK_MINUTE then fires daily."""
    logger.info(f"Email scheduler started — will check at {CHECK_HOUR:02d}:{CHECK_MINUTE:02d} every day")

    # Track which date we last ran so we don't double-fire
    last_run_date = None

    while True:
        try:
            now = datetime.now()
            today = now.date()

            if (now.hour == CHECK_HOUR
                    and now.minute == CHECK_MINUTE
                    and last_run_date != today):
                last_run_date = today
                check_missing_logs()

            # Sleep 30 seconds between checks — precise enough for minute-level timing
            time.sleep(30)

        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
            time.sleep(60)


def start_scheduler():
    """Launch the scheduler in a daemon background thread."""
    t = threading.Thread(target=_scheduler_loop, daemon=True, name="eod-scheduler")
    t.start()
    return t