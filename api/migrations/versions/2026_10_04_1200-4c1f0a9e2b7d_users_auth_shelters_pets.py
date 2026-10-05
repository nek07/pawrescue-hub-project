"""users, auth, shelters, pets

Revision ID: 4c1f0a9e2b7d
Revises:
Create Date: 2026-10-04 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "4c1f0a9e2b7d"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Enum'ы создаём явно один раз: city используется в трёх таблицах.
city = postgresql.ENUM("pavlodar", "astana", "almaty", name="city", create_type=False)
user_role = postgresql.ENUM("user", "volunteer", "moderator", name="user_role", create_type=False)
auth_provider = postgresql.ENUM(
    "google", "telegram", "dev", name="auth_provider", create_type=False
)
shelter_role = postgresql.ENUM("admin", "staff", name="shelter_role", create_type=False)
pet_kind = postgresql.ENUM("cat", "dog", name="pet_kind", create_type=False)
pet_sex = postgresql.ENUM("female", "male", name="pet_sex", create_type=False)
chip_status = postgresql.ENUM("none", "planned", "done", name="chip_status", create_type=False)
pet_status = postgresql.ENUM(
    "draft",
    "seeking",
    "needs_foster",
    "treatment",
    "reserved",
    "adopted",
    name="pet_status",
    create_type=False,
)
ENUMS = (city, user_role, auth_provider, shelter_role, pet_kind, pet_sex, chip_status, pet_status)

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    bind = op.get_bind()
    for enum in ENUMS:
        enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("role", user_role, server_default="user", nullable=False),
        sa.Column("city", city, nullable=True),
        sa.Column("phone", sa.String(length=16), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("verified_at", TS, nullable=True),
        sa.Column("blocked_at", TS, nullable=True),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )

    op.create_table(
        "auth_identities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("provider", auth_provider, nullable=False),
        sa.Column("provider_user_id", sa.String(length=255), nullable=False),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_auth_identities_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_auth_identities")),
        sa.UniqueConstraint(
            "provider", "provider_user_id", name=op.f("uq_auth_identities_provider")
        ),
    )
    op.create_index(
        op.f("ix_auth_identities_user_id"), "auth_identities", ["user_id"], unique=False
    )

    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("revoked_at", TS, nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_sessions_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_sessions_token_hash")),
    )
    op.create_index(op.f("ix_sessions_user_id"), "sessions", ["user_id"], unique=False)

    op.create_table(
        "shelters",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("city", city, nullable=False),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("about", sa.Text(), nullable=True),
        sa.Column("visit_hours", sa.String(length=120), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("cover_url", sa.String(length=500), nullable=True),
        sa.Column("verified_at", TS, nullable=True),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_shelters")),
    )

    op.create_table(
        "shelter_members",
        sa.Column("shelter_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", shelter_role, nullable=False),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["shelter_id"],
            ["shelters.id"],
            name=op.f("fk_shelter_members_shelter_id_shelters"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_shelter_members_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("shelter_id", "user_id", name=op.f("pk_shelter_members")),
    )
    op.create_index(
        op.f("ix_shelter_members_user_id"), "shelter_members", ["user_id"], unique=False
    )

    op.create_table(
        "pets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("kind", pet_kind, nullable=False),
        sa.Column("sex", pet_sex, nullable=False),
        sa.Column("breed", sa.String(length=80), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.Column("weight_kg", sa.Numeric(precision=4, scale=1), nullable=True),
        sa.Column("sterilized", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("vaccinated_at", sa.Date(), nullable=True),
        sa.Column("chip", chip_status, server_default="none", nullable=False),
        sa.Column("litter_trained", sa.Boolean(), nullable=True),
        sa.Column(
            "traits", postgresql.ARRAY(sa.String(length=32)), server_default="{}", nullable=False
        ),
        sa.Column("story_title", sa.String(length=160), nullable=True),
        sa.Column("story", sa.Text(), nullable=True),
        sa.Column("city", city, nullable=False),
        sa.Column("status", pet_status, server_default="draft", nullable=False),
        sa.Column("shelter_id", sa.Uuid(), nullable=True),
        sa.Column("volunteer_id", sa.Uuid(), nullable=True),
        sa.Column(
            "search",
            postgresql.TSVECTOR(),
            sa.Computed(
                "to_tsvector('russian'::regconfig, "
                "coalesce(name, '') || ' ' || coalesce(breed, '') || ' ' || coalesce(story, ''))",
                persisted=True,
            ),
            nullable=False,
        ),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "(shelter_id IS NULL) <> (volunteer_id IS NULL)", name=op.f("ck_pets_one_curator")
        ),
        sa.ForeignKeyConstraint(
            ["shelter_id"],
            ["shelters.id"],
            name=op.f("fk_pets_shelter_id_shelters"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["volunteer_id"],
            ["users.id"],
            name=op.f("fk_pets_volunteer_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pets")),
    )
    op.create_index("ix_pets_catalog", "pets", ["status", "city", "kind"], unique=False)
    op.create_index("ix_pets_created_at_id", "pets", ["created_at", "id"], unique=False)
    op.create_index("ix_pets_birth_date", "pets", ["birth_date"], unique=False)
    op.create_index("ix_pets_traits", "pets", ["traits"], unique=False, postgresql_using="gin")
    op.create_index("ix_pets_search", "pets", ["search"], unique=False, postgresql_using="gin")
    op.create_index(op.f("ix_pets_shelter_id"), "pets", ["shelter_id"], unique=False)
    op.create_index(op.f("ix_pets_volunteer_id"), "pets", ["volunteer_id"], unique=False)

    op.create_table(
        "pet_photos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("pet_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("card_url", sa.String(length=500), nullable=True),
        sa.Column("original_url", sa.String(length=500), nullable=True),
        sa.Column("position", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["pet_id"], ["pets.id"], name=op.f("fk_pet_photos_pet_id_pets"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pet_photos")),
    )
    op.create_index(op.f("ix_pet_photos_pet_id"), "pet_photos", ["pet_id"], unique=False)


def downgrade() -> None:
    op.drop_table("pet_photos")
    op.drop_table("pets")
    op.drop_table("shelter_members")
    op.drop_table("shelters")
    op.drop_table("sessions")
    op.drop_table("auth_identities")
    op.drop_table("users")
    bind = op.get_bind()
    for enum in reversed(ENUMS):
        enum.drop(bind, checkfirst=True)
