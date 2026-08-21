import { useTranslation } from "react-i18next";
import { SafetyCertificateOutlined } from "@ant-design/icons";

import LandingLayout from "../layouts/LandingLayout";

function Policy() {
  const { t } = useTranslation("policy");

  const termsOfUseSections = t("termsOfUse.sections", { returnObjects: true }) || [];
  const privacyPolicySections = t("privacyPolicy.sections", { returnObjects: true }) || [];
  const otherPoliciesSections = t("otherPolicies.sections", { returnObjects: true }) || [];

  const documents = [
    {
      id: "terms-of-use",
      title: t("nav.termsOfUse"),
      heading: t("termsOfUse.title"),
      sections: termsOfUseSections,
    },
    {
      id: "privacy-policy",
      title: t("nav.privacyPolicy"),
      heading: t("privacyPolicy.title"),
      sections: privacyPolicySections,
    },
    {
      id: "other-policies",
      title: t("nav.otherPolicies"),
      heading: t("otherPolicies.title"),
      sections: otherPoliciesSections,
    },
  ];

  return (
    <LandingLayout>
      <section className="site-hero site-hero-compact">
        <div className="site-hero-glow" aria-hidden="true" />
        <div className="site-hero-inner">
          <span className="site-kicker site-kicker-light">
            <SafetyCertificateOutlined /> {t("hero.kicker")}
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

        <nav className="site-policy-nav" aria-label={t("nav.termsOfUse")}>
          {documents.map((doc) => (
            <a className="site-policy-nav-link" href={`#${doc.id}`} key={doc.id}>
              {doc.title}
            </a>
          ))}
        </nav>

        {documents.map((doc) => (
          <article className="site-policy-document" id={doc.id} key={doc.id}>
            <h2 className="site-policy-document-title">{doc.heading}</h2>
            {doc.sections.map((section) => (
              <div className="site-policy-block" key={section.id}>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </div>
            ))}
          </article>
        ))}
      </section>
    </LandingLayout>
  );
}

export default Policy;
