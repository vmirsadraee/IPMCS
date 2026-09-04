from pydantic import BaseModel


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