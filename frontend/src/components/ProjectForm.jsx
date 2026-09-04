import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

function ProjectForm({ onProjectCreated, onCancel }) {
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    status: "planning",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/projects",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      const newProject = await response.json();

      onProjectCreated(newProject);

      setFormData({
        code: "",
        name: "",
        description: "",
        status: "planning",
      });
    } catch (error) {
      console.error(error);
      setError("createProjectError");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="project-form-card">

      <div className="project-form-header">
        <div>
          <h2>{t("newProject")}</h2>
          <p>{t("newProjectDescription")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>

        <div className="form-grid">

          <div className="form-group">
            <label htmlFor="code">
              {t("code")}
            </label>

            <input
              id="code"
              name="code"
              type="text"
              value={formData.code}
              onChange={handleChange}
              placeholder="PRJ-002"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">
              {t("projectName")}
            </label>

            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder={t("projectName")}
              required
            />
          </div>

          <div className="form-group form-group-full">
            <label htmlFor="description">
              {t("description")}
            </label>

            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              placeholder={t("description")}
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">
              {t("status")}
            </label>

            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
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

        </div>

        {error && (
          <p className="form-error">
            {t(error)}
          </p>
        )}

        <div className="form-actions">

          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={saving}
          >
            {t("cancel")}
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving
              ? t("saving")
              : t("saveProject")}
          </button>

        </div>

      </form>
    </div>
  );
}

export default ProjectForm;