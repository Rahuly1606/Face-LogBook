"""
RegistrationLink model.

Each row represents a signed URL token that allows public self-registration
into a specific group.  Tokens are URL-safe, 256-bit random values (never
JWTs) so they cannot be forged without DB access.
"""
import secrets
from datetime import datetime, timedelta

from app import db


def _new_token() -> str:
    """Generate a cryptographically-strong, URL-safe 256-bit token (43 chars)."""
    return secrets.token_urlsafe(32)


class RegistrationLink(db.Model):
    __tablename__ = "registration_links"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(
        db.Integer, db.ForeignKey("groups.id"), nullable=False, index=True
    )
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    label = db.Column(db.String(100), nullable=True)          # optional human label
    expires_at = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_by = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    group = db.relationship(
        "Group",
        back_populates="registration_links",
    )

    def __repr__(self) -> str:
        return (
            f"<RegistrationLink id={self.id} "
            f"group_id={self.group_id} active={self.is_active}>"
        )

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def generate(
        cls,
        group_id: int,
        expiry_days: int = 7,
        created_by: int | None = None,
        label: str | None = None,
    ) -> tuple["RegistrationLink", str]:
        """
        Create a new, unsaved RegistrationLink.

        Returns (link_instance, raw_token).
        The raw_token is shown to the admin once; only the token is stored.
        """
        raw_token = _new_token()
        expires_at = datetime.utcnow() + timedelta(days=expiry_days)
        link = cls(
            group_id=group_id,
            token=raw_token,
            expires_at=expires_at,
            is_active=True,
            created_by=created_by,
            label=label,
        )
        return link, raw_token

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------

    @classmethod
    def get_valid(cls, raw_token: str) -> "RegistrationLink | None":
        """
        Return the link if the token is active and not expired; None otherwise.
        Auto-deactivates expired links as a side effect.
        """
        link = cls.query.filter_by(token=raw_token, is_active=True).first()
        if link is None:
            return None
        if link.expires_at < datetime.utcnow():
            link.is_active = False
            db.session.commit()
            return None
        return link

    # ------------------------------------------------------------------
    # Mutation helpers
    # ------------------------------------------------------------------

    def deactivate(self) -> None:
        self.is_active = False

    @property
    def is_expired(self) -> bool:
        return self.expires_at < datetime.utcnow()

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def to_dict(self, include_token: bool = False) -> dict:
        d = {
            "id": self.id,
            "group_id": self.group_id,
            "group_name": self.group.name if self.group else None,
            "label": self.label,
            "expires_at": self.expires_at.isoformat(),
            "is_active": self.is_active,
            "is_expired": self.is_expired,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_token:
            d["token"] = self.token
        return d
