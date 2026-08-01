const { getSupabaseAdminClient } = require("../config/supabase");

function nonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number);
}

async function recordApiUsage(event) {
  if (!event.userId) return;

  const { error } = await getSupabaseAdminClient()
    .from("api_usage_events")
    .insert({
      user_id: event.userId,
      method: String(event.method || "GET").slice(0, 12),
      endpoint: String(event.endpoint || "unknown").slice(0, 240),
      status_code: nonNegativeInteger(event.statusCode) || 500,
      duration_ms: nonNegativeInteger(event.durationMs),
      ai_provider: event.provider || null,
      ai_model: event.model || null,
      prompt_tokens: nonNegativeInteger(event.promptTokens),
      output_tokens: nonNegativeInteger(event.outputTokens),
      total_tokens: nonNegativeInteger(event.totalTokens),
      metadata: event.metadata || {},
    });

  if (error) {
    const usageError = new Error("Could not record API usage");
    usageError.code = "USAGE_RECORD_FAILED";
    usageError.details = { message: error.message };
    throw usageError;
  }
}

module.exports = {
  nonNegativeInteger,
  recordApiUsage,
};
