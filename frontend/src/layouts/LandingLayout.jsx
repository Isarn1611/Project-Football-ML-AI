import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRightOutlined, GlobalOutlined } from "@ant-design/icons";

import scoutAiWordmark from "../assets/scoutai-wordmark.png";
import { useAuth } from "../auth/useAuth";
import { useInterfaceSettings } from "../interface/useInterfaceSettings";
import { getRoleHomePath } from "../routes/rolePaths";

function LandingLayout({ children }) {
  const { t } = useTranslation("landing");
  const { isAuthenticated, loading, role } = useAuth();
  const { language, setLanguage } = useInterfaceSettings();
  const workspacePath = isAuthenticated ? getRoleHomePath(role) : "/login";

  const navLinkClass = ({ isActive }) =>
    `site-nav-link${isActive ? " is-active" : ""}`;

  return (
    <div className="site-page">
      <header className="site-header">
        <div className="site-header-inner">
          <Link aria-label="ScoutAI" className="site-brand" to="/">
            <img src={scoutAiWordmark} alt="ScoutAI" />
          </Link>

          <nav aria-label={t("nav.ariaLabel")} className="site-nav">
            <NavLink className={navLinkClass} to="/">
              {t("nav.home")}
            </NavLink>
            <NavLink className={navLinkClass} to="/about">
              {t("nav.about")}
            </NavLink>
            <NavLink className={navLinkClass} to="/pricing">
              {t("nav.pricing")}
            </NavLink>
          </nav>

          <div className="site-nav-actions">
            <button
              aria-label={t("nav.changeLanguage")}
              className="site-language-button"
              onClick={() => setLanguage(language === "th" ? "en" : "th")}
              type="button"
            >
              <GlobalOutlined />
              {language === "th" ? "EN" : "TH"}
            </button>
            {!isAuthenticated && !loading && (
              <Link className="site-signin-link" to="/login">
                {t("nav.signIn")}
              </Link>
            )}
            <Link className="site-cta-button" to={workspacePath}>
              {isAuthenticated ? t("nav.openWorkspace") : t("nav.getStarted")}
              <ArrowRightOutlined />
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <Link aria-label="ScoutAI" to="/">
              <img src={scoutAiWordmark} alt="ScoutAI" />
            </Link>
            <p>{t("footer.tagline")}</p>
          </div>

          <nav className="site-footer-col" aria-label={t("footer.productLabel")}>
            <h4>{t("footer.product")}</h4>
            <Link to="/">{t("nav.home")}</Link>
            <Link to="/about">{t("nav.about")}</Link>
            <Link to="/pricing">{t("nav.pricing")}</Link>
          </nav>

          <nav className="site-footer-col" aria-label={t("footer.legalLabel")}>
            <h4>{t("footer.legal")}</h4>
            <Link to="/terms">{t("nav.termsOfUse")}</Link>
            <Link to="/privacy">{t("nav.privacyPolicy")}</Link>
          </nav>
        </div>
        <div className="site-footer-bottom">
          <span>{t("footer.note")}</span>
          <span>{t("footer.copy")}</span>
        </div>
      </footer>
    </div>
  );
}

export default LandingLayout;
