
from datetime import date, datetime
from pydantic import BaseModel, Field


# =========================================
# Project
# =========================================

class ProjectCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    status: str = "planning"


class ProjectResponse(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    status: str

    class Config:
        from_attributes = True


# =========================================
# Task
# =========================================

class TaskCreate(BaseModel):
    project_id: int
    parent_task_id: int | None = None

    code: str
    name: str
    description: str | None = None

    status: str = "not_started"
    priority: str = "medium"
    progress_type: str = "manual"
    include_in_progress: bool = True

    planned_start: date | None = None
    planned_finish: date | None = None

    actual_start: date | None = None
    actual_finish: date | None = None

    progress: int = Field(
        default=0,
        ge=0,
        le=100,
    )

    
    weight: float = Field(
        default=100,
        ge=0,
        le=100,
    )

    notes: str | None = None


class TaskUpdate(BaseModel):
    parent_task_id: int | None = None

    code: str | None = None
    name: str | None = None
    description: str | None = None

    status: str | None = None
    priority: str | None = None
    progress_type: str | None = None
    include_in_progress: bool | None = None

    planned_start: date | None = None
    planned_finish: date | None = None

    actual_start: date | None = None
    actual_finish: date | None = None

    progress: int | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    weight: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    notes: str | None = None

class TaskResponse(BaseModel):
    id: int
    project_id: int
    parent_task_id: int | None = None

    code: str
    name: str
    description: str | None = None

    status: str
    priority: str
    progress_type: str
    include_in_progress: bool

    planned_start: date | None = None
    planned_finish: date | None = None

    actual_start: date | None = None
    actual_finish: date | None = None

    progress: int
    weight: float

    notes: str | None = None

    class Config:
        from_attributes = True


# =========================================
# Task Quantity
# =========================================

class TaskQuantityCreate(BaseModel):
    task_id: int
    unit: str

    original_quantity: float = Field(
        default=0,
        ge=0,
    )

    planned_quantity: float = Field(
        default=0,
        ge=0,
    )

    actual_quantity: float = Field(
        default=0,
        ge=0,
    )


class TaskQuantityResponse(BaseModel):
    id: int
    task_id: int
    unit: str

    original_quantity: float
    planned_quantity: float
    actual_quantity: float

    class Config:
        from_attributes = True


class TaskQuantityUpdate(BaseModel):
    unit: str | None = None

    original_quantity: float | None = Field(
        default=None,
        ge=0,
    )

    planned_quantity: float | None = Field(
        default=None,
        ge=0,
    )

    actual_quantity: float | None = Field(
        default=None,
        ge=0,
    )


# =========================================
# Task Progress
# =========================================

class TaskProgressResponse(BaseModel):
    task_id: int
    progress_type: str

    planned_quantity: float | None = None
    actual_quantity: float | None = None

    progress: float

    quantity_variance: float | None = None

# =========================================
# Weighted Task Progress
# =========================================

class WeightedProgressChildResponse(BaseModel):
    task_id: int
    task_name: str

    progress: float
    weight: float
    contribution: float


class WeightedProgressResponse(BaseModel):
    task_id: int
    task_name: str
    progress_type: str

    progress: float
    total_weight: float

    children: list[WeightedProgressChildResponse]

    # =========================================
# Project Progress
# =========================================

class ProjectProgressChildResponse(BaseModel):
    task_id: int
    task_name: str

    progress: float
    weight: float
    contribution: float


class ProjectProgressResponse(BaseModel):
    project_id: int
    project_name: str

    progress: float
    total_weight: float

    children: list[ProjectProgressChildResponse]

# =========================================
# Weight Validation
# =========================================

class WeightValidationResponse(BaseModel):
    task_id: int
    task_name: str

    total_weight: float
    is_valid: bool    
# =========================================
# Task Quantity History
# =========================================

class TaskQuantityHistoryResponse(BaseModel):
    id: int
    task_quantity_id: int

    previous_quantity: float
    recorded_quantity: float
    quantity_change: float

    recorded_at: datetime

    class Config:
        from_attributes = True

# =========================================
# Task Progress History
# =========================================

class TaskProgressHistoryResponse(BaseModel):
    id: int
    task_id: int

    previous_progress: float
    recorded_progress: float
    progress_change: float

    recorded_at: datetime

    class Config:
        from_attributes = True

# =========================================
# WBS Tree
# =========================================

class WBSTaskResponse(BaseModel):
    id: int
    project_id: int
    parent_task_id: int | None = None

    code: str
    name: str

    status: str
    priority: str
    progress_type: str

    progress: float
    weight: float

    include_in_progress: bool

    children: list["WBSTaskResponse"] = []


class ProjectWBSResponse(BaseModel):
    project_id: int
    project_name: str

    tasks: list[WBSTaskResponse]
