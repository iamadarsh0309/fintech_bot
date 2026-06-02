from app.core.config import settings
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import chat, loan_product, user  # noqa: F401
from app.services.seed import seed_loan_products


def initialize_database() -> None:
    Base.metadata.create_all(bind=engine)
    if settings.seed_sample_data:
        db = SessionLocal()
        try:
            seed_loan_products(db)
        finally:
            db.close()
