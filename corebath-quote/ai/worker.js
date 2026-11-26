/*
 * CoreBath AI design advisor - Cloudflare Worker.
 *
 * The quotation page POSTs the priced quote here; Claude reviews the selections
 * and returns a short summary, extra recommendations and compatibility checks.
 * The API key stays on the server (never put it in the Shopify theme).
 *
 * Deploy:  cd ai && npm install && npx wrangler secret put ANTHROPIC_API_KEY && npx wrangler deploy
 * Then set the worker URL as data-ai-endpoint (index.html) or "AI advisor URL" (Shopify section).
 */
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are the design advisor for CoreBath (corebath.in), an Indian company that sells complete bathroom renovations as a product: fixtures, concealed plumbing parts, demolition, waterproofing, tiling and fixing.

You receive one priced quotation as JSON. Review it as an experienced Indian bathroom site engineer would:
- Check that concealed parts fit the visible fixtures (diverter body vs trim brand and series, wall-hung WC vs concealed cistern, hot/cold supply for mixers, angle valve count).
- Spot missing items that would cause trouble on site (no hot water source for mixers, no ventilation, no slope or drain, unsuitable choices for elderly users, hard water).
- Suggest add-ons only from the provided addon_catalog where possible, and say why for this bathroom.
- Do not repeat recommendations that are already in the quote. Do not invent prices.
Write for the homeowner: plain English, short sentences, Indian context (sqft, geyser, CPVC).`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "recommendations", "checks"],
  properties: {
    summary: { type: "string", description: "2-3 sentences on how well this selection suits the bathroom." },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "reason", "priority"],
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          priority: { type: "string", enum: ["essential", "recommended", "optional"] },
        },
      },
    },
    checks: { type: "array", items: { type: "string" }, description: "Compatibility or site issues to confirm before ordering." },
  },
};

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin || "*" : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export default {
  async fetch(request, env) {
    const headers = cors(request.headers.get("Origin"), env);
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

    const body = await request.text();
    if (body.length > 60000) return Response.json({ error: "Quote too large" }, { status: 413, headers });
    let quote;
    try { quote = JSON.parse(body); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers }); }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: "user", content: "Review this CoreBath quotation:\n\n" + JSON.stringify(quote) }],
      });
      if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
        return Response.json({ error: "Advisor could not review this quote" }, { status: 502, headers });
      }
      const text = response.content.find((b) => b.type === "text");
      return Response.json(JSON.parse(text.text), { headers });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "Busy, try again shortly" }, { status: 429, headers });
      if (err instanceof Anthropic.APIError) return Response.json({ error: "AI service error " + err.status }, { status: 502, headers });
      return Response.json({ error: "Advisor failed" }, { status: 500, headers });
    }
  },
};
