import { useTranslation } from "react-i18next";
import LandingLayout from "../layouts/LandingLayout";

function Terms() {
  const { t } = useTranslation("terms");

  const sections = t("sections", { returnObjects: true }) || [];

  return (
    <LandingLayout>
      <section className="site-section">
        <div
          className="site-policy-block"
          style={{
            maxWidth: "860px",
            margin: "0 auto",
            padding: "clamp(24px, 5vw, 48px)",
            background: "rgba(255, 255, 255, 0.8)",
            border: "1px solid #dce7e1",
            borderRadius: "20px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
          }}
        >
          <h1
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.3rem)",
              fontWeight: "800",
              marginBottom: "8px",
              letterSpacing: "-0.02em",
              lineHeight: "1.2",
            }}
          >
            {t("hero.title")}
          </h1>
          <p
            style={{
              fontSize: "0.88rem",
              color: "#6b7c73",
              marginBottom: "20px",
              fontWeight: "600",
            }}
          >
            {t("updated")}
          </p>

          <p
            style={{
              fontSize: "clamp(1rem, 2.5vw, 1.05rem)",
              lineHeight: "1.7",
              marginBottom: "28px",
              paddingBottom: "20px",
              borderBottom: "1px solid #e4ebe7",
              color: "var(--site-text-main, #14241c)",
              fontWeight: "500",
            }}
          >
            {t("note")}
          </p>

          <article className="site-policy-document">
            {sections.map((section) => (
              <div key={section.id} style={{ marginBottom: "26px" }}>
                <h2
                  style={{
                    fontSize: "clamp(1.15rem, 3vw, 1.3rem)",
                    fontWeight: "750",
                    marginBottom: "8px",
                    color: "var(--site-text-main, #14241c)",
                  }}
                >
                  {section.title}
                </h2>
                <p
                  style={{
                    fontSize: "0.96rem",
                    lineHeight: "1.75",
                    color: "var(--site-text-muted, #5f7267)",
                    margin: 0,
                  }}
                >
                  {section.body}
                </p>
              </div>
            ))}
          </article>
        </div>
      </section>
    </LandingLayout>
  );
}

export default Terms;
