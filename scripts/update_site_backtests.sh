#!/usr/bin/env bash
# update_site_backtests.sh — Weekly regen of ALL public-site backtests (news/event studies)
# Loaded via launchd: ~/Library/LaunchAgents/com.angelo.update-site-backtests.plist (Sunday 23h,
#   1h after update-news-pine so it starts from fresh news data).
#
# Pipeline:
#   1. Prepare/refresh a dedicated `main` worktree at ~/jacktradesnq-site-deploy (PROD branch).
#   2. Run 5 ifvg/fomc runners (NQ/ES/GC/SI/FOMC) — they write HARDCODED to
#      ~/jacktradesnq-site-costs/public/data (no env/arg override available).
#   3. Run the straddle runner with JTNQ_SITE_ROOT=<worktree> so it writes straight into the worktree.
#   4. Copy regenerated ifvg/fomc JSON from site-costs into the worktree.
#   5. git add public/data → commit → push origin main   (gated behind DRY_RUN=0).
#   6. Discord heartbeat (always, even on 0 change / partial failure).
#
# Robustness: NO `set -e`. Each runner wrapped in try; a failing runner logs WARN + Discord
# and the batch continues. Global wall-clock deadline guards against a hung runner.
#
# DRY_RUN (default 1 = safe): when 1, the worktree-add / pull / git add / commit / push are
# ECHOed only, never executed. Set DRY_RUN=0 in the LaunchAgent/cron for real operation.

set -uo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DRY_RUN="${DRY_RUN:-1}"

SITE_REPO="/Users/angelo/jacktradesnq-site"            # main clone (has local `main` branch)
COSTS_REPO="/Users/angelo/jacktradesnq-site-costs"     # 2nd clone holding the ifvg/fomc runners
DEPLOY_WT="/Users/angelo/jacktradesnq-site-deploy"     # dedicated main worktree (commit target)

MFX_PY="/Users/angelo/monfxreplay-python/.venv/bin/python"  # venv for ifvg/fomc runners
HUB_PY="/Users/angelo/jtnq-hub/.venv/bin/python"            # venv for straddle runner
HUB_DIR="/Users/angelo/jtnq-hub"
COSTS_DATA="$COSTS_REPO/public/data"
DEPLOY_DATA="$DEPLOY_WT/public/data"

LOG="/tmp/update_site_backtests.log"
DEADLINE_SECONDS=2400          # 40min hard wall-clock cap (real run ~3.5min, huge safety margin)
SCRIPT_START=$(date +%s)

# Discord secrets (gitignored) — reuse the news-pine cron env.
ENV_CRON="$HUB_DIR/.env.cron"
if [[ -f "$ENV_CRON" ]]; then
    set -a; source "$ENV_CRON"; set +a
fi
MENTION="<@${ANGELO_DISCORD_ID:-}>"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

discord() {
    [[ -z "${DISCORD_WEBHOOK:-}" ]] && return 0
    local msg="$1"
    local payload
    payload=$(python3 -c 'import json,sys; print(json.dumps({"content": sys.argv[1], "allowed_mentions": {"users": [sys.argv[2]]}}))' "$msg" "${ANGELO_DISCORD_ID:-}")
    curl -s -H "Content-Type: application/json" -X POST -d "$payload" "$DISCORD_WEBHOOK" >/dev/null || true
}

check_deadline() {
    local now elapsed
    now=$(date +%s)
    elapsed=$((now - SCRIPT_START))
    if (( elapsed > DEADLINE_SECONDS )); then
        log "  FATAL — global deadline ${DEADLINE_SECONDS}s exceeded (elapsed ${elapsed}s). Aborting."
        discord "${MENTION} ❌ **update_site_backtests** — global deadline exceeded (${elapsed}s), aborted."
        exit 1
    fi
}

# Run a python runner with timing + try/catch. $1=label, rest=command.
WARN_COUNT=0
run_runner() {
    local label="$1"; shift
    local start end ec
    check_deadline
    log "Runner: $label"
    start=$(date +%s)
    if "$@" >>"$LOG" 2>&1; then ec=0; else ec=$?; fi
    end=$(date +%s)
    if (( ec == 0 )); then
        log "  OK — $label ($((end-start))s)"
    else
        WARN_COUNT=$((WARN_COUNT+1))
        log "  WARN — $label exit=$ec ($((end-start))s)"
        discord "${MENTION} ⚠️ **update_site_backtests** — runner \`$label\` failed (exit $ec). Batch continues. See \`$LOG\`."
    fi
}

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------
: > "$LOG"
log "=== update_site_backtests START (DRY_RUN=$DRY_RUN) ==="

# --- Step 1: prepare the deploy worktree on main -----------------------------
log "Step 1: prepare deploy worktree ($DEPLOY_WT on main)"
if [[ "$DRY_RUN" == "0" ]]; then
    if [[ -d "$DEPLOY_WT/.git" || -f "$DEPLOY_WT/.git" ]]; then
        log "  worktree exists → checkout main + pull"
        git -C "$DEPLOY_WT" checkout main >>"$LOG" 2>&1 || true
        git -C "$DEPLOY_WT" pull origin main >>"$LOG" 2>&1 || log "  WARN — pull failed (continuing with local state)"
    else
        log "  worktree missing → git worktree add"
        if ! git -C "$SITE_REPO" worktree add "$DEPLOY_WT" main >>"$LOG" 2>&1; then
            # main worktree may already be checked out elsewhere, or branch missing → try from origin/main
            git -C "$SITE_REPO" fetch origin main >>"$LOG" 2>&1 || true
            git -C "$SITE_REPO" worktree add "$DEPLOY_WT" -B main origin/main >>"$LOG" 2>&1 \
                || { log "  FATAL — could not create worktree"; discord "${MENTION} ❌ **update_site_backtests** — worktree creation failed."; exit 1; }
        fi
        git -C "$DEPLOY_WT" pull origin main >>"$LOG" 2>&1 || true
    fi
else
    log "  [DRY_RUN] would run:"
    log "  [DRY_RUN]   if worktree exists: git -C $DEPLOY_WT checkout main && git -C $DEPLOY_WT pull origin main"
    log "  [DRY_RUN]   else:              git -C $SITE_REPO worktree add $DEPLOY_WT main  (fallback: -B main origin/main)"
    log "  [DRY_RUN]   then:              git -C $DEPLOY_WT pull origin main"
    # In dry-run, target the costs repo's data dir for the copy-count proof (worktree not created).
    DEPLOY_DATA="$COSTS_DATA"
fi

# --- Step 2: ifvg/fomc runners (write to site-costs/public/data, hardcoded) --
log "Step 2: ifvg/fomc runners (output → $COSTS_DATA, hardcoded)"
cd "$COSTS_REPO" || { log "FATAL — cannot cd $COSTS_REPO"; exit 1; }
run_runner "NQ 10y all events"     "$MFX_PY" "$COSTS_REPO/scripts/run_nq_10y_all_events.py"
run_runner "ES 10y all events"     "$MFX_PY" "$COSTS_REPO/scripts/run_es_10y_all_events.py"
run_runner "Metals(GC) 10y events" "$MFX_PY" "$COSTS_REPO/scripts/run_metals_10y_all_events.py"
run_runner "SI 10y all events"     "$MFX_PY" "$COSTS_REPO/scripts/run_si_10y_all_events.py"
run_runner "FOMC 10y detailed"     "$MFX_PY" "$COSTS_REPO/scripts/run_fomc_10y.py"

# --- Step 3: straddle runner (writes into the worktree directly via env var) --
log "Step 3: straddle runner (output → \$JTNQ_SITE_ROOT/public/data)"
if [[ "$DRY_RUN" == "0" ]]; then
    run_runner "News straddles (70 JSON)" env "JTNQ_SITE_ROOT=$DEPLOY_WT" "$HUB_PY" "$HUB_DIR/scripts/run_all_news_straddles.py"
else
    # In dry-run, write straddles to a temp dir so the runner is genuinely exercised
    # without touching any real site clone or the worktree.
    STRADDLE_TMP="/tmp/update_site_backtests_straddle_dry/$(date +%s)"
    mkdir -p "$STRADDLE_TMP/public/data"
    log "  [DRY_RUN] straddle output → $STRADDLE_TMP/public/data (real clone untouched)"
    run_runner "News straddles (70 JSON) [dry tmp]" env "JTNQ_SITE_ROOT=$STRADDLE_TMP" "$HUB_PY" "$HUB_DIR/scripts/run_all_news_straddles.py"
    STRADDLE_COUNT=$(find "$STRADDLE_TMP/public/data" -name "*-straddle*.json" 2>/dev/null | grep -vc _backup || echo 0)
    log "  [DRY_RUN] straddle produced $STRADDLE_COUNT JSON in tmp"
fi

# --- Step 4: copy ifvg/fomc JSON into the worktree ---------------------------
# All ifvg/fomc regenerated files match the single glob *ifvg-smt*.json
# (per-event NQ/ES/GC/SI, *_gc, *-es, *-si-vs-gc, *-trade-prices, the combined
#  nq/es/gc-ifvg-smt.json, and fomc-ifvg-smt*). Verified: 83 files, all match.
log "Step 4: copy ifvg/fomc JSON → $DEPLOY_DATA"
COPY_COUNT=0
if [[ "$DRY_RUN" == "0" ]]; then
    mkdir -p "$DEPLOY_DATA"
    shopt -s nullglob
    for f in "$COSTS_DATA"/*ifvg-smt*.json; do
        cp -f "$f" "$DEPLOY_DATA/" && COPY_COUNT=$((COPY_COUNT+1))
    done
    shopt -u nullglob
    log "  copied $COPY_COUNT ifvg/fomc JSON"
else
    COPY_COUNT=$(find "$COSTS_DATA" -name "*ifvg-smt*.json" 2>/dev/null | wc -l | tr -d ' ')
    log "  [DRY_RUN] would copy $COPY_COUNT ifvg/fomc JSON ($COSTS_DATA/*ifvg-smt*.json → $DEPLOY_DATA/)"
fi

# --- Step 5: git add + commit + push (PROD) ----------------------------------
log "Step 5: git commit + push (main)"
COMMIT_STATUS="skipped (DRY_RUN)"
CHANGED=0
if [[ "$DRY_RUN" == "0" ]]; then
    cd "$DEPLOY_WT" || { log "FATAL — cannot cd $DEPLOY_WT"; exit 1; }
    CUR_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$CUR_BRANCH" != "main" ]]; then
        COMMIT_STATUS="skipped (not on main: $CUR_BRANCH)"
        log "  SKIP — worktree not on main ($CUR_BRANCH)"
    else
        # Never stage the straddle backup subdir the runner may create.
        git rm -r --cached --quiet "public/data/_backup_pre_5asset" 2>/dev/null || true
        CHANGED=$(git status --porcelain public/data | grep -v '_backup_pre_5asset' | wc -l | tr -d ' ')
        if (( CHANGED > 0 )); then
            git add public/data
            git reset -q -- "public/data/_backup_pre_5asset" 2>/dev/null || true
            if git -c user.name="site-backtest cron" -c user.email="cron@jacktradesnq.local" \
                 commit -m "data: weekly site backtest regen $(date '+%Y-%m-%d')" >>"$LOG" 2>&1; then
                # Rebase on origin first — a concurrent session may have pushed during the ~4min run.
                git pull --rebase origin main >>"$LOG" 2>&1 || log "  WARN — rebase before push failed (trying push anyway)"
                if git push origin main >>"$LOG" 2>&1; then
                    COMMIT_STATUS="committed + pushed ($CHANGED files)"
                    log "  OK — committed + pushed ($CHANGED files)"
                else
                    COMMIT_STATUS="committed (push failed)"
                    log "  WARN — commit OK but push failed"
                    discord "${MENTION} ⚠️ **update_site_backtests** — commit OK but \`git push\` failed (rebase+retry exhausted)."
                fi
            else
                COMMIT_STATUS="commit failed"
                log "  WARN — commit failed"
            fi
        else
            COMMIT_STATUS="no changes"
            log "  SKIP — no file changes in public/data"
        fi
    fi
else
    log "  [DRY_RUN] would run (in $DEPLOY_WT):"
    log "  [DRY_RUN]   git status --porcelain public/data   # gate"
    log "  [DRY_RUN]   git add public/data"
    log "  [DRY_RUN]   git -c user.name='site-backtest cron' -c user.email='cron@jacktradesnq.local' commit -m 'data: weekly site backtest regen $(date '+%Y-%m-%d')'"
    log "  [DRY_RUN]   git push origin main"
fi

# --- Step 6: Discord heartbeat (always) --------------------------------------
ELAPSED=$(( $(date +%s) - SCRIPT_START ))
if [[ "$DRY_RUN" == "0" ]]; then
    discord "${MENTION} ✅ **update_site_backtests DONE** — ${WARN_COUNT} runner warning(s), ${COPY_COUNT} ifvg/fomc JSON copied. Git: ${COMMIT_STATUS}. Took ${ELAPSED}s."
else
    log "  [DRY_RUN] heartbeat skipped (would post: DONE, ${WARN_COUNT} warns, ${COPY_COUNT} JSON, Git: ${COMMIT_STATUS}, ${ELAPSED}s)"
fi
log "=== update_site_backtests DONE (warns=$WARN_COUNT, copy=$COPY_COUNT, git=$COMMIT_STATUS, ${ELAPSED}s) ==="
