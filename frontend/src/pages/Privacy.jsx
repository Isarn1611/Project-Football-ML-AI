import { useTranslation } from "react-i18next";
import { LockOutlined } from "@ant-design/icons";

import LandingLayout from "../layouts/LandingLayout";

function Privacy() {
  const { t } = useTranslation("privacy");

  const sections = t("sections", { returnObjects: true }) || [];

  return (
    <LandingLayout>
      <section className="site-hero site-hero-compact">
        <div className="site-hero-glow" aria-hidden="true" />
        <div className="site-hero-inner">
          <span className="site-kicker site-kicker-light">
            <LockOutlined /> {t("hero.kicker")}
          </span>
          <h1>{t("hero.title")}</h1>
          <p className="site-hero-sub">{t("hero.description")}</p>
        </div>
      </section>

      <section className="site-section site-policy">
        <div className="site-policy-intro">
          <p className="site-policy-note">{t("note")}</p>
          <p className="site-policy-updated">{t("updated")}</p>
        </div>

        <article className="site-policy-document">
          {sections.map((section) => (
            <div className="site-policy-block" key={section.id}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </div>
          ))}
        </article>
      </section>
    </LandingLayout>
  );
}

export default Privacy;
