
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    Numeric,
    Float,
    DateTime,
    Boolean,
)
from datetime import datetime

from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)

    code = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    name = Column(
        String(200),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="planning",
    )


class Task(Base):
    __tablename__ = "tasks"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    project_id = Column(
        Integer,
        ForeignKey("projects.id"),
        nullable=False,
        index=True,
    )

    parent_task_id = Column(
        Integer,
        ForeignKey("tasks.id"),
        nullable=True,
        index=True,
    )

    code = Column(
        String(50),
        nullable=False,
    )

    name = Column(
        String(200),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="not_started",
    )

    priority = Column(
        String(50),
        nullable=False,
        default="medium",
    )

    planned_start = Column(
        String(10),
        nullable=True,
    )

    planned_finish = Column(
        String(10),
        nullable=True,
    )

    actual_start = Column(
        String(10),
        nullable=True,
    )

    actual_finish = Column(
        String(10),
        nullable=True,
    )

    progress_type = Column(
        String(20),
        nullable=False,
        default="manual",
    )

    progress = Column(
        Integer,
        nullable=False,
        default=0,
    )

    # Weight of this task relative to its parent task
    weight = Column(
        Numeric(8, 3),
        nullable=False,
        default=100,
    )

    # Include this task in progress calculations
    include_in_progress = Column(
        Boolean,
        nullable=False,
        default=True,
    )
    
    notes = Column(
        Text,
        nullable=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "code",
            name="uq_task_project_code",
        ),
        CheckConstraint(
            "progress >= 0 AND progress <= 100",
            name="ck_task_progress_range",
        ),
        CheckConstraint(
            "weight >= 0 AND weight <= 100",
            name="ck_task_weight_range",
        ),
    )

# =========================================
# Task Progress History
# =========================================

class TaskProgressHistory(Base):
    __tablename__ = "task_progress_history"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    task_id = Column(
        Integer,
        ForeignKey("tasks.id"),
        nullable=False,
        index=True,
    )

    previous_progress = Column(
        Float,
        nullable=False,
        default=0,
    )

    recorded_progress = Column(
        Float,
        nullable=False,
        default=0,
    )

    progress_change = Column(
        Float,
        nullable=False,
        default=0,
    )

    recorded_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    

class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    predecessor_task_id = Column(
        Integer,
        ForeignKey("tasks.id"),
        nullable=False,
        index=True,
    )

    successor_task_id = Column(
        Integer,
        ForeignKey("tasks.id"),
        nullable=False,
        index=True,
    )

    dependency_type = Column(
        String(10),
        nullable=False,
        default="FS",
    )

    lag_days = Column(
        Integer,
        nullable=False,
        default=0,
    )

    __table_args__ = (
        UniqueConstraint(
            "predecessor_task_id",
            "successor_task_id",
            name="uq_task_dependency",
        ),
    )


# =========================================
# Task Quantity
# =========================================

class TaskQuantity(Base):
    __tablename__ = "task_quantities"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    task_id = Column(
        Integer,
        ForeignKey("tasks.id"),
        nullable=False,
        index=True,
    )

    unit = Column(
        String(50),
        nullable=False,
    )

    original_quantity = Column(
        Numeric(18, 3),
        nullable=False,
        default=0,
    )

    planned_quantity = Column(
        Numeric(18, 3),
        nullable=False,
        default=0,
    )

    actual_quantity = Column(
        Numeric(18, 3),
        nullable=False,
        default=0,
    )


# =========================================
# Task Quantity History
# =========================================

class TaskQuantityHistory(Base):
    __tablename__ = "task_quantity_history"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    task_quantity_id = Column(
        Integer,
        ForeignKey("task_quantities.id"),
        nullable=False,
        index=True,
    )

    previous_quantity = Column(
        Float,
        nullable=False,
        default=0,
    )

    recorded_quantity = Column(
        Float,
        nullable=False,
        default=0,
    )

    quantity_change = Column(
        Float,
        nullable=False,
        default=0,
    )

    recorded_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
