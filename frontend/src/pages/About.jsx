import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertOutlined,
  ArrowRightOutlined,
  ClusterOutlined,
  CompassOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FilterOutlined,
  LineChartOutlined,
  RobotOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";
import LandingLayout from "../layouts/LandingLayout";

function About() {
  const { t } = useTranslation("about");
  const { isAuthenticated, loading } = useAuth();
  const workspacePath = isAuthenticated ? "/app" : "/login";

  const pillars = [
    {
      icon: <DatabaseOutlined />,
      title: t("pillars.data.title"),
      body: t("pillars.data.body"),
    },
    {
      icon: <RobotOutlined />,
      title: t("pillars.people.title"),
      body: t("pillars.people.body"),
    },
    {
      icon: <SafetyCertificateOutlined />,
      title: t("pillars.privacy.title"),
      body: t("pillars.privacy.body"),
    },
  ];

  const milestones = t("timeline.items", { returnObjects: true });

  const models = [
    {
      icon: <ClusterOutlined />,
      title: t("building.models.clone.title"),
      badge: t("building.models.clone.badge"),
      description: t("building.models.clone.description"),
    },
    {
      icon: <LineChartOutlined />,
      title: t("building.models.style.title"),
      badge: t("building.models.style.badge"),
      description: t("building.models.style.description"),
    },
    {
      icon: <FilterOutlined />,
      title: t("building.models.strict.title"),
      badge: t("building.models.strict.badge"),
      description: t("building.models.strict.description"),
    },
    {
      icon: <ExperimentOutlined />,
      title: t("building.models.group.title"),
      badge: t("building.models.group.badge"),
      description: t("building.models.group.description"),
    },
    {
      icon: <AlertOutlined />,
      title: t("building.models.outlier.title"),
      badge: t("building.models.outlier.badge"),
      description: t("building.models.outlier.description"),
    },
  ];

  return (
    <LandingLayout>
      {/* Hero: why we made ScoutAI */}
      <section className="site-hero site-hero-compact">
        <div className="site-hero-glow" aria-hidden="true" />
        <div className="site-hero-inner">
          <span className="site-kicker site-kicker-light">
            {t("hero.kicker")}
          </span>
          <h1>{t("hero.title")}</h1>
          <p className="site-hero-sub">{t("hero.description")}</p>
        </div>
      </section>

      {/* Mission statement */}
      <section className="site-section">
        <div className="site-showcase-copy" style={{ maxWidth: "820px" }}>
          <span className="site-kicker">{t("statement.kicker")}</span>
          <h2>{t("statement.title")}</h2>
          <p>{t("statement.body.1")}</p>
          <p>{t("statement.body.2")}</p>
        </div>
      </section>

      {/* Pillars — how we work */}
      <section className="site-section site-section-alt">
        <div className="site-section-heading">
          <span className="site-kicker">{t("pillars.kicker")}</span>
          <h2>{t("pillars.title")}</h2>
          <p>{t("pillars.description")}</p>
        </div>
        <div className="site-feature-grid">
          {pillars.map((pillar, index) => (
            <article className="site-feature-card" key={pillar.title}>
              <span className="site-feature-number">0{index + 1}</span>
              <span className="site-feature-icon">{pillar.icon}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Timeline — a look back */}
      <section className="site-section">
        <div className="site-section-heading">
          <span className="site-kicker">{t("timeline.kicker")}</span>
          <h2>{t("timeline.title")}</h2>
          <p>{t("timeline.description")}</p>
        </div>
        <div className="site-split">
          <div className="site-split-copy">
            <ol className="site-workflow-list">
              {milestones.map((item) => (
                <li key={item.year}>
                  <span>{item.year.slice(-2)}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <aside className="site-split-stats">
            <div className="site-stat-card">
              <strong>8,452+</strong>
              <small>{t("metrics.players")}</small>
            </div>
            <div className="site-stat-card">
              <strong>89</strong>
              <small>{t("metrics.attributes")}</small>
            </div>
            <div className="site-stat-card">
              <strong>5</strong>
              <small>{t("metrics.models")}</small>
            </div>
            <div className="site-stat-card">
              <strong>
                <ThunderboltOutlined />
              </strong>
              <small>{t("metrics.workflow")}</small>
            </div>
          </aside>
        </div>
      </section>

      {/* What we're building — the 5 models */}
      <section className="site-section site-section-alt">
        <div className="site-section-heading">
          <span className="site-kicker">{t("building.kicker")}</span>
          <h2>{t("building.title")}</h2>
          <p>{t("building.description")}</p>
        </div>
        <div className="site-feature-grid">
          {models.map((model, index) => (
            <article className="site-feature-card" key={model.title}>
              <span className="site-feature-number">0{index + 1}</span>
              <span className="site-feature-icon">{model.icon}</span>
              <h3>{model.title}</h3>
              <p className="site-model-badge">{model.badge}</p>
              <p>{model.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Close — contact / start */}
      <section className="site-cta-band">
        <span className="site-cta-band-icon">
          <CompassOutlined />
        </span>
        <span className="site-kicker">{t("cta.kicker")}</span>
        <h2>{t("cta.title")}</h2>
        <p>{t("cta.description")}</p>
        <div className="site-hero-actions" style={{ marginTop: "6px" }}>
          <Link className="site-cta-button site-cta-light" to={workspacePath}>
            {isAuthenticated ? t("cta.openWorkspace") : t("cta.action")}
            <ArrowRightOutlined />
          </Link>
          <Link className="site-cta-ghost-solid" to="/pricing">
            <RocketOutlined />
            {t("cta.pricing")}
          </Link>
        </div>
        <p className="site-contact-note">
          <TeamOutlined /> {t("cta.contact")}
        </p>
      </section>
    </LandingLayout>
  );
}

export default About;

