
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import "./ProjectDetails.css";

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
// Task Details
// =========================================

function TaskDetails({
  task,
  onClose,
  t,
}) {
  if (!task) {
    return null;
  }

  const progress = clampProgress(task.progress);
  const weight = Number(task.weight);

  const statusLabel = getTranslation(
    t,
    task.status,
    task.status
  );

  const priorityLabel = getTranslation(
    t,
    task.priority,
    task.priority || "-"
  );

  return (
    <div className="task-details-panel">

      <div className="task-details-header">

        <div>

          <span className="project-section-eyebrow">
            {getTranslation(
              t,
              "taskDetails",
              "Task Details"
            )}
          </span>

          <h4 className="task-details-title">
            {task.name || "-"}
          </h4>

        </div>

        <button
          type="button"
          className="task-details-close"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label={getTranslation(
            t,
            "close",
            "Close"
          )}
          title={getTranslation(
            t,
            "close",
            "Close"
          )}
        >
          ×
        </button>

      </div>


      <div className="task-details-identity">

        <span className="wbs-task-code">
          {task.code || "-"}
        </span>

        {task.include_in_progress === false && (
          <span className="wbs-excluded-label">
            {getTranslation(
              t,
              "excludedFromProgress",
              "Excluded from progress"
            )}
          </span>
        )}

      </div>


      <div className="task-details-grid">

        <div className="task-detail-item">

          <span>
            {getTranslation(
              t,
              "status",
              "Status"
            )}
          </span>

          <strong>
            <span
              className={`status-badge status-${task.status}`}
            >
              {statusLabel}
            </span>
          </strong>

        </div>


        <div className="task-detail-item">

          <span>
            {getTranslation(
              t,
              "priority",
              "Priority"
            )}
          </span>

          <strong>
            {priorityLabel}
          </strong>

        </div>


        <div className="task-detail-item">

          <span>
            {getTranslation(
              t,
              "progress",
              "Progress"
            )}
          </span>

          <strong>
            {progress.toFixed(1)}%
          </strong>

        </div>


        <div className="task-detail-item">

          <span>
            {getTranslation(
              t,
              "weight",
              "Weight"
            )}
          </span>

          <strong>
            {Number.isNaN(weight)
              ? "0.0"
              : weight.toFixed(1)}
            %
          </strong>

        </div>

      </div>


      <div className="task-details-progress">

        <div className="task-details-progress-header">

          <span>
            {getTranslation(
              t,
              "progress",
              "Progress"
            )}
          </span>

          <strong>
            {progress.toFixed(1)}%
          </strong>

        </div>

        <div className="project-overview-progress-track">

          <div
            className="project-overview-progress-fill"
            style={{
              width: `${progress}%`,
            }}
          />

        </div>

      </div>


      <div className="task-details-section">

        <h5>
          {getTranslation(
            t,
            "schedule",
            "Schedule"
          )}
        </h5>

        <div className="task-details-grid">

          <div className="task-detail-item">

            <span>
              {getTranslation(
                t,
                "plannedStart",
                "Planned Start"
              )}
            </span>

            <strong>
              {task.planned_start || "-"}
            </strong>

          </div>


          <div className="task-detail-item">

            <span>
              {getTranslation(
                t,
                "plannedFinish",
                "Planned Finish"
              )}
            </span>

            <strong>
              {task.planned_finish ||
                task.planned_end ||
                "-"}
            </strong>

          </div>


          <div className="task-detail-item">

            <span>
              {getTranslation(
                t,
                "actualStart",
                "Actual Start"
              )}
            </span>

            <strong>
              {task.actual_start || "-"}
            </strong>

          </div>


          <div className="task-detail-item">

            <span>
              {getTranslation(
                t,
                "actualFinish",
                "Actual Finish"
              )}
            </span>

            <strong>
              {task.actual_finish ||
                task.actual_end ||
                "-"}
            </strong>

          </div>

        </div>

      </div>


      <div className="task-details-section">

        <h5>
          {getTranslation(
            t,
            "description",
            "Description"
          )}
        </h5>

        <div className="task-details-description">

          {task.description ||
            getTranslation(
              t,
              "noDescription",
              "No description available."
            )}

        </div>

      </div>


      <div className="task-details-section">

        <h5>
          {getTranslation(
            t,
            "notes",
            "Notes"
          )}
        </h5>

        <div className="task-details-description">

          {task.notes ||
            getTranslation(
              t,
              "noNotes",
              "No notes available."
            )}

        </div>

      </div>

    </div>
  );
}


// =========================================
// Add Child Task Form
// =========================================

function AddChildTaskForm({
  parentTask,
  onCancel,
  onCreated,
  t,
}) {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    weight: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };


  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.code.trim()) {
      setError(
        getTranslation(
          t,
          "taskCodeRequired",
          "Task code is required."
        )
      );

      return;
    }

    if (!formData.name.trim()) {
      setError(
        getTranslation(
          t,
          "taskNameRequired",
          "Task name is required."
        )
      );

      return;
    }

    const numericWeight =
      parseFloat(formData.weight);

    if (
      Number.isNaN(numericWeight) ||
      numericWeight < 0 ||
      numericWeight > 100
    ) {
      setError(
        getTranslation(
          t,
          "taskWeightInvalid",
          "Weight must be between 0 and 100."
        )
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/tasks",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            project_id:
              parentTask.project_id,

            parent_task_id:
              parentTask.id,

            code:
              formData.code.trim(),

            name:
              formData.name.trim(),

            description:
              null,

            status:
              "not_started",

            priority:
              "medium",

            progress_type:
              "manual",

            include_in_progress:
              true,

            planned_start:
              null,

            planned_end:
              null,

            actual_start:
              null,

            actual_end:
              null,

            progress:
              0,

            weight:
              numericWeight,
          }),
        }
      );


      if (!response.ok) {
        let message =
          getTranslation(
            t,
            "createTaskFailed",
            "Unable to create the task."
          );

        try {
          const errorData =
            await response.json();

          if (errorData?.detail) {
            message =
              Array.isArray(
                errorData.detail
              )
                ? errorData.detail
                    .map(
                      (item) =>
                        item.msg ||
                        "Validation error"
                    )
                    .join(", ")
                : String(
                    errorData.detail
                  );
          }
        } catch {
          // Keep default message.
        }

        throw new Error(message);
      }


      const createdTask =
        await response.json();

      onCreated(createdTask);

    } catch (submitError) {

      console.error(
        submitError
      );

      setError(
        submitError.message ||
          getTranslation(
            t,
            "createTaskFailed",
            "Unable to create the task."
          )
      );

    } finally {

      setSaving(false);

    }
  };


  return (
    <div
      className="task-add-child-panel"
      onClick={(event) =>
        event.stopPropagation()
      }
    >

      <div className="task-add-child-header">

        <div>

          <span className="project-section-eyebrow">
            {getTranslation(
              t,
              "newSubtask",
              "New Subtask"
            )}
          </span>

          <strong>
            {getTranslation(
              t,
              "addChildTo",
              "Add child task to"
            )}{" "}
            {parentTask.code} —{" "}
            {parentTask.name}
          </strong>

        </div>

        <button
          type="button"
          className="task-details-close"
          onClick={onCancel}
          disabled={saving}
        >
          ×
        </button>

      </div>


      <form
        className="task-add-child-form"
        onSubmit={handleSubmit}
      >

        <div className="task-add-child-grid">

          <div className="form-group">

            <label>
              {getTranslation(
                t,
                "code",
                "Code"
              )}
            </label>

            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              placeholder="T-001-01"
              disabled={saving}
              autoFocus
            />

          </div>


          <div className="form-group">

            <label>
              {getTranslation(
                t,
                "task",
                "Task"
              )}
            </label>

            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={getTranslation(
                t,
                "subtaskNamePlaceholder",
                "e.g. Foundation Excavation"
              )}
              disabled={saving}
            />

          </div>


          <div className="form-group">

            <label>
              {getTranslation(
                t,
                "weight",
                "Weight"
              )}
            </label>

            <div className="project-wizard-weight-input">

              <input
                type="number"
                name="weight"
                min="0"
                max="100"
                step="0.01"
                value={
                  formData.weight
                }
                onChange={handleChange}
                placeholder="0"
                disabled={saving}
              />

              <span>%</span>

            </div>

          </div>

        </div>


        {error && (

          <div
            className="project-wizard-error"
            role="alert"
          >
            {error}
          </div>

        )}


        <div className="task-add-child-actions">

          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={saving}
          >
            {getTranslation(
              t,
              "cancel",
              "Cancel"
            )}
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving
              ? getTranslation(
                  t,
                  "saving",
                  "Saving..."
                )
              : getTranslation(
                  t,
                  "addTask",
                  "Add Task"
                )}
          </button>

        </div>

      </form>

    </div>
  );
}


// =========================================
// WBS Task Row
// =========================================

function WBSTaskRow({
  task,
  level = 0,
  expandedTasks,
  onToggle,
  selectedTaskId,
  onSelect,
  onCloseTask,
  addChildTaskId,
  onStartAddChild,
  onCancelAddChild,
  onChildCreated,
  t,
}) {
  const hasChildren =
    Array.isArray(task.children) &&
    task.children.length > 0;

  const isExpanded =
    expandedTasks.has(task.id);

  const isSelected =
    selectedTaskId === task.id;

  const isAddingChild =
    addChildTaskId === task.id;

  const progress =
    clampProgress(task.progress);

  const weight =
    Number(task.weight);

  const statusLabel =
    getTranslation(
      t,
      task.status,
      task.status
    );


  return (
    <div className="wbs-task-node">

      {/* =================================
          Task Row
      ================================= */}

     <div
        className={`wbs-task-row wbs-level-${Math.min(
          level,
          4
        )} ${
          task.include_in_progress
            ? ""
            : "wbs-task-row-excluded"
        } ${
          isSelected
            ? "wbs-task-row-selected"
            : ""
        }`}
        onClick={() =>
          onSelect(task)
        }
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {

          if (
            event.key === "Enter" ||
            event.key === " "
          ) {

            event.preventDefault();

            onSelect(task);

          }

        }}
      >

        {/* ---------------------------------
            Task
        --------------------------------- */}

        <div className="wbs-task-main">

          {hasChildren ? (

            <button
              type="button"
              className="wbs-expand-button"
              onClick={(event) => {

                event.stopPropagation();

                onToggle(task.id);

              }}
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
            >

              <span
                className={`wbs-expand-icon ${
                  isExpanded
                    ? "expanded"
                    : ""
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


        {/* ---------------------------------
            Add Child
        --------------------------------- */}

        <div
          className="wbs-task-actions"
          onClick={(event) =>
            event.stopPropagation()
          }
        >

          <button
            type="button"
            className="wbs-add-child-button"
            onClick={() =>
              onStartAddChild(task.id)
            }
            title={getTranslation(
              t,
              "addSubtask",
              "Add Subtask"
            )}
            aria-label={getTranslation(
              t,
              "addSubtask",
              "Add Subtask"
            )}
          >
            +
          </button>

        </div>

      </div>


      {/* =================================
          Add Child Form
      ================================= */}

      {isAddingChild && (

        <div
          className="wbs-inline-child-form"
          style={{
            marginInlineStart:
              `${(level + 1) * 24}px`,
          }}
        >

          <AddChildTaskForm
            parentTask={task}
            onCancel={
              onCancelAddChild
            }
            onCreated={
              onChildCreated
            }
            t={t}
          />

        </div>

      )}


      {/* =================================
          Task Details
      ================================= */}

      {isSelected && (

        <TaskDetails
          task={task}
          onClose={onCloseTask}
          t={t}
        />

      )}


      {/* =================================
          Children
      ================================= */}

      {hasChildren &&
        isExpanded && (

        <div className="wbs-task-children">

          {task.children.map(
            (child) => (

              <WBSTaskRow
                key={child.id}
                task={child}
                level={level + 1}
                expandedTasks={
                  expandedTasks
                }
                onToggle={
                  onToggle
                }
                selectedTaskId={
                  selectedTaskId
                }
                onSelect={
                  onSelect
                }
                onCloseTask={
                  onCloseTask
                }
                addChildTaskId={
                  addChildTaskId
                }
                onStartAddChild={
                  onStartAddChild
                }
                onCancelAddChild={
                  onCancelAddChild
                }
                onChildCreated={
                  onChildCreated
                }
                t={t}
              />

            )
          )}

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

  const navigate =
    useNavigate();


  const [project, setProject] =
    useState(null);

  const [wbs, setWbs] =
    useState(null);

  const [projectProgress, setProjectProgress] =
    useState(null);


  const [expandedTasks, setExpandedTasks] =
    useState(new Set());


  const [activeTab, setActiveTab] =
    useState("overview");


  const [selectedTask, setSelectedTask] =
    useState(null);


  const [addChildTaskId, setAddChildTaskId] =
    useState(null);


  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  // =======================================
  // Translations
  // =======================================

  const wbsTitle =
    getTranslation(
      t,
      "wbs",
      "Work Breakdown Structure"
    );

  const overallProgressLabel =
    getTranslation(
      t,
      "overallProgress",
      "Overall Progress"
    );

  const weightLabel =
    getTranslation(
      t,
      "weight",
      "Weight"
    );

  const progressLabel =
    getTranslation(
      t,
      "progress",
      "Progress"
    );

  const statusLabel =
    getTranslation(
      t,
      "status",
      "Status"
    );

  const taskLabel =
    getTranslation(
      t,
      "task",
      "Task"
    );

  const topLevelTasksLabel =
    getTranslation(
      t,
      "topLevelTasks",
      "top-level task(s)"
    );

  const totalWeightLabel =
    getTranslation(
      t,
      "totalWeight",
      "Total weight"
    );

  const noTasksLabel =
    getTranslation(
      t,
      "noTasks",
      "No tasks defined for this project."
    );


  // =======================================
  // Control Center Tabs
  // =======================================

  const controlTabs = [
    {
      id: "overview",
      label: getTranslation(
        t,
        "overview",
        "Overview"
      ),
    },
    {
      id: "wbs",
      label: getTranslation(
        t,
        "wbs",
        "WBS"
      ),
    },
    {
      id: "schedule",
      label: getTranslation(
        t,
        "schedule",
        "Schedule"
      ),
    },
    {
      id: "resources",
      label: getTranslation(
        t,
        "resources",
        "Resources"
      ),
    },
    {
      id: "costs",
      label: getTranslation(
        t,
        "costs",
        "Costs"
      ),
    },
    {
      id: "reports",
      label: getTranslation(
        t,
        "reports",
        "Reports"
      ),
    },
  ];


  // =======================================
  // Load Project Details
  // =======================================

  const loadProjectDetails =
    async () => {

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


        const selectedProject =
          projectsData.find(
            (item) =>
              String(item.id) ===
              String(id)
          );


        if (!selectedProject) {

          setError(
            "projectNotFound"
          );

          return;

        }


        setProject(
          selectedProject
        );

        setWbs(
          wbsData
        );

        setProjectProgress(
          progressData
        );


        // -----------------------------------
        // Expand all groups
        // -----------------------------------

        const initialExpanded =
          new Set();


        function collectExpandableTasks(
          tasks
        ) {

          if (!Array.isArray(tasks)) {
            return;
          }


          tasks.forEach(
            (task) => {

              if (
                Array.isArray(
                  task.children
                ) &&
                task.children.length > 0
              ) {

                initialExpanded.add(
                  task.id
                );

                collectExpandableTasks(
                  task.children
                );

              }

            }
          );

        }


        collectExpandableTasks(
          wbsData?.tasks || []
        );


        setExpandedTasks(
          initialExpanded
        );


        setSelectedTask(
          null
        );

        setAddChildTaskId(
          null
        );

      } catch (loadError) {

        console.error(
          loadError
        );

        setError(
          "backendError"
        );

      } finally {

        setLoading(false);

      }

    };


  useEffect(() => {

    let cancelled = false;


    async function initialLoad() {

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
              String(item.id) ===
              String(id)
          );


        if (!selectedProject) {

          setError(
            "projectNotFound"
          );

          return;

        }


        setProject(
          selectedProject
        );

        setWbs(
          wbsData
        );

        setProjectProgress(
          progressData
        );


        const initialExpanded =
          new Set();


        function collectExpandableTasks(
          tasks
        ) {

          if (!Array.isArray(tasks)) {
            return;
          }


          tasks.forEach(
            (task) => {

              if (
                Array.isArray(
                  task.children
                ) &&
                task.children.length > 0
              ) {

                initialExpanded.add(
                  task.id
                );

                collectExpandableTasks(
                  task.children
                );

              }

            }
          );

        }


        collectExpandableTasks(
          wbsData?.tasks || []
        );


        setExpandedTasks(
          initialExpanded
        );

      } catch (loadError) {

        console.error(
          loadError
        );

        if (!cancelled) {

          setError(
            "backendError"
          );

        }

      } finally {

        if (!cancelled) {

          setLoading(false);

        }

      }

    }


    initialLoad();


    return () => {

      cancelled = true;

    };

  }, [id]);


  // =======================================
  // Toggle WBS Task
  // =======================================

  const toggleTask =
    (taskId) => {

      setExpandedTasks(
        (current) => {

          const next =
            new Set(current);


          if (next.has(taskId)) {

            next.delete(taskId);

          } else {

            next.add(taskId);

          }


          return next;

        }
      );

    };


  // =======================================
  // Select WBS Task
  // =======================================

  const selectTask =
    (task) => {

      setSelectedTask(
        (current) => {

          if (
            current?.id ===
            task.id
          ) {

            return null;

          }

          return task;

        }
      );

    };


  // =======================================
  // Close Task Details
  // =======================================

  const closeTaskDetails =
    () => {

      setSelectedTask(
        null
      );

    };


  // =======================================
  // Add Child
  // =======================================

  const startAddChild =
    (taskId) => {

      setSelectedTask(
        null
      );

      setAddChildTaskId(
        taskId
      );


      // Make sure the parent
      // is expanded.

      setExpandedTasks(
        (current) => {

          const next =
            new Set(current);

          next.add(taskId);

          return next;

        }
      );

    };


  const cancelAddChild =
    () => {

      setAddChildTaskId(
        null
      );

    };


  const handleChildCreated =
    async () => {

      setAddChildTaskId(
        null
      );


      /*
       * Reload WBS and progress
       * after successful creation.
       */

      try {

        const [
          wbsResponse,
          progressResponse,
        ] = await Promise.all([

          fetch(
            `http://127.0.0.1:8000/api/projects/${id}/wbs`
          ),

          fetch(
            `http://127.0.0.1:8000/api/projects/${id}/progress`
          ),

        ]);


        if (
          !wbsResponse.ok ||
          !progressResponse.ok
        ) {

          throw new Error(
            "Failed to refresh WBS"
          );

        }


        const [
          wbsData,
          progressData,
        ] = await Promise.all([

          wbsResponse.json(),

          progressResponse.json(),

        ]);


        setWbs(
          wbsData
        );

        setProjectProgress(
          progressData
        );


        /*
         * Expand all levels after
         * adding a new child.
         */

        const expanded =
          new Set();


        function collect(
          tasks
        ) {

          if (!Array.isArray(tasks)) {
            return;
          }


          tasks.forEach(
            (task) => {

              if (
                Array.isArray(
                  task.children
                ) &&
                task.children.length > 0
              ) {

                expanded.add(
                  task.id
                );

                collect(
                  task.children
                );

              }

            }
          );

        }


        collect(
          wbsData?.tasks || []
        );


        setExpandedTasks(
          expanded
        );

      } catch (refreshError) {

        console.error(
          refreshError
        );

        setError(
          "backendError"
        );

      }

    };


  // =======================================
  // Loading
  // =======================================

  if (loading) {

    return (

      <div className="project-details-page">

        <p className="projects-message">
          {getTranslation(
            t,
            "loadingProject",
            "Loading project..."
          )}
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
              {getTranslation(
                t,
                "projectDetails",
                "Project Details"
              )}
            </h1>

            <p>
              {getTranslation(
                t,
                error,
                "Unable to load project."
              )}
            </p>

          </div>


          <button
            className="secondary-button"
            onClick={() =>
              navigate(
                "/projects"
              )
            }
          >
            ←{" "}
            {getTranslation(
              t,
              "backToProjects",
              "Back to Projects"
            )}
          </button>

        </div>

      </div>

    );

  }


  // =======================================
  // Calculated Values
  // =======================================

  const overallProgress =
    clampProgress(
      projectProgress?.progress ??
        0
    );


  const totalWeight =
    Number(
      projectProgress?.total_weight ??
        0
    );


  const topLevelTaskCount =
    projectProgress?.children
      ?.length ?? 0;


  const wbsTasks =
    Array.isArray(
      wbs?.tasks
    )
      ? wbs.tasks
      : [];


  return (

    <div className="project-details-page">


      {/* ===================================
          Page Header
      =================================== */}

      <div className="page-header">

        <div>

          <span className="project-details-code">
            {project.code}
          </span>

          <h1>
            {project.name}
          </h1>

          <p>
            {getTranslation(
              t,
              "projectDetailsDescription",
              "Project Control Center"
            )}
          </p>

        </div>


        <div className="project-details-actions">

          <button
            className="secondary-button"
            onClick={() =>
              navigate(
                "/projects"
              )
            }
          >
            ←{" "}
            {getTranslation(
              t,
              "backToProjects",
              "Back to Projects"
            )}
          </button>


          <button
            className="primary-button"
            onClick={() =>
              navigate(
                "/projects",
                {
                  state: {
                    editProjectId:
                      project.id,
                  },
                }
              )
            }
          >
            {getTranslation(
              t,
              "edit",
              "Edit"
            )}
          </button>

        </div>

      </div>


      {/* ===================================
          Project Control Center
      =================================== */}

      <div className="project-details-card">


        {/* ===================================
            Control Center Navigation
        =================================== */}

        <nav
          className="project-control-tabs"
          aria-label={getTranslation(
            t,
            "projectControlCenter",
            "Project Control Center"
          )}
        >

          {controlTabs.map(
            (tab) => (

              <button
                key={tab.id}
                type="button"
                className={`project-control-tab ${
                  activeTab ===
                  tab.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setActiveTab(
                    tab.id
                  )
                }
                aria-current={
                  activeTab ===
                  tab.id
                    ? "page"
                    : undefined
                }
              >
                {tab.label}
              </button>

            )
          )}

        </nav>


        {/* ===================================
            Overview
        =================================== */}

        {activeTab ===
          "overview" && (

          <div className="project-control-tab-content">

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
                    {getTranslation(
                      t,
                      "id",
                      "ID"
                    )}
                  </span>

                  <strong>
                    {project.id}
                  </strong>

                </div>


                <div className="project-detail-item">

                  <span>
                    {getTranslation(
                      t,
                      "code",
                      "Code"
                    )}
                  </span>

                  <strong>
                    {project.code ||
                      "-"}
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


            <section className="project-details-section">

              <h3>
                {getTranslation(
                  t,
                  "description",
                  "Description"
                )}
              </h3>


              <div className="project-description-box">

                {project.description ||
                  getTranslation(
                    t,
                    "noDescription",
                    "No description"
                  )}

              </div>

            </section>


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
                    {overallProgress.toFixed(
                      1
                    )}
                    %
                  </strong>

                </div>


                <div className="project-overview-progress-track">

                  <div
                    className="project-overview-progress-fill"
                    style={{
                      width:
                        `${overallProgress}%`,
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
                      {Number.isNaN(
                        totalWeight
                      )
                        ? "0.0"
                        : totalWeight.toFixed(
                            1
                          )}
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

          </div>

        )}


        {/* ===================================
            WBS
        =================================== */}

        {activeTab ===
          "wbs" && (

          <div className="project-control-tab-content">

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
                      {Number.isNaN(
                        totalWeight
                      )
                        ? "0.0"
                        : totalWeight.toFixed(
                            1
                          )}
                      %
                    </span>

                  </div>

                </div>


                {/* ---------------------------------
                    WBS Explanation
                --------------------------------- */}

                <div className="project-wizard-next-stage">

                  <span className="project-section-eyebrow">
                    {getTranslation(
                      t,
                      "wbsStructure",
                      "WBS Structure"
                    )}
                  </span>

                  <strong>
                    {getTranslation(
                      t,
                      "wbsHierarchyTitle",
                      "Build the project hierarchy"
                    )}
                  </strong>

                  <p>
                    {getTranslation(
                      t,
                      "wbsHierarchyDescription",
                      "The operations created during project setup are the main project operations. Use the + button on any operation to create its detailed subtasks. The same action can be used at deeper levels to build the full WBS hierarchy."
                    )}
                  </p>

                </div>


                {/* ---------------------------------
                    WBS Table Header
                --------------------------------- */}

                {wbsTasks.length >
                  0 && (

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

                    <div className="wbs-header-actions">
                      {getTranslation(
                        t,
                        "actions",
                        "Actions"
                      )}
                    </div>

                  </div>

                )}


                {/* ---------------------------------
                    WBS Tree
                --------------------------------- */}

                {wbsTasks.length >
                  0 ? (

                  <div className="wbs-tree">

                    {wbsTasks.map(
                      (task) => (

                        <WBSTaskRow
                          key={
                            task.id
                          }
                          task={
                            task
                          }
                          expandedTasks={
                            expandedTasks
                          }
                          onToggle={
                            toggleTask
                          }
                          selectedTaskId={
                            selectedTask?.id
                          }
                          onSelect={
                            selectTask
                          }
                          onCloseTask={
                            closeTaskDetails
                          }
                          addChildTaskId={
                            addChildTaskId
                          }
                          onStartAddChild={
                            startAddChild
                          }
                          onCancelAddChild={
                            cancelAddChild
                          }
                          onChildCreated={
                            handleChildCreated
                          }
                          t={t}
                        />

                      )
                    )}

                  </div>

                ) : (

                  <div className="wbs-empty">

                    {noTasksLabel}

                  </div>

                )}

              </div>

            </section>

          </div>

        )}


        {/* ===================================
            Schedule
        =================================== */}

        {activeTab ===
          "schedule" && (

          <div className="project-control-placeholder">

            <span className="project-section-eyebrow">
              {getTranslation(
                t,
                "schedule",
                "Schedule"
              )}
            </span>

            <h3>
              {getTranslation(
                t,
                "scheduleComingSoon",
                "Schedule Control"
              )}
            </h3>

            <p>
              {getTranslation(
                t,
                "scheduleComingSoonDescription",
                "Schedule management will be connected to project tasks and dependencies."
              )}
            </p>

          </div>

        )}


        {/* ===================================
            Resources
        =================================== */}

        {activeTab ===
          "resources" && (

          <div className="project-control-placeholder">

            <span className="project-section-eyebrow">
              {getTranslation(
                t,
                "resources",
                "Resources"
              )}
            </span>

            <h3>
              {getTranslation(
                t,
                "resourcesComingSoon",
                "Resource Control"
              )}
            </h3>

            <p>
              {getTranslation(
                t,
                "resourcesComingSoonDescription",
                "Resource planning and allocation will be connected to project activities."
              )}
            </p>

          </div>

        )}


        {/* ===================================
            Costs
        =================================== */}

        {activeTab ===
          "costs" && (

          <div className="project-control-placeholder">

            <span className="project-section-eyebrow">
              {getTranslation(
                t,
                "costs",
                "Costs"
              )}
            </span>

            <h3>
              {getTranslation(
                t,
                "costsComingSoon",
                "Cost Control"
              )}
            </h3>

            <p>
              {getTranslation(
                t,
                "costsComingSoonDescription",
                "Cost planning, commitments and actual costs will be connected to the project cost structure."
              )}
            </p>

          </div>

        )}


        {/* ===================================
            Reports
        =================================== */}

        {activeTab ===
          "reports" && (

          <div className="project-control-placeholder">

            <span className="project-section-eyebrow">
              {getTranslation(
                t,
                "reports",
                "Reports"
              )}
            </span>

            <h3>
              {getTranslation(
                t,
                "reportsComingSoon",
                "Project Reports"
              )}
            </h3>

            <p>
              {getTranslation(
                t,
                "reportsComingSoonDescription",
                "Project performance reports and control summaries will be available here."
              )}
            </p>

          </div>

        )}

      </div>

    </div>

  );
}


export default ProjectDetails;
