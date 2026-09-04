from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, SessionLocal
from models import Project
from schemas import ProjectCreate, ProjectResponse


app = FastAPI(title="IPMCS API")


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


# Create database tables
Base.metadata.create_all(bind=engine)


# Database session
def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "message": "IPMCS Backend is running",
        "status": "ok"
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy"
    }


# Get all projects
@app.get("/api/projects", response_model=list[ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()


# Create a new project
@app.post("/api/projects", response_model=ProjectResponse)
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
@app.put("/api/projects/{project_id}", response_model=ProjectResponse)
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