from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database import Base, engine, SessionLocal
from datetime import date, datetime

from models import (
    Project,
    Task,
    TaskQuantity,
    TaskQuantityHistory,
    TaskProgressHistory,
    TaskDependency,
    TaskExecutionReport,
    TaskExecutionReportHistory,
    TaskExecutionBaseline,
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
    WBSTaskResponse,
    ProjectWBSResponse,
    ProjectSetupCreate,
    TaskDependencyCreate,
    TaskDependencyResponse,
    TaskBlockingReason,
    TaskReadinessResponse,
    TaskExecutionReportCreate,
    TaskExecutionReportUpdate,
    TaskExecutionReportResponse,
    TaskExecutionReportHistoryResponse,
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
    db: Session,
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
            100,
        )

    # -----------------------------------------
    # Weighted Progress - Recursive
    # -----------------------------------------

    if task.progress_type == "weighted":

        children = (
            db.query(Task)
            .filter(
                Task.parent_task_id == task.id,
                Task.include_in_progress.is_(True),
            )
            .order_by(Task.id)
            .all()
        )

        if not children:
            return 0

        total_weight = sum(
            float(child.weight)
            for child in children
        )

        if round(total_weight, 3) != 100:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Child task weights must total 100. "
                    f"Task {task.id} total weight: "
                    f"{total_weight}"
                ),
            )

        weighted_progress = 0

        for child in children:

            child_progress = calculate_task_progress(
                child,
                db,
            )

            weighted_progress += (
                child_progress
                * float(child.weight)
                / 100
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
        ),
    )

# =========================================
# Dependency Validation
# =========================================

def dependency_would_create_cycle(
    db: Session,
    predecessor_task_id: int,
    successor_task_id: int,
) -> bool:
    """
    Check whether adding:

        predecessor -> successor

    would create a circular dependency.

    A cycle is created if the successor can
    already reach the predecessor through
    existing downstream dependencies.
    """

    visited = set()
    stack = [successor_task_id]

    while stack:
        current_task_id = stack.pop()

        if current_task_id == predecessor_task_id:
            return True

        if current_task_id in visited:
            continue

        visited.add(current_task_id)

        downstream_dependencies = (
            db.query(TaskDependency)
            .filter(
                TaskDependency.predecessor_task_id
                == current_task_id
            )
            .all()
        )

        for dependency in downstream_dependencies:
            next_task_id = dependency.successor_task_id

            if next_task_id not in visited:
                stack.append(next_task_id)

    return False

# =========================================
# Calculate Task Readiness
# =========================================
def calculate_task_readiness(
    task: Task,
    db: Session,
):
    """
    Determine whether a task is ready to START.

    FS: predecessor must be completed.
    SS: predecessor must have started.
    FF: constrains task finish, not task start.
    SF: constrains task finish, not task start.

    Time-based lag calculations belong to scheduling logic.
    """

    dependencies = (
        db.query(TaskDependency)
        .filter(
            TaskDependency.successor_task_id == task.id
        )
        .order_by(TaskDependency.id)
        .all()
    )

    blocking_reasons = []

    for dependency in dependencies:
        predecessor = (
            db.query(Task)
            .filter(
                Task.id == dependency.predecessor_task_id
            )
            .first()
        )

        if predecessor is None:
            continue

        dependency_type = dependency.dependency_type.upper()

        # Finish-to-Start: predecessor must be completed.
        if dependency_type == "FS":
            is_blocked = predecessor.status != "completed"
            reason = "Predecessor task must be completed."

        # Start-to-Start: predecessor must have started.
        elif dependency_type == "SS":
            is_blocked = predecessor.status == "not_started"
            reason = "Predecessor task must have started."

        # FF and SF constrain finish timing, not start readiness.
        elif dependency_type in {"FF", "SF"}:
            continue

        else:
            # Fail safely if unsupported dependency data exists.
            blocking_reasons.append(
                TaskBlockingReason(
                    predecessor_task_id=predecessor.id,
                    predecessor_task_name=predecessor.name,
                    predecessor_status=predecessor.status,
                    dependency_type=dependency_type,
                    reason="Unsupported dependency type.",
                )
            )
            continue

        if is_blocked:
            blocking_reasons.append(
                TaskBlockingReason(
                    predecessor_task_id=predecessor.id,
                    predecessor_task_name=predecessor.name,
                    predecessor_status=predecessor.status,
                    dependency_type=dependency_type,
                    reason=reason,
                )
            )

    readiness = "blocked" if blocking_reasons else "ready"

    return readiness, blocking_reasons
# =========================================
# Refresh Task Execution State
# =========================================

def refresh_task_execution_state(
    task: Task,
    db: Session,
):
    readiness, _ = calculate_task_readiness(
        task,
        db,
    )

    task.execution_state = readiness

    return readiness

# =========================================
# Refresh Successor Execution States
# Recursive Dependency Propagation
# =========================================

def refresh_successor_execution_states(
    task: Task,
    db: Session,
):
    """
    Recalculate execution readiness through the
    complete downstream dependency chain.

    Example:

        A -> B -> C -> D

    If A changes, B is refreshed.
    If B readiness changes, C is refreshed.
    Then D is refreshed, and so on.

    The function prevents infinite loops by keeping
    track of already processed task IDs.
    """

    queue = [task.id]
    processed_task_ids = set()
    refreshed_task_ids = set()

    while queue:

        current_task_id = queue.pop(0)

        if current_task_id in processed_task_ids:
            continue

        processed_task_ids.add(current_task_id)

        # -----------------------------------------
        # Find direct successors
        # -----------------------------------------

        dependencies = (
            db.query(TaskDependency)
            .filter(
                TaskDependency.predecessor_task_id
                == current_task_id
            )
            .order_by(TaskDependency.id)
            .all()
        )

        for dependency in dependencies:

            successor = (
                db.query(Task)
                .filter(
                    Task.id
                    == dependency.successor_task_id
                )
                .first()
            )

            if successor is None:
                continue

            # -------------------------------------
            # Refresh successor readiness
            # -------------------------------------

            old_state = successor.execution_state

            new_state = refresh_task_execution_state(
                successor,
                db,
            )

            refreshed_task_ids.add(
                successor.id
            )

            # -------------------------------------
            # Continue propagation
            #
            # Even if the state did not change,
            # continue through the chain because
            # the successor's state is an input to
            # other logic in future extensions.
            # -------------------------------------

            if successor.id not in processed_task_ids:

                queue.append(
                    successor.id
                )

    return refreshed_task_ids
# =========================================
# Root
# =========================================

@app.get("/")
def root():
    return {
        "message": "IPMCS Backend is running",
        "status": "ok",
    }


# =========================================
# Health
# =========================================

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
    }


# =========================================
# Projects
# =========================================

# -----------------------------------------
# Get all projects
# -----------------------------------------

@app.get(
    "/api/projects",
    response_model=list[ProjectResponse],
)
def get_projects(
    db: Session = Depends(get_db),
):
    return (
        db.query(Project)
        .order_by(Project.id)
        .all()
    )


# -----------------------------------------
# Dashboard summary
# -----------------------------------------

@app.get("/api/dashboard/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
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


# =========================================
# Create a new project
# =========================================

@app.post(
    "/api/projects",
    response_model=ProjectResponse,
)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
):
    # -----------------------------------------
    # Normalize project code
    # -----------------------------------------

    project_code = project.code.strip()

    if not project_code:
        raise HTTPException(
            status_code=400,
            detail="Project code cannot be empty",
        )

    # -----------------------------------------
    # Check duplicate project code
    # -----------------------------------------

    existing_project = (
        db.query(Project)
        .filter(Project.code == project_code)
        .first()
    )

    if existing_project is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Project code '{project_code}' "
                "already exists."
            ),
        )

    # -----------------------------------------
    # Create project
    # -----------------------------------------

    new_project = Project(
        code=project_code,
        name=project.name.strip(),
        description=project.description,
        status=project.status,
    )

    db.add(new_project)

    try:
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                f"Project code '{project_code}' "
                "already exists."
            ),
        )

    db.refresh(new_project)

    return new_project


# =========================================
# Create Project + Main WBS Atomically
# =========================================

@app.post(
    "/api/projects/setup",
    response_model=ProjectResponse,
)
def create_project_setup(
    setup: ProjectSetupCreate,
    db: Session = Depends(get_db),
):
    """
    Create the project and its initial top-level WBS
    operations as one atomic database operation.

    Either everything is created successfully,
    or everything is rolled back.
    """

    # -----------------------------------------
    # Normalize project code
    # -----------------------------------------

    project_code = setup.project.code.strip()

    if not project_code:
        raise HTTPException(
            status_code=400,
            detail="Project code cannot be empty",
        )

    # -----------------------------------------
    # Normalize project name
    # -----------------------------------------

    project_name = setup.project.name.strip()

    if not project_name:
        raise HTTPException(
            status_code=400,
            detail="Project name cannot be empty",
        )

    # -----------------------------------------
    # Check duplicate project code
    # -----------------------------------------

    existing_project = (
        db.query(Project)
        .filter(Project.code == project_code)
        .first()
    )

    if existing_project is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Project code '{project_code}' "
                "already exists."
            ),
        )

    # -----------------------------------------
    # Validate main operations
    # -----------------------------------------

    if not setup.main_operations:
        raise HTTPException(
            status_code=400,
            detail=(
                "At least one main project operation "
                "is required."
            ),
        )

    # -----------------------------------------
    # Validate operation codes and names
    # -----------------------------------------

    operation_codes = set()

    for operation in setup.main_operations:

        operation_code = operation.code.strip()
        operation_name = operation.name.strip()

        if not operation_code:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Every main project operation "
                    "must have a code."
                ),
            )

        if not operation_name:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Every main project operation "
                    "must have a name."
                ),
            )

        if operation_code in operation_codes:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Duplicate main operation code "
                    f"'{operation_code}'."
                ),
            )

        operation_codes.add(operation_code)

    # -----------------------------------------
    # Validate total weight
    # -----------------------------------------

    total_weight = sum(
        float(operation.weight)
        for operation in setup.main_operations
    )

    if round(total_weight, 3) != 100:
        raise HTTPException(
            status_code=400,
            detail=(
                "Top-level task weights must total 100. "
                f"Current total: {total_weight}"
            ),
        )

    # -----------------------------------------
    # Database transaction
    # -----------------------------------------

    try:

        # -------------------------------------
        # Create project
        # -------------------------------------

        new_project = Project(
            code=project_code,
            name=project_name,
            description=setup.project.description,
            status="planning",
        )

        db.add(new_project)

        # -------------------------------------
        # Flush
        # -------------------------------------

        db.flush()

        # -------------------------------------
        # Create top-level WBS operations
        # -------------------------------------

        for operation in setup.main_operations:

            new_task = Task(
                project_id=new_project.id,
                parent_task_id=None,

                code=operation.code.strip(),
                name=operation.name.strip(),
                description=operation.description,

                status=operation.status,
                priority=operation.priority,

                progress_type=operation.progress_type,
                include_in_progress=(
                    operation.include_in_progress
                ),

                planned_start=operation.planned_start,
                planned_finish=operation.planned_finish,

                actual_start=operation.actual_start,
                actual_finish=operation.actual_finish,

                progress=operation.progress,
                weight=operation.weight,

                notes=operation.notes,
            )

            db.add(new_task)

        # -------------------------------------
        # Final database commit
        # -------------------------------------

        db.commit()

        # -------------------------------------
        # Refresh project
        # -------------------------------------

        db.refresh(new_project)

        return new_project

    except IntegrityError as exc:

        db.rollback()

        error_text = str(exc).lower()

        if "code" in error_text:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Project or task code conflict "
                    f"for project '{project_code}'."
                ),
            )

        raise HTTPException(
            status_code=400,
            detail=(
                "Project setup could not be completed "
                "because of a database constraint."
            ),
        )

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Project setup failed. "
                "No incomplete project data was saved."
            ),
        )


# =========================================
# Update an existing project
# =========================================

@app.put(
    "/api/projects/{project_id}",
    response_model=ProjectResponse,
)
def update_project(
    project_id: int,
    project: ProjectCreate,
    db: Session = Depends(get_db),
):
    existing_project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if existing_project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    project_code = project.code.strip()

    if not project_code:
        raise HTTPException(
            status_code=400,
            detail="Project code cannot be empty",
        )

    duplicate_project = (
        db.query(Project)
        .filter(
            Project.code == project_code,
            Project.id != project_id,
        )
        .first()
    )

    if duplicate_project is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Project code '{project_code}' "
                "already exists."
            ),
        )

    existing_project.code = project_code
    existing_project.name = project.name.strip()
    existing_project.description = project.description
    existing_project.status = project.status

    try:
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                f"Project code '{project_code}' "
                "already exists."
            ),
        )

    db.refresh(existing_project)

    return existing_project


# =========================================
# Delete a project
# =========================================


@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    existing_project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if existing_project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    try:

        # -----------------------------------------
        # Find all project tasks
        # -----------------------------------------

        project_tasks = (
            db.query(Task)
            .filter(
                Task.project_id == project_id
            )
            .all()
        )

        task_ids = [
            task.id
            for task in project_tasks
        ]


        # -----------------------------------------
        # Delete execution report history
        # -----------------------------------------

        if task_ids:

            report_ids = [
                report_id
                for (report_id,) in db.query(
                    TaskExecutionReport.id
                ).filter(
                    TaskExecutionReport.task_id.in_(task_ids)
                ).all()
            ]

            if report_ids:
                db.query(TaskExecutionReportHistory).filter(
                    TaskExecutionReportHistory.report_id.in_(
                        report_ids
                    )
                ).delete(
                    synchronize_session=False
                )

            # -------------------------------------
            # Delete execution reports
            # -------------------------------------

            db.query(TaskExecutionReport).filter(
                TaskExecutionReport.task_id.in_(task_ids)
            ).delete(
                synchronize_session=False
            )

            # -------------------------------------
            # Delete execution baselines
            # -------------------------------------

            db.query(TaskExecutionBaseline).filter(
                TaskExecutionBaseline.task_id.in_(task_ids)
            ).delete(
                synchronize_session=False
            )


        # -----------------------------------------
        # Delete task dependencies
        # -----------------------------------------

        if task_ids:

            db.query(TaskDependency).filter(
                (
                    TaskDependency.predecessor_task_id
                    .in_(task_ids)
                )
                |
                (
                    TaskDependency.successor_task_id
                    .in_(task_ids)
                )
            ).delete(
                synchronize_session=False
            )

        # -----------------------------------------
        # Delete quantity history
        # -----------------------------------------

        if task_ids:

            quantities = (
                db.query(TaskQuantity)
                .filter(
                    TaskQuantity.task_id.in_(task_ids)
                )
                .all()
            )

            quantity_ids = [
                quantity.id
                for quantity in quantities
            ]

            if quantity_ids:

                db.query(TaskQuantityHistory).filter(
                    TaskQuantityHistory.task_quantity_id.in_(
                        quantity_ids
                    )
                ).delete(
                    synchronize_session=False
                )

            # -------------------------------------
            # Delete quantities
            # -------------------------------------

            db.query(TaskQuantity).filter(
                TaskQuantity.task_id.in_(task_ids)
            ).delete(
                synchronize_session=False
            )

            # -------------------------------------
            # Delete progress history
            # -------------------------------------

            db.query(TaskProgressHistory).filter(
                TaskProgressHistory.task_id.in_(task_ids)
            ).delete(
                synchronize_session=False
            )

        # -----------------------------------------
        # Delete all project tasks
        # -----------------------------------------

        if task_ids:

            db.query(Task).filter(
                Task.id.in_(task_ids)
            ).delete(
                synchronize_session=False
            )

        # -----------------------------------------
        # Delete project
        # -----------------------------------------

        db.delete(existing_project)

        # -----------------------------------------
        # Commit transaction
        # -----------------------------------------

        db.commit()

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Project could not be deleted.",
        )

    return {
        "message": "Project deleted successfully",
        "id": project_id,
    }

# =========================================
# Tasks
# =========================================

# -----------------------------------------
# Get all tasks
# -----------------------------------------

@app.get(
    "/api/tasks",
    response_model=list[TaskResponse],
)
def get_tasks(
    db: Session = Depends(get_db),
):
    return (
        db.query(Task)
        .order_by(Task.id)
        .all()
    )


# =========================================
# Create a new task
# =========================================

@app.post(
    "/api/tasks",
    response_model=TaskResponse,
)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
):
    # -----------------------------------------
    # Check project
    # -----------------------------------------

    project = (
        db.query(Project)
        .filter(Project.id == task.project_id)
        .first()
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    # -----------------------------------------
    # Check parent task
    # -----------------------------------------

    if task.parent_task_id is not None:

        parent_task = (
            db.query(Task)
            .filter(Task.id == task.parent_task_id)
            .first()
        )

        if parent_task is None:
            raise HTTPException(
                status_code=404,
                detail="Parent task not found",
            )

        if parent_task.project_id != task.project_id:
            raise HTTPException(
                status_code=400,
                detail="Parent task belongs to another project",
            )

    # -----------------------------------------
    # Create task
    # -----------------------------------------

    new_task = Task(
        project_id=task.project_id,
        parent_task_id=task.parent_task_id,
        code=task.code,
        name=task.name,
        description=task.description,
        status=task.status,
        execution_state="not_evaluated",
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
    db.flush()

    # Evaluate readiness after the task has an ID.
    refresh_task_execution_state(
        new_task,
        db,
    )

    db.commit()
    db.refresh(new_task)

    return new_task


# =========================================
# Update Task
# =========================================

@app.put(
    "/api/tasks/{task_id}",
    response_model=TaskResponse,
)
def update_task(
    task_id: int,
    task: TaskUpdate,
    db: Session = Depends(get_db),
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
            detail="Task not found",
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

        if task.parent_task_id == task_id:
            raise HTTPException(
                status_code=400,
                detail="A task cannot be its own parent",
            )

        parent_task = (
            db.query(Task)
            .filter(Task.id == task.parent_task_id)
            .first()
        )

        if parent_task is None:
            raise HTTPException(
                status_code=404,
                detail="Parent task not found",
            )

        if parent_task.project_id != existing_task.project_id:
            raise HTTPException(
                status_code=400,
                detail="Parent task belongs to another project",
            )

        # -----------------------------------------
        # Prevent circular hierarchy
        # -----------------------------------------

        current_parent_id = parent_task.id

        while current_parent_id is not None:

            if current_parent_id == task_id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Circular task hierarchy "
                        "is not allowed"
                    ),
                )

            current_parent = (
                db.query(Task)
                .filter(
                    Task.id == current_parent_id
                )
                .first()
            )

            if current_parent is None:
                break

            current_parent_id = (
                current_parent.parent_task_id
            )

# -----------------------------------------
# Determine proposed parent
# -----------------------------------------

    if "parent_task_id" in task.model_fields_set:
        new_parent_task_id = task.parent_task_id
    else:
        new_parent_task_id = existing_task.parent_task_id

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
                    Task.parent_task_id
                    == new_parent_task_id,

                    Task.id != task_id,

                    Task.include_in_progress.is_(True),
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
                .filter(
                    Task.id == new_parent_task_id
                )
                .first()
            )

            if (
                parent_task is not None
                and parent_task.progress_type
                == "weighted"
            ):

                if round(
                    proposed_total_weight,
                    3,
                ) != 100:

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Active child task weights "
                            "must total 100. "
                            f"Current proposed total: "
                            f"{proposed_total_weight}"
                        ),
                    )

    # -----------------------------------------
    # Update fields
    # -----------------------------------------

    if "parent_task_id" in task.model_fields_set:
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

    # -----------------------------------------
    # Update execution state
    # -----------------------------------------
# -----------------------------------------
# Update execution state
# -----------------------------------------

    readiness, _ = calculate_task_readiness(
        existing_task,
        db,
    )

    existing_task.execution_state = readiness

    # -----------------------------------------
    # Propagate readiness to successors
    # -----------------------------------------

    refresh_successor_execution_states(
        existing_task,
        db,
    )

    # -----------------------------------------
    # Commit all execution-state changes
    # -----------------------------------------

    db.commit()

    db.refresh(existing_task)

    return existing_task


# =========================================
# Task Progress History
# =========================================

@app.get(
    "/api/tasks/{task_id}/progress-history",
    response_model=list[TaskProgressHistoryResponse],
)
def get_task_progress_history(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
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
    response_model=WeightedProgressResponse,
)
def get_weighted_task_progress(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    children = (
        db.query(Task)
        .filter(
            Task.parent_task_id == task_id,
            Task.include_in_progress.is_(True),
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
            ),
        )

    weighted_progress = 0
    children_result = []

    for child in children:

        child_progress = calculate_task_progress(
            child,
            db,
        )

        child_weight = float(child.weight)

        contribution = (
            child_progress
            * child_weight
            / 100
        )

        weighted_progress += contribution

        children_result.append(
            WeightedProgressChildResponse(
                task_id=child.id,
                task_name=child.name,
                progress=round(
                    child_progress,
                    2,
                ),
                weight=round(
                    child_weight,
                    2,
                ),
                contribution=round(
                    contribution,
                    2,
                ),
            )
        )

    return {
        "task_id": task.id,
        "task_name": task.name,
        "progress_type": task.progress_type,
        "progress": round(
            weighted_progress,
            2,
        ),
        "total_weight": round(
            total_weight,
            2,
        ),
        "children": children_result,
    }


# =========================================
# Validate Task Weights
# =========================================

@app.get(
    "/api/tasks/{task_id}/validate-weights",
    response_model=WeightValidationResponse,
)
def validate_task_weights(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    children = (
        db.query(Task)
        .filter(
            Task.parent_task_id == task_id,
            Task.include_in_progress.is_(True),
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
            3,
        ),
        "is_valid": is_valid,
    }


# =========================================
# Task Dependencies
# =========================================

@app.post(
    "/api/task-dependencies",
    response_model=TaskDependencyResponse,
)
def create_task_dependency(
    dependency: TaskDependencyCreate,
    db: Session = Depends(get_db),
):
    # -----------------------------------------
    # Self dependency
    # -----------------------------------------

    if (
        dependency.predecessor_task_id
        == dependency.successor_task_id
    ):
        raise HTTPException(
            status_code=400,
            detail="A task cannot depend on itself.",
        )

    # -----------------------------------------
    # Validate dependency type
    # -----------------------------------------

    allowed_types = {
        "FS",
        "SS",
        "FF",
        "SF",
    }

    dependency_type = (
        dependency.dependency_type
        .strip()
        .upper()
    )

    if dependency_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported dependency type. "
                "Allowed values: FS, SS, FF, SF."
            ),
        )

    # -----------------------------------------
    # Find predecessor
    # -----------------------------------------

    predecessor = (
        db.query(Task)
        .filter(
            Task.id
            == dependency.predecessor_task_id
        )
        .first()
    )

    if predecessor is None:
        raise HTTPException(
            status_code=404,
            detail="Predecessor task not found.",
        )

    # -----------------------------------------
    # Find successor
    # -----------------------------------------

    successor = (
        db.query(Task)
        .filter(
            Task.id
            == dependency.successor_task_id
        )
        .first()
    )

    if successor is None:
        raise HTTPException(
            status_code=404,
            detail="Successor task not found.",
        )

    # -----------------------------------------
    # Same project validation
    # -----------------------------------------

    if predecessor.project_id != successor.project_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "Tasks from different projects "
                "cannot have a dependency."
            ),
        )

    # -----------------------------------------
    # Duplicate dependency
    # -----------------------------------------

    existing_dependency = (
        db.query(TaskDependency)
        .filter(
            TaskDependency.predecessor_task_id
            == dependency.predecessor_task_id,

            TaskDependency.successor_task_id
            == dependency.successor_task_id,
        )
        .first()
    )

    if existing_dependency is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "This task dependency already exists."
            ),
        )

    # -----------------------------------------
    # Circular dependency validation
    # -----------------------------------------

    if dependency_would_create_cycle(
        db,
        dependency.predecessor_task_id,
        dependency.successor_task_id,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Circular task dependency is not allowed."
            ),
        )

    # -----------------------------------------
    # Create dependency
    # -----------------------------------------

    new_dependency = TaskDependency(
        predecessor_task_id=(
            dependency.predecessor_task_id
        ),
        successor_task_id=(
            dependency.successor_task_id
        ),
        dependency_type=dependency_type,
        lag_days=dependency.lag_days,
    )

    db.add(new_dependency)
    try:
        # Refresh the new successor's readiness.
        refresh_task_execution_state(
            successor,
            db,
        )

        # Refresh all downstream successors.
        refresh_successor_execution_states(
            successor,
            db,
        )

        # Save the dependency and readiness changes
        # together in one transaction.
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Task dependency already exists."
            ),
        )

    db.refresh(new_dependency)

    return new_dependency

# =========================================
# Get Task Dependencies
# =========================================

@app.get(
    "/api/tasks/{task_id}/dependencies",
    response_model=list[TaskDependencyResponse],
)
def get_task_dependencies(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found.",
        )

    dependencies = (
        db.query(TaskDependency)
        .filter(
            (
                TaskDependency.predecessor_task_id
                == task_id
            )
            |
            (
                TaskDependency.successor_task_id
                == task_id
            )
        )
        .order_by(TaskDependency.id)
        .all()
    )

    return dependencies

# =========================================
# Delete Task Dependency
# =========================================

@app.delete(
    "/api/task-dependencies/{dependency_id}"
)
def delete_task_dependency(
    dependency_id: int,
    db: Session = Depends(get_db),
):
    dependency = (
        db.query(TaskDependency)
        .filter(
            TaskDependency.id
            == dependency_id
        )
        .first()
    )

    if dependency is None:
        raise HTTPException(
            status_code=404,
            detail="Task dependency not found.",
        )

    # -----------------------------------------
    # Keep task IDs before deleting dependency
    # -----------------------------------------

    predecessor_task_id = (
        dependency.predecessor_task_id
    )

    successor_task_id = (
        dependency.successor_task_id
    )

    # -----------------------------------------
    # Delete dependency
    # -----------------------------------------

    db.delete(dependency)

    db.flush()

    # -----------------------------------------
    # Find successor
    # -----------------------------------------

    successor = (
        db.query(Task)
        .filter(
            Task.id == successor_task_id
        )
        .first()
    )

    # -----------------------------------------
    # Refresh successor readiness
    # -----------------------------------------

    if successor is not None:

        refresh_task_execution_state(
            successor,
            db,
        )

        # -------------------------------------
        # Propagate through downstream chain
        # -------------------------------------

        refresh_successor_execution_states(
            successor,
            db,
        )

    # -----------------------------------------
    # Commit changes
    # -----------------------------------------

    db.commit()

    return {
        "message": (
            "Task dependency deleted successfully."
        ),
        "id": dependency_id,
        "predecessor_task_id": (
            predecessor_task_id
        ),
        "successor_task_id": (
            successor_task_id
        ),
    }
# =========================================
# Project Overall Progress
# =========================================

@app.get(
    "/api/projects/{project_id}/progress",
    response_model=ProjectProgressResponse,
)
def get_project_progress(
    project_id: int,
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    tasks = (
        db.query(Task)
        .filter(
            Task.project_id == project_id,
            Task.parent_task_id.is_(None),
            Task.include_in_progress.is_(True),
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
            ),
        )

    project_progress = 0
    children_result = []

    for task in tasks:

        task_progress = calculate_task_progress(
            task,
            db,
        )

        task_weight = float(task.weight)

        contribution = (
            task_progress
            * task_weight
            / 100
        )

        project_progress += contribution

        children_result.append(
            ProjectProgressChildResponse(
                task_id=task.id,
                task_name=task.name,
                progress=round(
                    task_progress,
                    2,
                ),
                weight=round(
                    task_weight,
                    2,
                ),
                contribution=round(
                    contribution,
                    2,
                ),
            )
        )

    return {
        "project_id": project.id,
        "project_name": project.name,
        "progress": round(
            project_progress,
            2,
        ),
        "total_weight": round(
            total_weight,
            2,
        ),
        "children": children_result,
    }


# =========================================
# Project WBS Tree
# =========================================

@app.get(
    "/api/projects/{project_id}/wbs",
    response_model=ProjectWBSResponse,
)
def get_project_wbs(
    project_id: int,
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    def build_task_tree(task: Task):

        children = (
            db.query(Task)
            .filter(
                Task.project_id == project_id,
                Task.parent_task_id == task.id,
            )
            .order_by(Task.id)
            .all()
        )

        task_progress = calculate_task_progress(
            task,
            db,
        )

        return WBSTaskResponse(
            id=task.id,
            project_id=task.project_id,
            parent_task_id=task.parent_task_id,
            code=task.code,
            name=task.name,
            status=task.status,
            execution_state=task.execution_state,
            priority=task.priority,
            progress_type=task.progress_type,
            progress=round(task_progress, 2),
            weight=round(float(task.weight), 3),
            include_in_progress=task.include_in_progress,
            children=[
                build_task_tree(child)
                for child in children
            ],
        )

    root_tasks = (
        db.query(Task)
        .filter(
            Task.project_id == project_id,
            Task.parent_task_id.is_(None),
        )
        .order_by(Task.id)
        .all()
    )

    return ProjectWBSResponse(
        project_id=project.id,
        project_name=project.name,
        tasks=[
            build_task_tree(task)
            for task in root_tasks
        ],
    )


# =========================================
# Task Quantities
# =========================================

# -----------------------------------------
# Get all task quantities
# -----------------------------------------

@app.get(
    "/api/task-quantities",
    response_model=list[TaskQuantityResponse],
)
def get_task_quantities(
    db: Session = Depends(get_db),
):
    return (
        db.query(TaskQuantity)
        .order_by(TaskQuantity.id)
        .all()
    )


# -----------------------------------------
# Create task quantity
# -----------------------------------------

@app.post(
    "/api/task-quantities",
    response_model=TaskQuantityResponse,
)
def create_task_quantity(
    quantity: TaskQuantityCreate,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == quantity.task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
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


# -----------------------------------------
# Update task quantity
# -----------------------------------------

@app.put(
    "/api/task-quantities/{quantity_id}",
    response_model=TaskQuantityResponse,
)
def update_task_quantity(
    quantity_id: int,
    quantity: TaskQuantityUpdate,
    db: Session = Depends(get_db),
):
    existing_quantity = (
        db.query(TaskQuantity)
        .filter(TaskQuantity.id == quantity_id)
        .first()
    )

    if existing_quantity is None:
        raise HTTPException(
            status_code=404,
            detail="Task quantity not found",
        )

    old_actual_quantity = float(
        existing_quantity.actual_quantity
    )

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
    response_model=list[TaskQuantityHistoryResponse],
)
def get_task_quantity_history(
    task_quantity_id: int,
    db: Session = Depends(get_db),
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
    response_model=TaskProgressResponse,
)
def get_task_progress(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    progress = calculate_task_progress(
        task,
        db,
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
                2,
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

    raise HTTPException(
        status_code=400,
        detail=(
            "Unsupported progress_type. "
            "Allowed values are: "
            "manual, quantity, weighted"
        ),
    )


# =========================================
# Task Readiness
# =========================================

@app.get(
    "/api/tasks/{task_id}/readiness",
    response_model=TaskReadinessResponse,
)
def get_task_readiness(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found.",
        )

    readiness, blocking_reasons = (
        calculate_task_readiness(
            task,
            db,
        )
    )

    # -----------------------------------------
    # Store current execution state
    # -----------------------------------------

    refresh_task_execution_state(
        task,
        db,
    )

    db.commit()

    return {
        "task_id": task.id,
        "task_name": task.name,
        "readiness": readiness,
        "blocking_reasons": blocking_reasons,
    }


# =========================================
# Task Execution Reports API
# =========================================

def _get_task_quantity(db: Session, task_id: int):
    """Return the latest quantity record for a task."""
    return (
        db.query(TaskQuantity)
        .filter(TaskQuantity.task_id == task_id)
        .order_by(TaskQuantity.id.desc())
        .first()
    )


def _ensure_execution_baseline(db: Session, task_id: int):
    """
    Preserve the cumulative actual quantity that existed
    before periodic execution reporting started.
    """
    baseline = (
        db.query(TaskExecutionBaseline)
        .filter(TaskExecutionBaseline.task_id == task_id)
        .first()
    )

    if baseline is not None:
        return baseline

    quantity = _get_task_quantity(db, task_id)

    opening_quantity = (
        float(quantity.actual_quantity or 0)
        if quantity is not None
        else 0.0
    )

    baseline = TaskExecutionBaseline(
        task_id=task_id,
        opening_quantity=opening_quantity,
    )

    db.add(baseline)
    db.flush()

    return baseline

def _recalculate_execution_quantity(
    db: Session,
    task_id: int,
):
    """
    Actual cumulative quantity =
    opening baseline + all periodic reports.
    """
    baseline = _ensure_execution_baseline(db, task_id)

    reports = (
        db.query(TaskExecutionReport)
        .filter(TaskExecutionReport.task_id == task_id)
        .all()
    )

    cumulative = float(baseline.opening_quantity or 0)

    for report in reports:
        cumulative += float(report.period_quantity or 0)

    quantity = _get_task_quantity(db, task_id)

    if quantity is not None:
        quantity.actual_quantity = cumulative

    return cumulative


@app.post(
    "/api/tasks/{task_id}/execution-reports",
    response_model=TaskExecutionReportResponse,
    status_code=201,
)
def create_task_execution_report(
    task_id: int,
    report_data: TaskExecutionReportCreate,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    if report_data.task_id != task_id:
        raise HTTPException(
            status_code=400,
            detail="Task ID in the URL and request body must match",
        )

    existing_report = (
        db.query(TaskExecutionReport)
        .filter(
            TaskExecutionReport.task_id == task_id,
            TaskExecutionReport.report_date == report_data.report_date,
        )
        .first()
    )

    if existing_report is not None:
        raise HTTPException(
            status_code=409,
            detail="An execution report already exists for this task and date",
        )

    try:
        # Capture the old cumulative quantity before adding the first report.
        _ensure_execution_baseline(db, task_id)

        report = TaskExecutionReport(
            task_id=task_id,
            report_date=report_data.report_date,
            period_quantity=report_data.period_quantity,
            notes=report_data.notes,
        )

        db.add(report)
        db.flush()

        _recalculate_execution_quantity(db, task_id)

        db.commit()
        db.refresh(report)

        return report

    except Exception:
        db.rollback()
        raise


@app.get(
    "/api/tasks/{task_id}/execution-reports",
    response_model=list[TaskExecutionReportResponse],
)
def list_task_execution_reports(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return (
        db.query(TaskExecutionReport)
        .filter(TaskExecutionReport.task_id == task_id)
        .order_by(
            TaskExecutionReport.report_date.asc(),
            TaskExecutionReport.id.asc(),
        )
        .all()
    )


@app.put(
    "/api/execution-reports/{report_id}",
    response_model=TaskExecutionReportResponse,
)
def update_task_execution_report(
    report_id: int,
    report_data: TaskExecutionReportUpdate,
    db: Session = Depends(get_db),
):
    report = (
        db.query(TaskExecutionReport)
        .filter(TaskExecutionReport.id == report_id)
        .first()
    )

    if report is None:
        raise HTTPException(
            status_code=404,
            detail="Execution report not found",
        )

    reason = report_data.reason.strip()

    if not reason:
        raise HTTPException(
            status_code=422,
            detail="A non-empty correction reason is required",
        )

    try:
        previous_quantity = float(report.period_quantity)

        if report_data.period_quantity is not None:
            new_quantity = report_data.period_quantity

            if new_quantity != previous_quantity:
                history = TaskExecutionReportHistory(
                    report_id=report.id,
                    previous_quantity=previous_quantity,
                    recorded_quantity=new_quantity,
                    reason=reason,
                )
                db.add(history)

                report.period_quantity = new_quantity

        if report_data.notes is not None:
            report.notes = report_data.notes

        report.updated_at = datetime.utcnow()

        _recalculate_execution_quantity(db, report.task_id)

        db.commit()
        db.refresh(report)

        return report

    except Exception:
        db.rollback()
        raise


@app.get(
    "/api/execution-reports/{report_id}/history",
    response_model=list[TaskExecutionReportHistoryResponse],
)
def get_task_execution_report_history(
    report_id: int,
    db: Session = Depends(get_db),
):
    report = (
        db.query(TaskExecutionReport)
        .filter(TaskExecutionReport.id == report_id)
        .first()
    )

    if report is None:
        raise HTTPException(
            status_code=404,
            detail="Execution report not found",
        )

    return (
        db.query(TaskExecutionReportHistory)
        .filter(
            TaskExecutionReportHistory.report_id == report_id
        )
        .order_by(
            TaskExecutionReportHistory.changed_at.asc(),
            TaskExecutionReportHistory.id.asc(),
        )
        .all()
    )


@app.get("/api/tasks/{task_id}/execution-summary")
def get_task_execution_summary(
    task_id: int,
    as_of_date: date | None = None,
    db: Session = Depends(get_db),
):
    # -----------------------------------------
    # Find task
    # -----------------------------------------

    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    cutoff_date = as_of_date or date.today()

    # -----------------------------------------
    # Find current quantity record
    # -----------------------------------------

    quantity = _get_task_quantity(db, task_id)

    # -----------------------------------------
    # Determine opening quantity
    # -----------------------------------------

    baseline = (
        db.query(TaskExecutionBaseline)
        .filter(
            TaskExecutionBaseline.task_id == task_id
        )
        .first()
    )

    if baseline is not None:
        opening_quantity = float(
            baseline.opening_quantity or 0
        )
    else:
        # Preserve existing cumulative actual quantity
        # until periodic reporting starts for this task.
        opening_quantity = (
            float(quantity.actual_quantity or 0)
            if quantity is not None
            else 0.0
        )

    # -----------------------------------------
    # Get reports up to the selected date
    # -----------------------------------------

    reports = (
        db.query(TaskExecutionReport)
        .filter(
            TaskExecutionReport.task_id == task_id,
            TaskExecutionReport.report_date <= cutoff_date,
        )
        .order_by(
            TaskExecutionReport.report_date.asc(),
            TaskExecutionReport.id.asc(),
        )
        .all()
    )

    # -----------------------------------------
    # Calculate cumulative quantity
    # -----------------------------------------

    period_total = sum(
        float(report.period_quantity or 0)
        for report in reports
    )

    cumulative_quantity = (
        opening_quantity + period_total
    )

    # -----------------------------------------
    # Calculate quantity progress
    # -----------------------------------------

    planned_quantity = (
        float(quantity.planned_quantity or 0)
        if quantity is not None
        else 0.0
    )

    progress = (
        min(
            cumulative_quantity / planned_quantity * 100,
            100.0,
        )
        if planned_quantity > 0
        else 0.0
    )

    # -----------------------------------------
    # Return execution summary
    # -----------------------------------------

    return {
        "task_id": task_id,
        "as_of_date": cutoff_date,
        "opening_quantity": round(opening_quantity, 3),
        "period_quantity_total": round(period_total, 3),
        "cumulative_quantity": round(cumulative_quantity, 3),
        "planned_quantity": round(planned_quantity, 3),
        "unit": quantity.unit if quantity is not None else None,
        "quantity_progress": round(progress, 2),
        "report_count": len(reports),
        "reports": reports,
    }
