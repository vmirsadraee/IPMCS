import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

function Sidebar() {
  const { t } = useLanguage();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">IP</div>

        <div>
          <h2>IPMCS</h2>
          <span>Project Control</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <p className="nav-title">{t("main")}</p>

        <Link to="/" className="nav-item active">
          <span>▦</span>
          <span>{t("dashboard")}</span>
        </Link>

        <Link to="/projects" className="nav-item">
          <span>□</span>
          <span>{t("projects")}</span>
        </Link>

        <a href="#" className="nav-item">
          <span>◷</span>
          <span>{t("schedule")}</span>
        </a>

        <p className="nav-title">{t("management")}</p>

        <a href="#" className="nav-item">
          <span>♙</span>
          <span>{t("resources")}</span>
        </a>

        <a href="#" className="nav-item">
          <span>◇</span>
          <span>{t("costs")}</span>
        </a>

        <a href="#" className="nav-item">
          <span>▤</span>
          <span>{t("reports")}</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        <span>IPMCS</span>
        <small>v1.0.0</small>
      </div>
    </aside>
  );
}

export default Sidebar;