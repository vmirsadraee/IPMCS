import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import ProjectForm from "../components/ProjectForm";

function Projects() {
  const { t } = useLanguage();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const loadProjects = () => {
    setLoading(true);
    setError("");

    fetch("http://127.0.0.1:8000/api/projects")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }

        return response.json();
      })
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => {
        setError("backendError");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleProjectCreated = (newProject) => {
    setProjects((previous) => [
      ...previous,
      newProject,
    ]);

    setShowForm(false);
    setEditingProject(null);
  };

  const handleProjectUpdated = (updatedProject) => {
    setProjects((previous) =>
      previous.map((project) =>
        project.id === updatedProject.id
          ? updatedProject
          : project
      )
    );

    setShowForm(false);
    setEditingProject(null);
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleDelete = async (project) => {
    const confirmed = window.confirm(
      `${t("confirmDelete")} "${project.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/projects/${project.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      setProjects((previous) =>
        previous.filter(
          (item) => item.id !== project.id
        )
      );
    } catch (error) {
      console.error(error);
      setError("deleteProjectError");
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  return (
    <div className="projects-page">

      {!showForm && (
        <>
          <div className="page-header">

            <div>
              <h1>{t("projectsTitle")}</h1>

              <p>
                {t("projectsDescription")}
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => {
                setEditingProject(null);
                setShowForm(true);
              }}
            >
              + {t("newProject")}
            </button>

          </div>

          <div className="projects-card">

            <div className="projects-card-header">

              <h2>{t("projectList")}</h2>

              <span>
                {projects.length} {t("projectsCount")}
              </span>

            </div>

            {loading && (
              <p className="projects-message">
                {t("loadingProjects")}
              </p>
            )}

            {error && (
              <p className="projects-error">
                {t(error)}
              </p>
            )}

            {!loading &&
              !error &&
              projects.length === 0 && (
                <p className="projects-message">
                  {t("noProjects")}
                </p>
              )}

            {!loading &&
              !error &&
              projects.length > 0 && (
                <div className="projects-table-wrapper">

                  <table className="projects-table">

                    <thead>
                      <tr>
                        <th>{t("id")}</th>
                        <th>{t("code")}</th>
                        <th>{t("projectName")}</th>
                        <th>{t("description")}</th>
                        <th>{t("status")}</th>
                        <th>{t("actions")}</th>
                      </tr>
                    </thead>

                    <tbody>

                      {projects.map((project) => (
                        <tr key={project.id}>

                          <td>{project.id}</td>

                          <td>{project.code}</td>

                          <td>{project.name}</td>

                          <td>
                            {project.description || "-"}
                          </td>

                          <td>
                            <span className="status-badge">
                              {t(project.status)}
                            </span>
                          </td>

                          <td>
                            <div className="project-actions">

                              <button
                                className="edit-button"
                                onClick={() =>
                                  handleEdit(project)
                                }
                              >
                                {t("edit")}
                              </button>

                              <button
                                className="delete-button"
                                onClick={() =>
                                  handleDelete(project)
                                }
                              >
                                {t("delete")}
                              </button>

                            </div>
                          </td>

                        </tr>
                      ))}

                    </tbody>

                  </table>

                </div>
              )}

          </div>
        </>
      )}

      {showForm && (
        <ProjectForm
          project={editingProject}
          onProjectCreated={handleProjectCreated}
          onProjectUpdated={handleProjectUpdated}
          onCancel={handleCancelForm}
        />
      )}

    </div>
  );
}

export default Projects;