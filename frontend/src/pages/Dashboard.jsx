import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";

function Dashboard() {
  const { t } = useLanguage();

  const [summary, setSummary] = useState({
    total_projects: 0,
    active_projects: 0,
    planning_projects: 0,
    completed_projects: 0,
    on_hold_projects: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/dashboard/summary")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard summary");
        }

        return response.json();
      })
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setError("backendError");
        setLoading(false);
      });
  }, []);

  const statusItems = [
    {
      key: "active",
      label: t("activeProjects"),
      value: summary.active_projects,
    },
    {
      key: "planning",
      label: t("planningProjects"),
      value: summary.planning_projects,
    },
    {
      key: "completed",
      label: t("completedProjects"),
      value: summary.completed_projects,
    },
    {
      key: "on_hold",
      label: t("onHoldProjects"),
      value: summary.on_hold_projects,
    },
  ];

  return (
    <div className="dashboard-page">

      <div className="page-header">
        <div>
          <h1>{t("dashboardTitle")}</h1>

          <p>{t("dashboardDescription")}</p>
        </div>
      </div>

      <hr />

      <h2>{t("projectOverview")}</h2>

      {error && (
        <p className="projects-error">
          {t(error)}
        </p>
      )}

      <div className="dashboard-cards">

        <div className="dashboard-card">
          <h3>{t("totalProjects")}</h3>

          <p>
            {loading ? "..." : summary.total_projects}
          </p>
        </div>

        <div className="dashboard-card">
          <h3>{t("activeProjects")}</h3>

          <p>
            {loading ? "..." : summary.active_projects}
          </p>
        </div>

        <div className="dashboard-card">
          <h3>{t("planningProjects")}</h3>

          <p>
            {loading ? "..." : summary.planning_projects}
          </p>
        </div>

        <div className="dashboard-card">
          <h3>{t("completedProjects")}</h3>

          <p>
            {loading ? "..." : summary.completed_projects}
          </p>
        </div>

      </div>

      <div className="dashboard-status-card">

        <div className="dashboard-status-header">
          <h2>{t("projectStatusDistribution")}</h2>
        </div>

        <div className="dashboard-status-list">

          {statusItems.map((item) => {
            const percentage =
              summary.total_projects > 0
                ? Math.round(
                    (item.value / summary.total_projects) * 100
                  )
                : 0;

            return (
              <div
                className="dashboard-status-item"
                key={item.key}
              >

                <div className="dashboard-status-label">
                  <span>{item.label}</span>

                  <strong>
                    {loading ? "..." : item.value}
                  </strong>
                </div>

                <div className="dashboard-progress-track">

                  <div
                    className={`dashboard-progress-bar ${item.key}`}
                    style={{
                      width: `${loading ? 0 : percentage}%`,
                    }}
                  />

                </div>

                <span className="dashboard-status-percentage">
                  {loading ? "..." : `${percentage}%`}
                </span>

              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
}

export default Dashboard;