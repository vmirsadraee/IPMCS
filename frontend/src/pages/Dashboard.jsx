import { useLanguage } from "../context/LanguageContext";

function Dashboard() {
  const { t } = useLanguage();

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

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <h3>{t("totalProjects")}</h3>
          <p>0</p>
        </div>

        <div className="dashboard-card">
          <h3>{t("activeActivities")}</h3>
          <p>0</p>
        </div>

        <div className="dashboard-card">
          <h3>{t("overallProgress")}</h3>
          <p>0%</p>
        </div>

        <div className="dashboard-card">
          <h3>{t("spentCost")}</h3>
          <p>0</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;