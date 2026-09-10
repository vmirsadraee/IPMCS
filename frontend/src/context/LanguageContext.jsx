import { createContext, useContext, useState } from "react";

const LanguageContext = createContext();

const translations = {
  en: {
    dashboard: "Dashboard",
    projects: "Projects",
    schedule: "Schedule",
    resources: "Resources",
    costs: "Costs",
    reports: "Reports",

    management: "MANAGEMENT",
    main: "MAIN",

    administrator: "Administrator",
    systemAdministrator: "System Administrator",

    dashboardTitle: "IPMCS Dashboard",
    dashboardDescription:
      "Integrated Project Management Control System",

    projectOverview: "Project Overview",

    totalProjects: "Projects",
    activeActivities: "Active Activities",
    overallProgress: "Overall Progress",
    spentCost: "Spent Cost",

    activeProjects: "Active Projects",
    planningProjects: "Planning Projects",
    completedProjects: "Completed Projects",
    onHoldProjects: "On Hold Projects",
    projectStatusDistribution: "Project Status Distribution",

    projectsTitle: "Projects",
    projectsDescription: "Manage and monitor your projects",
    newProject: "New Project",
    projectList: "Project List",
    projectsCount: "Projects",
    loadingProjects: "Loading projects...",
    noProjects: "No projects found.",
    noMatchingProjects: "No matching projects found.",
    backendError: "Unable to connect to Backend",

    id: "ID",
    code: "Code",
    projectName: "Project Name",
    description: "Description",
    status: "Status",

    newProjectDescription: "Create a new project",
    cancel: "Cancel",
    saveProject: "Save Project",

    planning: "Planning",
    active: "Active",
    onHold: "On Hold",
    completed: "Completed",

    createProjectError: "Unable to create project",
    saving: "Saving...",

    edit: "Edit",
    delete: "Delete",
    actions: "Actions",

    editProject: "Edit Project",
    editProjectDescription: "Update project information",
    updateProject: "Update Project",

    confirmDelete: "Are you sure you want to delete",
    deleteProjectError: "Unable to delete project",
    updateProjectError: "Unable to update project",

    searchProjects: "Search projects...",
    allStatuses: "All Statuses",
    viewDetails: "View Details",
    projectDetails: "Project Details",
    projectDetailsDescription:"View project information and current status",
    backToProjects: "Back to Projects",
    projectInformation: "Project Information",
    loadingProject: "Loading project...",
    projectNotFound: "Project not found.",
    noDescription: "No description available.",
  },

  fa: {
    dashboard: "داشبورد",
    projects: "پروژه‌ها",
    schedule: "برنامه زمان‌بندی",
    resources: "منابع",
    costs: "هزینه‌ها",
    reports: "گزارش‌ها",

    management: "مدیریت",
    main: "اصلی",

    administrator: "مدیر سیستم",
    systemAdministrator: "مدیر سیستم",

    dashboardTitle: "داشبورد IPMCS",
    dashboardDescription:
      "سیستم یکپارچه مدیریت و کنترل پروژه",

    projectOverview: "نمای کلی پروژه",

    totalProjects: "پروژه‌ها",
    activeActivities: "فعالیت‌های در حال اجرا",
    overallProgress: "پیشرفت کلی",
    spentCost: "هزینه مصرف‌شده",

    activeProjects: "پروژه‌های در حال اجرا",
    planningProjects: "پروژه‌های در حال برنامه‌ریزی",
    completedProjects: "پروژه‌های تکمیل‌شده",
    onHoldProjects: "پروژه‌های متوقف‌شده",
    projectStatusDistribution: "توزیع وضعیت پروژه‌ها",

    projectsTitle: "پروژه‌ها",
    projectsDescription: "مدیریت و کنترل پروژه‌ها",
    newProject: "پروژه جدید",
    projectList: "فهرست پروژه‌ها",
    projectsCount: "پروژه",
    loadingProjects: "در حال بارگذاری پروژه‌ها...",
    noProjects: "هیچ پروژه‌ای یافت نشد.",
    noMatchingProjects: "هیچ پروژه منطبقی یافت نشد.",
    backendError: "اتصال به Backend برقرار نیست",

    id: "شناسه",
    code: "کد پروژه",
    projectName: "نام پروژه",
    description: "توضیحات",
    status: "وضعیت",

    newProjectDescription: "ایجاد یک پروژه جدید",
    cancel: "انصراف",
    saveProject: "ذخیره پروژه",

    planning: "برنامه‌ریزی",
    active: "در حال اجرا",
    onHold: "متوقف‌شده",
    completed: "تکمیل‌شده",

    createProjectError: "ایجاد پروژه امکان‌پذیر نیست",
    saving: "در حال ذخیره...",

    edit: "ویرایش",
    delete: "حذف",
    actions: "عملیات",

    editProject: "ویرایش پروژه",
    editProjectDescription: "اطلاعات پروژه را ویرایش کنید",
    updateProject: "به‌روزرسانی پروژه",

    confirmDelete: "آیا از حذف پروژه اطمینان دارید",
    deleteProjectError: "حذف پروژه امکان‌پذیر نیست",
    updateProjectError: "ویرایش پروژه امکان‌پذیر نیست",

    searchProjects: "جستجوی پروژه‌ها...",
    allStatuses: "همه وضعیت‌ها",

    viewDetails: "مشاهده جزئیات",
    projectDetails: "جزئیات پروژه",
    projectDetailsDescription: "مشاهده اطلاعات و وضعیت فعلی پروژه",
    backToProjects: "بازگشت به پروژه‌ها",
    projectInformation: "اطلاعات پروژه",
    loadingProject: "در حال بارگذاری پروژه...",
    projectNotFound: "پروژه موردنظر یافت نشد.",
    noDescription: "توضیحاتی برای این پروژه ثبت نشده است.",
  },
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("ipmcs-language") || "en";
  });

  const direction = language === "fa" ? "rtl" : "ltr";

  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem("ipmcs-language", newLanguage);
  };

  const t = (key) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: changeLanguage,
        direction,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}