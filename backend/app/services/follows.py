from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.follow import Follow
from app.models.user import User


class FollowError(ValueError):
    """Invalid follow action (e.g. following yourself)."""


def is_following(db: Session, follower_id: UUID, followee_id: UUID) -> bool:
    return (
        db.query(Follow.id)
        .filter(Follow.follower_id == follower_id, Follow.followee_id == followee_id)
        .first()
        is not None
    )


def follower_count(db: Session, user_id: UUID) -> int:
    return db.query(Follow).filter(Follow.followee_id == user_id).count()


def following_count(db: Session, user_id: UUID) -> int:
    return db.query(Follow).filter(Follow.follower_id == user_id).count()


def follow_user(db: Session, follower: User, followee: User) -> Follow:
    if follower.id == followee.id:
        raise FollowError("You cannot follow yourself")

    existing = (
        db.query(Follow)
        .filter(Follow.follower_id == follower.id, Follow.followee_id == followee.id)
        .first()
    )
    if existing:
        return existing

    row = Follow(follower_id=follower.id, followee_id=followee.id)
    db.add(row)
    db.flush()
    return row


def unfollow_user(db: Session, follower: User, followee: User) -> None:
    row = (
        db.query(Follow)
        .filter(Follow.follower_id == follower.id, Follow.followee_id == followee.id)
        .first()
    )
    if row is None:
        return
    db.delete(row)
    db.flush()


def list_followers(db: Session, user_id: UUID) -> list[User]:
    rows = (
        db.query(User)
        .join(Follow, Follow.follower_id == User.id)
        .filter(Follow.followee_id == user_id, User.username.isnot(None))
        .order_by(Follow.created_at.desc())
        .all()
    )
    return rows


def list_following(db: Session, user_id: UUID) -> list[User]:
    rows = (
        db.query(User)
        .join(Follow, Follow.followee_id == User.id)
        .filter(Follow.follower_id == user_id, User.username.isnot(None))
        .order_by(Follow.created_at.desc())
        .all()
    )
    return rows


def followed_user_ids(db: Session, follower_id: UUID) -> list[UUID]:
    rows = db.query(Follow.followee_id).filter(Follow.follower_id == follower_id).all()
    return [row[0] for row in rows]
