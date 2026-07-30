#!/bin/bash
# VINtage / Torque database backup.
#
# Exports the data that can't be recreated -- products, purchases (who paid),
# vehicles (customer inventory), and the user list -- to a timestamped,
# gzipped JSON file. Uses the Supabase Management API via the CLI's stored
# login: no Docker, no database password. Keeps the newest 8 backups.
# (The database STRUCTURE lives in supabase/migrations/, so this data export
# plus those migrations is a complete picture.)
#
# Run by hand any time:  bash "scripts/backup-db.sh"
# Or on the weekly schedule set up by the LaunchAgent alongside this file.

set -uo pipefail

PROJECT_DIR="/Users/jefflovette/Desktop/Wheelhouse App"
BACKUP_DIR="/Users/jefflovette/Desktop/Torque Private/VINtage Backups"
KEEP=8

mkdir -p "$BACKUP_DIR"
cd "$PROJECT_DIR" || { echo "project dir missing"; exit 1; }

# A LaunchAgent runs with a bare PATH; make sure node/npx are findable.
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"

LOG="$BACKUP_DIR/backup.log"
say() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

say "starting backup"

python3 - "$BACKUP_DIR" "$KEEP" <<'PY' 2>>"$LOG"
import subprocess, json, sys, gzip, glob, os, datetime

backup_dir, keep = sys.argv[1], int(sys.argv[2])

# name -> query. Passwords are never selected.
TABLES = {
    "products":  "select * from public.products order by created_at",
    "purchases": "select * from public.purchases order by created_at",
    "vehicles":  "select * from public.vehicles order by created_at",
    "users":     "select id, email, created_at, last_sign_in_at from auth.users order by created_at",
}

def q(sql):
    out = subprocess.run(
        ["npx", "--yes", "supabase@latest", "db", "query", "--linked", sql],
        capture_output=True, text=True, timeout=120,
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip()[:300] or "query failed")
    start = out.stdout.find("{")
    if start < 0:
        raise RuntimeError("no JSON in response")
    return json.loads(out.stdout[start:]).get("rows", [])

dump = {"backed_up_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
counts = []
for name, sql in TABLES.items():
    rows = q(sql)
    dump[name] = rows
    counts.append(f"{name}={len(rows)}")

stamp = datetime.datetime.now().strftime("%Y-%m-%d_%H%M")
path = os.path.join(backup_dir, f"vintage-backup-{stamp}.json.gz")
with gzip.open(path, "wt", encoding="utf-8") as f:
    json.dump(dump, f, indent=2, default=str)

size = os.path.getsize(path)
print(f"WROTE {path} ({size} bytes) rows: {', '.join(counts)}")

# prune to newest `keep`
backups = sorted(glob.glob(os.path.join(backup_dir, "vintage-backup-*.json.gz")), reverse=True)
for old in backups[keep:]:
    os.remove(old)
    print(f"PRUNED {os.path.basename(old)}")
PY

STATUS=$?
if [ $STATUS -eq 0 ]; then
  say "SUCCESS"
else
  say "FAILED (exit $STATUS) -- see lines above; if it mentions login/token, run 'npx supabase login' once"
fi
exit $STATUS
