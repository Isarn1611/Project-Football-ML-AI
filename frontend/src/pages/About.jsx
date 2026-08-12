import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RightOutlined } from "@ant-design/icons";
import { useAuth } from "../auth/useAuth";
import LandingLayout from "../layouts/LandingLayout";

function About() {
  const { t } = useTranslation("about");
  const { isAuthenticated, loading } = useAuth();
  const workspacePath = isAuthenticated ? "/app" : "/login";

  return (
    <LandingLayout>
      <section className="site-section">
        <div
          className="site-policy-block"
          style={{
            maxWidth: "840px",
            margin: "0 auto",
            padding: "clamp(24px, 5vw, 48px)",
            background: "#ffffff",
            border: "1px solid #dce7e1",
            borderRadius: "20px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
          }}
        >
          {/* Main Title */}
          <h1
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.3rem)",
              fontWeight: "800",
              marginBottom: "12px",
              letterSpacing: "-0.02em",
              lineHeight: "1.2",
            }}
          >
            {t("title")}
          </h1>

          {/* Lead sentence */}
          <p
            style={{
              fontSize: "clamp(1.05rem, 2.5vw, 1.15rem)",
              fontWeight: "650",
              marginBottom: "24px",
              color: "var(--site-text-main, #14241c)",
              lineHeight: "1.55",
            }}
          >
            {t("lead")}
          </p>

          {/* Body paragraphs */}
          <p style={{ fontSize: "0.98rem", lineHeight: "1.75", marginBottom: "16px", color: "var(--site-text-muted, #5f7267)" }}>
            {t("body1")}
          </p>
          <p style={{ fontSize: "0.98rem", lineHeight: "1.75", marginBottom: "28px", color: "var(--site-text-muted, #5f7267)" }}>
            {t("body2")}
          </p>

          {/* Accomplishments / Highlights */}
          <h2
            style={{
              fontSize: "clamp(1.2rem, 3vw, 1.35rem)",
              fontWeight: "750",
              marginTop: "32px",
              marginBottom: "14px",
              borderBottom: "1px solid #e4ebe7",
              paddingBottom: "8px",
              color: "var(--site-text-main, #14241c)",
            }}
          >
            {t("accomplishments.title")}
          </h2>
          <ul
            style={{
              listStyleType: "none",
              paddingLeft: "0",
              lineHeight: "1.8",
              marginBottom: "28px",
              fontSize: "0.96rem",
              color: "var(--site-text-muted, #5f7267)",
            }}
          >
            <li style={{ marginBottom: "10px", paddingLeft: "20px", position: "relative" }}>
              <span style={{ position: "absolute", left: 0, color: "#246c4f", fontWeight: "bold" }}>›</span>
              {t("accomplishments.item1")}
            </li>
            <li style={{ marginBottom: "10px", paddingLeft: "20px", position: "relative" }}>
              <span style={{ position: "absolute", left: 0, color: "#246c4f", fontWeight: "bold" }}>›</span>
              {t("accomplishments.item2")}
            </li>
            <li style={{ marginBottom: "10px", paddingLeft: "20px", position: "relative" }}>
              <span style={{ position: "absolute", left: 0, color: "#246c4f", fontWeight: "bold" }}>›</span>
              {t("accomplishments.item3")}
            </li>
            <li style={{ marginBottom: "10px", paddingLeft: "20px", position: "relative" }}>
              <span style={{ position: "absolute", left: 0, color: "#246c4f", fontWeight: "bold" }}>›</span>
              {t("accomplishments.item4")}
            </li>
          </ul>

          {/* Credits */}
          <h2
            style={{
              fontSize: "clamp(1.2rem, 3vw, 1.35rem)",
              fontWeight: "750",
              marginTop: "32px",
              marginBottom: "14px",
              borderBottom: "1px solid #e4ebe7",
              paddingBottom: "8px",
              color: "var(--site-text-main, #14241c)",
            }}
          >
            {t("credits.title")}
          </h2>
          <p style={{ fontSize: "0.96rem", lineHeight: "1.75", marginBottom: "12px", color: "var(--site-text-muted, #5f7267)" }}>
            {t("credits.thanks1")}
          </p>
          <p style={{ fontSize: "0.96rem", lineHeight: "1.75", marginBottom: "12px", color: "var(--site-text-muted, #5f7267)" }}>
            {t("credits.thanks2")}
          </p>
          <p style={{ fontSize: "0.96rem", lineHeight: "1.75", marginBottom: "28px", color: "var(--site-text-muted, #5f7267)" }}>
            {t("credits.thanks3")}
          </p>

          {/* Disclaimer */}
          <h2
            style={{
              fontSize: "1.15rem",
              fontWeight: "700",
              marginTop: "32px",
              marginBottom: "10px",
              color: "#6b7c73",
              borderBottom: "1px solid #e4ebe7",
              paddingBottom: "6px",
            }}
          >
            {t("disclaimer.title")}
          </h2>
          <p
            style={{
              fontSize: "0.86rem",
              color: "#6b7c73",
              lineHeight: "1.65",
              marginBottom: "12px",
            }}
          >
            {t("disclaimer.text1")}
          </p>
          <p
            style={{
              fontSize: "0.86rem",
              color: "#6b7c73",
              lineHeight: "1.65",
              marginBottom: "12px",
            }}
          >
            {t("disclaimer.text2")}
          </p>
          <p
            style={{
              fontSize: "0.86rem",
              color: "#6b7c73",
              lineHeight: "1.65",
              margin: 0,
            }}
          >
            {t("disclaimer.text3")}
          </p>
        </div>
      </section>

      {/* Bottom Conversion Band */}
      <section className="site-cta-band" style={{ maxWidth: "840px" }}>
        <span className="site-kicker site-kicker-light">ScoutAI Platform</span>
        <h2>Experience AI-Powered Scouting</h2>
        <p>Explore realistic player recommendations and market analytics designed for modern recruitment.</p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "8px" }}>
          <Link className="site-cta-button site-cta-light" to={workspacePath}>
            {loading ? "..." : (
              <>
                Open Workspace <RightOutlined />
              </>
            )}
          </Link>
          <Link className="site-cta-button site-cta-ghost" to="/pricing" style={{ background: "#ffffff" }}>
            View Pricing <RightOutlined />
          </Link>
        </div>
      </section>
    </LandingLayout>
  );
}

export default About;
