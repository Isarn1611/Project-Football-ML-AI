import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  UpOutlined,
  RightOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import { useAuth } from "../auth/useAuth";
import LandingLayout from "../layouts/LandingLayout";

function Pricing() {
  const { t } = useTranslation("pricing");
  const { isAuthenticated, loading } = useAuth();
  const workspacePath = isAuthenticated ? "/app" : "/login";
  const [period, setPeriod] = useState("monthly");
  const [openFaq, setOpenFaq] = useState(0);

  const planKeys = ["free", "pro", "team"];
  const plans = planKeys.map((key) => {
    const monthlyPrice = t(`plans.${key}.price`);
    const annualPrice = t(`plans.${key}.annual`) || monthlyPrice;

    return {
      key,
      name: t(`plans.${key}.name`),
      price: period === "annual" ? annualPrice : monthlyPrice,
      description: t(`plans.${key}.description`),
      features: t(`plans.${key}.features`, { returnObjects: true }),
      cta: t(`plans.${key}.cta`),
    };
  });

  const features = t("compare.rows", { returnObjects: true });
  const faqItems = t("faq.items", { returnObjects: true });
  const featured = "pro";

  const renderCell = (value) => {
    if (value === true)
      return <CheckOutlined aria-label="yes" style={{ color: "#246c4f", fontWeight: "bold" }} />;
    if (value === false)
      return <CloseOutlined aria-label="no" style={{ color: "#b6c5bd" }} />;
    return <span style={{ fontWeight: "600", color: "var(--site-text-main, #14241c)" }}>{value}</span>;
  };

  return (
    <LandingLayout>
      {/* Hero Header */}
      <section className="site-hero site-hero-compact">
        <div className="site-hero-glow" aria-hidden="true" />
        <div className="site-hero-inner">
          <span className="site-kicker site-kicker-light">
            <ThunderboltOutlined /> {t("hero.kicker")}
          </span>
          <h1>{t("hero.title")}</h1>
          <p className="site-hero-sub">{t("hero.description")}</p>
        </div>
      </section>

      {/* Monthly / Annual Billing Toggle Switch */}
      <section className="site-section" style={{ paddingBlock: "24px 12px", textAlign: "center" }}>
        <div className="site-billing-toggle" role="group" aria-label={t("billing.monthly")}>
          <button
            type="button"
            className={`site-billing-option${period === "monthly" ? " is-active" : ""}`}
            onClick={() => setPeriod("monthly")}
          >
            {t("billing.monthly")}
          </button>
          <button
            type="button"
            className={`site-billing-option${period === "annual" ? " is-active" : ""}`}
            onClick={() => setPeriod("annual")}
          >
            {t("billing.annual")}
            <span className="site-billing-save">{t("billing.save")}</span>
          </button>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="site-section" style={{ paddingTop: "24px" }}>
        <div className="site-pricing-grid">
          {plans.map((plan) => (
            <article
              className={`site-pricing-card${plan.key === featured ? " is-featured" : ""}`}
              key={plan.key}
            >
              {plan.key === featured && (
                <span className="site-pricing-badge">{t("badge")}</span>
              )}
              <h3 style={{ fontSize: "1.4rem", fontWeight: "750", letterSpacing: "-0.02em" }}>
                {plan.name}
              </h3>
              <p className="site-pricing-desc" style={{ minHeight: "42px", fontSize: "0.92rem" }}>
                {plan.description}
              </p>

              <div className="site-pricing-price" style={{ marginBlock: "20px 16px", minHeight: "48px" }}>
                <strong style={{ fontSize: "2.4rem", fontWeight: "800" }}>{plan.price}</strong>
                <span className="site-pricing-period" style={{ fontSize: "0.85rem", color: "#6b7c73" }}>
                  / {period === "annual" ? t("billing.annual") : t("billing.monthly")}
                </span>
              </div>

              <Link
                className={`site-cta-button ${plan.key === featured ? "site-cta-light" : "site-cta-ghost-solid"}`}
                to={workspacePath}
                style={{ width: "100%", justifyContent: "center", marginBottom: "24px" }}
              >
                {loading ? "" : (
                  <>
                    {plan.cta} <RightOutlined />
                  </>
                )}
              </Link>

              <ul className="site-pricing-features" style={{ borderTop: "1px solid #e4ebe7", paddingTop: "20px", marginTop: "auto" }}>
                {plan.features.map((feature) => (
                  <li key={feature} style={{ fontSize: "0.92rem", lineHeight: "1.6" }}>
                    <CheckOutlined style={{ color: "#246c4f", fontWeight: "bold", marginTop: "3px" }} /> {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Compare Table */}
      <section className="site-section">
        <div className="site-compare">
          <h2 style={{ fontSize: "1.6rem", fontWeight: "750", marginBottom: "8px" }}>
            {t("compare.title")}
          </h2>
          <p className="site-compare-sub">{t("compare.subtitle")}</p>
          <div className="site-compare-table" style={{ marginTop: "24px" }}>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("compare.header")}</th>
                  {planKeys.map((key) => (
                    <th scope="col" key={key}>
                      {t(`plans.${key}.name`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((row) => (
                  <tr key={row[0]}>
                    <td style={{ fontWeight: "500" }}>{row[0]}</td>
                    {row.slice(1).map((cell, i) => (
                      <td key={i}>{renderCell(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="site-section">
        <div className="site-faq">
          <h2 style={{ fontSize: "1.6rem", fontWeight: "750", marginBottom: "8px" }}>
            {t("faq.title")}
          </h2>
          <p className="site-faq-sub">{t("faq.subtitle")}</p>
          <div className="site-faq-list" style={{ marginTop: "24px" }}>
            {faqItems.map((item, i) => (
              <div className="site-faq-item" key={i}>
                <button
                  type="button"
                  className="site-faq-question"
                  aria-expanded={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                >
                  <span style={{ fontWeight: "650" }}>{item.q}</span>
                  {openFaq === i ? <UpOutlined /> : <DownOutlined />}
                </button>
                {openFaq === i && (
                  <div className="site-faq-answer" style={{ lineHeight: "1.7", color: "var(--site-text-muted, #5f7267)" }}>
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA Band */}
      <section className="site-cta-band">
        <span className="site-kicker site-kicker-light">{t("cta.kicker")}</span>
        <h2>{t("cta.title")}</h2>
        <p>{t("cta.description")}</p>
        <Link className="site-cta-button site-cta-light" to={workspacePath}>
          {loading ? "..." : (
            <>
              {t("cta.action")} <RightOutlined />
            </>
          )}
        </Link>
      </section>
    </LandingLayout>
  );
}

export default Pricing;
