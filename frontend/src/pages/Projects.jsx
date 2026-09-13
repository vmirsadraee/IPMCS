import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import ProjectForm from "../components/ProjectForm";
import ProjectSetupWizard from "../components/ProjectSetupWizard";

function Projects() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const filteredProjects = projects.filter((project) => {
    const search = searchTerm.toLowerCase().trim();

    const matchesSearch =
      project.code?.toLowerCase().includes(search) ||
      project.name?.toLowerCase().includes(search) ||
      project.description?.toLowerCase().includes(search);

    const matchesStatus =
      statusFilter === "all" ||
      project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleProjectCreated = (newProject) => {
    setProjects((previous) => [
      ...previous,
      newProject,
    ]);

    setShowWizard(false);
    setShowForm(false);
    setEditingProject(null);

    navigate(`/projects/${newProject.id}`);
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
    setShowWizard(false);
  };

  const handleDelete = async (project) => {
    const confirmed = window.confirm(
      t("confirmDelete") +
        ' "' +
        project.name +
        '"?'
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/projects/" +
          project.id,
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

  const handleCancelWizard = () => {
    setShowWizard(false);
  };

  const handleNewProject = () => {
    setEditingProject(null);
    setShowForm(false);
    setShowWizard(true);
  };

  return (
    <div className="projects-page">

      {/* =====================================
          New Project Wizard
      ===================================== */}

      {showWizard && (

        <ProjectSetupWizard
          onProjectCreated={
            handleProjectCreated
          }
          onCancel={
            handleCancelWizard
          }
        />

      )}


      {/* =====================================
          Edit Project
      ===================================== */}

      {!showWizard && showForm && (

        <ProjectForm
          project={editingProject}
          onProjectCreated={
            handleProjectCreated
          }
          onProjectUpdated={
            handleProjectUpdated
          }
          onCancel={
            handleCancelForm
          }
        />

      )}


      {/* =====================================
          Projects List
      ===================================== */}

      {!showWizard && !showForm && (

        <>

          <div className="page-header">

            <div>

              <h1>
                {t("projectsTitle")}
              </h1>

              <p>
                {t("projectsDescription")}
              </p>

            </div>


            <button
              className="primary-button"
              onClick={handleNewProject}
            >
              + {t("newProject")}
            </button>

          </div>


          <div className="projects-card">

            <div className="projects-card-header">

              <h2>
                {t("projectList")}
              </h2>

              <span>
                {filteredProjects.length}{" "}
                {t("projectsCount")}
              </span>

            </div>


            <div className="projects-toolbar">

              <input
                type="text"
                className="search-input"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder={t(
                  "searchProjects"
                )}
              />


              <select
                className="status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >

                <option value="all">
                  {t("allStatuses")}
                </option>

                <option value="planning">
                  {t("planning")}
                </option>

                <option value="active">
                  {t("active")}
                </option>

                <option value="on_hold">
                  {t("onHold")}
                </option>

                <option value="completed">
                  {t("completed")}
                </option>

              </select>

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
              projects.length > 0 &&
              filteredProjects.length === 0 && (

                <p className="projects-message">
                  {t(
                    "noMatchingProjects"
                  )}
                </p>

              )}


            {!loading &&
              !error &&
              filteredProjects.length > 0 && (

                <div className="projects-table-wrapper">

                  <table className="projects-table">

                    <thead>

                      <tr>

                        <th>
                          {t("id")}
                        </th>

                        <th>
                          {t("code")}
                        </th>

                        <th>
                          {t("projectName")}
                        </th>

                        <th>
                          {t("description")}
                        </th>

                        <th>
                          {t("status")}
                        </th>

                        <th>
                          {t("actions")}
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      {filteredProjects.map(
                        (project) => (

                          <tr
                            key={
                              project.id
                            }
                          >

                            <td>
                              {project.id}
                            </td>

                            <td>
                              {project.code}
                            </td>

                            <td>
                              {project.name}
                            </td>

                            <td>
                              {project.description ||
                                "-"}
                            </td>

                            <td>

                              <span
                                className={`status-badge status-${project.status}`}
                              >
                                {t(
                                  project.status
                                )}
                              </span>

                            </td>

                            <td>

                              <div className="project-actions">

                                <button
                                  className="details-button"
                                  onClick={() =>
                                    navigate(
                                      `/projects/${project.id}`
                                    )
                                  }
                                >
                                  {t(
                                    "viewDetails"
                                  )}
                                </button>


                                <button
                                  className="edit-button"
                                  onClick={() =>
                                    handleEdit(
                                      project
                                    )
                                  }
                                >
                                  {t("edit")}
                                </button>


                                <button
                                  className="delete-button"
                                  onClick={() =>
                                    handleDelete(
                                      project
                                    )
                                  }
                                >
                                  {t("delete")}
                                </button>

                              </div>

                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              )}

          </div>

        </>

      )}

    </div>
  );
}

export default Projects;