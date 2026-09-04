import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { useLanguage } from "../context/LanguageContext";

function MainLayout({ children }) {
  const { direction } = useLanguage();

  
  return (
   <div
      className={`app-layout ${direction}`}
      dir={direction}
      style={{
      display: "flex",
      flexDirection: "row",
           
      }}
   >
      <Sidebar />

      <div className="main-area">
        <Header />

        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  );
}

export default MainLayout;