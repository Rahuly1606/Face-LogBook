from datetime import datetime
from app import db
import pytz


class Setting(db.Model):
    """Key-value settings table for runtime-configurable options."""
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False, index=True)
    value = db.Column(db.String(500), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(pytz.timezone('Asia/Kolkata')),
        onupdate=lambda: datetime.now(pytz.timezone('Asia/Kolkata')),
    )

    def __repr__(self):
        return f"<Setting {self.key}={self.value}>"

    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'description': self.description,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    # ── helpers ────────────────────────────────────────────────────

    @staticmethod
    def get(key, default=None):
        """Fetch a single setting value by key. Returns *default* if not found."""
        row = Setting.query.filter_by(key=key).first()
        return row.value if row else default

    @staticmethod
    def set(key, value, description=None):
        """Create or update a setting."""
        row = Setting.query.filter_by(key=key).first()
        if row:
            row.value = value
            if description is not None:
                row.description = description
        else:
            row = Setting(key=key, value=value, description=description)
            db.session.add(row)
        db.session.commit()
        return row

    @staticmethod
    def get_attendance_window_settings(group_id=None):
        """Return attendance-window settings as a dict.

        If *group_id* is supplied, look for group-specific overrides first
        (keys like ``ATTENDANCE_WINDOW_START:group_5``).  Falls back to the
        global keys, then to Flask config / hardcoded defaults.

        Returns an extra ``has_custom`` boolean so the frontend knows whether
        these are group-specific overrides or the global defaults.
        """
        from flask import current_app

        suffix = f':group_{group_id}' if group_id else ''
        has_custom = False

        if group_id:
            # Check if at least one group-specific key exists
            has_custom = Setting.get(f'ATTENDANCE_WINDOW_START{suffix}') is not None

        def _val(base_key):
            """Return group-specific value → global DB value → config → default."""
            if group_id:
                v = Setting.get(f'{base_key}{suffix}')
                if v is not None:
                    return v
            return (Setting.get(base_key)
                    or current_app.config.get(base_key, None))

        return {
            'window_start': _val('ATTENDANCE_WINDOW_START') or '09:00',
            'window_end':   _val('ATTENDANCE_WINDOW_END')   or '09:10',
            'late_end':     _val('ATTENDANCE_LATE_END')      or '09:30',
            'late_policy':  _val('ATTENDANCE_LATE_POLICY')   or 'late',
            'has_custom':   has_custom,
        }

    @staticmethod
    def get_default_group_id():
        """Return the default group/section ID (as string), or empty string if not set."""
        return Setting.get('DEFAULT_GROUP_ID', '')

    @staticmethod
    def set_default_group_id(group_id):
        """Persist the default group/section ID."""
        Setting.set('DEFAULT_GROUP_ID', str(group_id) if group_id else '',
                    description='Default group/section for attendance')

    @staticmethod
    def seed_defaults():
        """Seed default attendance-window settings if they don't exist yet."""
        from flask import current_app

        defaults = {
            'ATTENDANCE_WINDOW_START': (
                current_app.config.get('ATTENDANCE_WINDOW_START', '09:00'),
                'Attendance on-time window start (HH:MM IST)',
            ),
            'ATTENDANCE_WINDOW_END': (
                current_app.config.get('ATTENDANCE_WINDOW_END', '09:10'),
                'Attendance on-time window end (HH:MM IST)',
            ),
            'ATTENDANCE_LATE_END': (
                current_app.config.get('ATTENDANCE_LATE_END', '09:30'),
                'Late attendance cutoff time (HH:MM IST)',
            ),
            'ATTENDANCE_LATE_POLICY': (
                current_app.config.get('ATTENDANCE_LATE_POLICY', 'late'),
                'Policy after on-time window: "late" or "rejected"',
            ),
        }

        # Default group
        defaults['DEFAULT_GROUP_ID'] = ('', 'Default group/section for attendance')

        for key, (value, description) in defaults.items():
            existing = Setting.query.filter_by(key=key).first()
            if not existing:
                db.session.add(Setting(key=key, value=value, description=description))

        db.session.commit()
        current_app.logger.info("Attendance window default settings seeded.")
