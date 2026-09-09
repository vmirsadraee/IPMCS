
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, SessionLocal

from models import (
    Project,
    Task,
    TaskQuantity,
    TaskQuantityHistory,
    TaskProgressHistory,
)

from schemas import (
    ProjectCreate,
    ProjectResponse,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    TaskQuantityCreate,
    TaskQuantityResponse,
    TaskQuantityUpdate,
    TaskProgressResponse,
    TaskQuantityHistoryResponse,
    TaskProgressHistoryResponse,
    WeightedProgressResponse,
    WeightedProgressChildResponse,
    ProjectProgressChildResponse,
    ProjectProgressResponse,
    WeightValidationResponse,
)


app = FastAPI(title="IPMCS API")


# =========================================
# CORS
# =========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================
# Database
# =========================================

Base.metadata.create_all(bind=engine)


# =========================================
# Database Session
# =========================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# =========================================
# Calculate Task Progress - Recursive
# =========================================

def calculate_task_progress(
    task: Task,
    db: Session
) -> float:

    # -----------------------------------------
    # Manual Progress
    # -----------------------------------------

    if task.progress_type == "manual":
        return float(task.progress)

    # -----------------------------------------
    # Quantity Progress
    # -----------------------------------------

    if task.progress_type == "quantity":

        quantity = (
            db.query(TaskQuantity)
            .filter(TaskQuantity.task_id == task.id)
            .order_by(TaskQuantity.id.desc())
            .first()
        )

        if quantity is None:
            return 0

        planned = float(quantity.planned_quantity)
        actual = float(quantity.actual_quantity)

        if planned <= 0:
            return 0

        return min(
            (actual / planned) * 100,
            100
        )

    # -----------------------------------------
    # Weighted Progress - Recursive
    # -----------------------------------------

    if task.progress_type == "weighted":

        children = (
            db.query(Task)
            .filter(
                Task.parent_task_id == task.id,
                Task.include_in_progress.is_(True)
            )
            .order_by(Task.id)
            .all()
        )

        if not children:
            return 0

        # Total active child weight
        total_weight = sum(
            float(child.weight)
            for child in children
        )

        if round(total_weight, 3) != 100:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Child task weights must total 100. "
                    f"Task {task.id} total weight: "
                    f"{total_weight}"
                )
            )

        weighted_progress = 0

        for child in children:

            # Recursive calculation
            child_progress = calculate_task_progress(
                child,
                db
            )

            weighted_progress += (
                child_progress *
                float(child.weight) /
                100
            )

        return round(weighted_progress, 2)

    # -----------------------------------------
    # Unsupported Progress Type
    # -----------------------------------------

    raise HTTPException(
        status_code=400,
        detail=(
            "Unsupported progress_type. "
            "Allowed values are: "
            "manual, quantity, weighted"
        )
    )


# =========================================
# Root
# =========================================

@app.get("/")
def root():
    return {
        "message": "IPMCS Backend is running",
        "status": "ok"
    }


# =========================================
# Health
# =========================================

@app.get("/api/health")
def health():
    return {
        "status": "healthy"
    }


# =========================================
# Projects
# =========================================

# Get all projects
@app.get(
    "/api/projects",
    response_model=list[ProjectResponse]
)
def get_projects(
    db: Session = Depends(get_db)
):
    return (
        db.query(Project)
        .order_by(Project.id)
        .all()
    )


# Dashboard summary
@app.get("/api/dashboard/summary")
def dashboard_summary(
    db: Session = Depends(get_db)
):
    projects = db.query(Project).all()

    total_projects = len(projects)

    active_projects = sum(
        1
        for project in projects
        if project.status == "active"
    )

    planning_projects = sum(
        1
        for project in projects
        if project.status == "planning"
    )

    completed_projects = sum(
        1
        for project in projects
        if project.status == "completed"
    )

    on_hold_projects = sum(
        1
        for project in projects
        if project.status == "on_hold"
    )

    return {
        "total_projects": total_projects,
        "active_projects": active_projects,
        "planning_projects": planning_projects,
        "completed_projects": completed_projects,
        "on_hold_projects": on_hold_projects,
    }


# Create a new project
@app.post(
    "/api/projects",
    response_model=ProjectResponse
)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db)
):
    new_project = Project(
        code=project.code,
        name=project.name,
        description=project.description,
        status=project.status,
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return new_project


# Update an existing project
@app.put(
    "/api/projects/{project_id}",
    response_model=ProjectResponse
)
def update_project(
    project_id: int,
    project: ProjectCreate,
    db: Session = Depends(get_db)
):
    existing_project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if existing_project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    existing_project.code = project.code
    existing_project.name = project.name
    existing_project.description = project.description
    existing_project.status = project.status

    db.commit()
    db.refresh(existing_project)

    return existing_project


# Delete a project
@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db)
):
    existing_project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if existing_project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    db.delete(existing_project)
    db.commit()

    return {
        "message": "Project deleted successfully",
        "id": project_id
    }


# =========================================
# Tasks
# =========================================

# Get all tasks
@app.get(
    "/api/tasks",
    response_model=list[TaskResponse]
)
def get_tasks(
    db: Session = Depends(get_db)
):
    return (
        db.query(Task)
        .order_by(Task.id)
        .all()
    )


# Create a new task
@app.post(
    "/api/tasks",
    response_model=TaskResponse
)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db)
):
    # Check project
    project = (
        db.query(Project)
        .filter(Project.id == task.project_id)
        .first()
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    # Check parent task
    if task.parent_task_id is not None:

        parent_task = (
            db.query(Task)
            .filter(Task.id == task.parent_task_id)
            .first()
        )

        if parent_task is None:
            raise HTTPException(
                status_code=404,
                detail="Parent task not found"
            )

        # Parent must belong to same project
        if parent_task.project_id != task.project_id:
            raise HTTPException(
                status_code=400,
                detail="Parent task belongs to another project"
            )

        # A weighted parent must eventually have
        # valid child weights.
        # During creation, total may be temporarily
        # less than 100.

    new_task = Task(
        project_id=task.project_id,
        parent_task_id=task.parent_task_id,
        code=task.code,
        name=task.name,
        description=task.description,
        status=task.status,
        priority=task.priority,
        progress_type=task.progress_type,
        planned_start=task.planned_start,
        planned_finish=task.planned_finish,
        actual_start=task.actual_start,
        actual_finish=task.actual_finish,
        progress=task.progress,
        weight=task.weight,
        include_in_progress=task.include_in_progress,
        notes=task.notes,
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


# =========================================
# Update Task
# =========================================

@app.put(
    "/api/tasks/{task_id}",
    response_model=TaskResponse
)
def update_task(
    task_id: int,
    task: TaskUpdate,
    db: Session = Depends(get_db)
):
    # -----------------------------------------
    # Find task
    # -----------------------------------------

    existing_task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if existing_task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    # -----------------------------------------
    # Keep old values
    # -----------------------------------------

    old_progress = float(existing_task.progress)

    old_parent_task_id = existing_task.parent_task_id
    old_weight = float(existing_task.weight)
    old_include_in_progress = (
        existing_task.include_in_progress
    )

    # -----------------------------------------
    # Validate Parent Task
    # -----------------------------------------

    if task.parent_task_id is not None:

        # Task cannot be its own parent
        if task.parent_task_id == task_id:
            raise HTTPException(
                status_code=400,
                detail="A task cannot be its own parent"
            )

        parent_task = (
            db.query(Task)
            .filter(Task.id == task.parent_task_id)
            .first()
        )

        if parent_task is None:
            raise HTTPException(
                status_code=404,
                detail="Parent task not found"
            )

        # Parent must belong to same project
        if parent_task.project_id != existing_task.project_id:
            raise HTTPException(
                status_code=400,
                detail="Parent task belongs to another project"
            )

        # -----------------------------------------
        # Prevent circular hierarchy
        # -----------------------------------------

        current_parent_id = parent_task.id

        while current_parent_id is not None:

            if current_parent_id == task_id:
                raise HTTPException(
                    status_code=400,
                    detail="Circular task hierarchy is not allowed"
                )

            current_parent = (
                db.query(Task)
                .filter(Task.id == current_parent_id)
                .first()
            )

            if current_parent is None:
                break

            current_parent_id = current_parent.parent_task_id

    # -----------------------------------------
    # Determine proposed values
    # -----------------------------------------

    new_parent_task_id = (
        task.parent_task_id
        if task.parent_task_id is not None
        else existing_task.parent_task_id
    )

    new_weight = (
        float(task.weight)
        if task.weight is not None
        else old_weight
    )

    new_include_in_progress = (
        task.include_in_progress
        if task.include_in_progress is not None
        else old_include_in_progress
    )

    # -----------------------------------------
    # Detect relevant changes
    # -----------------------------------------

    hierarchy_changed = (
        new_parent_task_id != old_parent_task_id
    )

    weight_changed = (
        new_weight != old_weight
    )

    include_changed = (
        new_include_in_progress
        != old_include_in_progress
    )

    # -----------------------------------------
    # Validate active sibling weights
    # -----------------------------------------

    if (
        hierarchy_changed
        or weight_changed
        or include_changed
    ):

        if new_parent_task_id is not None:

            sibling_tasks = (
                db.query(Task)
                .filter(
                    Task.parent_task_id == new_parent_task_id,
                    Task.id != task_id,
                    Task.include_in_progress.is_(True)
                )
                .all()
            )

            sibling_weight = sum(
                float(sibling.weight)
                for sibling in sibling_tasks
            )

            proposed_total_weight = sibling_weight

            if new_include_in_progress:
                proposed_total_weight += new_weight

            parent_task = (
                db.query(Task)
                .filter(Task.id == new_parent_task_id)
                .first()
            )

            # Only enforce total=100 when the parent
            # itself is weighted.
            if (
                parent_task is not None
                and parent_task.progress_type == "weighted"
            ):

                if round(
                    proposed_total_weight,
                    3
                ) != 100:

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Active child task weights "
                            "must total 100. "
                            f"Current proposed total: "
                            f"{proposed_total_weight}"
                        )
                    )

    # -----------------------------------------
    # Update fields
    # -----------------------------------------

    if task.parent_task_id is not None:
        existing_task.parent_task_id = (
            task.parent_task_id
        )

    if task.code is not None:
        existing_task.code = task.code

    if task.name is not None:
        existing_task.name = task.name

    if task.description is not None:
        existing_task.description = (
            task.description
        )

    if task.status is not None:
        existing_task.status = task.status

    if task.priority is not None:
        existing_task.priority = task.priority

    if task.progress_type is not None:
        existing_task.progress_type = (
            task.progress_type
        )

    if task.include_in_progress is not None:
        existing_task.include_in_progress = (
            task.include_in_progress
        )

    if task.planned_start is not None:
        existing_task.planned_start = (
            task.planned_start
        )

    if task.planned_finish is not None:
        existing_task.planned_finish = (
            task.planned_finish
        )

    if task.actual_start is not None:
        existing_task.actual_start = (
            task.actual_start
        )

    if task.actual_finish is not None:
        existing_task.actual_finish = (
            task.actual_finish
        )

    # -----------------------------------------
    # Update progress + history
    # -----------------------------------------

    if task.progress is not None:

        new_progress = float(task.progress)

        existing_task.progress = new_progress

        if new_progress != old_progress:

            progress_change = (
                new_progress - old_progress
            )

            history = TaskProgressHistory(
                task_id=existing_task.id,
                previous_progress=old_progress,
                recorded_progress=new_progress,
                progress_change=progress_change,
            )

            db.add(history)

    # -----------------------------------------
    # Update weight
    # -----------------------------------------

    if task.weight is not None:
        existing_task.weight = task.weight

    # -----------------------------------------
    # Update notes
    # -----------------------------------------

    if task.notes is not None:
        existing_task.notes = task.notes

    db.commit()
    db.refresh(existing_task)

    return existing_task


# =========================================
# Task Progress History
# =========================================

@app.get(
    "/api/tasks/{task_id}/progress-history",
    response_model=list[TaskProgressHistoryResponse]
)
def get_task_progress_history(
    task_id: int,
    db: Session = Depends(get_db)
):
    # Check task exists
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    history = (
        db.query(TaskProgressHistory)
        .filter(
            TaskProgressHistory.task_id == task_id
        )
        .order_by(
            TaskProgressHistory.recorded_at
        )
        .all()
    )

    return history


# =========================================
# Weighted Task Progress
# =========================================

@app.get(
    "/api/tasks/{task_id}/weighted-progress",
    response_model=WeightedProgressResponse
)
def get_weighted_task_progress(
    task_id: int,
    db: Session = Depends(get_db)
):
    # Find parent task
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    # Get active direct children
    children = (
        db.query(Task)
        .filter(
            Task.parent_task_id == task_id,
            Task.include_in_progress.is_(True)
        )
        .order_by(Task.id)
        .all()
    )

    if not children:
        return {
            "task_id": task.id,
            "task_name": task.name,
            "progress_type": task.progress_type,
            "progress": 0,
            "total_weight": 0,
            "children": [],
        }

    # Calculate total active weight
    total_weight = sum(
        float(child.weight)
        for child in children
    )

    if round(total_weight, 3) != 100:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Child task weights must total 100. "
                f"Task {task.id} total weight: "
                f"{total_weight}"
            )
        )

    weighted_progress = 0
    children_result = []

    for child in children:

        # Recursive progress
        child_progress = calculate_task_progress(
            child,
            db
        )

        child_weight = float(child.weight)

        contribution = (
            child_progress *
            child_weight /
            100
        )

        weighted_progress += contribution

        children_result.append(
            WeightedProgressChildResponse(
                task_id=child.id,
                task_name=child.name,
                progress=round(
                    child_progress,
                    2
                ),
                weight=round(
                    child_weight,
                    2
                ),
                contribution=round(
                    contribution,
                    2
                ),
            )
        )

    return {
        "task_id": task.id,
        "task_name": task.name,
        "progress_type": task.progress_type,
        "progress": round(
            weighted_progress,
            2
        ),
        "total_weight": round(
            total_weight,
            2
        ),
        "children": children_result,
    }


# =========================================
# Validate Task Weights
# =========================================

@app.get(
    "/api/tasks/{task_id}/validate-weights",
    response_model=WeightValidationResponse
)
def validate_task_weights(
    task_id: int,
    db: Session = Depends(get_db)
):
    # Find task
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    # Get active direct children
    children = (
        db.query(Task)
        .filter(
            Task.parent_task_id == task_id,
            Task.include_in_progress.is_(True)
        )
        .order_by(Task.id)
        .all()
    )

    if not children:
        return {
            "task_id": task.id,
            "task_name": task.name,
            "total_weight": 0,
            "is_valid": False,
        }

    total_weight = sum(
        float(child.weight)
        for child in children
    )

    is_valid = (
        round(total_weight, 3) == 100
    )

    return {
        "task_id": task.id,
        "task_name": task.name,
        "total_weight": round(
            total_weight,
            3
        ),
        "is_valid": is_valid,
    }


# =========================================
# Project Overall Progress
# =========================================

@app.get(
    "/api/projects/{project_id}/progress",
    response_model=ProjectProgressResponse
)
def get_project_progress(
    project_id: int,
    db: Session = Depends(get_db)
):
    # Find project
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    # Get active top-level tasks
    tasks = (
        db.query(Task)
        .filter(
            Task.project_id == project_id,
            Task.parent_task_id.is_(None),
            Task.include_in_progress.is_(True)
        )
        .order_by(Task.id)
        .all()
    )

    if not tasks:
        return {
            "project_id": project.id,
            "project_name": project.name,
            "progress": 0,
            "total_weight": 0,
            "children": [],
        }

    # Calculate total weight
    total_weight = sum(
        float(task.weight)
        for task in tasks
    )

    if round(total_weight, 3) != 100:

        raise HTTPException(
            status_code=400,
            detail=(
                "Top-level task weights must total 100. "
                f"Current total: {total_weight}"
            )
        )

    project_progress = 0
    children_result = []

    for task in tasks:

        task_progress = calculate_task_progress(
            task,
            db
        )

        task_weight = float(task.weight)

        contribution = (
            task_progress *
            task_weight /
            100
        )

        project_progress += contribution

        children_result.append(
            ProjectProgressChildResponse(
                task_id=task.id,
                task_name=task.name,
                progress=round(
                    task_progress,
                    2
                ),
                weight=round(
                    task_weight,
                    2
                ),
                contribution=round(
                    contribution,
                    2
                ),
            )
        )

    return {
        "project_id": project.id,
        "project_name": project.name,
        "progress": round(
            project_progress,
            2
        ),
        "total_weight": round(
            total_weight,
            2
        ),
        "children": children_result,
    }


# =========================================
# Task Quantities
# =========================================

# Get all task quantities
@app.get(
    "/api/task-quantities",
    response_model=list[TaskQuantityResponse]
)
def get_task_quantities(
    db: Session = Depends(get_db)
):
    return (
        db.query(TaskQuantity)
        .order_by(TaskQuantity.id)
        .all()
    )


# Create task quantity
@app.post(
    "/api/task-quantities",
    response_model=TaskQuantityResponse
)
def create_task_quantity(
    quantity: TaskQuantityCreate,
    db: Session = Depends(get_db)
):
    # Check task exists
    task = (
        db.query(Task)
        .filter(Task.id == quantity.task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    new_quantity = TaskQuantity(
        task_id=quantity.task_id,
        unit=quantity.unit,
        original_quantity=quantity.original_quantity,
        planned_quantity=quantity.planned_quantity,
        actual_quantity=quantity.actual_quantity,
    )

    db.add(new_quantity)
    db.commit()
    db.refresh(new_quantity)

    return new_quantity


# Update task quantity
@app.put(
    "/api/task-quantities/{quantity_id}",
    response_model=TaskQuantityResponse
)
def update_task_quantity(
    quantity_id: int,
    quantity: TaskQuantityUpdate,
    db: Session = Depends(get_db)
):
    # Find quantity
    existing_quantity = (
        db.query(TaskQuantity)
        .filter(TaskQuantity.id == quantity_id)
        .first()
    )

    if existing_quantity is None:
        raise HTTPException(
            status_code=404,
            detail="Task quantity not found"
        )

    # Keep old actual quantity
    old_actual_quantity = float(
        existing_quantity.actual_quantity
    )

    # Update provided fields
    if quantity.unit is not None:
        existing_quantity.unit = quantity.unit

    if quantity.original_quantity is not None:
        existing_quantity.original_quantity = (
            quantity.original_quantity
        )

    if quantity.planned_quantity is not None:
        existing_quantity.planned_quantity = (
            quantity.planned_quantity
        )

    # Update actual quantity + history
    if quantity.actual_quantity is not None:

        new_actual_quantity = float(
            quantity.actual_quantity
        )

        existing_quantity.actual_quantity = (
            new_actual_quantity
        )

        if new_actual_quantity != old_actual_quantity:

            quantity_change = (
                new_actual_quantity
                - old_actual_quantity
            )

            history = TaskQuantityHistory(
                task_quantity_id=existing_quantity.id,
                previous_quantity=old_actual_quantity,
                recorded_quantity=new_actual_quantity,
                quantity_change=quantity_change,
            )

            db.add(history)

    db.commit()
    db.refresh(existing_quantity)

    return existing_quantity


# =========================================
# Task Quantity History
# =========================================

@app.get(
    "/api/task-quantities/{task_quantity_id}/history",
    response_model=list[TaskQuantityHistoryResponse]
)
def get_task_quantity_history(
    task_quantity_id: int,
    db: Session = Depends(get_db)
):
    history = (
        db.query(TaskQuantityHistory)
        .filter(
            TaskQuantityHistory.task_quantity_id
            == task_quantity_id
        )
        .order_by(
            TaskQuantityHistory.recorded_at
        )
        .all()
    )

    return history


# =========================================
# Task Progress
# =========================================

@app.get(
    "/api/tasks/{task_id}/progress",
    response_model=TaskProgressResponse
)
def get_task_progress(
    task_id: int,
    db: Session = Depends(get_db)
):
    # Find task
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    # Calculate progress centrally
    progress = calculate_task_progress(
        task,
        db
    )

    # -----------------------------------------
    # Manual
    # -----------------------------------------

    if task.progress_type == "manual":
        return {
            "task_id": task.id,
            "progress_type": "manual",
            "planned_quantity": None,
            "actual_quantity": None,
            "progress": progress,
            "quantity_variance": None,
        }

    # -----------------------------------------
    # Quantity
    # -----------------------------------------

    if task.progress_type == "quantity":

        quantity = (
            db.query(TaskQuantity)
            .filter(
                TaskQuantity.task_id == task.id
            )
            .order_by(
                TaskQuantity.id.desc()
            )
            .first()
        )

        if quantity is None:
            return {
                "task_id": task.id,
                "progress_type": "quantity",
                "planned_quantity": None,
                "actual_quantity": None,
                "progress": 0,
                "quantity_variance": None,
            }

        planned = float(
            quantity.planned_quantity
        )

        actual = float(
            quantity.actual_quantity
        )

        return {
            "task_id": task.id,
            "progress_type": "quantity",
            "planned_quantity": planned,
            "actual_quantity": actual,
            "progress": progress,
            "quantity_variance": round(
                actual - planned,
                2
            ),
        }

    # -----------------------------------------
    # Weighted
    # -----------------------------------------

    if task.progress_type == "weighted":

        return {
            "task_id": task.id,
            "progress_type": "weighted",
            "planned_quantity": None,
            "actual_quantity": None,
            "progress": progress,
            "quantity_variance": None,
        }

    # This point should never normally be reached
    raise HTTPException(
        status_code=400,
        detail=(
            "Unsupported progress_type. "
            "Allowed values are: "
            "manual, quantity, weighted"
        )
    )
