import { useLanguage } from "../context/LanguageContext";

function Header() {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "fa" : "en");
  };

  return (
    <header className="header">
      <div className="header-title">
        <h1>{t("dashboard")}</h1>
        <span>
          Integrated Project Management Control System
        </span>
      </div>

      <div className="header-actions">
        <button
          className="language-button"
          onClick={toggleLanguage}
        >
          {language === "en" ? "فارسی" : "EN"}
        </button>

        <button className="notification-button">
          🔔
        </button>

        <div className="user-profile">
          <div className="user-avatar">
            VM
          </div>

          <div className="user-info">
            <strong>{t("systemAdministrator")}</strong>
            <span>{t("administrator")}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;