from flask import Blueprint, request, jsonify
from app.utils.auth import admin_required
from app.models.setting import Setting
from app.models.group import Group
from app import db

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/', methods=['GET'])
@admin_required()
def get_all_settings():
    """Return all settings as a list."""
    rows = Setting.query.order_by(Setting.key).all()
    return jsonify({
        'success': True,
        'settings': [r.to_dict() for r in rows],
    }), 200


@settings_bp.route('/attendance-window', methods=['GET'])
@admin_required()
def get_attendance_window():
    """Return the attendance-window settings.

    Pass ?group_id=X to get group-specific overrides.  The response includes
    a ``has_custom`` boolean so the frontend knows whether this group has its
    own time-slot or is inheriting from global defaults.
    """
    group_id = request.args.get('group_id', type=int)
    window = Setting.get_attendance_window_settings(group_id=group_id)
    return jsonify({'success': True, **window}), 200


@settings_bp.route('/attendance-window', methods=['PUT'])
@admin_required()
def update_attendance_window():
    """Update one or more attendance-window settings.

    Pass ?group_id=X to save group-specific overrides.
    Accepts JSON body with any of:
      window_start, window_end, late_end, late_policy
    """
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400

    group_id = request.args.get('group_id', type=int)
    suffix = f':group_{group_id}' if group_id else ''

    KEY_MAP = {
        'window_start': 'ATTENDANCE_WINDOW_START',
        'window_end':   'ATTENDANCE_WINDOW_END',
        'late_end':     'ATTENDANCE_LATE_END',
        'late_policy':  'ATTENDANCE_LATE_POLICY',
    }

    updated = []
    for field, db_key in KEY_MAP.items():
        if field in data and data[field] is not None:
            val = str(data[field]).strip()

            # Validate HH:MM format for time fields
            if field != 'late_policy':
                parts = val.split(':')
                if len(parts) != 2:
                    return jsonify({'success': False, 'message': f'Invalid time format for {field}: use HH:MM'}), 400
                try:
                    h, m = int(parts[0]), int(parts[1])
                    if not (0 <= h <= 23 and 0 <= m <= 59):
                        raise ValueError
                except ValueError:
                    return jsonify({'success': False, 'message': f'Invalid time value for {field}: {val}'}), 400
            else:
                if val not in ('late', 'rejected'):
                    return jsonify({'success': False, 'message': 'late_policy must be "late" or "rejected"'}), 400

            Setting.set(f'{db_key}{suffix}', val)
            updated.append(field)

    if not updated:
        return jsonify({'success': False, 'message': 'No valid fields provided'}), 400

    # Return the refreshed state
    window = Setting.get_attendance_window_settings(group_id=group_id)
    return jsonify({
        'success': True,
        'message': f'Updated: {", ".join(updated)}',
        **window,
    }), 200


@settings_bp.route('/attendance-window', methods=['DELETE'])
@admin_required()
def delete_group_attendance_window():
    """Delete group-specific attendance-window overrides.

    Pass ?group_id=X to specify which group's overrides to remove.
    The group will then fall back to the global time window.
    """
    group_id = request.args.get('group_id', type=int)
    if not group_id:
        return jsonify({'success': False, 'message': 'group_id is required'}), 400

    suffix = f':group_{group_id}'
    keys_to_delete = [
        f'ATTENDANCE_WINDOW_START{suffix}',
        f'ATTENDANCE_WINDOW_END{suffix}',
        f'ATTENDANCE_LATE_END{suffix}',
        f'ATTENDANCE_LATE_POLICY{suffix}',
    ]

    deleted = 0
    for key in keys_to_delete:
        row = Setting.query.filter_by(key=key).first()
        if row:
            db.session.delete(row)
            deleted += 1

    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'Removed custom time window ({deleted} settings deleted)',
    }), 200


@settings_bp.route('/default-group', methods=['GET'])
@admin_required()
def get_default_group():
    """Return the default group/section setting."""
    group_id = Setting.get_default_group_id()
    group_name = None
    if group_id:
        group = Group.query.get(int(group_id)) if group_id.isdigit() else None
        group_name = group.name if group else None
    return jsonify({
        'success': True,
        'default_group_id': group_id,
        'default_group_name': group_name,
    }), 200


@settings_bp.route('/default-group', methods=['PUT'])
@admin_required()
def update_default_group():
    """Update the default group/section setting."""
    data = request.get_json()
    if data is None:
        return jsonify({'success': False, 'message': 'No data provided'}), 400

    group_id = data.get('default_group_id', '')

    # Validate that group exists (if not clearing)
    if group_id and str(group_id) != '':
        group = Group.query.get(int(group_id)) if str(group_id).isdigit() else None
        if not group:
            return jsonify({'success': False, 'message': f'Group with id {group_id} not found'}), 404
        Setting.set_default_group_id(group_id)
        return jsonify({
            'success': True,
            'message': f'Default group set to "{group.name}"',
            'default_group_id': str(group.id),
            'default_group_name': group.name,
        }), 200
    else:
        Setting.set_default_group_id('')
        return jsonify({
            'success': True,
            'message': 'Default group cleared',
            'default_group_id': '',
            'default_group_name': None,
        }), 200
