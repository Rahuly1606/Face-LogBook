"""
Metrics API — recognition performance + accuracy analytics.

Endpoints
---------
GET  /api/v1/metrics                    Aggregate timing + precision/recall/F1.
GET  /api/v1/metrics/threshold-sweep    Iterate thresholds, return optimal point.
GET  /api/v1/metrics/logs               Paginated log browser.
DELETE /api/v1/metrics/logs/archive     Purge logs older than N days (admin-only).

Query-string filters accepted by GET /api/v1/metrics and GET /api/v1/metrics/logs:
  days      (int,  default 7)   — look-back window; 0 = all-time
  source    (str,  optional)    — filter by source field  (live|upload|eval|…)
  group_id  (int,  optional)    — filter by group

Precision / Recall / F1 notes
------------------------------
These are only computed when logs have actual_student_id populated (evaluation
or test-mode ingestion).  Live-attendance logs do not carry ground truth, so
the response indicates that via  "ground_truth_available": false.

Precision  =  TP / (TP + FP)   — of all predicted positives, how many were correct?
Recall     =  TP / (TP + FN)   — of all actual positives, how many did we find?
F1         =  2 * P * R / (P + R)

Threshold sweep notes
---------------------
For each candidate threshold the function re-evaluates the stored
similarity_score against actual_student_id to resimulate what the system
*would* have decided.  This lets you find the operating point that maximises
F1 (or any other metric) without re-running the face pipeline.

Indexing rationale
------------------
  created_at   — almost every query here is time-bounded; this index keeps
                 aggregate queries fast even at 1M+ rows.
  result       — GROUP BY result uses this.
  actual_student_id — evaluation queries filter on IS NOT NULL.
"""

from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import func

from app import db
from app.models.recognition_log import RecognitionLog
from app.utils.auth import admin_required

metrics_bp = Blueprint('metrics', __name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_query(days, source, group_id):
    """Return a filtered RecognitionLog query (no columns selected yet)."""
    q = RecognitionLog.query
    if days and days > 0:
        cutoff = datetime.utcnow() - timedelta(days=int(days))
        q = q.filter(RecognitionLog.created_at >= cutoff)
    if source:
        q = q.filter(RecognitionLog.source == source)
    if group_id:
        q = q.filter(RecognitionLog.group_id == int(group_id))
    return q


def _precision_recall_f1(tp: int, fp: int, fn: int) -> tuple:
    """Return (precision, recall, f1) as floats, avoiding division by zero."""
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1        = (2 * precision * recall / (precision + recall)
                 if (precision + recall) > 0 else 0.0)
    return round(precision, 4), round(recall, 4), round(f1, 4)


# ---------------------------------------------------------------------------
# GET /api/v1/metrics
# ---------------------------------------------------------------------------

@metrics_bp.route('', methods=['GET'])
def get_metrics():
    """
    Aggregate recognition performance + accuracy for the requested window.

    Returns timing averages, match distribution, and precision/recall/F1
    when ground-truth logs are available.
    """
    days     = request.args.get('days',     7,    type=int)
    source   = request.args.get('source',   None)
    group_id = request.args.get('group_id', None, type=int)

    q = _base_query(days, source, group_id)

    # ── Aggregate timing + similarity via a single DB round-trip ──────────────
    agg = q.with_entities(
        func.count(RecognitionLog.id),
        func.avg(RecognitionLog.detection_time_ms),
        func.avg(RecognitionLog.embedding_time_ms),
        func.avg(RecognitionLog.search_time_ms),
        func.avg(RecognitionLog.total_time_ms),
        func.avg(RecognitionLog.similarity_score),
        func.avg(RecognitionLog.confidence_ratio),
        func.min(RecognitionLog.total_time_ms),
        func.max(RecognitionLog.total_time_ms),
    ).one()

    (total, avg_det, avg_emb, avg_search, avg_total,
     avg_sim, avg_conf, min_total, max_total) = agg

    def _r(v, d=2):
        return round(float(v), d) if v is not None else None

    # ── Result distribution ────────────────────────────────────────────────────
    result_counts_raw = (
        q.with_entities(RecognitionLog.result, func.count(RecognitionLog.id))
         .group_by(RecognitionLog.result)
         .all()
    )
    result_distribution = {r: c for r, c in result_counts_raw}

    # ── Precision / Recall (only from labelled evaluation logs) ───────────────
    tp = result_distribution.get('TP', 0)
    fp = result_distribution.get('FP', 0)
    fn = result_distribution.get('FN', 0)
    labelled_total = tp + fp + fn

    ground_truth_available = labelled_total > 0
    precision, recall, f1 = _precision_recall_f1(tp, fp, fn) if ground_truth_available else (None, None, None)

    # ── Threshold in use ──────────────────────────────────────────────────────
    threshold_used = current_app.config.get('FACE_MATCH_THRESHOLD', 0.60)

    return jsonify({
        'window_days':               days if days > 0 else 'all_time',
        'total_attempts':            int(total or 0),

        # Timing averages (ms)
        'avg_detection_time_ms':     _r(avg_det),
        'avg_embedding_time_ms':     _r(avg_emb),
        'avg_search_time_ms':        _r(avg_search),
        'avg_total_time_ms':         _r(avg_total),
        'min_total_time_ms':         _r(min_total),
        'max_total_time_ms':         _r(max_total),

        # Match quality
        'average_similarity':        _r(avg_sim, 4),
        'average_confidence_ratio':  _r(avg_conf, 4),

        # Result distribution
        'result_distribution':       result_distribution,

        # Accuracy (when ground truth is available)
        'ground_truth_available':    ground_truth_available,
        'tp_count':                  tp,
        'fp_count':                  fp,
        'fn_count':                  fn,
        'precision':                 precision,
        'recall':                    recall,
        'f1_score':                  f1,

        # Configuration
        'current_threshold':         threshold_used,
    }), 200


# ---------------------------------------------------------------------------
# GET /api/v1/metrics/threshold-sweep
# ---------------------------------------------------------------------------

@metrics_bp.route('/threshold-sweep', methods=['GET'])
def threshold_sweep():
    """
    Re-evaluate stored evaluation logs at multiple thresholds.

    Requires logs with actual_student_id populated (evaluation / test mode).
    For each candidate threshold, determines what the system *would* have
    decided given the stored similarity_score and computes P / R / F1.

    Returns the full curve and the optimal threshold (maximum F1).

    Query params:
      days  (int, default 30)  — look-back window for evaluation logs
      step  (float, default 0.05) — step between thresholds (min 0.01)
    """
    days = request.args.get('days', 30, type=int)
    step = max(0.01, request.args.get('step', 0.05, type=float))

    # Fetch evaluation logs only (actual_student_id is populated)
    cutoff = datetime.utcnow() - timedelta(days=days) if days > 0 else None
    q = RecognitionLog.query.filter(
        RecognitionLog.actual_student_id.isnot(None),
        RecognitionLog.similarity_score.isnot(None),
    )
    if cutoff:
        q = q.filter(RecognitionLog.created_at >= cutoff)

    logs = q.with_entities(
        RecognitionLog.similarity_score,
        RecognitionLog.student_id_predicted,
        RecognitionLog.actual_student_id,
    ).all()

    if not logs:
        return jsonify({
            'error': 'No evaluation logs found.  Populate actual_student_id when calling '
                     'the recognition endpoint in test/eval mode.',
            'hint': 'Pass actual_id= to RecognitionLog.create() during evaluation runs.',
        }), 404

    # ── Sweep ─────────────────────────────────────────────────────────────────
    thresholds = []
    t = 0.30
    while t <= 0.95 + 1e-9:
        thresholds.append(round(t, 4))
        t += step

    curve = []
    best_f1 = -1.0
    optimal = None

    for thresh in thresholds:
        tp = fp = fn = 0
        for sim, pred_orig, actual in logs:
            # Resimulate match decision at this threshold
            simulated_prediction = pred_orig if sim >= thresh else None

            if actual is not None:
                if simulated_prediction is None:
                    fn += 1
                elif simulated_prediction == actual:
                    tp += 1
                else:
                    fp += 1

        precision, recall, f1 = _precision_recall_f1(tp, fp, fn)
        entry = {
            'threshold': thresh,
            'tp': tp, 'fp': fp, 'fn': fn,
            'precision': precision,
            'recall':    recall,
            'f1_score':  f1,
        }
        curve.append(entry)

        if f1 > best_f1:
            best_f1 = f1
            optimal = entry

    current_threshold = current_app.config.get('FACE_MATCH_THRESHOLD', 0.60)

    return jsonify({
        'evaluation_logs_used':   len(logs),
        'window_days':            days if days > 0 else 'all_time',
        'current_threshold':      current_threshold,
        'optimal_threshold':      optimal['threshold'] if optimal else None,
        'optimal_f1':             optimal['f1_score']  if optimal else None,
        'suggestion': (
            f"Set FACE_MATCH_THRESHOLD={optimal['threshold']} to maximise F1={optimal['f1_score']}"
            if optimal else 'Insufficient data'
        ),
        'curve': curve,
    }), 200


# ---------------------------------------------------------------------------
# GET /api/v1/metrics/logs
# ---------------------------------------------------------------------------

@metrics_bp.route('/logs', methods=['GET'])
@admin_required()
def get_logs():
    """
    Paginated list of raw recognition log entries.

    Query params:
      page      (int, default 1)
      per_page  (int, default 50, max 200)
      days      (int, default 7)
      source    (str, optional)
      group_id  (int, optional)
      result    (str, optional) — filter by exact result label (TP/FP/FN/…)
    """
    page     = max(1,   request.args.get('page',     1,   type=int))
    per_page = min(200, request.args.get('per_page', 50,  type=int))
    days     = request.args.get('days',     7,    type=int)
    source   = request.args.get('source',   None)
    group_id = request.args.get('group_id', None, type=int)
    result   = request.args.get('result',   None)

    q = _base_query(days, source, group_id)
    if result:
        q = q.filter(RecognitionLog.result == result.upper())

    q = q.order_by(RecognitionLog.created_at.desc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'logs':       [log.to_dict() for log in pagination.items],
        'total':      pagination.total,
        'page':       pagination.page,
        'per_page':   pagination.per_page,
        'pages':      pagination.pages,
        'has_next':   pagination.has_next,
        'has_prev':   pagination.has_prev,
    }), 200


# ---------------------------------------------------------------------------
# DELETE /api/v1/metrics/logs/archive
# ---------------------------------------------------------------------------

@metrics_bp.route('/logs/archive', methods=['DELETE'])
@admin_required()
def archive_logs():
    """
    Delete recognition logs older than *older_than_days* days.

    Log storage strategy:
      - Keep the last 90 days for threshold tuning.
      - Archive (delete here; export to cold storage externally) older rows.
      - Never store the raw face images or embeddings in logs — only scores.

    Query params:
      older_than_days (int, required, min 30)
    """
    older_than_days = request.args.get('older_than_days', type=int)
    if not older_than_days or older_than_days < 30:
        return jsonify({
            'error': 'older_than_days must be an integer >= 30',
        }), 400

    cutoff = datetime.utcnow() - timedelta(days=older_than_days)

    try:
        deleted = (
            RecognitionLog.query
            .filter(RecognitionLog.created_at < cutoff)
            .delete(synchronize_session=False)
        )
        db.session.commit()
        current_app.logger.info(
            f'Archived {deleted} recognition logs older than {older_than_days} days '
            f'(cutoff={cutoff.date()})'
        )
        return jsonify({
            'deleted_count':  deleted,
            'cutoff_date':    cutoff.date().isoformat(),
            'older_than_days': older_than_days,
        }), 200

    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(f'Log archive failed: {exc}')
        return jsonify({'error': str(exc)}), 500
