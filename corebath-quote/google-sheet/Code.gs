/**
 * CoreBath quotation - Google Sheet back end (Apps Script web app).
 *
 * GET  ?action=catalog        -> products, add-ons and settings as JSON (read by the quotation tool)
 * POST {action:"saveQuote"}   -> adds or updates a row in "Quotes" and its lines in "Quote Lines"
 * POST {action:"saveRates"}   -> writes prices / settings from the admin tool (needs the admin key)
 *
 * Setup (once): Extensions > Apps Script, paste this file, Run > setup (allow access),
 * then Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone. Copy the /exec URL.
 */

var ITEMS = [
  ["ewc", "fixture", "EWC (wall-hung WC)"],
  ["basin", "fixture", "Wash basin"],
  ["basin_mixer", "fixture", "Tall boy basin mixer"],
  ["diverter_trim", "fixture", "Diverter (exposed trim)"],
  ["waste_coupling", "concealed", "Waste coupling"],
  ["bottle_trap", "concealed", "Bottle trap"],
  ["angle_valve", "concealed", "Angle valve"],
  ["health_faucet", "fixture", "Health faucet"],
  ["bath_spout", "fixture", "Bath spout"],
  ["diverter_body", "concealed", "Concealed diverter body"],
  ["hand_shower", "fixture", "Hand shower"],
  ["sliding_rail", "fixture", "Sliding rail"],
  ["flexi_pipe", "concealed", "Shower flexi pipe 1.5m"],
  ["braided_hose", "concealed", "Braided connection hose"],
  ["floor_grating", "fixture", "Floor drain / grating"],
  ["concealed_cistern", "concealed", "Concealed cistern + flush plate"],
  ["stop_cock", "concealed", "Concealed stop cock"]
];
var PKG = { "core essential": "essential", "core signature": "signature", "core luxe": "luxe", essential: "essential", signature: "signature", luxe: "luxe" };

var QUOTE_HEADERS = ["Saved at", "Quote No", "Source", "Client", "Phone", "Email", "Site address", "Package", "Brands",
  "Bathroom size", "A. Fixtures", "B. Concealed", "C. Civil", "D. Plumbing & fixing", "E. Add-ons", "F. Additional",
  "G. Site & project", "Subtotal", "Discount", "GST", "Grand total", "Estimated rates", "Notes", "Quote data (JSON)"];
var LINE_HEADERS = ["Quote No", "Section", "Item", "Description", "Brand", "SKU", "Qty", "Unit", "Rate", "Amount", "Rate source"];

// ---------- helpers ----------
function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" not found');
  return sh;
}
function rows_(name) {
  var values = sheet_(name).getDataRange().getValues();
  var head = values.shift().map(function (h) { return String(h).trim(); });
  return values.map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = r[j]; });
    return o;
  });
}
function col_(name, header) {
  var head = sheet_(name).getRange(1, 1, 1, sheet_(name).getLastColumn()).getValues()[0];
  var i = head.map(function (h) { return String(h).trim(); }).indexOf(header);
  if (i < 0) throw new Error('Column "' + header + '" not found in ' + name);
  return i + 1;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function num_(v) { return v === "" || v === null || v === undefined ? null : Number(v); }
function slug_(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

// ---------- read ----------
function catalog_() {
  var byLabel = {};
  ITEMS.forEach(function (it) { byLabel[it[2].toLowerCase()] = it; byLabel[it[0]] = it; });
  var products = [], skipped = [], idSheet = sheet_("Products"), idCol = col_("Products", "ID");
  rows_("Products").forEach(function (r) {
    if (!r["Brand"] || !r["Item"]) return;
    var it = byLabel[String(r["Item"]).trim().toLowerCase()];
    var pkg = PKG[String(r["Package"]).trim().toLowerCase()];
    if (!it || !pkg) { skipped.push(r._row); return; }
    var id = String(r["ID"] || "").trim();
    if (!id) { // new row added by hand: give it a permanent ID
      id = slug_(r["Brand"]) + "-" + pkg + "-" + it[0] + "-r" + r._row;
      idSheet.getRange(r._row, idCol).setValue(id);
    }
    var included = r["Included in set"] === true || String(r["Included in set"]).toUpperCase() === "TRUE";
    var price = num_(r["Price (Rs)"]);
    products.push({
      id: id, brand: String(r["Brand"]).trim(), pkg: pkg, key: it[0], role: it[1],
      qty: Number(r["Qty"]) || 1, name: String(r["Product"] || it[2]), sku: r["SKU"] ? String(r["SKU"]) : null,
      price: included || price === null || isNaN(price) ? null : price, included: included,
      basis: r["Price basis"] ? String(r["Price basis"]) : null, link: r["Link"] ? String(r["Link"]) : null,
      notes: r["Notes"] ? String(r["Notes"]) : null
    });
  });
  var addons = rows_("Add-ons").filter(function (r) { return r["Key"] && r["Add-on"]; }).map(function (r) {
    return { key: String(r["Key"]).trim(), name: String(r["Add-on"]), rate: Number(r["Rate (Rs)"]) || 0,
      unit: String(r["Unit"] || "each"), fixing: Number(r["Fixing (Rs)"]) || 0,
      elecPoints: Number(r["Electrical points"]) || 0, angleValves: Number(r["Angle valves"]) || 0 };
  });
  var settings = {};
  rows_("Settings").forEach(function (r) {
    var sec = String(r["Section"]).trim(), key = String(r["Key"]).trim();
    if (!sec || !key || r["Value"] === "") return;
    settings[sec] = settings[sec] || {};
    var v = r["Value"];
    settings[sec][key] = typeof v === "number" || sec === "company" ? v : Number(v);
  });
  var tz = Session.getScriptTimeZone();
  return { ok: true, products: products, addons: addons, settings: settings, skippedRows: skipped,
    updatedAt: Utilities.formatDate(new Date(), tz, "d MMM yyyy, HH:mm") };
}

function doGet(e) {
  try { return json_(catalog_()); } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

// ---------- write ----------
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse(e.postData.contents);
    if (body.action === "saveQuote") return json_(saveQuote_(body.quote));
    if (body.action === "saveRates") return json_(saveRates_(body));
    return json_({ ok: false, error: "Unknown action" });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function saveQuote_(q) {
  if (!q || !q.quoteNo) throw new Error("Missing quote number");
  var sh = sheet_("Quotes"), lines = sheet_("Quote Lines");
  var c = q.client || {}, t = q.totals || {}, sec = {};
  (q.sections || []).forEach(function (s) { sec[s.id] = s.total; });
  var row = [new Date(), q.quoteNo, q.mode === "admin" ? "CoreBath team" : "Website", c.name || "", "'" + (c.phone || ""), c.email || "",
    c.address || "", q.package || "", q.brands || "", q.size || "", sec.A || 0, sec.B || 0, sec.C || 0, sec.D || 0, sec.E || 0,
    sec.F || 0, sec.G || 0, t.subtotal || 0, t.discount || 0, t.gst || 0, t.grand || 0, q.estimated || 0, c.notes || "",
    JSON.stringify(q.state || {}).slice(0, 49000)];

  // same quote number saved again -> update that row and replace its lines
  var nos = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var at = nos.indexOf(String(q.quoteNo)), updated = at >= 0;
  if (updated) sh.getRange(at + 2, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);

  if (lines.getLastRow() > 1) {
    var lq = lines.getRange(2, 1, lines.getLastRow() - 1, 1).getValues();
    for (var i = lq.length - 1; i >= 0; i--) if (String(lq[i][0]) === String(q.quoteNo)) lines.deleteRow(i + 2);
  }
  var out = (q.lines || []).map(function (l) {
    return [q.quoteNo, l.section, l.item, l.desc, l.brand, l.sku, l.qty, l.unit, l.rate, l.amount, l.source];
  });
  if (out.length) lines.getRange(lines.getLastRow() + 1, 1, out.length, LINE_HEADERS.length).setValues(out);
  return { ok: true, updated: updated, lines: out.length };
}

function saveRates_(body) {
  var key = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
  if (!key || body.key !== key) throw new Error("Wrong admin key");
  var prices = 0, settingsCount = 0;

  var ps = sheet_("Products"), idCol = col_("Products", "ID"), priceCol = col_("Products", "Price (Rs)"), basisCol = col_("Products", "Price basis");
  var ids = ps.getRange(2, idCol, Math.max(1, ps.getLastRow() - 1), 1).getValues().map(function (r) { return String(r[0]); });
  var stamp = "Rate book " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "d MMM yyyy");
  Object.keys(body.rates || {}).forEach(function (id) {
    var i = ids.indexOf(id), v = Number(body.rates[id]);
    if (i < 0 || isNaN(v)) return;
    ps.getRange(i + 2, priceCol).setValue(v);
    ps.getRange(i + 2, basisCol).setValue(stamp);
    prices++;
  });

  var ss = sheet_("Settings"), srows = rows_("Settings"), vCol = col_("Settings", "Value");
  (body.settings || []).forEach(function (s) {
    var r = srows.filter(function (x) { return String(x["Section"]) === s.section && String(x["Key"]) === s.key; })[0];
    if (r) ss.getRange(r._row, vCol).setValue(s.value);
    else ss.appendRow([s.section, s.key, s.value, "Added from the quotation tool"]);
    settingsCount++;
  });

  var as = sheet_("Add-ons"), arows = rows_("Add-ons"), rCol = col_("Add-ons", "Rate (Rs)");
  Object.keys(body.addonRates || {}).forEach(function (k) {
    var r = arows.filter(function (x) { return String(x["Key"]) === k; })[0];
    if (r) { as.getRange(r._row, rCol).setValue(Number(body.addonRates[k])); settingsCount++; }
  });
  return { ok: true, prices: prices, settings: settingsCount };
}

// ---------- one-time setup ----------
function setup() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("ADMIN_KEY");
  if (!key) {
    key = Utilities.getUuid().slice(0, 8);
    props.setProperty("ADMIN_KEY", key);
  }
  var setupTab = SpreadsheetApp.getActive().getSheetByName("Setup");
  if (setupTab) setupTab.getRange("B3").setValue(key);
  catalog_(); // fills IDs for any new rows and checks the tabs
  SpreadsheetApp.getActive().toast("Admin key: " + key + " (also written on the Setup tab)", "CoreBath", 10);
}
