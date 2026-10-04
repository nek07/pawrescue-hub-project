"""applications

Revision ID: 8e3d5b21c6fa
Revises: 4c1f0a9e2b7d
Create Date: 2026-10-04 15:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "8e3d5b21c6fa"
down_revision: str | None = "4c1f0a9e2b7d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

city = postgresql.ENUM(name="city", create_type=False)  # создан в 4c1f0a9e2b7d
housing = postgresql.ENUM("flat", "house", "rent", name="housing", create_type=False)
application_status = postgresql.ENUM(
    "sent",
    "meeting",
    "approved",
    "completed",
    "rejected",
    "withdrawn",
    name="application_status",
    create_type=False,
)

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    bind = op.get_bind()
    housing.create(bind, checkfirst=True)
    application_status.create(bind, checkfirst=True)

    op.create_table(
        "applications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("pet_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=16), nullable=False),
        sa.Column("city", city, nullable=False),
        sa.Column("housing", housing, nullable=False),
        sa.Column(
            "household", postgresql.ARRAY(sa.String(length=16)), server_default="{}", nullable=False
        ),
        sa.Column("about", sa.Text(), nullable=True),
        sa.Column("status", application_status, server_default="sent", nullable=False),
        sa.Column("consented_at", TS, nullable=False),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["pet_id"], ["pets.id"], name=op.f("fk_applications_pet_id_pets"), ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_applications_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_applications")),
    )
    op.create_index(op.f("ix_applications_pet_id"), "applications", ["pet_id"], unique=False)
    op.create_index(op.f("ix_applications_user_id"), "applications", ["user_id"], unique=False)
    op.create_index(
        "ix_applications_created_at_id", "applications", ["created_at", "id"], unique=False
    )
    op.create_index(
        "uq_applications_active_pet_user",
        "applications",
        ["pet_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('sent', 'meeting', 'approved')"),
    )


def downgrade() -> None:
    op.drop_table("applications")
    bind = op.get_bind()
    application_status.drop(bind, checkfirst=True)
    housing.drop(bind, checkfirst=True)
