/*
 * CoreBath quotation builder - UI.
 * Mount: <div id="corebath-quote" data-mode="admin|customer"></div>
 * Needs: cbq-catalog.js, cbq-config.js, cbq-engine.js, cbq-pdf.js (and optional cbq-rates.js).
 */
(function (g) {
  "use strict";
  var CBQ = g.CBQ, E = CBQ.engine;
  var STATE_KEY = "cbq-state-v1", BOOK_KEY = "cbq-ratebook-v1", SHEET_CACHE = "cbq-sheet-cache-v1";

  function esc(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function load(k) { try { var v = g.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(k, v) { try { g.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  function getPath(o, path) { return path.split(".").reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function setPath(o, path, v) {
    var ks = path.split("."), last = ks.pop();
    ks.forEach(function (k) { if (o[k] === undefined || o[k] === null || typeof o[k] !== "object") o[k] = {}; o = o[k]; });
    o[last] = v;
  }
  function rs(n) { return "₹" + E.inr(n); }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "application/octet-stream" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function quoteNo(cfg) {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return (cfg.company.quotePrefix || "CB") + "-" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + "-" + rand5();
  }
  // 5 characters from 31 unambiguous letters/digits: ~28 million per day, so team members never clash
  function rand5() {
    var abc = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ", out = "", buf = new Uint32Array(5);
    try { (g.crypto || {}).getRandomValues(buf); } catch (e) { for (var i = 0; i < 5; i++) buf[i] = Math.floor(Math.random() * 1e9); }
    for (var j = 0; j < 5; j++) out += abc[buf[j] % abc.length];
    return out;
  }

  function App(root) {
    this.root = root;
    this.mode = root.getAttribute("data-mode") === "customer" ? "customer" : "admin";
    this.catalog = CBQ.catalog;
    // Shop-wide overrides published as cbq-rates.js, then this device's own rate book (admin only)
    var shop = g.CBQ_RATES || {};
    this.cfg = E.deepMerge(CBQ.defaults, shop.settings || {});
    if (root.getAttribute("data-ai-endpoint")) this.cfg.aiEndpoint = root.getAttribute("data-ai-endpoint");
    this.shopRates = shop.rateOverrides || {};
    var book = this.mode === "admin" ? (load(BOOK_KEY) || {}) : {};
    var saved = load(STATE_KEY + "-" + this.mode);
    this.state = saved && saved.fixtures ? saved : E.newState(this.catalog, this.cfg, {
      brand: root.getAttribute("data-brand") || "Jaquar", pkg: root.getAttribute("data-package") || "signature",
    });
    this.state.rateOverrides = Object.assign({}, this.shopRates, this.state.rateOverrides || {}, book.rateOverrides || {});
    if (this.mode === "admin" && book.settings) this.state.settings = E.deepMerge(book.settings, this.state.settings || {});
    if (!this.state.quoteNo) this.state.quoteNo = quoteNo(this.cfg);
    this.tab = "build";
    // Google Sheet link: URL from the page (Shopify setting) or, in admin, typed in Rates & settings
    this.baseCfg = this.cfg;
    this.sheet = { url: root.getAttribute("data-sheet-url") || book.sheetUrl || "", key: book.sheetKey || "" };
    this.sheetStatus = { state: this.sheet.url ? "loading" : "off", msg: "" };
    var cached = this.sheet.url ? load(SHEET_CACHE) : null;
    if (cached && cached.url === this.sheet.url && cached.data) this.applySheet(cached.data, true);
    this.bind();
    this.render();
    if (this.sheet.url) this.loadSheet();
  }

  // ---------- Google Sheet ----------
  App.prototype.applySheet = function (data, fromCache) {
    if (data.products && data.products.length) E.loadCatalog(this.catalog, data.products);
    var cfg = E.deepMerge(this.baseCfg, data.settings || {});
    if (data.addons && data.addons.length) cfg.addons = data.addons;
    this.cfg = cfg;
    this.sheetStatus = { state: "ok", msg: (fromCache ? "Saved copy of sheet" : "Live from Google Sheet") + (data.updatedAt ? " \u00B7 " + data.updatedAt : ""), count: (data.products || []).length };
  };

  App.prototype.sheetCall = function (payload) {
    var url = this.sheet.url;
    if (!payload) return fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "action=catalog", { redirect: "follow" }).then(function (r) { return r.json(); });
    // text/plain keeps this a "simple" request, which Apps Script web apps accept cross-origin
    return fetch(url, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); });
  };

  App.prototype.loadSheet = function () {
    var self = this;
    this.sheetStatus = { state: "loading", msg: "Loading Google Sheet\u2026" }; this.render();
    return this.sheetCall().then(function (data) {
      if (!data || data.ok === false) throw new Error((data && data.error) || "No data");
      self.applySheet(data, false);
      save(SHEET_CACHE, { url: self.sheet.url, data: data });
    }).catch(function (err) {
      self.sheetStatus = { state: "err", msg: "Could not reach the Google Sheet (" + err.message + "). Using " + (load(SHEET_CACHE) ? "the last saved copy." : "built-in prices.") };
    }).then(function () { self.render(); });
  };

  App.prototype.quotePayload = function () {
    var st = this.state, q = E.compute(st, this.catalog, this.cfg), lines = [];
    q.sections.forEach(function (sec) {
      sec.lines.forEach(function (l) {
        lines.push({ section: sec.id + ". " + sec.title, item: l.item || "", desc: l.desc, brand: l.brand || "", sku: l.sku || "", qty: l.qty, unit: l.unit || "", rate: l.rate, amount: l.amount, source: l.source || "" });
      });
    });
    return {
      action: "saveQuote",
      quote: {
        quoteNo: st.quoteNo, date: st.date, mode: this.mode, client: st.client,
        size: st.room.length + " x " + st.room.width + " x " + st.room.height + " ft",
        package: E.mixLabel(st, this.catalog), brands: E.brandMix(st, this.catalog).map(function (m) { return m.brand + " x" + m.count; }).join(", "),
        sections: q.sections.map(function (sec) { return { id: sec.id, title: sec.title, total: sec.total }; }),
        totals: q.totals, estimated: q.flags.estimated, lines: lines, state: st,
      },
    };
  };

  App.prototype.saveToSheet = function (silent) {
    var self = this;
    if (!this.sheet.url) return;
    this.sheetBusy = "Saving quote\u2026"; if (!silent) this.render();
    this.sheetCall(this.quotePayload()).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || "not saved");
      self.lastSaved = "Quote " + self.state.quoteNo + (res.updated ? " updated" : " saved") + " in Google Sheet";
    }).catch(function (err) { self.lastSaved = "Not saved to Google Sheet: " + err.message; })
      .then(function () { self.sheetBusy = null; self.render(); });
  };

  App.prototype.pushRates = function () {
    var self = this, st = this.state, S = E.settings(st, this.baseCfg);
    if (!this.sheet.key) { this.lastSaved = "Enter the sheet admin key first."; this.render(); return; }
    var settings = [], over = st.settings || {};
    ["pricing", "services", "siteCharges", "tileAllowance", "fixing", "company"].forEach(function (sec) {
      Object.keys(over[sec] || {}).forEach(function (k) {
        var v = over[sec][k];
        if (typeof v !== "object") settings.push({ section: sec, key: k, value: v });
      });
    });
    var addonRates = {};
    if (over.addons) Object.keys(over.addons).forEach(function (i) { var a = S.addons[i]; if (a) addonRates[a.key] = a.rate; });
    Object.keys(st.addons || {}).forEach(function (k) { if (st.addons[k] && st.addons[k].rate !== undefined && st.addons[k].rate !== "") addonRates[k] = st.addons[k].rate; });
    this.sheetBusy = "Sending rates\u2026"; this.render();
    this.sheetCall({ action: "saveRates", key: this.sheet.key, rates: st.rateOverrides, settings: settings, addonRates: addonRates })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || "not saved");
        self.lastSaved = res.prices + " price(s) and " + res.settings + " setting(s) written to the Google Sheet.";
        st.rateOverrides = {}; st.settings = {};
        Object.keys(st.addons || {}).forEach(function (k) { if (st.addons[k]) delete st.addons[k].rate; });
        self.persist();
        return self.loadSheet();
      })
      .catch(function (err) { self.lastSaved = "Rates not sent: " + err.message; })
      .then(function () { self.sheetBusy = null; self.render(); });
  };

  App.prototype.persist = function () {
    save(STATE_KEY + "-" + this.mode, this.state);
    if (this.mode === "admin") save(BOOK_KEY, { rateOverrides: this.state.rateOverrides, settings: this.state.settings, sheetUrl: this.sheet.url, sheetKey: this.sheet.key });
  };

  App.prototype.bind = function () {
    var self = this;
    this.root.addEventListener("change", function (e) {
      var el = e.target, f = el.getAttribute("data-f");
      if (!f) return;
      var t = el.getAttribute("data-t"), v;
      if (el.type === "checkbox") v = el.hasAttribute("data-invert") ? !el.checked : el.checked;
      else if (t === "num") v = el.value === "" ? "" : parseFloat(el.value);
      else v = el.value;
      if (f.indexOf("sheet.") === 0) {
        var k2 = f.slice(6), changed = self.sheet[k2] !== String(v).trim();
        self.sheet[k2] = String(v).trim();
        self.persist();
        if (k2 === "url" && changed) {
          if (self.sheet.url) self.loadSheet();
          else { self.cfg = self.baseCfg; self.sheetStatus = { state: "off" }; self.render(); }
        }
        return;
      }
      if (f.indexOf("rateOverrides.") === 0) {
        var id = f.slice("rateOverrides.".length);
        if (v === "" || v === null || isNaN(v)) delete self.state.rateOverrides[id];
        else self.state.rateOverrides[id] = v;
      } else if (f.indexOf("concealed.") === 0 && f.slice(-10) === ".productId") {
        setPath(self.state, f, v || undefined);
      } else setPath(self.state, f, v);
      self.persist();
      // plain text fields were already saved on input and do not change any price
      if (t === "str" && el.tagName === "INPUT" && el.type !== "checkbox") return;
      self.scheduleRender();
    });
    // Render after the pointer is released so a click that blurred an edited field still lands.
    this.pointerDown = false;
    this.root.addEventListener("pointerdown", function () { self.pointerDown = true; });
    document.addEventListener("pointerup", function () {
      setTimeout(function () { self.pointerDown = false; if (self.pending) self.render(); }, 0);
    });
    this.root.addEventListener("input", function (e) {
      var el = e.target, f = el.getAttribute("data-f");
      // text fields update silently; numbers re-render on change
      if (f && el.getAttribute("data-t") === "str" && el.type !== "checkbox" && el.tagName !== "SELECT") {
        setPath(self.state, f, el.value); self.persist();
      }
    });
    this.root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act"), arg = b.getAttribute("data-arg");
      e.preventDefault();
      self.action(act, arg, b);
    });
  };

  App.prototype.scheduleRender = function () {
    var self = this;
    this.pending = true;
    if (this.pointerDown) return;
    setTimeout(function () { if (self.pending && !self.pointerDown) self.render(); }, 0);
  };

  // In-page confirmation: first click arms the button, second click within 4s runs it.
  App.prototype.confirmTwice = function (act) {
    var self = this;
    if (this.armed === act) { this.armed = null; return true; }
    this.armed = act;
    clearTimeout(this.armTimer);
    this.armTimer = setTimeout(function () { self.armed = null; self.render(); }, 4000);
    this.render();
    return false;
  };
  App.prototype.label = function (act, normal, confirm) { return this.armed === act ? confirm : normal; };

  // Show the generated PDF inside the page (pdf.js if loaded, else a new tab).
  App.prototype.previewPdf = function () {
    var q = E.compute(this.state, this.catalog, this.cfg);
    var doc = CBQ.pdf.generate(q, this.state, this.catalog, { mode: this.mode, returnDoc: true });
    if (!doc) return;
    if (!g.pdfjsLib) { g.open(doc.output("bloburl"), "_blank"); return; }
    var old = document.getElementById("cbq-pdf-overlay"); if (old) old.remove();
    var ov = document.createElement("div");
    ov.id = "cbq-pdf-overlay"; ov.className = "cbq-overlay";
    ov.innerHTML = '<div class="cbq-overlay-bar"><b>PDF preview</b><span class="cbq-small">' + esc(this.state.quoteNo) + '</span><button class="cbq-btn" data-act="close-preview">Close</button></div><div class="cbq-pages">Rendering\u2026</div>';
    this.root.appendChild(ov);
    var pagesEl = ov.querySelector(".cbq-pages");
    g.pdfjsLib.getDocument({ data: new Uint8Array(doc.output("arraybuffer")) }).promise.then(function (pdf) {
      pagesEl.textContent = "";
      var chain = Promise.resolve();
      for (var i = 1; i <= pdf.numPages; i++) (function (n) {
        chain = chain.then(function () { return pdf.getPage(n); }).then(function (page) {
          var vp = page.getViewport({ scale: 2 });
          var c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height; c.className = "cbq-page";
          pagesEl.appendChild(c);
          return page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        });
      })(i);
      return chain;
    }).catch(function (err) { pagesEl.textContent = "Could not render the preview: " + err.message; });
  };

  App.prototype.action = function (act, arg) {
    var st = this.state, self = this;
    if (act === "tab") { this.tab = arg; }
    else if (act === "load-pkg") {
      var bp = arg.split("|");
      E.applyPackage(st, this.catalog, bp[0], bp[1]);
    } else if (act === "fx-brand") {
      var kb = arg.split("|"), curP = st.fixtures[kb[0]] && E.index(this.catalog).byId[st.fixtures[kb[0]].productId];
      var np = E.pick(this.catalog, kb[0], kb[1], curP ? curP.pkg : st.basePkg);
      if (np) { st.fixtures[kb[0]] = Object.assign({}, st.fixtures[kb[0]], { productId: np.id, on: true }); }
    } else if (act === "all-brand") {
      var cat = this.catalog;
      Object.keys(st.fixtures).forEach(function (k) {
        var cp = E.index(cat).byId[st.fixtures[k].productId];
        var np2 = E.pick(cat, k, arg, cp ? cp.pkg : st.basePkg);
        if (np2 && np2.brand === arg) st.fixtures[k].productId = np2.id;
      });
    } else if (act === "toggle-addon") {
      st.addons[arg] = st.addons[arg] || {};
      st.addons[arg].on = !st.addons[arg].on;
    } else if (act === "add-custom") {
      st.customItems.push({ desc: "", qty: 1, unit: "nos", rate: "", kind: "service" });
    } else if (act === "del-custom") {
      st.customItems.splice(+arg, 1);
    } else if (act === "toggle-rec-pdf") {
      st.pdf = st.pdf || {}; st.pdf.hiddenRecs = st.pdf.hiddenRecs || {};
      st.pdf.hiddenRecs[arg] = !st.pdf.hiddenRecs[arg];
    } else if (act === "reset-line") {
      var lo = (st.lineOverrides || {})[arg];
      if (lo) { delete lo.qty; delete lo.rate; delete lo.desc; }
    } else if (act === "reset-concealed") {
      delete st.concealed[arg];
    } else if (act === "pdf") {
      var q = E.compute(st, this.catalog, this.cfg);
      CBQ.pdf.generate(q, st, this.catalog, { mode: this.mode });
      if (this.sheet.url) this.saveToSheet(true);
      return;
    } else if (act === "sheet-save") {
      this.saveToSheet(); return;
    } else if (act === "sheet-reload") {
      this.loadSheet(); return;
    } else if (act === "sheet-push") {
      this.pushRates(); return;
    } else if (act === "pdf-preview") {
      this.previewPdf(); return;
    } else if (act === "close-preview") {
      var ov = document.getElementById("cbq-pdf-overlay"); if (ov) ov.remove(); return;
    } else if (act === "new-quote") {
      if (!this.confirmTwice(act)) return;
      var keep = { rateOverrides: st.rateOverrides, settings: st.settings };
      this.state = E.newState(this.catalog, this.cfg, { brand: st.baseBrand, pkg: st.basePkg });
      Object.assign(this.state, keep);
      this.state.quoteNo = quoteNo(this.cfg);
    } else if (act === "export-rates") {
      var data = { rateOverrides: st.rateOverrides, settings: st.settings };
      download("cbq-rates.js",
        "/* CoreBath shop rates - upload to your Shopify theme assets (replaces cbq-rates.js). */\nwindow.CBQ_RATES = " + JSON.stringify(data, null, 1) + ";\n",
        "text/javascript");
      return;
    } else if (act === "export-json") {
      download("corebath-quote-" + st.quoteNo + ".json", JSON.stringify(st, null, 1), "application/json");
      return;
    } else if (act === "import") {
      var inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".js,.json";
      inp.onchange = function () {
        var f = inp.files[0]; if (!f) return;
        f.text().then(function (txt) {
          var json = txt.replace(/^[\s\S]*?=\s*/, function (m) { return /window\.CBQ_RATES/.test(m) ? "" : m; }).replace(/;\s*$/, "");
          var obj = JSON.parse(json);
          if (obj.fixtures) self.state = obj; // a saved quote
          else {
            self.state.rateOverrides = Object.assign({}, self.state.rateOverrides, obj.rateOverrides || {});
            self.state.settings = E.deepMerge(self.state.settings || {}, obj.settings || {});
          }
          self.persist(); self.render();
        }).catch(function (err) { g.alert("Could not read that file: " + err.message); });
      };
      inp.click();
      return;
    } else if (act === "reset-settings") {
      if (!this.confirmTwice(act)) return;
      st.settings = {};
    } else if (act === "ai") {
      this.runAI(); return;
    } else if (act === "send") {
      this.sendToStore(); return;
    }
    this.persist();
    this.render();
  };

  // ---------- optional Claude advisor ----------
  App.prototype.runAI = function () {
    var self = this, st = this.state;
    var q = E.compute(st, this.catalog, this.cfg);
    var payload = {
      bathroom: { size_ft: [st.room.length, st.room.width, st.room.height], areas: q.areas, demolition: st.room.demolition },
      context: st.context, base_package: E.mixLabel(st, this.catalog),
      sections: q.sections.map(function (s) {
        return { title: s.title, total: s.total, lines: s.lines.map(function (l) { return { item: l.item || "", desc: l.desc, brand: l.brand || "", qty: l.qty, amount: l.amount }; }) };
      }),
      warnings: q.warnings, grand_total: q.totals.grand,
      addon_catalog: q.settings.addons.map(function (a) { return a.key + ": " + a.name; }),
    };
    this.aiBusy = true; this.render();
    fetch(this.cfg.aiEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (res) { st.aiNotes = res; })
      .catch(function (err) { st.aiNotes = { error: "AI advisor unavailable (" + err.message + "). Built-in recommendations are still applied." }; })
      .then(function () { self.aiBusy = false; self.persist(); self.render(); });
  };

  // ---------- Shopify: send the quote through the store's contact form ----------
  App.prototype.sendToStore = function () {
    var form = document.getElementById("cbq-contact-form");
    var st = this.state, c = st.client;
    if (!form) return;
    if (!c.name || !c.email || !c.phone) { g.alert("Please fill in your name, email and phone first."); this.tab = "build"; this.render(); return; }
    var q = E.compute(st, this.catalog, this.cfg);
    var lines = ["CoreBath quote " + st.quoteNo, "Package: " + E.mixLabel(st, this.catalog),
      "Size: " + st.room.length + " x " + st.room.width + " ft", "Site: " + (c.address || "-"), ""];
    q.sections.forEach(function (s) {
      if (!s.lines.length) return;
      lines.push(s.id + ". " + s.title + " - Rs " + E.inr(s.total));
      s.lines.forEach(function (l) { lines.push("  - " + l.qty + " " + (l.unit || "") + " " + l.desc + (l.brand ? " [" + l.brand + "]" : "") + " = Rs " + E.inr(l.amount)); });
    });
    lines.push("", "Grand total incl. GST: Rs " + E.inr(q.totals.grand), "Notes: " + (c.notes || "-"));
    form.querySelector("[name='contact[name]']").value = c.name;
    form.querySelector("[name='contact[email]']").value = c.email;
    form.querySelector("[name='contact[phone]']").value = c.phone;
    form.querySelector("[name='contact[body]']").value = lines.join("\n");
    if (this.sheet.url) this.saveToSheet(true);
    form.submit();
  };

  // ---------- render ----------
  App.prototype.render = function () {
    this.pending = false;
    var act = document.activeElement, focusKey = act && this.root.contains(act) ? act.getAttribute("data-f") : null;
    var st = this.state, q = E.compute(st, this.catalog, this.cfg);
    this.quote = q;
    var admin = this.mode === "admin";
    var tabs = [["build", "1. Bathroom"], ["fixtures", "2. Fixtures"], ["addons", "3. Add-ons & extras"]];
    if (admin) tabs.splice(2, 0, ["works", "Works & charges"]);
    if (admin) tabs.push(["rates", "Rates & settings"]);
    var html = '<div class="cbq">' +
      '<header class="cbq-head"><div><div class="cbq-logo">Core<b>Bath</b></div><div class="cbq-sub">Custom bathroom package quotation</div></div>' +
      '<div class="cbq-qno">Quote <b>' + esc(st.quoteNo) + '</b>' + (admin ? ' <span class="cbq-badge">Admin</span>' : "") + '</div></header>' +
      '<nav class="cbq-tabs">' + tabs.map(function (t) { return '<button data-act="tab" data-arg="' + t[0] + '" class="' + (this.tab === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }, this).join("") + "</nav>" +
      '<div class="cbq-body"><main class="cbq-main">' + this["tab_" + this.tab](q) + "</main>" + this.summary(q) + "</div></div>";
    this.root.innerHTML = html;
    if (focusKey) {
      var el = this.root.querySelector('[data-f="' + focusKey.replace(/"/g, '\\"') + '"]');
      if (el) try { el.focus(); } catch (e) { /* ignore */ }
    }
  };

  function field(label, f, val, opts) {
    opts = opts || {};
    var t = opts.type || "text", dt = opts.dt || (t === "number" ? "num" : "str");
    return '<label class="cbq-field' + (opts.wide ? " wide" : "") + '"><span>' + label + "</span>" +
      '<input type="' + t + '" data-f="' + f + '" data-t="' + dt + '" value="' + esc(val) + '"' +
      (opts.step ? ' step="' + opts.step + '"' : "") + (opts.min !== undefined ? ' min="' + opts.min + '"' : "") +
      (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : "") + "></label>";
  }
  function area(label, f, val, rows) {
    return '<label class="cbq-field wide"><span>' + label + '</span><textarea rows="' + (rows || 4) + '" data-f="' + f + '" data-t="str">' + esc(val) + "</textarea></label>";
  }
  function check(label, f, val) {
    return '<label class="cbq-check"><input type="checkbox" data-f="' + f + '"' + (val ? " checked" : "") + "> " + label + "</label>";
  }
  function select(label, f, val, options) {
    return '<label class="cbq-field"><span>' + label + '</span><select data-f="' + f + '" data-t="str">' +
      options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(val) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") +
      "</select></label>";
  }

  App.prototype.tab_build = function (q) {
    var st = this.state, c = st.client, r = st.room, x = st.context, self = this;
    var idx = E.index(this.catalog);
    var pkgGrid = '<div class="cbq-pkgs"><div class="cbq-pkgrow head"><span></span>' + E.PKGS.map(function (p) { return "<span>" + E.PKG_LABEL[p] + "</span>"; }).join("") + "</div>" +
      idx.brands.map(function (b) {
        return '<div class="cbq-pkgrow"><span class="cbq-brand">' + esc(b) + "</span>" + E.PKGS.map(function (p) {
          var on = st.baseBrand === b && st.basePkg === p;
          return '<button class="cbq-pkg' + (on ? " on" : "") + '" data-act="load-pkg" data-arg="' + esc(b) + "|" + p + '">' + (on ? "Selected" : "Start here") + "</button>";
        }).join("") + "</div>";
      }).join("") + "</div>";
    return '<section class="cbq-card"><h3>Client</h3><div class="cbq-grid">' +
      field("Name", "client.name", c.name) + field("Phone", "client.phone", c.phone, { type: "tel" }) +
      field("Email", "client.email", c.email, { type: "email" }) + field("Site address", "client.address", c.address, { wide: true }) +
      "</div></section>" +
      '<section class="cbq-card"><h3>Bathroom size</h3><div class="cbq-grid">' +
      field("Length (ft)", "room.length", r.length, { type: "number", step: "0.25", min: 0 }) +
      field("Width (ft)", "room.width", r.width, { type: "number", step: "0.25", min: 0 }) +
      field("Ceiling height (ft)", "room.height", r.height, { type: "number", step: "0.25", min: 0 }) +
      field("Wall tiles up to (ft)", "room.tileHeight", r.tileHeight, { type: "number", step: "0.5", min: 0 }) +
      '</div><div class="cbq-areas">Floor <b>' + q.areas.floor + "</b> sqft · Wall tiles <b>" + q.areas.wall + "</b> sqft · Waterproofing <b>" + q.areas.waterproof + "</b> sqft</div>" +
      '<div class="cbq-checks">' + check("Existing bathroom: include demolition", "room.demolition", r.demolition) +
      check("CoreBath supplies the tiles", "room.tilesByUs", r.tilesByUs) + "</div></section>" +
      '<section class="cbq-card"><h3>About the space</h3><div class="cbq-grid">' +
      select("Hot water today", "context.hotWater", x.hotWater, [["none", "No geyser"], ["existing", "Geyser stays / reused"], ["solar", "Solar / central hot water"]]) +
      select("Ventilation", "context.ventilation", x.ventilation, [["window", "Has a window"], ["none", "No window"]]) +
      '</div><div class="cbq-checks">' + check("Elderly users", "context.seniors", x.seniors) + check("Young children", "context.kids", x.kids) +
      check("Hard water in the area", "context.hardWater", x.hardWater) + "</div></section>" +
      '<section class="cbq-card"><h3>Start from a package</h3><p class="cbq-hint">Pick a brand and tier to load its fixtures. You can then swap any single item on the next tab to make a custom package.</p>' +
      pkgGrid + '<div class="cbq-next"><button class="cbq-btn" data-act="tab" data-arg="fixtures">Next: fixtures →</button></div></section>';
  };

  App.prototype.rateCell = function (line, admin) {
    var tag = line.source === "estimate" ? '<span class="cbq-tag est" title="Estimated from similar products">EST</span>' :
      line.source === "missing" ? '<span class="cbq-tag miss">No rate</span>' :
      line.source === "rate-book" ? '<span class="cbq-tag book" title="From your rate book">Your rate</span>' :
      line.source === "included" ? '<span class="cbq-tag inc">Included</span>' : "";
    if (admin && line.productId && line.source !== "included") {
      var ov = this.state.rateOverrides[line.productId];
      var p = E.index(this.catalog).byId[line.productId];
      var ph = p.price != null ? String(p.price) : (line.source === "estimate" ? "est. " + Math.round(line.rate) : "enter rate");
      return '<input class="cbq-rate' + (line.source === "missing" || line.source === "estimate" ? " need" : "") + '" type="number" min="0" data-t="num" data-f="rateOverrides.' + esc(line.productId) + '" value="' + (ov === undefined ? "" : esc(ov)) + '" placeholder="' + esc(ph) + '" title="Dealer / cost rate per unit, before markup">' + tag;
    }
    return rs(line.rate) + " " + tag;
  };

  App.prototype.tab_fixtures = function (q) {
    var st = this.state, self = this, admin = this.mode === "admin", idx = E.index(this.catalog);
    var lineByKey = {};
    q.sections[0].lines.forEach(function (l) { lineByKey[l.key] = l; });
    var rows = this.catalog.items.filter(function (it) { return it.role === "fixture"; }).map(function (it) {
      var sel = st.fixtures[it.key] || { on: false };
      var opts = (idx.byKey[it.key] || []).slice().sort(function (a, b) {
        return a.brand === b.brand ? E.PKGS.indexOf(a.pkg) - E.PKGS.indexOf(b.pkg) : a.brand < b.brand ? -1 : 1;
      });
      var cur = sel.productId ? idx.byId[sel.productId] : null;
      var curBrand = cur ? cur.brand : st.baseBrand;
      var brandsFor = [];
      opts.forEach(function (p) { if (brandsFor.indexOf(p.brand) < 0) brandsFor.push(p.brand); });
      var chips = '<div class="cbq-chips" role="group" aria-label="Brand for ' + esc(it.label) + '">' + brandsFor.map(function (b) {
        return '<button type="button" class="cbq-chip' + (b === curBrand ? " on" : "") + '" data-act="fx-brand" data-arg="' + it.key + "|" + esc(b) + '"' + (b === curBrand ? ' aria-pressed="true"' : ' aria-pressed="false"') + ">" + esc(b) + "</button>";
      }).join("") + "</div>";
      var selectHtml = chips + '<select data-f="fixtures.' + it.key + '.productId" data-t="str" aria-label="' + esc(it.label) + ' model">' +
        opts.filter(function (p) { return p.brand === curBrand; }).map(function (p) {
          var pr = E.priceOf(p, st, self.catalog);
          var price = pr.source === "included" ? "included" : pr.rate ? "\u20B9" + E.inr(pr.rate) + (pr.source === "estimate" ? " est." : "") : "on request";
          return '<option value="' + p.id + '"' + (sel.productId === p.id ? " selected" : "") + ">" + esc((E.PKG_LABEL[p.pkg] || p.pkg).replace("Core ", "") + " \u00B7 " + p.name + " \u00B7 " + price) + "</option>";
        }).join("") + "</select>";
      var l = lineByKey[it.key];
      var p = sel.productId ? idx.byId[sel.productId] : null;
      return '<tr class="' + (sel.on ? "" : "off") + '"><td>' + check("", "fixtures." + it.key + ".on", sel.on) + "</td>" +
        '<td><div class="cbq-item">' + esc(it.label) + "</div>" + selectHtml +
        (p ? '<div class="cbq-meta">' + esc(p.brand) + (p.sku ? " · " + esc(p.sku) : "") + (p.notes ? ' · <i>' + esc(p.notes) + "</i>" : "") + "</div>" : "") + "</td>" +
        '<td><input class="cbq-qty" type="number" min="0" data-t="num" data-f="fixtures.' + it.key + '.qty" value="' + esc(sel.qty) + '"></td>' +
        '<td class="r">' + (l ? self.rateCell(l, admin) : "") + "</td><td class=\"r b\">" + (l ? rs(l.amount) : "–") + "</td></tr>";
    }).join("");

    var matched = E.matchConcealed(st, this.catalog);
    var lineById = {};
    q.sections[1].lines.forEach(function (l) { lineById[l.productId] = l; });
    var crow = matched.map(function (m) {
      var ov = st.concealed[m.key] || {};
      var l = lineById[m.product.id];
      var alts = (idx.byKey[m.key] || []).map(function (p) {
        return '<option value="' + p.id + '"' + (ov.productId === p.id ? " selected" : "") + ">" + esc(p.brand + " · " + E.PKG_LABEL[p.pkg].replace("Core ", "") + " · " + p.name) + "</option>";
      }).join("");
      return '<tr class="' + (m.excluded ? "off" : "") + '"><td>' + '<label class="cbq-check" title="Untick if the client already has this part"><input type="checkbox" data-f="concealed.' + m.key + '.excluded"' + (m.excluded ? "" : " checked") + ' data-invert="1"></label></td>' +
        '<td><div class="cbq-item">' + esc(idx.itemByKey[m.key].label) + (m.overridden ? ' <a href="#" class="cbq-link" data-act="reset-concealed" data-arg="' + m.key + '">auto-match</a>' : ' <span class="cbq-tag auto">Auto-matched</span>') + "</div>" +
        '<select data-f="concealed.' + m.key + '.productId" data-t="str"><option value="">Auto: ' + esc(m.product.brand + " · " + m.product.name) + "</option>" + alts + "</select>" +
        '<div class="cbq-meta">' + esc(m.reasons.join(" · ")) + (m.product.notes ? ' · <i>' + esc(m.product.notes) + "</i>" : "") + "</div></td>" +
        '<td><input class="cbq-qty" type="number" min="0" data-t="num" data-f="concealed.' + m.key + '.qty" value="' + esc(ov.qty !== undefined && ov.qty !== "" ? ov.qty : m.qty) + '"></td>' +
        '<td class="r">' + (l ? self.rateCell(l, admin) : "") + '</td><td class="r b">' + (l ? rs(l.amount) : "–") + "</td></tr>";
    }).join("");

    var mix = E.brandMix(st, this.catalog);
    var mixHtml = '<div class="cbq-mix"><span>' + (mix.length > 1 ? "Your mix:" : "All fixtures:") + "</span> " + mix.map(function (m) {
      return '<span class="cbq-mixpill">' + esc(m.brand) + " \u00D7 " + m.count + "</span>";
    }).join("") + "</div>" +
      '<div class="cbq-allbrand"><span class="cbq-small">Set every fixture to one brand (keeps the tier):</span><div class="cbq-chips">' +
      idx.brands.map(function (b) { return '<button type="button" class="cbq-chip" data-act="all-brand" data-arg="' + esc(b) + '">' + esc(b) + "</button>"; }).join("") + "</div></div>";
    return '<section class="cbq-card"><h3>Fixtures <small>mix and match brands: pick a brand for each item, then the model</small></h3>' + mixHtml +
      '<table class="cbq-table cbq-ftable"><thead><tr><th></th><th>Item</th><th>Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>' + rows + "</tbody></table></section>" +
      '<section class="cbq-card"><h3>Concealed &amp; connection parts <small>matched to the fixtures above</small></h3>' +
      '<p class="cbq-hint">Each in-wall part follows the brand and series of the fixture it connects to, so bodies, trims and finishes fit. Change one only if you know it is compatible.</p>' +
      '<table class="cbq-table cbq-ftable"><thead><tr><th></th><th>Part</th><th>Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>' + crow + "</tbody></table>" +
      '<div class="cbq-next"><button class="cbq-btn" data-act="tab" data-arg="addons">Next: add-ons →</button></div></section>';
  };

  App.prototype.tab_addons = function (q) {
    var st = this.state, admin = this.mode === "admin";
    var order = { essential: 0, recommended: 1, optional: 2 };
    var recs = q.recommendations.slice().sort(function (a, b) { return order[a.priority] - order[b.priority]; });
    var seen = {};
    var addonLine = {};
    q.sections[4].lines.forEach(function (l) { addonLine[l.key] = l; });
    function card(addon, priority, reason) {
      seen[addon.key] = 1;
      var sel = st.addons[addon.key] || {}, on = !!sel.on, l = addonLine[addon.key];
      var unit = addon.unit === "each" ? "each" : addon.unit === "per_drain" ? "per drain" : "per sqft";
      var pdfHidden = !!((st.pdf || {}).hiddenRecs || {})[addon.key];
      var pdfLink = admin && priority && priority !== "optional" && !on ?
        '<a href="#" class="cbq-link" data-act="toggle-rec-pdf" data-arg="' + addon.key + '">' + (pdfHidden ? "Not in PDF \u2014 show it" : "Leave out of PDF") + "</a>" : "";
      return '<div class="cbq-addon' + (on ? " on" : "") + (pdfHidden ? " cbq-dim" : "") + '">' +
        '<div class="cbq-addon-top">' + (priority ? '<span class="cbq-pri ' + priority + '">' + priority + "</span>" : "") +
        '<button class="cbq-btn ' + (on ? "ghost" : "") + '" data-act="toggle-addon" data-arg="' + addon.key + '">' + (on ? "Remove" : "Add") + "</button></div>" +
        '<div class="cbq-addon-name">' + esc(addon.name) + "</div>" + (reason ? '<div class="cbq-meta">' + esc(reason) + "</div>" : "") +
        '<div class="cbq-addon-price">' + (admin ?
          '<input class="cbq-rate" type="number" min="0" data-t="num" data-f="addons.' + addon.key + '.rate" value="' + esc(sel.rate !== undefined ? sel.rate : "") + '" placeholder="' + addon.rate + '"> ' : rs(addon.rate) + " ") + unit +
        (addon.unit === "each" && on ? ' × <input class="cbq-qty" type="number" min="1" data-t="num" data-f="addons.' + addon.key + '.qty" value="' + esc(sel.qty || 1) + '">' : "") +
        (l ? ' = <b>' + rs(l.amount) + "</b>" : "") + "</div>" + pdfLink + "</div>";
    }
    var showRecs = (st.pdf || {}).showRecs !== false;
    var html = '<section class="cbq-card"><h3>Recommended for this bathroom</h3>' +
      (admin ? '<p class="cbq-hint">Add one to put it in the quote. Recommendations you don\u2019t add are listed in the PDF under \u201CRecommended for your bathroom (not included above)\u201D.</p><div class="cbq-checks" style="margin:0 0 12px">' +
        check("Show that list in the PDF", "pdf.showRecs", showRecs) + "</div>" : "") +
      '<div class="cbq-addons">' +
      recs.map(function (r) { return card(r.addon, r.priority, r.reason); }).join("") + "</div>";
    var rest = q.settings.addons.filter(function (a) { return !seen[a.key]; });
    if (rest.length) html += '<h4>More add-ons</h4><div class="cbq-addons">' + rest.map(function (a) { return card(a, "", ""); }).join("") + "</div>";
    html += "</section>";
    if (st.aiNotes) html += this.aiBlock(st.aiNotes);
    if (admin) {
      html += '<section class="cbq-card"><h3>Additional items &amp; services</h3><p class="cbq-hint">Anything not in the catalogue: a product without a rate, extra civil work, electrical, carpentry, a special service charge.</p>' +
        '<div class="cbq-xscroll"><table class="cbq-table"><thead><tr><th>Description</th><th>Type</th><th>Qty</th><th>Unit</th><th class="r">Rate</th><th class="r">Amount</th><th></th></tr></thead><tbody>' +
        st.customItems.map(function (c, i) {
          var amt = (parseFloat(c.qty) || 0) * (parseFloat(c.rate) || 0);
          return "<tr><td>" + '<input data-f="customItems.' + i + '.desc" data-t="str" value="' + esc(c.desc) + '" placeholder="e.g. Shift WC outlet by 2 ft">' + "</td>" +
            '<td><select data-f="customItems.' + i + '.kind" data-t="str"><option value="service"' + (c.kind !== "product" ? " selected" : "") + '>Service</option><option value="product"' + (c.kind === "product" ? " selected" : "") + ">Product</option></select></td>" +
            '<td><input class="cbq-qty" type="number" min="0" step="any" data-t="num" data-f="customItems.' + i + '.qty" value="' + esc(c.qty) + '"></td>' +
            '<td><input class="cbq-unit" data-t="str" data-f="customItems.' + i + '.unit" value="' + esc(c.unit) + '"></td>' +
            '<td class="r"><input class="cbq-rate' + (c.rate === "" ? " need" : "") + '" type="number" min="0" data-t="num" data-f="customItems.' + i + '.rate" value="' + esc(c.rate) + '"></td>' +
            '<td class="r b">' + rs(amt) + '</td><td><button class="cbq-x" data-act="del-custom" data-arg="' + i + '" title="Remove">×</button></td></tr>';
        }).join("") + "</tbody></table></div>" + '<button class="cbq-btn ghost" data-act="add-custom">+ Add item or service</button></section>' +
        '<section class="cbq-card"><h3>Discount &amp; notes</h3><div class="cbq-grid">' +
        select("Discount type", "discount.type", st.discount.type, [["pct", "Percent"], ["amt", "Amount (₹)"]]) +
        field("Discount", "discount.value", st.discount.value, { type: "number", min: 0 }) +
        field("Note on the quote", "client.notes", st.client.notes, { wide: true }) + "</div></section>";
    } else {
      html += '<section class="cbq-card"><h3>Anything else?</h3><div class="cbq-grid">' + field("Notes for our team", "client.notes", st.client.notes, { wide: true, ph: "e.g. move the WC, add a window, timeline" }) + "</div></section>";
    }
    return html;
  };

  // Edit any civil / plumbing / site-charge line for this quote: description, qty, rate, or remove it.
  App.prototype.tab_works = function (q) {
    var st = this.state, removed = q.removedLines || [];
    var groups = [["C", "Civil work: demolition, waterproofing, tiling", "Areas come from the room size on tab 1. Default rates: Rates & settings \u2192 Civil & plumbing rates."],
      ["D", "Plumbing & fixing", "Points and fixing count come from the selected fixtures. Default rates: Rates & settings."],
      ["G", "Site & project charges", "Percent lines (consumables, project management) recalculate unless you type a rate."]];
    var sec = {}; q.sections.forEach(function (x) { sec[x.id] = x; });
    function row(l) {
      var o = (st.lineOverrides || {})[l.key] || {}, off = !!o.off, f = "lineOverrides." + l.key + ".";
      return '<tr class="' + (off ? "off" : "") + '"><td><label class="cbq-check" title="Untick to leave this line out of the quote"><input type="checkbox" data-f="' + f + 'off" data-invert="1"' + (off ? "" : " checked") + "></label></td>" +
        '<td><input data-t="str" data-f="' + f + 'desc" value="' + esc(o.desc || "") + '" placeholder="' + esc(l.auto.desc) + '" aria-label="Description">' +
        (l.edited ? ' <a href="#" class="cbq-link" data-act="reset-line" data-arg="' + esc(l.key) + '">undo my changes</a>' : "") + "</td>" +
        '<td><input class="cbq-qty" type="number" min="0" step="any" data-t="num" data-f="' + f + 'qty" value="' + esc(o.qty === undefined ? "" : o.qty) + '" placeholder="' + l.auto.qty + '" aria-label="Quantity"> <span class="cbq-small">' + esc(l.unit) + "</span></td>" +
        '<td class="r"><input class="cbq-rate" type="number" min="0" step="any" data-t="num" data-f="' + f + 'rate" value="' + esc(o.rate === undefined ? "" : o.rate) + '" placeholder="' + Math.round(l.auto.rate * 100) / 100 + '" aria-label="Rate"></td>' +
        '<td class="r b">' + (off ? "removed" : rs(l.amount)) + "</td></tr>";
    }
    return '<section class="cbq-card"><h3>Works &amp; charges</h3><p class="cbq-hint">Change any line for this quote only. Leave a box empty to use the calculated value (shown in grey). Untick a line to remove it. To change a rate for every future quote, use Rates &amp; settings instead.</p></section>' +
      groups.map(function (g) {
        var lines = sec[g[0]].lines.concat(removed.filter(function (l) { return l.section === g[0]; }));
        return '<section class="cbq-card"><h3>' + g[0] + ". " + g[1] + ' <small>' + rs(sec[g[0]].total) + '</small></h3><p class="cbq-hint">' + g[2] + "</p>" +
          '<table class="cbq-table cbq-ftable cbq-works"><thead><tr><th></th><th>Description</th><th>Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>' +
          lines.map(row).join("") + "</tbody></table></section>";
      }).join("") +
      '<section class="cbq-card"><h3>Need another line?</h3><p class="cbq-hint">Add any extra item or service charge under <a href="#" class="cbq-link" data-act="tab" data-arg="addons">Add-ons &amp; extras \u2192 Additional items &amp; services</a>.</p></section>';
  };

  App.prototype.aiBlock = function (n) {
    if (n.error) return '<section class="cbq-card cbq-ai"><h3>AI design advisor</h3><p class="cbq-hint">' + esc(n.error) + "</p></section>";
    return '<section class="cbq-card cbq-ai"><h3>AI design advisor</h3>' + (n.summary ? "<p>" + esc(n.summary) + "</p>" : "") +
      (n.recommendations && n.recommendations.length ? "<ul>" + n.recommendations.map(function (r) { return "<li><b>" + esc(r.title) + "</b> — " + esc(r.reason) + "</li>"; }).join("") + "</ul>" : "") +
      (n.checks && n.checks.length ? '<h4>Checks</h4><ul>' + n.checks.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>" : "") + "</section>";
  };

  App.prototype.tab_rates = function (q) {
    var st = this.state, S = q.settings, self = this;
    var sv = S.services, sc = S.siteCharges, pr = S.pricing;
    function num(label, path, val, step) { return field(label, "settings." + path, val, { type: "number", min: 0, step: step || "any" }); }
    var missing = E.unpriced(this.catalog, st);
    var est = function (p) { var r = E.priceOf(p, st, self.catalog); return r.source === "estimate" ? "est. " + r.rate : "enter rate"; };
    var missingRows = missing.map(function (p) {
      return "<tr><td>" + esc(p.brand) + "</td><td>" + esc(E.PKG_LABEL[p.pkg].replace("Core ", "")) + "</td><td>" + esc(E.index(self.catalog).itemByKey[p.key].label) + '<div class="cbq-meta">' + esc(p.name) + (p.sku ? " · " + esc(p.sku) : "") + "</div></td>" +
        '<td class="r"><input class="cbq-rate need" type="number" min="0" data-t="num" data-f="rateOverrides.' + esc(p.id) + '" placeholder="' + esc(est(p)) + '"></td></tr>';
    }).join("");
    var entered = Object.keys(st.rateOverrides).length;
    var ss = this.sheetStatus;
    var sheetCard = '<section class="cbq-card"><h3>Google Sheet</h3>' +
      '<p class="cbq-hint">Keep products, prices, add-ons and rates in your Google Sheet, and log every saved quote there. Paste the web app URL from the sheet\u2019s Setup tab.</p>' +
      '<div class="cbq-grid">' + field("Web app URL", "sheet.url", this.sheet.url, { wide: true, ph: "https://script.google.com/macros/s/\u2026/exec" }) +
      field("Admin key (to send rates)", "sheet.key", this.sheet.key, { type: "password" }) + "</div>" +
      '<div class="cbq-sheet" style="margin-top:10px"><span class="cbq-dot ' + (ss.state === "ok" ? "ok" : ss.state === "err" ? "err" : "") + '"></span>' +
      esc(ss.state === "off" ? "Not connected. Using the built-in catalogue." : ss.msg + (ss.count ? " \u00B7 " + ss.count + " products" : "")) + "</div>" +
      (this.sheet.url ? '<div class="cbq-row"><button class="cbq-btn ghost" data-act="sheet-reload">Reload from sheet</button>' +
        '<button class="cbq-btn" data-act="sheet-push"' + (this.sheetBusy ? " disabled" : "") + ">Send my rates &amp; settings to sheet</button></div>" : "") +
      (this.lastSaved ? '<p class="cbq-small">' + esc(this.lastSaved) + "</p>" : "") + "</section>";
    return sheetCard + '<section class="cbq-card"><h3>Rate book</h3>' +
      '<p class="cbq-hint">' + missing.length + " catalogue items have no price (“Get dealer quote”). Until you enter a rate, the quote uses an estimate from the same item in other brands and marks it EST. You have entered " + entered + " rate(s).</p>" +
      '<div class="cbq-row"><button class="cbq-btn" data-act="export-rates">Download cbq-rates.js (for Shopify)</button><button class="cbq-btn ghost" data-act="import">Import rates / quote</button><button class="cbq-btn ghost" data-act="export-json">Save this quote (.json)</button></div>' +
      '<div class="cbq-scroll"><table class="cbq-table"><thead><tr><th>Brand</th><th>Tier</th><th>Item</th><th class="r">Rate ₹</th></tr></thead><tbody>' + missingRows + "</tbody></table></div></section>" +
      '<section class="cbq-card"><h3>Pricing</h3><div class="cbq-grid">' +
      num("Markup on product prices %", "pricing.productMarkupPct", pr.productMarkupPct) + num("GST %", "pricing.gstPct", pr.gstPct) + num("Round total to nearest ₹", "pricing.roundTo", pr.roundTo) +
      "</div><h4>Tile allowance (₹/sqft, supply)</h4><div class=\"cbq-grid\">" +
      E.PKGS.map(function (p) { return num(E.PKG_LABEL[p], "tileAllowance." + p, S.tileAllowance[p]); }).join("") + "</div></section>" +
      '<section class="cbq-card"><h3>Civil &amp; plumbing rates</h3><div class="cbq-grid">' +
      num("Demolition ₹/sqft", "services.demolitionPerSqft", sv.demolitionPerSqft) + num("Dismantle sanitaryware (lump)", "services.sanitaryDismantleLump", sv.sanitaryDismantleLump) +
      num("Debris disposal (lump)", "services.debrisDisposalLump", sv.debrisDisposalLump) + num("Waterproofing ₹/sqft", "services.waterproofPerSqft", sv.waterproofPerSqft) +
      num("Waterproof up walls (ft)", "services.waterproofUpturnFt", sv.waterproofUpturnFt) + num("Shower wall waterproofing (sqft)", "services.showerWallWpSqft", sv.showerWallWpSqft) +
      num("Floor screed ₹/sqft", "services.screedPerSqft", sv.screedPerSqft) + num("Floor tile laying ₹/sqft", "services.floorTileLayPerSqft", sv.floorTileLayPerSqft) +
      num("Wall tile laying ₹/sqft", "services.wallTileLayPerSqft", sv.wallTileLayPerSqft) + num("Adhesive + grout ₹/sqft", "services.adhesiveGroutPerSqft", sv.adhesiveGroutPerSqft) +
      num("Tile wastage %", "services.tileWastagePct", sv.tileWastagePct) + num("Door deduction (sqft)", "services.doorDeductionSqft", sv.doorDeductionSqft) +
      num("Water point ₹ each", "services.waterPointRate", sv.waterPointRate) + num("Drain point ₹ each", "services.drainPointRate", sv.drainPointRate) +
      field("Water points (blank = auto " + q.waterPoints + ")", "room.waterPoints", st.room.waterPoints, { type: "number", min: 0 }) +
      field("Drain points (blank = auto " + q.drainPoints + ")", "room.drainPoints", st.room.drainPoints, { type: "number", min: 0 }) +
      "</div><h4>Fixing labour per unit</h4><div class=\"cbq-grid\">" +
      this.catalog.items.map(function (it) { return num(it.label, "fixing." + it.key, S.fixing[it.key]); }).join("") + "</div></section>" +
      '<section class="cbq-card"><h3>Site &amp; project charges</h3><div class="cbq-grid">' +
      num("Project management %", "siteCharges.projectMgmtPct", sc.projectMgmtPct) + num("Consumables % of works", "siteCharges.consumablesPct", sc.consumablesPct) +
      num("Site protection (lump)", "siteCharges.siteProtectionLump", sc.siteProtectionLump) + num("Transport & handling (lump)", "siteCharges.transportLump", sc.transportLump) +
      num("Deep cleaning (lump)", "siteCharges.cleaningLump", sc.cleaningLump) + num("Contingency %", "siteCharges.contingencyPct", sc.contingencyPct) +
      "</div></section>" +
      '<section class="cbq-card"><h3>Add-on rates</h3><div class="cbq-grid">' +
      S.addons.map(function (a, i) { return num(a.name, "addons." + i + ".rate", a.rate); }).join("") + "</div></section>" +
      '<section class="cbq-card"><h3>Company details on the PDF</h3><div class="cbq-grid">' +
      field("Phone", "settings.company.phone", S.company.phone) + field("Email", "settings.company.email", S.company.email) +
      field("GSTIN", "settings.company.gstin", S.company.gstin) + field("Quote valid (days)", "settings.company.validityDays", S.company.validityDays, { type: "number", min: 1 }) +
      field("Address", "settings.company.address", S.company.address, { wide: true }) + "</div>" +
      "<h4>Text at the end of the PDF</h4><p class=\"cbq-hint\">One point per line. Leave a box empty to drop that section from the PDF. Applies to every quote; click \u201CSend my rates &amp; settings to sheet\u201D to save it in the Google Sheet too.</p>" +
      '<div class="cbq-grid">' + area("Payment schedule", "settings.company.paymentTerms", E.textLines(S.company.paymentTerms).join("\n"), 4) +
      area("Terms", "settings.company.terms", E.textLines(S.company.terms).join("\n"), 7) + "</div>" +
      '<div class="cbq-row"><button class="cbq-btn ghost" data-act="reset-settings">' + this.label("reset-settings", "Reset rates to defaults", "Click again to reset all rates") + '</button></div></section>';
  };

  App.prototype.summary = function (q) {
    var admin = this.mode === "admin", t = q.totals;
    var rows = q.sections.filter(function (s) { return s.total > 0; }).map(function (s) {
      return "<tr><td>" + s.id + ". " + esc(s.title.replace(/ \(.*\)$/, "")) + '</td><td class="r">' + rs(s.total) + "</td></tr>";
    }).join("");
    var warn = q.warnings.map(function (w) { return '<li>' + esc(w) + "</li>"; }).join("");
    if (q.flags.estimated) warn += "<li>" + q.flags.estimated + " product rate(s) are estimates (EST)" + (admin ? "; enter your rates to firm up the quote." : " and will be confirmed after site visit.") + "</li>";
    var hasForm = !!document.getElementById("cbq-contact-form");
    return '<aside class="cbq-side"><div class="cbq-sum"><h3>Your quote</h3><table>' + rows +
      '<tr class="sub"><td>Subtotal</td><td class="r">' + rs(t.subtotal) + "</td></tr>" +
      (t.discount ? '<tr><td>Discount</td><td class="r">−' + rs(t.discount) + "</td></tr>" : "") +
      "<tr><td>GST " + t.gstPct + '%</td><td class="r">' + rs(t.gst) + "</td></tr>" +
      '<tr class="grand"><td>Total</td><td class="r">' + rs(t.grand) + "</td></tr></table>" +
      '<div class="cbq-small">' + q.areas.floor + " sqft floor \u00B7 " + esc(E.mixLabel(this.state, this.catalog)) + "</div>" +
      (warn ? '<ul class="cbq-warn">' + warn + "</ul>" : "") +
      '<button class="cbq-btn big" data-act="pdf">Download PDF quote</button>' +
      '<button class="cbq-btn ghost" data-act="pdf-preview">Preview PDF</button>' +
      (this.cfg.aiEndpoint ? '<button class="cbq-btn ghost" data-act="ai"' + (this.aiBusy ? " disabled" : "") + ">" + (this.aiBusy ? "Asking AI advisor…" : "AI review of this bathroom") + "</button>" : "") +
      (hasForm ? '<button class="cbq-btn ghost" data-act="send">Send to CoreBath for a site visit</button>' : "") +
      (this.sheet.url && admin ? '<button class="cbq-btn ghost" data-act="sheet-save"' + (this.sheetBusy ? " disabled" : "") + ">" + (this.sheetBusy || "Save quote to Google Sheet") + "</button>" : "") +
      (this.sheet.url && admin ? '<div class="cbq-sheet"><span class="cbq-dot ' + (this.sheetStatus.state === "ok" ? "ok" : this.sheetStatus.state === "err" ? "err" : "") + '"></span>' + esc(this.lastSaved || this.sheetStatus.msg || "") + "</div>" : "") +
      (admin ? '<button class="cbq-btn link" data-act="new-quote">' + this.label("new-quote", "Start a new quote", "Click again: clears client & selections") + "</button>" : "") +
      "</div></aside>";
  };

  CBQ.mount = function (el) {
    el = typeof el === "string" ? document.querySelector(el) : el;
    if (!el) return null;
    return (el.__cbq = new App(el));
  };
  function boot() { var el = document.getElementById("corebath-quote"); if (el && !el.__cbq) CBQ.mount(el); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(window);

// Theme integration: <corebath-quote> mounts itself, for themes that compose pages from web components.
(function () {
  if (!window.customElements || window.customElements.get("corebath-quote")) return;
  window.customElements.define("corebath-quote", class extends HTMLElement {
    connectedCallback() { if (!this.__cbq && window.CBQ && window.CBQ.mount) window.CBQ.mount(this); }
  });
})();
