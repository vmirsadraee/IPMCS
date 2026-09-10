import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

function getTranslation(t, key, fallback) {
  const translated = t(key);

  return translated === key ? fallback : translated;
}

function clampProgress(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return 0;
  }

  return Math.min(Math.max(number, 0), 100);
}


// =========================================
// WBS Task Row
// =========================================

function WBSTaskRow({
  task,
  level = 0,
  expandedTasks,
  onToggle,
  t,
}) {
  const hasChildren =
    Array.isArray(task.children) &&
    task.children.length > 0;

  const isExpanded = expandedTasks.has(task.id);

  const progress = clampProgress(task.progress);

  const weight = Number(task.weight);

  const statusLabel = getTranslation(
    t,
    task.status,
    task.status
  );

  return (
    <div className="wbs-task-node">

      <div
        className={`wbs-task-row ${
          task.include_in_progress
            ? ""
            : "wbs-task-row-excluded"
        }`}
      >

        {/* ---------------------------------
            Task
        --------------------------------- */}

        <div
          className="wbs-task-main"
          style={{
            paddingInlineStart: `${level * 24}px`,
          }}
        >

          {hasChildren ? (
            <button
              type="button"
              className="wbs-expand-button"
              onClick={() => onToggle(task.id)}
              aria-label={
                isExpanded
                  ? getTranslation(
                      t,
                      "collapseTask",
                      "Collapse task"
                    )
                  : getTranslation(
                      t,
                      "expandTask",
                      "Expand task"
                    )
              }
              title={
                isExpanded
                  ? getTranslation(
                      t,
                      "collapseTask",
                      "Collapse task"
                    )
                  : getTranslation(
                      t,
                      "expandTask",
                      "Expand task"
                    )
              }
            >
              <span
                className={`wbs-expand-icon ${
                  isExpanded ? "expanded" : ""
                }`}
              >
                ›
              </span>
            </button>
          ) : (
            <span className="wbs-expand-placeholder" />
          )}

          <div className="wbs-task-info">

            <div className="wbs-task-identity">

              <span className="wbs-task-code">
                {task.code || "-"}
              </span>

              {hasChildren && (
                <span className="wbs-parent-indicator">
                  {getTranslation(
                    t,
                    "wbsGroup",
                    "Group"
                  )}
                </span>
              )}

            </div>

            <strong className="wbs-task-name">
              {task.name || "-"}
            </strong>

            {!task.include_in_progress && (
              <span className="wbs-excluded-label">
                {getTranslation(
                  t,
                  "excludedFromProgress",
                  "Excluded from progress"
                )}
              </span>
            )}

          </div>

        </div>


        {/* ---------------------------------
            Progress
        --------------------------------- */}

        <div className="wbs-task-progress">

          <div className="wbs-progress-header">
            <span className="wbs-progress-value">
              {progress.toFixed(1)}%
            </span>
          </div>

          <div className="wbs-progress-track">

            <div
              className="wbs-progress-fill"
              style={{
                width: `${progress}%`,
              }}
            />

          </div>

        </div>


        {/* ---------------------------------
            Weight
        --------------------------------- */}

        <div className="wbs-task-weight">

          {Number.isNaN(weight)
            ? "0.0"
            : weight.toFixed(1)}
          %

        </div>


        {/* ---------------------------------
            Status
        --------------------------------- */}

        <div className="wbs-task-status">

          <span
            className={`status-badge status-${task.status}`}
          >
            {statusLabel}
          </span>

        </div>

      </div>


      {/* ---------------------------------
          Children
      --------------------------------- */}

      {hasChildren && isExpanded && (

        <div className="wbs-task-children">

          {task.children.map((child) => (

            <WBSTaskRow
              key={child.id}
              task={child}
              level={level + 1}
              expandedTasks={expandedTasks}
              onToggle={onToggle}
              t={t}
            />

          ))}

        </div>

      )}

    </div>
  );
}


// =========================================
// Project Details
// =========================================

function ProjectDetails() {

  const { t } = useLanguage();

  const { id } = useParams();

  const navigate = useNavigate();


  const [project, setProject] = useState(null);

  const [wbs, setWbs] = useState(null);

  const [projectProgress, setProjectProgress] =
    useState(null);


  const [expandedTasks, setExpandedTasks] =
    useState(new Set());


  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");


  // =======================================
  // Translations
  // =======================================

  const wbsTitle = getTranslation(
    t,
    "wbs",
    "Work Breakdown Structure"
  );

  const overallProgressLabel = getTranslation(
    t,
    "overallProgress",
    "Overall Progress"
  );

  const weightLabel = getTranslation(
    t,
    "weight",
    "Weight"
  );

  const progressLabel = getTranslation(
    t,
    "progress",
    "Progress"
  );

  const statusLabel = getTranslation(
    t,
    "status",
    "Status"
  );

  const taskLabel = getTranslation(
    t,
    "task",
    "Task"
  );

  const topLevelTasksLabel = getTranslation(
    t,
    "topLevelTasks",
    "top-level task(s)"
  );

  const totalWeightLabel = getTranslation(
    t,
    "totalWeight",
    "Total weight"
  );

  const noTasksLabel = getTranslation(
    t,
    "noTasks",
    "No tasks defined for this project."
  );


  // =======================================
  // Load Project Details
  // =======================================

  useEffect(() => {

    let cancelled = false;


    async function loadProjectDetails() {

      setLoading(true);

      setError("");


      try {

        const [
          projectsResponse,
          wbsResponse,
          progressResponse,
        ] = await Promise.all([

          fetch(
            "http://127.0.0.1:8000/api/projects"
          ),

          fetch(
            `http://127.0.0.1:8000/api/projects/${id}/wbs`
          ),

          fetch(
            `http://127.0.0.1:8000/api/projects/${id}/progress`
          ),

        ]);


        if (
          !projectsResponse.ok ||
          !wbsResponse.ok ||
          !progressResponse.ok
        ) {

          throw new Error(
            "Failed to fetch project details"
          );

        }


        const [
          projectsData,
          wbsData,
          progressData,
        ] = await Promise.all([

          projectsResponse.json(),

          wbsResponse.json(),

          progressResponse.json(),

        ]);


        if (cancelled) {
          return;
        }


        const selectedProject =
          projectsData.find(
            (item) =>
              String(item.id) === String(id)
          );


        if (!selectedProject) {

          setError("projectNotFound");

          return;

        }


        setProject(selectedProject);

        setWbs(wbsData);

        setProjectProgress(progressData);


        // -----------------------------------
        // Expand all WBS groups initially
        // -----------------------------------

        const initialExpanded = new Set();


        function collectExpandableTasks(tasks) {

          if (!Array.isArray(tasks)) {
            return;
          }


          tasks.forEach((task) => {

            if (
              Array.isArray(task.children) &&
              task.children.length > 0
            ) {

              initialExpanded.add(task.id);

              collectExpandableTasks(
                task.children
              );

            }

          });

        }


        collectExpandableTasks(
          wbsData?.tasks || []
        );


        setExpandedTasks(initialExpanded);

      } catch (loadError) {

        console.error(loadError);


        if (!cancelled) {

          setError("backendError");

        }

      } finally {

        if (!cancelled) {

          setLoading(false);

        }

      }

    }


    loadProjectDetails();


    return () => {

      cancelled = true;

    };

  }, [id]);


  // =======================================
  // Toggle WBS Task
  // =======================================

  const toggleTask = (taskId) => {

    setExpandedTasks((current) => {

      const next = new Set(current);


      if (next.has(taskId)) {

        next.delete(taskId);

      } else {

        next.add(taskId);

      }


      return next;

    });

  };


  // =======================================
  // Loading
  // =======================================

  if (loading) {

    return (

      <div className="project-details-page">

        <p className="projects-message">
          {t("loadingProject")}
        </p>

      </div>

    );

  }


  // =======================================
  // Error
  // =======================================

  if (error) {

    return (

      <div className="project-details-page">

        <div className="page-header">

          <div>

            <h1>
              {t("projectDetails")}
            </h1>

            <p>
              {t(error)}
            </p>

          </div>


          <button
            className="secondary-button"
            onClick={() =>
              navigate("/projects")
            }
          >
            ← {t("backToProjects")}
          </button>

        </div>

      </div>

    );

  }


  // =======================================
  // Calculated Values
  // =======================================

  const overallProgress = clampProgress(
    projectProgress?.progress ?? 0
  );


  const totalWeight = Number(
    projectProgress?.total_weight ?? 0
  );


  const topLevelTaskCount =
    projectProgress?.children?.length ?? 0;


  const wbsTasks = Array.isArray(wbs?.tasks)
    ? wbs.tasks
    : [];


  return (

    <div className="project-details-page">


      {/* ===================================
          Page Header
      =================================== */}

      <div className="page-header">

        <div>

          <h1>
            {project.name}
          </h1>

          <p>
            {t("projectDetailsDescription")}
          </p>

        </div>


        <div className="project-details-actions">

          <button
            className="secondary-button"
            onClick={() =>
              navigate("/projects")
            }
          >
            ← {t("backToProjects")}
          </button>


          <button
            className="primary-button"
            onClick={() =>
              navigate("/projects", {
                state: {
                  editProjectId: project.id,
                },
              })
            }
          >
            {t("edit")}
          </button>

        </div>

      </div>


      {/* ===================================
          Project Details Card
      =================================== */}

      <div className="project-details-card">


        {/* -----------------------------------
            Project Title
        ----------------------------------- */}

        <div className="project-details-title-row">

          <div>

            <span className="project-details-code">
              {project.code}
            </span>

            <h2>
              {project.name}
            </h2>

          </div>


          <span
            className={`status-badge status-${project.status}`}
          >
            {getTranslation(
              t,
              project.status,
              project.status
            )}
          </span>

        </div>


        <div className="project-details-divider" />


        {/* ===================================
            Project Information
        =================================== */}

        <section className="project-details-section">

          <h3>
            {getTranslation(
              t,
              "projectInformation",
              "Project Information"
            )}
          </h3>


          <div className="project-details-grid">

            <div className="project-detail-item">

              <span>
                {t("id")}
              </span>

              <strong>
                {project.id}
              </strong>

            </div>


            <div className="project-detail-item">

              <span>
                {t("code")}
              </span>

              <strong>
                {project.code || "-"}
              </strong>

            </div>


            <div className="project-detail-item">

              <span>
                {statusLabel}
              </span>

              <strong>
                {getTranslation(
                  t,
                  project.status,
                  project.status
                )}
              </strong>

            </div>

          </div>

        </section>


        {/* ===================================
            Project Description
        =================================== */}

        <section className="project-details-section">

          <h3>
            {t("description")}
          </h3>


          <div className="project-description-box">

            {project.description ||
              t("noDescription")}

          </div>

        </section>


        {/* ===================================
            Overall Project Progress
        =================================== */}

        <section className="project-details-section">

          <div className="project-overview-card">


            <div className="project-overview-header">

              <div>

                <span className="project-section-eyebrow">
                  {overallProgressLabel}
                </span>

                <h3>
                  {getTranslation(
                    t,
                    "projectOverview",
                    "Project Overview"
                  )}
                </h3>

              </div>


              <strong className="project-overview-progress-value">

                {overallProgress.toFixed(1)}%

              </strong>

            </div>


            <div className="project-overview-progress-track">

              <div
                className="project-overview-progress-fill"
                style={{
                  width: `${overallProgress}%`,
                }}
              />

            </div>


            <div className="project-overview-metrics">


              <div className="project-overview-metric">

                <span>
                  {topLevelTasksLabel}
                </span>

                <strong>
                  {topLevelTaskCount}
                </strong>

              </div>


              <div className="project-overview-metric">

                <span>
                  {totalWeightLabel}
                </span>

                <strong>

                  {Number.isNaN(totalWeight)
                    ? "0.0"
                    : totalWeight.toFixed(1)}

                  %

                </strong>

              </div>


              <div className="project-overview-metric">

                <span>
                  {getTranslation(
                    t,
                    "projectStatus",
                    "Project Status"
                  )}
                </span>

                <strong>
                  {getTranslation(
                    t,
                    project.status,
                    project.status
                  )}
                </strong>

              </div>


            </div>

          </div>

        </section>


        {/* ===================================
            Work Breakdown Structure
        =================================== */}

        <section className="project-details-section">


          <div className="wbs-card">


            <div className="wbs-header">

              <div>

                <span className="project-section-eyebrow">
                  {taskLabel}
                </span>

                <h3>
                  {wbsTitle}
                </h3>

              </div>


              <div className="wbs-summary">

                <span>
                  {topLevelTaskCount}{" "}
                  {topLevelTasksLabel}
                </span>

                <span>
                  {totalWeightLabel}:{" "}
                  {Number.isNaN(totalWeight)
                    ? "0.0"
                    : totalWeight.toFixed(1)}
                  %
                </span>

              </div>

            </div>


            {/* ---------------------------------
                WBS Table Header
            --------------------------------- */}

            {wbsTasks.length > 0 && (

              <div className="wbs-table-header">

                <div className="wbs-header-task">
                  {taskLabel}
                </div>

                <div className="wbs-header-progress">
                  {progressLabel}
                </div>

                <div className="wbs-header-weight">
                  {weightLabel}
                </div>

                <div className="wbs-header-status">
                  {statusLabel}
                </div>

              </div>

            )}


            {/* ---------------------------------
                WBS Tree
            --------------------------------- */}

            {wbsTasks.length > 0 ? (

              <div className="wbs-tree">

                {wbsTasks.map((task) => (

                  <WBSTaskRow
                    key={task.id}
                    task={task}
                    expandedTasks={expandedTasks}
                    onToggle={toggleTask}
                    t={t}
                  />

                ))}

              </div>

            ) : (

              <div className="wbs-empty">

                {noTasksLabel}

              </div>

            )}


          </div>

        </section>


      </div>

    </div>

  );

}


export default ProjectDetails;