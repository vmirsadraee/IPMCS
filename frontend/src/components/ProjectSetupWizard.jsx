
import { useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";

function getTranslation(t, key, fallback) {
  const translated = t(key);

  return translated === key ? fallback : translated;
}

function ProjectSetupWizard({ onProjectCreated, onCancel }) {
  const { t } = useLanguage();

  const [currentStep, setCurrentStep] = useState(1);

  /*
   * =====================================================
   * IMPORTANT WIZARD RULE
   * =====================================================
   *
   * All wizard information remains local until the user
   * explicitly presses "Create Project" on the final step.
   *
   * Future wizard stages MUST follow the same rule.
   *
   * No API request that creates or modifies the project
   * should be made from Steps 1, 2, 3, or future preparation
   * stages.
   * =====================================================
   */

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    status: "planning",
  });

  /*
   * =====================================================
   * Main Project Operations
   *
   * These are first-level / top-level WBS items.
   *
   * They remain local until final creation.
   * =====================================================
   */

  const [wbsTasks, setWbsTasks] = useState([
    {
      id: 1,
      code: "WBS-01",
      name: "",
      weight: "",
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /*
   * State updates are asynchronous.
   *
   * This ref gives us an immediate submission lock and
   * prevents two rapid clicks from starting two creation
   * processes.
   */
  const submitLockRef = useRef(false);

  const steps = [
    {
      number: 1,
      title: getTranslation(
        t,
        "wizardBasics",
        "Project Basics"
      ),
      description: getTranslation(
        t,
        "wizardBasicsDescription",
        "Define the basic identity of the project."
      ),
    },
    {
      number: 2,
      title: getTranslation(
        t,
        "wizardProfile",
        "Project Profile"
      ),
      description: getTranslation(
        t,
        "wizardProfileDescription",
        "Add project information and review the initial status."
      ),
    },
    {
      number: 3,
      title: getTranslation(
        t,
        "wizardMainOperations",
        "Main Project Operations"
      ),
      description: getTranslation(
        t,
        "wizardMainOperationsDescription",
        "Define the major peer-level operations that make up the project."
      ),
    },
    {
      number: 4,
      title: getTranslation(
        t,
        "wizardReview",
        "Review & Create"
      ),
      description: getTranslation(
        t,
        "wizardReviewDescription",
        "Review the project before creating it."
      ),
    },
  ];

  /*
   * =====================================================
   * General Form Changes
   * =====================================================
   */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  /*
   * =====================================================
   * WBS Changes
   * =====================================================
   */

  const handleWbsChange = (id, field, value) => {
    setWbsTasks((previous) =>
      previous.map((task) =>
        task.id === id
          ? {
              ...task,
              [field]: value,
            }
          : task
      )
    );

    setError("");
  };

  const addWbsTask = () => {
    setWbsTasks((previous) => {
      const nextNumber = previous.length + 1;

      return [
        ...previous,
        {
          id: Date.now(),
          code: `WBS-${String(nextNumber).padStart(2, "0")}`,
          name: "",
          weight: "",
        },
      ];
    });

    setError("");
  };

  const removeWbsTask = (id) => {
    setWbsTasks((previous) =>
      previous.filter(
        (task) => task.id !== id
      )
    );

    setError("");
  };

  const getTotalWeight = () => {
    return wbsTasks.reduce(
      (total, task) => {
        const weight =
          parseFloat(task.weight) || 0;

        return total + weight;
      },
      0
    );
  };

  /*
   * =====================================================
   * Validation
   * =====================================================
   */

  const validateCurrentStep = () => {
    /*
     * -----------------------------------------------
     * Step 1
     * -----------------------------------------------
     */

    if (currentStep === 1) {
      if (!formData.code.trim()) {
        setError(
          getTranslation(
            t,
            "projectCodeRequired",
            "Project code is required."
          )
        );

        return false;
      }

      if (!formData.name.trim()) {
        setError(
          getTranslation(
            t,
            "projectNameRequired",
            "Project name is required."
          )
        );

        return false;
      }
    }

    /*
     * -----------------------------------------------
     * Step 3
     *
     * Only top-level operations are defined here.
     * -----------------------------------------------
     */

    if (currentStep === 3) {
      if (wbsTasks.length === 0) {
        setError(
          getTranslation(
            t,
            "mainOperationsRequired",
            "At least one main project operation is required."
          )
        );

        return false;
      }

      const emptyTask = wbsTasks.find(
        (task) => !task.name.trim()
      );

      if (emptyTask) {
        setError(
          getTranslation(
            t,
            "mainOperationNameRequired",
            "Every main project operation must have a name."
          )
        );

        return false;
      }

      const emptyCode = wbsTasks.find(
        (task) => !task.code.trim()
      );

      if (emptyCode) {
        setError(
          getTranslation(
            t,
            "mainOperationCodeRequired",
            "Every main project operation must have a code."
          )
        );

        return false;
      }

      const invalidWeight = wbsTasks.find(
        (task) => {
          const weight =
            parseFloat(task.weight);

          return (
            Number.isNaN(weight) ||
            weight <= 0 ||
            weight > 100
          );
        }
      );

      if (invalidWeight) {
        setError(
          getTranslation(
            t,
            "wbsWeightInvalid",
            "Each main operation weight must be greater than 0 and no more than 100."
          )
        );

        return false;
      }

      const totalWeight =
        getTotalWeight();

      if (
        Math.abs(totalWeight - 100) >
        0.001
      ) {
        setError(
          `${getTranslation(
            t,
            "wbsWeightTotalError",
            "The weights of all main project operations must total 100%."
          )} ${getTranslation(
            t,
            "currentTotal",
            "Current total"
          )}: ${totalWeight.toFixed(2)}%`
        );

        return false;
      }
    }

    return true;
  };

  /*
   * =====================================================
   * Navigation
   * =====================================================
   */

  const handleNext = () => {
    if (!validateCurrentStep()) {
      return;
    }

    setError("");

    setCurrentStep((previous) =>
      Math.min(previous + 1, 4)
    );
  };

  const handleBack = () => {
    setError("");

    setCurrentStep((previous) =>
      Math.max(previous - 1, 1)
    );
  };

  /*
   * =====================================================
   * Final Project Creation
   * =====================================================
   *
   * IMPORTANT:
   *
   * This is the ONLY function in this component that
   * creates the project on the server.
   *
   * Future stages must NOT call /api/projects.
   * =====================================================
   */

  const handleSubmit = async (event) => {
    event.preventDefault();

    // ---------------------------------------
    // Final step only
    // ---------------------------------------

    if (currentStep !== 4) {
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    // ---------------------------------------
    // Immediate duplicate-submission lock
    // ---------------------------------------

    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;

    setSaving(true);
    setError("");

    try {
      /*
       * =======================================
       * ATOMIC PROJECT SETUP
       * =======================================
       *
       * The Wizard keeps all project information
       * locally until the user presses
       * "Create Project".
       *
       * The backend receives the complete setup
       * in ONE request.
       *
       * The backend then creates:
       *
       *   Project
       *   +
       *   Main WBS Operations
       *
       * inside one database transaction.
       *
       * If any part fails, the backend rolls
       * everything back.
       *
       * This structure must remain true when
       * future Wizard stages are added.
       * =======================================
       */

      const response = await fetch(
        "http://127.0.0.1:8000/api/projects/setup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project: {
              code: formData.code.trim(),
              name: formData.name.trim(),
              description:
                formData.description.trim() || null,

              // New projects always start in Planning.
              status: "planning",
            },

            /*
             * -----------------------------------
             * Main / Top-Level WBS Operations
             * -----------------------------------
             */

            main_operations: wbsTasks.map(
              (task) => ({
                code: task.code.trim(),
                name: task.name.trim(),

                description: null,

                status: "not_started",

                priority: "medium",

                progress_type: "manual",

                include_in_progress: true,

                planned_start: null,
                planned_finish: null,

                actual_start: null,
                actual_finish: null,

                progress: 0,

                weight:
                  parseFloat(task.weight),

                notes: null,
              })
            ),
          }),
        }
      );

      // ---------------------------------------
      // Handle API errors
      // ---------------------------------------

      if (!response.ok) {
        let message =
          "Unable to create the project.";

        try {
          const errorData =
            await response.json();

          if (errorData?.detail) {
            message = Array.isArray(
              errorData.detail
            )
              ? errorData.detail
                  .map(
                    (item) =>
                      item.msg ||
                      "Validation error"
                  )
                  .join(", ")
              : String(errorData.detail);
          }
        } catch {
          // Keep default message.
        }

        throw new Error(message);
      }

      // ---------------------------------------
      // Project + WBS created successfully
      // ---------------------------------------

      const createdProject =
        await response.json();

      /*
       * IMPORTANT:
       *
       * No separate task creation happens here.
       *
       * The backend has already created the
       * project and all main WBS operations
       * atomically.
       */

      onProjectCreated(
        createdProject
      );

    } catch (submitError) {
      console.error(
        "Project setup failed:",
        submitError
      );

      /*
       * ---------------------------------------
       * User-facing error
       * ---------------------------------------
       *
       * There is NO manual rollback here.
       *
       * The backend endpoint
       * /api/projects/setup is responsible for
       * rolling back the complete transaction
       * if any creation step fails.
       */

      setError(
        submitError?.message ||
        "Unable to create the project."
      );

    } finally {
      setSaving(false);
      submitLockRef.current = false;
    }
  };

  /*
   * =====================================================
   * Display Helpers
   * =====================================================
   */

  const statusLabel = (status) =>
    getTranslation(
      t,
      status === "on_hold"
        ? "onHold"
        : status,
      status
    );

  const totalWeight =
    getTotalWeight();

  const totalWeightClass =
    Math.abs(totalWeight - 100) <
    0.001
      ? "valid"
      : totalWeight > 100
        ? "invalid"
        : "";

  /*
   * =====================================================
   * Render
   * =====================================================
   */

  return (
    <div className="project-wizard">

      {/* =====================================
          Wizard Header
      ===================================== */}

      <div className="project-wizard-header">

        <div>

          <span className="project-section-eyebrow">
            {getTranslation(
              t,
              "projectSetup",
              "Project Setup"
            )}
          </span>

          <h2>
            {getTranslation(
              t,
              "newProject",
              "New Project"
            )}
          </h2>

          <p>
            {getTranslation(
              t,
              "newProjectWizardDescription",
              "Set up your project information and main project operations before entering the Project Control Center."
            )}
          </p>

        </div>

      </div>

      {/* =====================================
          Step Indicator
      ===================================== */}

      <div className="project-wizard-steps">

        {steps.map(
          (step, index) => {

            const isActive =
              currentStep ===
              step.number;

            const isCompleted =
              currentStep >
              step.number;

            return (
              <div
                key={
                  step.number
                }
                className={`project-wizard-step ${
                  isActive
                    ? "active"
                    : ""
                } ${
                  isCompleted
                    ? "completed"
                    : ""
                }`}
              >

                <div className="project-wizard-step-number">

                  {isCompleted
                    ? "✓"
                    : step.number}

                </div>

                <div className="project-wizard-step-info">

                  <strong>
                    {step.title}
                  </strong>

                  <span>
                    {
                      step.description
                    }
                  </span>

                </div>

                {index <
                  steps.length -
                    1 && (
                  <div className="project-wizard-step-line" />
                )}

              </div>
            );
          }
        )}

      </div>

      {/* =====================================
          Wizard Form
      ===================================== */}

      <form
        className="project-wizard-body"
        onSubmit={
          handleSubmit
        }
      >

        {/* ===================================
            Step 1 — Project Basics
        =================================== */}

        {currentStep ===
          1 && (

          <section className="project-wizard-section">

            <div className="project-wizard-section-header">

              <span className="project-section-eyebrow">
                {getTranslation(
                  t,
                  "step",
                  "Step"
                )}{" "}
                1
              </span>

              <h3>
                {getTranslation(
                  t,
                  "wizardBasics",
                  "Project Basics"
                )}
              </h3>

              <p>
                {getTranslation(
                  t,
                  "wizardBasicsDescription",
                  "Define the basic identity of your project."
                )}
              </p>

            </div>

            <div className="project-wizard-form-grid">

              <div className="form-group">

                <label htmlFor="wizard-code">
                  {t("code")}
                </label>

                <input
                  id="wizard-code"
                  name="code"
                  type="text"
                  value={
                    formData.code
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="PRJ-001"
                  autoFocus
                  required
                  disabled={saving}
                />

                <small>
                  {getTranslation(
                    t,
                    "projectCodeHint",
                    "Use a unique project identification code."
                  )}
                </small>

              </div>

              <div className="form-group">

                <label htmlFor="wizard-name">
                  {t(
                    "projectName"
                  )}
                </label>

                <input
                  id="wizard-name"
                  name="name"
                  type="text"
                  value={
                    formData.name
                  }
                  onChange={
                    handleChange
                  }
                  placeholder={getTranslation(
                    t,
                    "projectName",
                    "Project Name"
                  )}
                  required
                  disabled={saving}
                />

              </div>

            </div>

          </section>

        )}

        {/* ===================================
            Step 2 — Project Profile
        =================================== */}

        {currentStep ===
          2 && (

          <section className="project-wizard-section">

            <div className="project-wizard-section-header">

              <span className="project-section-eyebrow">
                {getTranslation(
                  t,
                  "step",
                  "Step"
                )}{" "}
                2
              </span>

              <h3>
                {getTranslation(
                  t,
                  "wizardProfile",
                  "Project Profile"
                )}
              </h3>

              <p>
                {getTranslation(
                  t,
                  "wizardProfileDescription",
                  "Add a description and review the initial project status."
                )}
              </p>

            </div>

            <div className="project-wizard-form-grid">

              <div className="form-group form-group-full">

                <label htmlFor="wizard-description">
                  {t(
                    "description"
                  )}
                </label>

                <textarea
                  id="wizard-description"
                  name="description"
                  value={
                    formData.description
                  }
                  onChange={
                    handleChange
                  }
                  rows="6"
                  disabled={saving}
                  placeholder={getTranslation(
                    t,
                    "projectDescriptionPlaceholder",
                    "Describe the project scope, objectives or other important information."
                  )}
                />

              </div>

              <div className="form-group">

                <label>
                  {getTranslation(
                    t,
                    "initialStatus",
                    "Initial Status"
                  )}
                </label>

                <div className="project-wizard-fixed-status">

                  <span className="status-badge status-planning">
                    {statusLabel(
                      "planning"
                    )}
                  </span>

                  <small>
                    {getTranslation(
                      t,
                      "newProjectStatusHint",
                      "New projects are created in Planning status."
                    )}
                  </small>

                </div>

              </div>

            </div>

          </section>

        )}

        {/* ===================================
            Step 3 — Main Project Operations
        =================================== */}

        {currentStep ===
          3 && (

          <section className="project-wizard-section">

            <div className="project-wizard-section-header">

              <span className="project-section-eyebrow">
                {getTranslation(
                  t,
                  "step",
                  "Step"
                )}{" "}
                3
              </span>

              <h3>
                {getTranslation(
                  t,
                  "wizardMainOperations",
                  "Main Project Operations"
                )}
              </h3>

              <p>
                {getTranslation(
                  t,
                  "wizardMainOperationsDescription",
                  "Enter the major peer-level operations that make up the project. These operations form the first level of the WBS and their weights must total 100%."
                )}
              </p>

            </div>

            <div className="project-wizard-next-stage">

              <span className="project-section-eyebrow">
                {getTranslation(
                  t,
                  "mainOperations",
                  "Main Operations"
                )}
              </span>

              <strong>
                {getTranslation(
                  t,
                  "mainOperationsInstructionTitle",
                  "Enter the major work packages of the project"
                )}
              </strong>

              <p>
                {getTranslation(
                  t,
                  "mainOperationsInstruction",
                  "Each item below should be a major, peer-level project operation. For example: Site Establishment, Foundation Grouting, Tunnel and Culvert Works, Dam Body and Filters, Hydromechanical and Electrical Works, Instrumentation, Roads and Site Works."
                )}
              </p>

            </div>

            <div className="project-wizard-wbs-summary">

              <div>

                <span>
                  {getTranslation(
                    t,
                    "mainOperationsCount",
                    "Main Operations"
                  )}
                </span>

                <strong>
                  {
                    wbsTasks.length
                  }
                </strong>

              </div>

              <div
                className={`project-wizard-wbs-total ${totalWeightClass}`}
              >

                <span>
                  {getTranslation(
                    t,
                    "totalWeight",
                    "Total Weight"
                  )}
                </span>

                <strong>
                  {totalWeight.toFixed(
                    2
                  )}
                  %
                </strong>

              </div>

            </div>

            <div className="project-wizard-wbs-list">

              <div className="project-wizard-wbs-header">

                <span>
                  {getTranslation(
                    t,
                    "code",
                    "Code"
                  )}
                </span>

                <span>
                  {getTranslation(
                    t,
                    "mainOperation",
                    "Main Operation"
                  )}
                </span>

                <span>
                  {getTranslation(
                    t,
                    "weight",
                    "Weight"
                  )}
                </span>

                <span>
                  {getTranslation(
                    t,
                    "actions",
                    "Actions"
                  )}
                </span>

              </div>

              {wbsTasks.map(
                (task, index) => (

                  <div
                    key={task.id}
                    className="project-wizard-wbs-row"
                  >

                    <div className="project-wizard-wbs-index">
                      {index + 1}
                    </div>

                    <div className="form-group">

                      <label
                        className="project-wizard-mobile-label"
                      >
                        {getTranslation(
                          t,
                          "code",
                          "Code"
                        )}
                      </label>

                      <input
                        type="text"
                        value={
                          task.code
                        }
                        onChange={(
                          event
                        ) =>
                          handleWbsChange(
                            task.id,
                            "code",
                            event
                              .target
                              .value
                          )
                        }
                        placeholder={`WBS-${String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}`}
                        disabled={
                          saving
                        }
                      />

                    </div>

                    <div className="form-group">

                      <label
                        className="project-wizard-mobile-label"
                      >
                        {getTranslation(
                          t,
                          "mainOperation",
                          "Main Operation"
                        )}
                      </label>

                      <input
                        type="text"
                        value={
                          task.name
                        }
                        onChange={(
                          event
                        ) =>
                          handleWbsChange(
                            task.id,
                            "name",
                            event
                              .target
                              .value
                          )
                        }
                        placeholder={getTranslation(
                          t,
                          "mainOperationPlaceholder",
                          "e.g. Dam Body, Filters and Waterproofing"
                        )}
                        disabled={
                          saving
                        }
                      />

                    </div>

                    <div className="form-group">

                      <label
                        className="project-wizard-mobile-label"
                      >
                        {getTranslation(
                          t,
                          "weight",
                          "Weight"
                        )}
                      </label>

                      <div className="project-wizard-weight-input">

                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={
                            task.weight
                          }
                          onChange={(
                            event
                          ) =>
                            handleWbsChange(
                              task.id,
                              "weight",
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="0"
                          disabled={
                            saving
                          }
                        />

                        <span>
                          %
                        </span>

                      </div>

                    </div>

                    <div className="project-wizard-wbs-action">

                      {wbsTasks.length >
                        1 ? (

                        <button
                          type="button"
                          className="project-wizard-remove-button"
                          onClick={() =>
                            removeWbsTask(
                              task.id
                            )
                          }
                          disabled={
                            saving
                          }
                        >
                          {getTranslation(
                            t,
                            "remove",
                            "Remove"
                          )}
                        </button>

                      ) : (

                        <span>
                          —
                        </span>

                      )}

                    </div>

                  </div>

                )
              )}

            </div>

            <div className="project-wizard-wbs-add">

              <button
                type="button"
                className="secondary-button"
                onClick={
                  addWbsTask
                }
                disabled={
                  saving
                }
              >
                +{" "}
                {getTranslation(
                  t,
                  "addMainOperation",
                  "Add Main Operation"
                )}
              </button>

            </div>

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
                  "topLevelOperationsOnly",
                  "Main Operations Only"
                )}
              </strong>

              <p>
                {getTranslation(
                  t,
                  "topLevelOperationsOnlyDescription",
                  "At this stage, enter only the major peer-level operations of the project. Do not enter detailed activities or subtasks here. After the project is created, each main operation can be expanded into its own detailed hierarchy in the Project Control Center."
                )}
              </p>

            </div>

          </section>

        )}

        {/* ===================================
            Step 4 — Review & Create
        =================================== */}

        {currentStep ===
          4 && (

          <section className="project-wizard-section">

            <div className="project-wizard-section-header">

              <span className="project-section-eyebrow">
                {getTranslation(
                  t,
                  "step",
                  "Step"
                )}{" "}
                4
              </span>

              <h3>
                {getTranslation(
                  t,
                  "wizardReview",
                  "Review & Create"
                )}
              </h3>

              <p>
                {getTranslation(
                  t,
                  "wizardReviewDescription",
                  "Review the project information and main operations before creating the project."
                )}
              </p>

            </div>

            <div className="project-wizard-review">

              <div className="project-wizard-review-item">

                <span>
                  {t("code")}
                </span>

                <strong>
                  {formData.code ||
                    "-"}
                </strong>

              </div>

              <div className="project-wizard-review-item">

                <span>
                  {t(
                    "projectName"
                  )}
                </span>

                <strong>
                  {formData.name ||
                    "-"}
                </strong>

              </div>

              <div className="project-wizard-review-item">

                <span>
                  {getTranslation(
                    t,
                    "initialStatus",
                    "Initial Status"
                  )}
                </span>

                <strong>

                  <span className="status-badge status-planning">
                    {statusLabel(
                      "planning"
                    )}
                  </span>

                </strong>

              </div>

              <div className="project-wizard-review-item project-wizard-review-full">

                <span>
                  {t(
                    "description"
                  )}
                </span>

                <strong>
                  {formData.description ||
                    getTranslation(
                      t,
                      "noDescription",
                      "No description provided."
                    )}
                </strong>

              </div>

            </div>

            <div className="project-wizard-review-wbs">

              <div className="project-wizard-review-wbs-header">

                <div>

                  <span className="project-section-eyebrow">
                    {getTranslation(
                      t,
                      "mainOperations",
                      "Main Operations"
                    )}
                  </span>

                  <h4>
                    {getTranslation(
                      t,
                      "mainOperationsSummary",
                      "Initial Main Project Operations"
                    )}
                  </h4>

                </div>

                <strong
                  className={
                    totalWeightClass
                  }
                >
                  {totalWeight.toFixed(
                    2
                  )}
                  %
                </strong>

              </div>

              <div className="project-wizard-review-wbs-list">

                {wbsTasks.map(
                  (task) => (

                    <div
                      key={task.id}
                      className="project-wizard-review-wbs-item"
                    >

                      <span className="project-wizard-review-wbs-code">
                        {
                          task.code
                        }
                      </span>

                      <strong>
                        {
                          task.name
                        }
                      </strong>

                      <span className="project-wizard-review-wbs-weight">
                        {
                          parseFloat(
                            task.weight ||
                              0
                          ).toFixed(
                            2
                          )
                        }
                        %
                      </span>

                    </div>

                  )
                )}

              </div>

            </div>

            <div className="project-wizard-next-stage">

              <span className="project-section-eyebrow">
                {getTranslation(
                  t,
                  "nextStage",
                  "Next Stage"
                )}
              </span>

              <strong>
                {getTranslation(
                  t,
                  "projectControlCenter",
                  "Project Control Center"
                )}
              </strong>

              <p>
                {getTranslation(
                  t,
                  "wizardNextStageDescription",
                  "After creation, the main project operations will be available in the Project Control Center. You can then expand each operation and define its detailed subtasks, sequencing, schedule and other project controls."
                )}
              </p>

            </div>

          </section>

        )}

        {/* =====================================
            Error
        ===================================== */}

        {error && (

          <div
            className="project-wizard-error"
            role="alert"
          >
            {error}
          </div>

        )}

        {/* =====================================
            Actions
        ===================================== */}

        <div className="project-wizard-actions">

          <button
            type="button"
            className="secondary-button"
            onClick={
              currentStep ===
              1
                ? onCancel
                : handleBack
            }
            disabled={
              saving
            }
          >
            {currentStep ===
            1
              ? getTranslation(
                  t,
                  "cancel",
                  "Cancel"
                )
              : getTranslation(
                  t,
                  "back",
                  "Back"
                )}
          </button>

          <div className="project-wizard-actions-right">

            {currentStep <
            4 ? (

              <button
                type="button"
                className="primary-button"
                onClick={
                  handleNext
                }
                disabled={
                  saving
                }
              >
                {getTranslation(
                  t,
                  "next",
                  "Next"
                )}{" "}
                →
              </button>

            ) : (

              <button
                type="submit"
                className="primary-button"
                disabled={
                  saving
                }
              >
                {saving
                  ? getTranslation(
                      t,
                      "creating",
                      "Creating..."
                    )
                  : getTranslation(
                      t,
                      "createProject",
                      "Create Project"
                    )}
              </button>

            )}

          </div>

        </div>

      </form>

    </div>
  );
}

export default ProjectSetupWizard;
