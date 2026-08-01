const { recordApiUsage } = require("../services/usageService");

function getRouteEndpoint(req) {
  const routePath = req.route?.path;
  if (routePath) return `${req.baseUrl || ""}${routePath}`;
  return String(req.path || req.originalUrl || "unknown").split("?")[0];
}

function trackApiUsage(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.once("finish", () => {
    const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
    const aiUsage = res.locals.aiUsage || {};
    const writeUsage = req.app.locals.recordApiUsage || recordApiUsage;

    Promise.resolve(
      writeUsage({
        userId: req.user?.id,
        method: req.method,
        endpoint: getRouteEndpoint(req),
        statusCode: res.statusCode,
        durationMs: Number(elapsedNanoseconds / 1000000n),
        provider: aiUsage.provider,
        model: aiUsage.model,
        promptTokens: aiUsage.promptTokens,
        outputTokens: aiUsage.outputTokens,
        totalTokens: aiUsage.totalTokens,
      })
    ).catch((error) => {
      console.error("Usage tracking failed", error);
    });
  });

  return next();
}

module.exports = {
  getRouteEndpoint,
  trackApiUsage,
};
