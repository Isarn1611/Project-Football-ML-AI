import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRightOutlined,
  BarChartOutlined,
  CheckCircleFilled,
  DatabaseOutlined,
  GlobalOutlined,
  RadarChartOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  TeamOutlined,
} from "@ant-design/icons";

import scoutAiWordmark from "../assets/scoutai-wordmark.png";
import scoutAiAnalysis from "../assets/scoutai-auth-hero-analysis.png";
import { useAuth } from "../auth/useAuth";
import { useInterfaceSettings } from "../interface/useInterfaceSettings";

function Home() {
  const { t } = useTranslation("landing");
  const { isAuthenticated, loading } = useAuth();
  const { language, setLanguage } = useInterfaceSettings();
  const workspacePath = isAuthenticated ? "/app" : "/login";

  const metrics = [
    { icon: <TeamOutlined />, value: "8,452", label: t("metrics.players") },
    { icon: <BarChartOutlined />, value: "89", label: t("metrics.attributes") },
    { icon: <RadarChartOutlined />, value: "5", label: t("metrics.models") },
  ];

  const capabilities = [
    {
      icon: <DatabaseOutlined />,
      title: t("capabilities.database.title"),
      description: t("capabilities.database.description"),
    },
    {
      icon: <RadarChartOutlined />,
      title: t("capabilities.analysis.title"),
      description: t("capabilities.analysis.description"),
    },
    {
      icon: <StarOutlined />,
      title: t("capabilities.decisions.title"),
      description: t("capabilities.decisions.description"),
    },
  ];

  return (
    <main className="landing-page">
      <header className="landing-header">
        <div className="landing-nav">
          <Link aria-label="ScoutAI" className="landing-brand" to="/">
            <img src={scoutAiWordmark} alt="ScoutAI" />
            <span>{t("nav.product")}</span>
          </Link>

          <nav aria-label={t("nav.ariaLabel")} className="landing-nav-links">
            <a href="#capabilities">{t("nav.features")}</a>
            <a href="#workflow">{t("nav.workflow")}</a>
            <a href="#security">{t("nav.security")}</a>
          </nav>

          <div className="landing-nav-actions">
            <button
              aria-label={t("nav.changeLanguage")}
              className="landing-language-button"
              onClick={() => setLanguage(language === "th" ? "en" : "th")}
              type="button"
            >
              <GlobalOutlined />
              {language === "th" ? "EN" : "TH"}
            </button>
            {!isAuthenticated && !loading && (
              <Link className="landing-signin-link" to="/login">
                {t("nav.signIn")}
              </Link>
            )}
            <Link className="landing-primary-link" to={workspacePath}>
              {isAuthenticated ? t("nav.openWorkspace") : t("nav.getStarted")}
              <ArrowRightOutlined />
            </Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-data-badge">
            <i />
            {t("hero.badge")}
          </span>
          <span className="landing-kicker">{t("hero.kicker")}</span>
          <h1>{t("hero.title")}</h1>
          <p>{t("hero.description")}</p>
          <div className="landing-hero-actions">
            <Link className="landing-cta-primary" to={workspacePath}>
              {isAuthenticated ? t("nav.openWorkspace") : t("hero.cta")}
              <ArrowRightOutlined />
            </Link>
            <a className="landing-cta-secondary" href="#capabilities">
              {t("hero.explore")}
            </a>
          </div>
          <div className="landing-trust-row">
            <span><CheckCircleFilled /> {t("hero.trust.private")}</span>
            <span><CheckCircleFilled /> {t("hero.trust.fast")}</span>
            <span><CheckCircleFilled /> {t("hero.trust.teamReady")}</span>
          </div>
        </div>

        <aside aria-label={t("hero.summary")} className="landing-metrics-panel">
          <div className="landing-metrics-glow" />
          {metrics.map((metric) => (
            <div className="landing-metric" key={metric.label}>
              <span className="landing-metric-icon">{metric.icon}</span>
              <span>
                <strong>{metric.value}</strong>
                <small>{metric.label}</small>
              </span>
            </div>
          ))}
        </aside>
      </section>

      <section className="landing-section" id="capabilities">
        <div className="landing-section-heading">
          <span className="landing-kicker">{t("capabilities.kicker")}</span>
          <h2>{t("capabilities.title")}</h2>
          <p>{t("capabilities.description")}</p>
        </div>
        <div className="landing-capability-grid">
          {capabilities.map((capability, index) => (
            <article className="landing-capability-card" key={capability.title}>
              <span className="landing-capability-number">0{index + 1}</span>
              <span className="landing-capability-icon">{capability.icon}</span>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-showcase" id="workflow">
        <div className="landing-showcase-visual">
          <img src={scoutAiAnalysis} alt={t("showcase.imageAlt")} />
          <span className="landing-showcase-label">
            <RadarChartOutlined />
            {t("showcase.label")}
          </span>
        </div>
        <div className="landing-showcase-copy">
          <span className="landing-kicker">{t("showcase.kicker")}</span>
          <h2>{t("showcase.title")}</h2>
          <p>{t("showcase.description")}</p>
          <ol className="landing-workflow-list">
            <li><span>1</span><div><strong>{t("showcase.steps.search.title")}</strong><small>{t("showcase.steps.search.description")}</small></div></li>
            <li><span>2</span><div><strong>{t("showcase.steps.compare.title")}</strong><small>{t("showcase.steps.compare.description")}</small></div></li>
            <li><span>3</span><div><strong>{t("showcase.steps.decide.title")}</strong><small>{t("showcase.steps.decide.description")}</small></div></li>
          </ol>
        </div>
      </section>

      <section className="landing-security" id="security">
        <span className="landing-security-icon"><SafetyCertificateOutlined /></span>
        <div>
          <span className="landing-kicker">{t("security.kicker")}</span>
          <h2>{t("security.title")}</h2>
          <p>{t("security.description")}</p>
        </div>
        <Link className="landing-cta-primary" to={workspacePath}>
          {isAuthenticated ? t("nav.openWorkspace") : t("security.cta")}
          <ArrowRightOutlined />
        </Link>
      </section>

      <footer className="landing-footer">
        <Link aria-label="ScoutAI" className="landing-brand" to="/">
          <img src={scoutAiWordmark} alt="ScoutAI" />
          <span>{t("nav.product")}</span>
        </Link>
        <p>{t("footer.copy")}</p>
        <span>{t("footer.note")}</span>
      </footer>
    </main>
  );
}

export default Home;
