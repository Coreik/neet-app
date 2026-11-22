// Run: node tools/test_engine.cjs   (no dependencies)
const assert = require("assert");
const path = require("path");
["cbq-catalog.js", "cbq-config.js", "cbq-engine.js", "cbq-pdf.js"].forEach((f) => require(path.join(__dirname, "..", "assets", f)));
const { catalog, defaults: cfg, engine: E, pdf } = globalThis.CBQ;

// every brand x package loads all 9 fixtures
for (const b of E.index(catalog).brands) for (const p of E.PKGS) {
  const st = E.newState(catalog, cfg, { brand: b, pkg: p });
  const q = E.compute(st, catalog, cfg);
  assert.strictEqual(q.sections[0].lines.length, 9, `${b} ${p} fixtures`);
  assert.ok(q.totals.grand > 100000, `${b} ${p} total looks too low: ${q.totals.grand}`);
  assert.ok(!q.warnings.some((w) => /different brands/.test(w)), `${b} ${p} brand mismatch`);
}

// concealed body follows the trim, even across brands
let st = E.newState(catalog, cfg, { brand: "Kohler", pkg: "signature" });
st.fixtures.diverter_trim.productId = "grohe-luxe-diverter_trim";
let body = E.matchConcealed(st, catalog).find((m) => m.key === "diverter_body");
assert.strictEqual(body.product.id, "grohe-luxe-diverter_body");

// angle valves: 2 mixer + 1 cistern + 1 health faucet (+2 with geyser) = the 6 in the package
st = E.newState(catalog, cfg, { brand: "Jaquar", pkg: "essential" });
const av = () => E.matchConcealed(st, catalog).filter((m) => m.key === "angle_valve").reduce((t, m) => t + m.qty, 0);
assert.strictEqual(av(), 4);
st.addons.geyser = { on: true };
assert.strictEqual(av(), 6);

// rate book beats estimate; estimate flagged
st = E.newState(catalog, cfg, { brand: "Jaquar", pkg: "signature" });
let q = E.compute(st, catalog, cfg);
const basin = q.sections[0].lines.find((l) => l.key === "basin");
assert.strictEqual(basin.source, "estimate");
st.rateOverrides["jaquar-signature-basin"] = 9000;
q = E.compute(st, catalog, cfg);
assert.strictEqual(q.sections[0].lines.find((l) => l.key === "basin").amount, 9000);

// markup, custom items, discount, GST and rounding
st.settings = { pricing: { productMarkupPct: 10 } };
st.customItems = [{ desc: "Extra service", qty: 2, rate: 1000 }];
st.discount = { type: "amt", value: 5000 };
q = E.compute(st, catalog, cfg);
assert.strictEqual(q.sections[0].lines.find((l) => l.key === "basin").rate, 9900);
assert.strictEqual(q.sections[5].total, 2000);
assert.strictEqual(q.totals.taxable, Math.round((q.totals.subtotal - 5000) * 100) / 100);
assert.strictEqual(q.totals.grand % 100, 0);
const sum = q.sections.reduce((t, s) => t + s.total, 0);
assert.ok(Math.abs(sum - q.totals.subtotal) < 0.05);

// no demolition removes demolition lines
st.room.demolition = false;
q = E.compute(st, catalog, cfg);
assert.ok(!q.sections[2].lines.some((l) => /Demolition/.test(l.desc)));

// settings array patch (add-on rate edit) works
st.settings = { addons: { 0: { rate: 9999 } } };
assert.strictEqual(E.settings(st, cfg).addons[0].rate, 9999);
assert.strictEqual(E.settings(st, cfg).addons.length, cfg.addons.length);

// recommendations react to context
st = E.newState(catalog, cfg, { brand: "Cera", pkg: "essential" });
st.context.seniors = true; st.context.ventilation = "none";
const recs = E.recommend(st, catalog, cfg);
for (const k of ["grab_bars", "anti_skid", "exhaust_fan", "geyser"]) assert.strictEqual(recs.find((r) => r.key === k).priority, "essential", k);

assert.strictEqual(pdf.words(314100), "Three Lakh Fourteen Thousand One Hundred");
assert.strictEqual(pdf.words(12500000), "One Crore Twenty Five Lakh");
console.log("All engine tests passed");
