import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRightOutlined,
  BarChartOutlined,
  CheckCircleFilled,
  DatabaseOutlined,
  RadarChartOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  TeamOutlined,
} from "@ant-design/icons";

import scoutAiAnalysis from "../assets/scoutai-auth-hero-analysis.png";
import scoutAi from "../assets/scoutai2.png";
import { useAuth } from "../auth/useAuth";
import LandingLayout from "../layouts/LandingLayout";

function Home() {
  const { t } = useTranslation("landing");
  const { isAuthenticated, loading } = useAuth();
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
    <LandingLayout>
      <section className="site-hero">
        <div className="site-hero-glow" aria-hidden="true" />
        <div className="site-hero-inner">
          <span className="site-badge">
            <i />
            {t("hero.badge")}
          </span>
          <h1>{t("hero.title")}</h1>
          <p>{t("hero.description")}</p>
          <div className="site-hero-actions">
            <Link className="site-cta-button site-cta-large" to={workspacePath}>
              {isAuthenticated ? t("nav.openWorkspace") : t("hero.cta")}
              <ArrowRightOutlined />
            </Link>
            <a className="site-cta-ghost" href="#features">
              {t("hero.explore")}
            </a>
          </div>
          <div className="site-trust-row">
            <span>
              <CheckCircleFilled /> {t("hero.trust.private")}
            </span>
            <span>
              <CheckCircleFilled /> {t("hero.trust.fast")}
            </span>
            <span>
              <CheckCircleFilled /> {t("hero.trust.teamReady")}
            </span>
          </div>
        </div>
        <div className="site-showcase-visual">
          <img
            src={scoutAi}
            alt={t("showcase.imageAlt")}
            loading="lazy"
          />
          <span className="site-showcase-label">
            <RadarChartOutlined />
            {t("showcase.label")}
          </span>
        </div>

      </section>

      <section className="site-metrics-strip">
        {metrics.map((metric) => (
          <div className="site-metric" key={metric.label}>
            <span className="site-metric-icon">{metric.icon}</span>
            <span>
              <strong>{metric.value}</strong>
              <small>{metric.label}</small>
            </span>
          </div>
        ))}
      </section>

      <section className="site-section" id="features">
        <div className="site-section-heading">
          <span className="site-kicker">{t("capabilities.kicker")}</span>
          <h2>{t("capabilities.title")}</h2>
          <p>{t("capabilities.description")}</p>
        </div>
        <div className="site-feature-grid">
          {capabilities.map((capability, index) => (
            <article className="site-feature-card" key={capability.title}>
              <span className="site-feature-number">0{index + 1}</span>
              <span className="site-feature-icon">{capability.icon}</span>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site-showcase" id="workflow">
        <div className="site-showcase-copy">
          <span className="site-kicker">{t("showcase.kicker")}</span>
          <h2>{t("showcase.title")}</h2>
          <p>{t("showcase.description")}</p>
          <ol className="site-workflow-list">
            <li>
              <span>1</span>
              <div>
                <strong>{t("showcase.steps.search.title")}</strong>
                <small>{t("showcase.steps.search.description")}</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>{t("showcase.steps.compare.title")}</strong>
                <small>{t("showcase.steps.compare.description")}</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>{t("showcase.steps.decide.title")}</strong>
                <small>{t("showcase.steps.decide.description")}</small>
              </div>
            </li>
          </ol>
        </div>
        <div className="site-showcase-visual">
          <img
            src={scoutAiAnalysis}
            alt={t("showcase.imageAlt")}
            loading="lazy"
          />
          <span className="site-showcase-label">
            <RadarChartOutlined />
            {t("showcase.label")}
          </span>
        </div>
      </section>

      <section className="site-cta-band">
        <span className="site-cta-band-icon">
          <SafetyCertificateOutlined />
        </span>
        <span className="site-kicker">{t("security.kicker")}</span>
        <h2>{t("security.title")}</h2>
        <p>{t("security.description")}</p>
        <Link className="site-cta-button site-cta-light" to={workspacePath}>
          {isAuthenticated ? t("nav.openWorkspace") : t("security.cta")}
          <ArrowRightOutlined />
        </Link>
      </section>
    </LandingLayout>
  );
}

export default Home;
