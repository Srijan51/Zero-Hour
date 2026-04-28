import secrets
from sqlalchemy.orm import Session as DBSession
from app.models import Session


def create_token(db: DBSession, user_type: str, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    db.add(Session(token=token, user_type=user_type, user_id=user_id))
    db.commit()
    return token


def get_user_id(db: DBSession, token: str, user_type: str):
    row = db.query(Session).filter(
        Session.token == token,
        Session.user_type == user_type,
    ).first()
    return row.user_id if row else None


def delete_token(db: DBSession, token: str):
    db.query(Session).filter(Session.token == token).delete()
    db.commit()


def delete_all_tokens_for_user(db: DBSession, user_type: str, user_id: int):
    db.query(Session).filter(
        Session.user_type == user_type,
        Session.user_id == user_id,
    ).delete()
    db.commit()