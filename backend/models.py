from sqlalchemy import Column, Integer, String, Text
from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)

    code = Column(String(50), unique=True, nullable=False, index=True)

    name = Column(String(200), nullable=False)

    description = Column(Text, nullable=True)

    status = Column(String(50), nullable=False, default="planning")