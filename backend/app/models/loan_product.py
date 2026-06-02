import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Numeric, String, Text

from app.db.base import Base


class LoanProduct(Base):
    __tablename__ = "loan_products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=False)
    interest_rate = Column(Numeric(5, 2), nullable=False)
    minimum_income = Column(Numeric(12, 2), nullable=False)
    maximum_amount = Column(Numeric(12, 2), nullable=False)
    minimum_tenure = Column(Numeric(5, 0), nullable=False)
    maximum_tenure = Column(Numeric(5, 0), nullable=False)
    eligibility_rules = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
