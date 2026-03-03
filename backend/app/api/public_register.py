"""
Public self-registration API.

Routes (no authentication required):
    GET  /public/register/<token>   – validate token & return group info
    POST /public/register/<token>   – submit self-registration

Rate-limited via Flask-Limiter (defined in app/__init__.py).
"""
import base64
import os
import uuid
import logging

import cv2
import numpy as np
from flask import Blueprint, current_app, jsonify, request

from app import db, limiter
from app.models.group import Group
from app.models.registration_link import RegistrationLink
from app.models.student import Student
from app.services.face_service import FaceService

public_bp = Blueprint("public", __name__)
_face_service = FaceService()

# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #

_ALLOWED_MIME_PREFIXES = (
    "data:image/jpeg;base64,",
    "data:image/jpg;base64,",
    "data:image/png;base64,",
    "data:image/webp;base64,",
)


def _decode_base64_image(b64_string: str) -> tuple[bytes | None, str | None]:
    """
    Decode a base64 data-URL image string to raw bytes.
    Returns (bytes, None) on success, (None, error_message) on failure.
    """
    if not b64_string:
        return None, "No image provided."

    if not any(b64_string.startswith(p) for p in _ALLOWED_MIME_PREFIXES):
        return None, "Unsupported image format. Use JPEG or PNG."

    try:
        _, data = b64_string.split(",", 1)
        image_bytes = base64.b64decode(data)
    except Exception:
        return None, "Malformed base64 image data."

    max_bytes = current_app.config.get(
        "SELF_REGISTER_MAX_IMAGE_BYTES", 5 * 1024 * 1024
    )
    if len(image_bytes) > max_bytes:
        mb = max_bytes // (1024 * 1024)
        return None, f"Image too large. Maximum allowed size is {mb} MB."

    return image_bytes, None


def _save_photo(image_bytes: bytes, student_id: str) -> str | None:
    """Write image bytes to the uploads folder; return the file path or None."""
    try:
        upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
        os.makedirs(upload_folder, exist_ok=True)
        filename = f"sr_{student_id}_{uuid.uuid4().hex[:8]}.jpg"
        path = os.path.join(upload_folder, filename)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is not None:
            cv2.imwrite(path, img)
            return path
    except Exception as exc:
        current_app.logger.error(f"Failed to save photo for {student_id}: {exc}")
    return None


# --------------------------------------------------------------------------- #
# Routes                                                                       #
# --------------------------------------------------------------------------- #


@public_bp.route("/register/<token>", methods=["GET"])
@limiter.limit("30 per minute")
def validate_token(token: str):
    """
    Validate a registration token.

    Returns group info so the frontend can display "Registering for <group>".
    No sensitive data is exposed.
    """
    link = RegistrationLink.get_valid(token)
    if link is None:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "invalid_token",
                    "message": "This registration link is invalid or has expired.",
                }
            ),
            404,
        )

    group = Group.query.get(link.group_id)
    if group is None:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "group_not_found",
                    "message": "The group for this link no longer exists.",
                }
            ),
            404,
        )

    return (
        jsonify(
            {
                "success": True,
                "group_id": group.id,
                "group_name": group.name,
                "expires_at": link.expires_at.isoformat(),
            }
        ),
        200,
    )


@public_bp.route("/register/<token>", methods=["POST"])
@limiter.limit("5 per minute")
def self_register(token: str):
    """
    Process a student self-registration submission.

    Expected JSON body:
        {
            "name":      "Full Name",           // required
            "id_number": "STU12345",            // required, becomes student_id
            "image":     "data:image/jpeg;base64,/9j/..." // required
        }

    Returns HTTP 201 on success; 4xx on validation / business-logic errors.
    Duplicate-face check uses FAISS with SELF_REGISTER_DUPLICATE_THRESHOLD.
    """
    # ------------------------------------------------------------------ #
    # 1. Token validation                                                  #
    # ------------------------------------------------------------------ #
    link = RegistrationLink.get_valid(token)
    if link is None:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "invalid_token",
                    "message": "This registration link is invalid or has expired.",
                }
            ),
            403,
        )

    group = Group.query.get(link.group_id)
    if group is None:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "group_not_found",
                    "message": "The group for this link no longer exists.",
                }
            ),
            404,
        )

    # ------------------------------------------------------------------ #
    # 2. Input parsing & basic validation                                  #
    # ------------------------------------------------------------------ #
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"success": False, "message": "Invalid JSON body."}), 400

    name = (body.get("name") or "").strip()
    id_number = (body.get("id_number") or "").strip()
    image_b64 = body.get("image", "")

    if not name or len(name) < 2:
        return jsonify({"success": False, "message": "Name must be at least 2 characters."}), 400
    if len(name) > 100:
        return jsonify({"success": False, "message": "Name too long (max 100 characters)."}), 400

    if not id_number or len(id_number) < 2:
        return jsonify({"success": False, "message": "ID number must be at least 2 characters."}), 400
    if len(id_number) > 50:
        return jsonify({"success": False, "message": "ID number too long (max 50 characters)."}), 400

    if not image_b64:
        return jsonify({"success": False, "message": "Photo is required."}), 400

    # ------------------------------------------------------------------ #
    # 3. Duplicate ID check (allow multi-section, but not same section)   #
    # ------------------------------------------------------------------ #
    existing_student = Student.query.filter_by(student_id=id_number).first()
    if existing_student:
        # Check if student is already in THIS group
        student_groups = db.session.execute(
            db.text("SELECT group_id FROM student_groups WHERE student_id = :sid"),
            {"sid": id_number}
        ).fetchall()
        existing_group_ids = [row[0] for row in student_groups]
        
        if link.group_id in existing_group_ids:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "already_in_group",
                        "message": f"You are already registered in {group.name}.",
                    }
                ),
                409,
            )
        # Student exists but not in this group - will add them to this group later

    # ------------------------------------------------------------------ #
    # 4. Decode & validate image                                           #
    # ------------------------------------------------------------------ #
    image_bytes, img_error = _decode_base64_image(image_b64)
    if img_error:
        return jsonify({"success": False, "message": img_error}), 400

    # ------------------------------------------------------------------ #
    # 5. Face detection (single-face enforcement)                          #
    # ------------------------------------------------------------------ #
    if not _face_service.initialized:
        _face_service.initialize()

    embedding, face_error = _face_service.detect_face_for_registration(image_bytes)
    if face_error:
        _FACE_ERROR_MESSAGES = {
            "no_face": (
                "No face detected in your photo. "
                "Please ensure your face is clearly visible, well-lit, and not obscured."
            ),
            "multiple_faces": (
                "Multiple faces detected. "
                "Please take the photo alone and ensure no other faces are visible."
            ),
            "model_unavailable": (
                "Face recognition service is temporarily unavailable. "
                "Please try again in a few moments."
            ),
        }
        return (
            jsonify(
                {
                    "success": False,
                    "error": face_error,
                    "message": _FACE_ERROR_MESSAGES.get(
                        face_error, "Face verification failed. Please retake your photo."
                    ),
                }
            ),
            422,
        )

    # ------------------------------------------------------------------ #
    # 6. Duplicate face check via FAISS                                    #
    # ------------------------------------------------------------------ #
    dup_threshold = current_app.config.get("SELF_REGISTER_DUPLICATE_THRESHOLD", 0.60)
    matched_id, similarity_score = _face_service.match_face(embedding, threshold=dup_threshold)
    
    # Allow if matched face is the same student registering for another section
    if matched_id is not None and matched_id != id_number:
        current_app.logger.warning(
            "Self-registration BLOCKED — duplicate face: "
            f"submitted_id={id_number!r} matched_existing={matched_id!r} "
            f"similarity={similarity_score:.4f} threshold={dup_threshold}"
        )
        return (
            jsonify(
                {
                    "success": False,
                    "error": "duplicate_face",
                    "message": (
                        "This face is already registered with another ID. "
                        "Please contact your administrator if you believe this is an error."
                    ),
                }
            ),
            409,
        )

    # ------------------------------------------------------------------ #
    # 7. Persist photo (only for new students)                            #
    # ------------------------------------------------------------------ #
    photo_path = None
    if not existing_student:
        photo_path = _save_photo(image_bytes, id_number)

    # ------------------------------------------------------------------ #
    # 8. Create or update Student record                                   #
    # ------------------------------------------------------------------ #
    try:
        if existing_student:
            # Student already exists - just add them to this group
            db.session.execute(
                db.text("""
                    INSERT INTO student_groups (student_id, group_id, created_at)
                    VALUES (:sid, :gid, NOW())
                """),
                {"sid": id_number, "gid": link.group_id}
            )
            db.session.commit()
            
            current_app.logger.info(
                f"Self-registration: Added existing student {id_number!r} to group {group.name!r}"
            )
        else:
            # New student - create record and add to group
            student = Student(
                student_id=id_number,
                name=name,
                group_id=link.group_id,  # Legacy field for backward compatibility
                photo_path=photo_path,
            )
            student.set_embedding(embedding)
            db.session.add(student)
            db.session.flush()  # Ensure student is created before adding to junction table
            
            # Add to student_groups junction table
            db.session.execute(
                db.text("""
                    INSERT INTO student_groups (student_id, group_id, created_at)
                    VALUES (:sid, :gid, NOW())
                """),
                {"sid": id_number, "gid": link.group_id}
            )
            db.session.commit()
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(
            f"DB error during self-registration for id_number={id_number!r}: {exc}"
        )
        return (
            jsonify(
                {"success": False, "message": "Registration failed due to a server error. Please try again."}
            ),
            500,
        )

    # ------------------------------------------------------------------ #
    # 9. Invalidate FAISS cache so the new student is searchable          #
    # ------------------------------------------------------------------ #
    _face_service.invalidate_cache()

    current_app.logger.info(
        f"Self-registration SUCCESS: student_id={id_number!r} name={name!r} "
        f"group_id={link.group_id} group={group.name!r}"
    )

    return (
        jsonify(
            {
                "success": True,
                "message": "Registration successful! You have been enrolled.",
                "student_id": id_number,
                "name": name,
                "group_name": group.name,
            }
        ),
        201,
    )
