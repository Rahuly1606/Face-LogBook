"""
RecognitionLog — one row per face-recognition event.

Captures timing breakdowns, match quality, and outcome for every attempt:
  • Tune the similarity threshold from genuine vs. imposter score distributions.
  • Track latency over time; identify pipeline bottlenecks.
  • Identify students with consistently low confidence scores.
  • Measure Precision / Recall / F1 when actual_student_id is populated.

Result values
-------------
  MATCH           — live recognition hit (no ground truth)
  BELOW_THRESHOLD — live recognition miss (no ground truth)
  TP              — predicted == actual (evaluation mode)
  FP              — predicted != actual (evaluation mode)
  FN              — predicted is None, actual is known (evaluation mode)
  REJECTED        — pipeline rejected before threshold check
  NO_FACE         — detector found nothing
  ERROR           — pipeline exception

Confidence ratio = best_score − second_best_score
  > 0.10  → high confidence
  0.04–0.10 → medium
  < 0.04  → ambiguous / likely wrong

Indexing
--------
  student_id_predicted, actual_student_id — FK JOINs and per-student analytics
  created_at — time-range scans (dominant query pattern; critical at >100k rows)
"""
from datetime import datetime
from app import db


class RecognitionLog(db.Model):
    __tablename__ = 'recognition_logs'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    # ---------- Identity --------------------------------------------------
    # Predicted identity (None when below threshold / unrecognised)
    student_id_predicted = db.Column(
        db.String(50),
        db.ForeignKey('students.student_id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )

    # Ground-truth identity -- only populated in evaluation / test mode
    actual_student_id = db.Column(
        db.String(50),
        db.ForeignKey('students.student_id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )

    # ---------- Match quality --------------------------------------------
    similarity_score = db.Column(db.Float, nullable=True)
    second_best_score = db.Column(db.Float, nullable=True)
    confidence_ratio = db.Column(db.Float, nullable=True)    # best - second_best

    # ---------- Timing (milliseconds, Float for sub-ms precision) --------
    detection_time_ms = db.Column(db.Float, nullable=True)
    embedding_time_ms = db.Column(db.Float, nullable=True)
    search_time_ms    = db.Column(db.Float, nullable=True)
    total_time_ms     = db.Column(db.Float, nullable=True)

    # ---------- Config snapshot ------------------------------------------
    threshold = db.Column(db.Float, nullable=True)

    # ---------- Outcome --------------------------------------------------
    # TP | FP | FN | REJECTED | NO_FACE | ERROR | MATCH | BELOW_THRESHOLD
    result = db.Column(db.String(30), nullable=False, default='MATCH')

    # ---------- Context --------------------------------------------------
    source = db.Column(db.String(20), nullable=True)  # live|upload|register|eval
    group_id = db.Column(
        db.Integer, db.ForeignKey('groups.id', ondelete='SET NULL'),
        nullable=True, index=True
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        score_str = f'{self.similarity_score:.3f}' if self.similarity_score is not None else 'n/a'
        return (
            f"<RecognitionLog id={self.id} predicted={self.student_id_predicted} "
            f"score={score_str} result={self.result}>"
        )

    def to_dict(self) -> dict:
        return {
            'id':                   self.id,
            'student_id_predicted': self.student_id_predicted,
            'actual_student_id':    self.actual_student_id,
            'similarity_score':  round(self.similarity_score,  4) if self.similarity_score  is not None else None,
            'second_best_score': round(self.second_best_score, 4) if self.second_best_score is not None else None,
            'confidence_ratio':  round(self.confidence_ratio,  4) if self.confidence_ratio  is not None else None,
            'detection_time_ms': self.detection_time_ms,
            'embedding_time_ms': self.embedding_time_ms,
            'search_time_ms':    self.search_time_ms,
            'total_time_ms':     self.total_time_ms,
            'threshold':         self.threshold,
            'result':            self.result,
            'source':            self.source,
            'group_id':          self.group_id,
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }

    # ------------------------------------------------------------------
    # Factory helper
    # ------------------------------------------------------------------

    @classmethod
    def create(
        cls,
        *,
        predicted_id=None,
        actual_id=None,
        similarity_score=None,
        second_best_score=None,
        detection_ms=None,
        embedding_ms=None,
        search_ms=None,
        total_ms=None,
        threshold=None,
        result=None,
        source=None,
        group_id=None,
    ) -> 'RecognitionLog':
        """
        Build, persist (flush), and return a RecognitionLog.

        Result auto-derivation when *result* is omitted:
          - actual_id present -> TP / FP / FN based on predicted vs actual
          - actual_id absent  -> MATCH or BELOW_THRESHOLD
        """
        ratio = None
        if similarity_score is not None and second_best_score is not None:
            ratio = round(similarity_score - second_best_score, 4)

        if result is None:
            if actual_id is not None:
                if predicted_id is None:
                    result = 'FN'
                elif predicted_id == actual_id:
                    result = 'TP'
                else:
                    result = 'FP'
            else:
                result = 'MATCH' if predicted_id is not None else 'BELOW_THRESHOLD'

        log = cls(
            student_id_predicted=predicted_id,
            actual_student_id=actual_id,
            similarity_score=similarity_score,
            second_best_score=second_best_score,
            confidence_ratio=ratio,
            detection_time_ms=detection_ms,
            embedding_time_ms=embedding_ms,
            search_time_ms=search_ms,
            total_time_ms=total_ms,
            threshold=threshold,
            result=result,
            source=source,
            group_id=group_id,
        )

        try:
            db.session.add(log)
            db.session.flush()   # write within the current transaction
        except Exception:
            db.session.rollback()
            raise

        return log
