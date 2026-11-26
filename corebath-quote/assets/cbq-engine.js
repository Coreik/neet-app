/*
 * CoreBath quotation engine. Pure functions, no DOM: the same code runs in the
 * browser, in the Shopify section and in Node tests.
 *
 *   CBQ.engine.newState(catalog, cfg, {brand, pkg})  -> editable quote state
 *   CBQ.engine.compute(state, catalog, cfg)          -> priced quote
 */
(function (g) {
  "use strict";
  var CBQ = (g.CBQ = g.CBQ || {});

  var PKG_LABEL = { essential: "Core Essential", signature: "Core Signature", luxe: "Core Luxe" };
  var PKGS = ["essential", "signature", "luxe"];

  // ---------- helpers ----------
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function isObj(o) { return o && typeof o === "object" && !Array.isArray(o); }
  function deepMerge(base, over) {
    if (!isObj(over)) return base;
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(over).forEach(function (k) {
      var b = base ? base[k] : undefined;
      if (Array.isArray(b) && isObj(over[k])) {
        // settings stored as {"3": {rate: 500}} patch array entries by index
        out[k] = b.map(function (x, i) { return over[k][i] !== undefined ? deepMerge(x, over[k][i]) : x; });
      } else out[k] = isObj(b) && isObj(over[k]) ? deepMerge(b, over[k]) : over[k];
    });
    return out;
  }
  function median(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function inr(n) {
    var neg = n < 0; n = Math.round(Math.abs(n));
    var s = String(n), last3 = s.slice(-3), rest = s.slice(0, -3);
    if (rest) last3 = "," + last3;
    return (neg ? "-" : "") + rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + last3;
  }

  function index(catalog) {
    if (catalog._idx) return catalog._idx;
    var byId = {}, byKey = {};
    catalog.products.forEach(function (p) {
      byId[p.id] = p;
      (byKey[p.key] = byKey[p.key] || []).push(p);
    });
    var itemByKey = {};
    catalog.items.forEach(function (it) { itemByKey[it.key] = it; });
    var brands = [];
    catalog.products.forEach(function (p) { if (brands.indexOf(p.brand) < 0) brands.push(p.brand); });
    catalog._idx = { byId: byId, byKey: byKey, itemByKey: itemByKey, brands: brands };
    return catalog._idx;
  }

  function settings(state, cfg) {
    return deepMerge(cfg, (state && state.settings) || {});
  }

  // Find the product for an item key, preferring the given brand + package.
  function pick(catalog, key, brand, pkg) {
    var list = index(catalog).byKey[key] || [];
    var exact = list.filter(function (p) { return p.brand === brand && p.pkg === pkg; })[0];
    if (exact) return exact;
    var sameBrand = list.filter(function (p) { return p.brand === brand; });
    if (sameBrand.length) {
      // nearest package tier
      var want = PKGS.indexOf(pkg);
      sameBrand.sort(function (a, b) { return Math.abs(PKGS.indexOf(a.pkg) - want) - Math.abs(PKGS.indexOf(b.pkg) - want); });
      return sameBrand[0];
    }
    return list.filter(function (p) { return p.pkg === pkg; })[0] || list[0] || null;
  }

  // Price lookup: your rate book > workbook price > included-in-set > estimate.
  function priceOf(product, state, catalog) {
    var ov = state.rateOverrides || {};
    if (ov[product.id] !== undefined && ov[product.id] !== "" && ov[product.id] !== null) {
      return { rate: num(ov[product.id]), source: "rate-book" };
    }
    if (product.included) return { rate: 0, source: "included" };
    if (product.price !== null && product.price !== undefined) return { rate: product.price, source: "list" };
    var list = index(catalog).byKey[product.key] || [];
    var rateOf = function (p) {
      if (ov[p.id] !== undefined && ov[p.id] !== "") return num(ov[p.id]);
      return p.price;
    };
    var samePkg = list.filter(function (p) { return p.pkg === product.pkg && rateOf(p) > 0; }).map(rateOf);
    var est = median(samePkg);
    if (est === null) est = median(list.filter(function (p) { return rateOf(p) > 0; }).map(rateOf));
    return { rate: est === null ? 0 : Math.round(est / 10) * 10, source: est === null ? "missing" : "estimate" };
  }

  // ---------- state ----------
  function newState(catalog, cfg, opts) {
    opts = opts || {};
    var brand = opts.brand || "Jaquar", pkg = opts.pkg || "signature";
    var st = {
      quoteNo: opts.quoteNo || "",
      date: opts.date || new Date().toISOString().slice(0, 10),
      client: { name: "", phone: "", email: "", address: "", notes: "" },
      room: { length: 8, width: 5, height: 10, tileHeight: 8, demolition: true, tilesByUs: true, waterPoints: "", drainPoints: "" },
      context: { hotWater: "none", ventilation: "window", seniors: false, kids: false, hardWater: false },
      baseBrand: brand, basePkg: pkg,
      fixtures: {}, concealed: {}, addons: {}, customItems: [],
      rateOverrides: {}, settings: {}, discount: { type: "pct", value: 0 },
      aiNotes: null, projectOverrides: {},
      name: "Bathroom 1", lineOverrides: {},
    };
    applyPackage(st, catalog, brand, pkg);
    st.bathrooms = [{}];
    st.activeBath = 0;
    syncOut(st);
    return st;
  }

  // ---------- several bathrooms in one quote ----------
  // The active bathroom's fields live on the quote itself (so every form path keeps working);
  // the others wait in st.bathrooms. syncOut/syncIn move them between the two.
  var BATH_FIELDS = ["name", "room", "context", "baseBrand", "basePkg", "fixtures", "concealed", "addons", "lineOverrides"];
  function syncOut(st) {
    if (!st.bathrooms || !st.bathrooms.length) return st;
    var b = st.bathrooms[st.activeBath || 0] || (st.bathrooms[st.activeBath || 0] = {});
    BATH_FIELDS.forEach(function (k) { b[k] = st[k]; });
    return st;
  }
  function syncIn(st, i) {
    if (!st.bathrooms || !st.bathrooms[i]) return st;
    st.activeBath = i;
    var b = st.bathrooms[i];
    BATH_FIELDS.forEach(function (k) { if (b[k] !== undefined) st[k] = b[k]; });
    return st;
  }
  // A fresh bathroom: same size and package as `from` unless told otherwise.
  function newBathroom(catalog, from, name) {
    var b = {
      name: name, lineOverrides: {}, concealed: {}, addons: {},
      room: JSON.parse(JSON.stringify((from && from.room) || { length: 8, width: 5, height: 10, tileHeight: 8, demolition: true, tilesByUs: true })),
      context: JSON.parse(JSON.stringify((from && from.context) || { hotWater: "none", ventilation: "window" })),
    };
    b.room.waterPoints = ""; b.room.drainPoints = "";
    applyPackage(b, catalog, (from && from.baseBrand) || "Jaquar", (from && from.basePkg) || "signature");
    b.concealed = {};
    return b;
  }
  // Make an older single-bathroom quote look like a one-bathroom list.
  function migrate(st) {
    if (!st.bathrooms || !st.bathrooms.length) {
      st.name = st.name || "Bathroom 1";
      st.lineOverrides = st.lineOverrides || {};
      st.projectOverrides = st.projectOverrides || {};
      ["consumables", "site_protection", "transport", "cleaning", "project_mgmt", "contingency"].forEach(function (k) {
        if (st.lineOverrides[k]) { st.projectOverrides[k] = st.lineOverrides[k]; delete st.lineOverrides[k]; }
      });
      st.bathrooms = [{}]; st.activeBath = 0;
      syncOut(st);
    } else {
      st.projectOverrides = st.projectOverrides || {};
      syncIn(st, Math.min(st.activeBath || 0, st.bathrooms.length - 1));
    }
    return st;
  }

  // Load every fixture of a brand + package as the starting point of a custom package.
  function applyPackage(st, catalog, brand, pkg) {
    st.baseBrand = brand; st.basePkg = pkg;
    st.fixtures = {};
    catalog.items.forEach(function (it) {
      if (it.role !== "fixture") return;
      var p = pick(catalog, it.key, brand, pkg);
      st.fixtures[it.key] = { on: !!p, productId: p ? p.id : null, qty: p ? p.qty : 1 };
    });
    st.concealed = {};
    return st;
  }

  // ---------- concealed matching ----------
  // Returns [{key, product, qty, reason}] for every in-wall / connection part
  // the selected fixtures need. Each part follows the brand + series of the
  // fixture it connects to, so bodies, trims and finishes stay compatible.
  function matchConcealed(st, catalog) {
    var idx = index(catalog);
    var F = st.fixtures || {};
    var on = function (k) { return F[k] && F[k].on && F[k].productId && idx.byId[F[k].productId]; };
    var prod = function (k) { return on(k) ? idx.byId[F[k].productId] : null; };
    var qtyOf = function (k) { return on(k) ? Math.max(1, num(F[k].qty, 1)) : 0; };

    // the "fittings brand" sets chrome finish for valves, stop cock, wastes
    var lead = prod("basin_mixer") || prod("diverter_trim") || prod("health_faucet");
    var fitBrand = lead ? lead.brand : st.baseBrand;
    var fitPkg = lead ? lead.pkg : st.basePkg;
    var adds = st.addons || {};
    var addonOn = function (k) { return adds[k] && adds[k].on; };

    var needs = [];
    function need(key, from, qty, reason) {
      var src = from ? { brand: from.brand, pkg: from.pkg } : { brand: fitBrand, pkg: fitPkg };
      needs.push({ key: key, brand: src.brand, pkg: src.pkg, qty: qty, reason: reason });
    }
    if (on("diverter_trim")) need("diverter_body", prod("diverter_trim"), 1, "In-wall body for " + prod("diverter_trim").name + " (same series)");
    if (on("ewc")) {
      need("concealed_cistern", prod("ewc"), 1, "Wall-hung WC needs an in-wall cistern and frame");
      need("angle_valve", null, 1, "Inlet for the concealed cistern");
    }
    if (on("basin_mixer")) {
      need("angle_valve", prod("basin_mixer"), 2, "Hot + cold supply for the basin mixer");
      need("braided_hose", prod("basin_mixer"), 2, "Connects angle valves to the basin mixer");
    }
    if (on("basin")) {
      var wasteSrc = prod("basin_mixer") || prod("basin");
      need("waste_coupling", wasteSrc, 1, "Basin outlet");
      need("bottle_trap", wasteSrc, 1, "Basin drain trap");
    }
    if (on("health_faucet")) need("angle_valve", prod("health_faucet"), 1, "Supply for the health faucet");
    if (on("hand_shower")) need("flexi_pipe", prod("hand_shower"), 1, "Hose for the hand shower");
    if (addonOn("geyser")) need("angle_valve", null, 2, "Geyser inlet + outlet");
    if (on("diverter_trim") || on("basin_mixer") || on("health_faucet") || on("bath_spout")) {
      need("stop_cock", null, 1, "Main shut-off for the bathroom");
    }

    // merge by key + product, then apply manual overrides / exclusions
    var out = {};
    needs.forEach(function (n) {
      var ov = (st.concealed || {})[n.key] || {};
      var p = ov.productId ? idx.byId[ov.productId] : pick(catalog, n.key, n.brand, n.pkg);
      if (!p) return;
      var k = n.key + "|" + p.id;
      if (!out[k]) out[k] = { key: n.key, product: p, qty: 0, reasons: [], overridden: !!ov.productId, excluded: !!ov.excluded };
      out[k].qty += n.qty;
      if (out[k].reasons.indexOf(n.reason) < 0) out[k].reasons.push(n.reason);
    });
    return Object.keys(out).map(function (k) {
      var o = out[k];
      var ov = (st.concealed || {})[o.key] || {};
      if (ov.qty !== undefined && ov.qty !== "") o.qty = num(ov.qty, o.qty);
      return o;
    }).sort(function (a, b) { return idx.itemByKey[a.key].sl - idx.itemByKey[b.key].sl; });
  }

  // ---------- add-on recommendations ----------
  function recommend(st, catalog, cfg) {
    var idx = index(catalog);
    var F = st.fixtures || {};
    var on = function (k) { return F[k] && F[k].on && F[k].productId; };
    var prod = function (k) { return on(k) ? idx.byId[F[k].productId] : null; };
    var c = st.context || {}, pkg = st.basePkg;
    var a = areas(st, cfg);
    var recs = [];
    function rec(key, priority, reason) { recs.push({ key: key, priority: priority, reason: reason }); }

    if (c.hotWater === "none" && (on("basin_mixer") || on("diverter_trim"))) {
      rec("geyser", "essential", "Mixer and diverter need hot water and no heater is recorded for this bathroom.");
    }
    if (c.ventilation === "none") rec("exhaust_fan", "essential", "No window: an exhaust fan is needed to stop damp, mould and grout staining.");
    else rec("exhaust_fan", "recommended", "Clears steam faster and protects grout and paint.");
    if (on("diverter_trim")) rec("overhead_shower", "recommended", "Your diverter has an overhead outlet; the package lists only a hand shower.");
    if (on("floor_grating")) rec("anti_cockroach", "recommended", "Keeps insects and drain odour out; low cost per drain.");
    rec("accessories", "recommended", "Completes the bathroom: towel rail, ring, robe hook, tumbler and soap dish.");
    if (on("basin")) rec("led_mirror", "recommended", "Lit, fog-free mirror over the basin.");
    var basin = prod("basin");
    if (basin && /table[- ]?top/i.test(basin.name)) rec("vanity", "essential", "Table-top basin needs a counter or vanity to sit on.");
    else if (on("basin")) rec("vanity", "optional", "Adds storage under the basin.");
    if (a.floor >= 35) rec("glass_partition", "recommended", "Bathroom is large enough to keep the shower zone separate and the rest dry.");
    else rec("glass_partition", "optional", "Keeps the WC and basin area dry.");
    rec("wall_niche", pkg === "essential" ? "optional" : "recommended", "Tiled recess for shampoo and soap instead of a wall shelf.");
    if (pkg === "luxe") rec("niche_light", "optional", "Soft light in the shower niche.");
    if (c.seniors) {
      rec("grab_bars", "essential", "Support near the WC and shower for elderly users.");
      rec("anti_skid", "essential", "Slip-resistant floor for elderly users.");
    } else if (c.kids) rec("anti_skid", "recommended", "Slip-resistant floor for children.");
    rec("epoxy_grout", pkg === "essential" ? "optional" : "recommended", "Stain-proof, waterproof joints that stay clean.");
    if (st.room && st.room.demolition) rec("false_ceiling", "optional", "Hides geyser, ducts and pipes; access panel for service.");
    if (c.hardWater) rec("water_softener", "recommended", "Hard water leaves scale on chrome and glass; a softener protects your fittings.");
    if (pkg === "luxe") rec("smart_seat", "optional", "Warm seat, wash and dryer for the wall-hung WC.");

    var addonByKey = {};
    settings(st, cfg).addons.forEach(function (x) { addonByKey[x.key] = x; });
    return recs.filter(function (r) { return addonByKey[r.key]; }).map(function (r) {
      r.addon = addonByKey[r.key];
      return r;
    });
  }

  // ---------- areas ----------
  function areas(st, cfg) {
    var r = st.room || {}, s = settings(st, cfg).services;
    var L = num(r.length), W = num(r.width), H = num(r.height), T = Math.min(num(r.tileHeight, H), H || 99);
    var floor = L * W, perim = 2 * (L + W);
    var wall = Math.max(0, perim * T - num(s.doorDeductionSqft));
    var wp = floor + perim * num(s.waterproofUpturnFt) + num(s.showerWallWpSqft);
    return { floor: round2(floor), wall: round2(wall), tiled: round2(floor + wall), waterproof: round2(wp), perimeter: round2(perim) };
  }

  // ---------- compute ----------
  function makeSvc(LO, removed) {
    return function svc(list, key, desc, qty, unit, rate, note) {
      var o = LO[key] || {}, auto = { qty: round2(qty), rate: rate, desc: desc };
      var has = function (v) { return v !== undefined && v !== null && v !== ""; };
      if (has(o.qty)) qty = num(o.qty);
      if (has(o.rate)) rate = num(o.rate);
      if (has(o.desc)) desc = o.desc;
      var line = { key: key, desc: desc, qty: round2(qty), unit: unit, rate: rate, amount: round2(qty * rate), note: note || "", auto: auto, edited: has(o.qty) || has(o.rate) || has(o.desc), section: list.sec };
      if (o.off) { line.amount = 0; removed.push(line); return; }
      if (!(qty > 0) || !(rate > 0)) return;
      list.push(line);
    };
  }

  // Sections A-E for one bathroom.
  function computeBath(st, catalog, cfg, S) {
    var idx = index(catalog);
    var markup = 1 + num(S.pricing.productMarkupPct) / 100;
    var sv = S.services, fx = S.fixing, sc = S.siteCharges;
    var warnings = [], flags = { estimated: 0, missing: 0 };
    var a = areas(st, cfg);
    var F = st.fixtures || {};
    var fixOn = function (k) { return F[k] && F[k].on && F[k].productId && idx.byId[F[k].productId]; };

    function productLine(p, qty, extra) {
      var pr = priceOf(p, st, catalog);
      if (pr.source === "estimate") flags.estimated++;
      if (pr.source === "missing") flags.missing++;
      var rate = round2(pr.rate * markup);
      return Object.assign({
        productId: p.id, key: p.key, desc: p.name, brand: p.brand, pkg: p.pkg, sku: p.sku,
        qty: qty, unit: "nos", rate: rate, amount: round2(rate * qty), source: pr.source, note: p.notes || "",
      }, extra || {});
    }

    // A. fixtures
    var fixtures = [];
    catalog.items.forEach(function (it) {
      if (it.role !== "fixture" || !fixOn(it.key)) return;
      var p = idx.byId[F[it.key].productId];
      fixtures.push(productLine(p, Math.max(0, num(F[it.key].qty, 1)), { item: it.label }));
    });

    // B. concealed / connections
    var matched = matchConcealed(st, catalog);
    var concealed = matched.filter(function (m) { return !m.excluded && m.qty > 0; }).map(function (m) {
      return productLine(m.product, m.qty, { item: idx.itemByKey[m.key].label, auto: !m.overridden, reason: m.reasons.join("; ") });
    });

    // compatibility checks
    if ((fixOn("bath_spout") || fixOn("hand_shower")) && !fixOn("diverter_trim")) {
      warnings.push("Bath spout / hand shower selected without a diverter. Add a diverter or a separate wall mixer.");
    }
    var trim = fixOn("diverter_trim") ? idx.byId[F.diverter_trim.productId] : null;
    var body = matched.filter(function (m) { return m.key === "diverter_body"; })[0];
    if (trim && body && body.product.brand !== trim.brand) {
      warnings.push("Diverter trim (" + trim.brand + ") and concealed body (" + body.product.brand + ") are different brands; they will not fit each other.");
    }
    if (fixOn("hand_shower") && !fixOn("sliding_rail")) {
      var hs = idx.byId[F.hand_shower.productId];
      if (!/rail/i.test(hs.name)) warnings.push("Hand shower has no sliding rail or wall hook selected.");
    }
    if (fixOn("ewc") && !matched.some(function (m) { return m.key === "concealed_cistern" && !m.excluded; })) {
      warnings.push("Wall-hung WC selected without a concealed cistern.");
    }

    // E. add-ons (needed before civil, for points)
    var addonDefs = {}; S.addons.forEach(function (x) { addonDefs[x.key] = x; });
    var addons = [], elecPoints = 0, addonFixing = [];
    var drains = fixOn("floor_grating") ? Math.max(1, num(F.floor_grating.qty, 1)) : 0;
    Object.keys(st.addons || {}).forEach(function (k) {
      var sel = st.addons[k], d = addonDefs[k];
      if (!sel || !sel.on || !d) return;
      var qty, unit;
      if (d.unit === "sqft_floor") { qty = a.floor; unit = "sqft"; }
      else if (d.unit === "sqft_tiled") { qty = a.tiled; unit = "sqft"; }
      else if (d.unit === "per_drain") { qty = Math.max(1, drains); unit = "nos"; }
      else { qty = Math.max(1, num(sel.qty, 1)); unit = "nos"; }
      if (sel.qty !== undefined && sel.qty !== "" && d.unit !== "each") qty = num(sel.qty, qty);
      var rate = sel.rate !== undefined && sel.rate !== "" ? num(sel.rate) : num(d.rate);
      addons.push({ key: k, desc: d.name, qty: round2(qty), unit: unit, rate: rate, amount: round2(rate * qty), source: "addon" });
      if (num(d.fixing) > 0) addonFixing.push({ key: k, desc: "Installation: " + d.name, qty: d.unit === "each" ? qty : 1, rate: num(d.fixing) });
      if (k !== "elec_point") elecPoints += num(d.elecPoints) * (d.unit === "each" ? qty : 1);
    });
    if (elecPoints > 0 && !(st.addons.elec_point && st.addons.elec_point.on)) {
      var ep = addonDefs.elec_point;
      if (ep) addons.push({ key: "elec_point_auto", desc: ep.name + " (for add-ons above)", qty: elecPoints, unit: "nos", rate: num(ep.rate), amount: elecPoints * num(ep.rate), source: "addon", auto: true });
    }

    // C. civil work
    var r = st.room || {};
    var civil = [];
    // Every work line has a stable key so it can be edited or removed per quote (lineOverrides).
    var removed = [], svc = makeSvc(st.lineOverrides || {}, removed);
    civil.sec = "C";
    if (r.demolition) {
      svc(civil, "demolition", "Demolition: break and remove old floor and wall tiles with bed", a.tiled, "sqft", num(sv.demolitionPerSqft));
      svc(civil, "dismantle", "Dismantle old sanitaryware and fittings", 1, "lump", num(sv.sanitaryDismantleLump));
      svc(civil, "debris", "Debris bagging, carrying and disposal", 1, "lump", num(sv.debrisDisposalLump));
    }
    svc(civil, "waterproofing", "Waterproofing: floor, " + num(sv.waterproofUpturnFt) + " ft up all walls, shower walls; with flood test", a.waterproof, "sqft", num(sv.waterproofPerSqft));
    svc(civil, "screed", "Floor screed with slope to drain", a.floor, "sqft", num(sv.screedPerSqft));
    if (r.tilesByUs) {
      var allowance = num((S.tileAllowance || {})[st.basePkg]);
      svc(civil, "tiles", "Tiles supply (allowance Rs " + allowance + "/sqft, incl. " + num(sv.tileWastagePct) + "% wastage)", a.tiled * (1 + num(sv.tileWastagePct) / 100), "sqft", allowance);
    }
    svc(civil, "adhesive", "Tile adhesive and grout", a.tiled, "sqft", num(sv.adhesiveGroutPerSqft));
    svc(civil, "floor_laying", "Floor tile laying", a.floor, "sqft", num(sv.floorTileLayPerSqft));
    svc(civil, "wall_laying", "Wall tile laying up to " + num(r.tileHeight) + " ft", a.wall, "sqft", num(sv.wallTileLayPerSqft));

    // D. plumbing + fixing
    var autoWater = (fixOn("basin_mixer") ? 2 : 0) + (fixOn("diverter_trim") ? 2 : 0) + (fixOn("health_faucet") ? 1 : 0) +
      (fixOn("ewc") ? 1 : 0) + (fixOn("hand_shower") ? 1 : 0) + (fixOn("bath_spout") ? 1 : 0) +
      ((st.addons.geyser && st.addons.geyser.on) ? 2 : 0) + ((st.addons.overhead_shower && st.addons.overhead_shower.on) ? 1 : 0);
    var autoDrain = (fixOn("ewc") ? 1 : 0) + (fixOn("basin") ? 1 : 0) + drains;
    var waterPts = r.waterPoints !== "" && r.waterPoints !== undefined ? num(r.waterPoints) : autoWater;
    var drainPts = r.drainPoints !== "" && r.drainPoints !== undefined ? num(r.drainPoints) : autoDrain;
    var plumbing = [];
    plumbing.sec = "D";
    svc(plumbing, "water_points", "Concealed CPVC water lines (hot/cold) incl. pressure test", waterPts, "points", num(sv.waterPointRate));
    svc(plumbing, "drain_points", "Drainage lines (SWR/uPVC) to stack", drainPts, "points", num(sv.drainPointRate));
    var fixQty = {};
    fixtures.concat(concealed).forEach(function (l) { fixQty[l.key] = (fixQty[l.key] || 0) + l.qty; });
    catalog.items.forEach(function (it) {
      if (fixQty[it.key]) svc(plumbing, "fix_" + it.key, "Fixing: " + it.label, fixQty[it.key], "nos", num(fx[it.key]));
    });
    addonFixing.forEach(function (x) { svc(plumbing, "addonfix_" + x.key, x.desc, x.qty, "nos", x.rate); });

    var sum = function (l) { return round2(l.reduce(function (t, x) { return t + x.amount; }, 0)); };
    var sections = [
      { id: "A", title: "Bathroom fixtures", lines: fixtures, total: sum(fixtures) },
      { id: "B", title: "Concealed & connection parts (matched to your fixtures)", lines: concealed, total: sum(concealed) },
      { id: "C", title: "Civil work: demolition, waterproofing, tiling", lines: civil, total: sum(civil) },
      { id: "D", title: "Plumbing & fixing", lines: plumbing, total: sum(plumbing) },
      { id: "E", title: "Add-ons", lines: addons, total: sum(addons) },
    ];
    return {
      name: st.name || "Bathroom", sections: sections, areas: a, waterPoints: waterPts, drainPoints: drainPts,
      total: round2(sections.reduce(function (t, x) { return t + x.total; }, 0)),
      recommendations: recommend(st, catalog, cfg), warnings: warnings, flags: flags, removed: removed,
      addonsOn: Object.keys(st.addons || {}).filter(function (k) { return st.addons[k] && st.addons[k].on; }),
      mix: mixLabel(st, catalog), room: st.room, basePkg: st.basePkg,
    };
  }

  // The whole quote: every bathroom, then extras, site charges, discount and GST once.
  function compute(st, catalog, cfg) {
    var S = settings(st, cfg), sc = S.siteCharges;
    var list = st.bathrooms && st.bathrooms.length ? st.bathrooms : [st];
    var active = Math.min(st.activeBath || 0, list.length - 1);
    var baths = list.map(function (b, i) {
      // the active bathroom's live data is on the quote itself
      var view = i === active ? st : Object.assign({}, st, b);
      return computeBath(view, catalog, cfg, S);
    });
    var multi = baths.length > 1;
    var flags = { estimated: 0, missing: 0 }, warnings = [];
    baths.forEach(function (b) {
      flags.estimated += b.flags.estimated; flags.missing += b.flags.missing;
      b.warnings.forEach(function (w) { warnings.push(multi ? b.name + ": " + w : w); });
    });
    var sum = function (l) { return round2(l.reduce(function (t, x) { return t + x.amount; }, 0)); };
    var secTotal = function (id) { return round2(baths.reduce(function (t, b) { return t + b.sections.filter(function (x) { return x.id === id; })[0].total; }, 0)); };

    // F. custom items & services (whole job)
    var custom = (st.customItems || []).filter(function (c) { return c && c.desc; }).map(function (c) {
      var qty = num(c.qty, 1), rate = num(c.rate);
      if (!(rate > 0)) flags.missing++;
      return { desc: c.desc, qty: qty, unit: c.unit || "nos", rate: rate, amount: round2(qty * rate), source: "custom", kind: c.kind || "service" };
    });
    var tF = sum(custom);
    var tBaths = round2(baths.reduce(function (t, b) { return t + b.total; }, 0));

    // G. unseen site & project charges (whole job)
    var removedG = [], svc = makeSvc(st.projectOverrides || {}, removedG), site = [];
    site.sec = "G";
    var n = baths.length;
    svc(site, "consumables", "Consumables: cement, sand, white cement, silicone, sleeves, fasteners (" + num(sc.consumablesPct) + "% of works)", 1, "lump", round2((secTotal("C") + secTotal("D")) * num(sc.consumablesPct) / 100));
    svc(site, "site_protection", "Site protection: floor and furniture covering on the access route", 1, "lump", num(sc.siteProtectionLump));
    svc(site, "transport", "Material transport, lifting and handling", 1, "lump", num(sc.transportLump));
    svc(site, "cleaning", "Post-work deep cleaning and acid wash" + (n > 1 ? " (" + n + " bathrooms)" : ""), n, n > 1 ? "nos" : "lump", num(sc.cleaningLump));
    var pmBase = tBaths + tF;
    svc(site, "project_mgmt", "Project management and site supervision (" + num(sc.projectMgmtPct) + "%)", 1, "lump", round2(pmBase * num(sc.projectMgmtPct) / 100));
    if (num(sc.contingencyPct) > 0) svc(site, "contingency", "Contingency (" + num(sc.contingencyPct) + "%)", 1, "lump", round2(pmBase * num(sc.contingencyPct) / 100));
    var tG = sum(site);
    var projectSections = [
      { id: "F", title: "Additional items & services", lines: custom, total: tF },
      { id: "G", title: "Site & project charges", lines: site, total: tG },
    ];

    var subtotal = round2(tBaths + tF + tG);
    var d = st.discount || {};
    var discount = d.type === "amt" ? num(d.value) : round2(subtotal * num(d.value) / 100);
    discount = Math.min(Math.max(0, discount), subtotal);
    var taxable = round2(subtotal - discount);
    var gst = round2(taxable * num(S.pricing.gstPct) / 100);
    var raw = taxable + gst;
    var step = num(S.pricing.roundTo, 1) || 1;
    var grand = Math.round(raw / step) * step;
    if (flags.missing) warnings.push(flags.missing + " line(s) have no rate. Enter the rate before sending this quote.");

    var cur = baths[active];
    return {
      bathrooms: baths, activeBath: active, projectSections: projectSections,
      sections: cur.sections.concat(projectSections), areas: cur.areas, waterPoints: cur.waterPoints, drainPoints: cur.drainPoints,
      recommendations: cur.recommendations, warnings: warnings, flags: flags, removedLines: cur.removed.concat(removedG),
      totals: {
        subtotal: subtotal, discount: discount, taxable: taxable, gstPct: num(S.pricing.gstPct), gst: gst,
        roundOff: round2(grand - raw), grand: grand,
      },
      settings: S,
    };
  }

  // Which brands the selected fixtures come from, most used first.
  function brandMix(st, catalog) {
    var idx = index(catalog), count = {};
    Object.keys(st.fixtures || {}).forEach(function (k) {
      var f = st.fixtures[k], p = f && f.on && idx.byId[f.productId];
      if (p) count[p.brand] = (count[p.brand] || 0) + 1;
    });
    return Object.keys(count).map(function (b) { return { brand: b, count: count[b] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }
  function mixLabel(st, catalog) {
    var mix = brandMix(st, catalog);
    var tier = PKG_LABEL[st.basePkg] || st.basePkg;
    if (mix.length <= 1) return (mix[0] ? mix[0].brand : st.baseBrand) + " " + tier;
    return "Custom mix (" + mix.map(function (m) { return m.brand + " x" + m.count; }).join(", ") + "), " + tier + " base";
  }

  // Replace the catalogue with rows loaded from the Google Sheet.
  function loadCatalog(catalog, products) {
    catalog.products = products;
    delete catalog._idx;
    return catalog;
  }

  // Text lists (payment schedule, terms) may be an array or one text block with a line per item.
  function textLines(v) {
    if (Array.isArray(v)) return v.filter(function (x) { return String(x).trim(); });
    return String(v || "").split(/\r?\n/).map(function (x) { return x.replace(/^\s*[-\u2022*]\s*/, "").trim(); }).filter(Boolean);
  }

  // Items that still need a rate (for the rate book screen)
  function unpriced(catalog, state) {
    var ov = (state && state.rateOverrides) || {};
    return catalog.products.filter(function (p) {
      return !p.included && (p.price === null || p.price === undefined) && (ov[p.id] === undefined || ov[p.id] === "");
    });
  }

  CBQ.engine = {
    PKG_LABEL: PKG_LABEL, PKGS: PKGS,
    newState: newState, applyPackage: applyPackage, compute: compute, matchConcealed: matchConcealed,
    recommend: recommend, areas: areas, syncIn: syncIn, syncOut: syncOut, newBathroom: newBathroom, migrate: migrate, BATH_FIELDS: BATH_FIELDS, brandMix: brandMix, mixLabel: mixLabel, textLines: textLines, loadCatalog: loadCatalog, priceOf: priceOf, pick: pick, unpriced: unpriced,
    settings: settings, deepMerge: deepMerge, index: index, inr: inr, num: num,
  };
})(typeof window !== "undefined" ? window : globalThis);
