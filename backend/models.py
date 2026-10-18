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
    Date,
)
from datetime import datetime

from database import Base


# =========================================
# Project
# =========================================

class Project(Base):
    __tablename__ = "projects"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

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
        default="not_started",
    )

    execution_state = Column(
        String(30),
        nullable=False,
        default="not_evaluated",
    )

    priority = Column(
        String(50),
        nullable=False,
        default="medium",
    )

    # -----------------------------------------
    # Real project start date
    #
    # This can remain NULL during project setup.
    # Once the project actually starts, this date
    # becomes the calendar reference for the
    # relative project schedule.
    # -----------------------------------------

    start_date = Column(
        Date,
        nullable=True,
    )


# =========================================
# Task
# =========================================

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

    execution_state = Column(
    String(30),
    nullable=False,
    default="not_evaluated",
    )

    priority = Column(
        String(50),
        nullable=False,
        default="medium",
    )

    # -----------------------------------------
    # Relative project schedule
    #
    # These values are measured from project
    # Day 0, not from a calendar date.
    #
    # Example:
    #
    # planned_start_day = 0
    # planned_finish_day = 30
    #
    # means the task is planned from project
    # Day 0 through Day 30.
    # -----------------------------------------

    planned_start_day = Column(
        Integer,
        nullable=True,
    )

    planned_finish_day = Column(
        Integer,
        nullable=True,
    )

    # -----------------------------------------
    # Legacy / existing calendar plan
    #
    # Kept temporarily so existing project data
    # is not lost while the new relative schedule
    # is being introduced.
    # -----------------------------------------

    planned_start = Column(
        String(10),
        nullable=True,
    )

    planned_finish = Column(
        String(10),
        nullable=True,
    )

    # -----------------------------------------
    # Actual execution dates
    # -----------------------------------------

    actual_start = Column(
        String(10),
        nullable=True,
    )

    actual_finish = Column(
        String(10),
        nullable=True,
    )

    # -----------------------------------------
    # Progress
    # -----------------------------------------

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

    # -----------------------------------------
    # Weight
    # -----------------------------------------

    # Weight of this task relative to its parent
    weight = Column(
        Numeric(8, 3),
        nullable=False,
        default=100,
    )

    # -----------------------------------------
    # Progress inclusion
    # -----------------------------------------

    # Include this task in progress calculations
    include_in_progress = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    # -----------------------------------------
    # Notes
    # -----------------------------------------

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

        CheckConstraint(
            "planned_start_day IS NULL "
            "OR planned_start_day >= 0",
            name="ck_task_planned_start_day",
        ),

        CheckConstraint(
            "planned_finish_day IS NULL "
            "OR planned_finish_day >= 0",
            name="ck_task_planned_finish_day",
        ),

        CheckConstraint(
            "planned_start_day IS NULL "
            "OR planned_finish_day IS NULL "
            "OR planned_finish_day >= planned_start_day",
            name="ck_task_relative_schedule",
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


# =========================================
# Task Dependency
# =========================================
#
# Stores task-to-task dependencies used by the
# execution readiness and dependency management
# logic in main.py.
#
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
# Task Execution Constraints
# =========================================

class TaskExecutionConstraint(Base):
    __tablename__ = "task_execution_constraints"

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

    constraint_type = Column(
        String(50),
        nullable=False,
        default="other",
    )

    description = Column(
        Text,
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="open",
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    resolved_at = Column(
        DateTime,
        nullable=True,
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'resolved')",
            name="ck_task_execution_constraint_status",
        ),
        CheckConstraint(
            "length(trim(description)) > 0",
            name="ck_task_execution_constraint_description",
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

    # =========================================
# Task Execution Report
# =========================================

class TaskExecutionReport(Base):
    __tablename__ = "task_execution_reports"

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

    # Date of the execution report
    report_date = Column(
        Date,
        nullable=False,
        index=True,
    )

    # Quantity executed during this reporting period
    period_quantity = Column(
        Numeric(18, 3),
        nullable=False,
        default=0,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    __table_args__ = (
        UniqueConstraint(
            "task_id",
            "report_date",
            name="uq_task_execution_report_date",
        ),
        CheckConstraint(
            "period_quantity >= 0",
            name="ck_execution_report_quantity_nonnegative",
        ),
    )


# =========================================
# Task Execution Report History
# =========================================

class TaskExecutionReportHistory(Base):
    __tablename__ = "task_execution_report_history"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    report_id = Column(
        Integer,
        ForeignKey("task_execution_reports.id"),
        nullable=False,
        index=True,
    )

    previous_quantity = Column(
        Numeric(18, 3),
        nullable=False,
    )

    recorded_quantity = Column(
        Numeric(18, 3),
        nullable=False,
    )

    reason = Column(
        Text,
        nullable=False,
    )

    changed_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )


# =========================================
# Task Execution Baseline
# Preserves cumulative quantity recorded
# before periodic reporting was introduced.
# =========================================

class TaskExecutionBaseline(Base):
    __tablename__ = "task_execution_baselines"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    task_id = Column(
        Integer,
        ForeignKey("tasks.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    opening_quantity = Column(
        Numeric(18, 3),
        nullable=False,
        default=0,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    __table_args__ = (
        CheckConstraint(
            "opening_quantity >= 0",
            name="ck_execution_baseline_nonnegative",
        ),
    )
