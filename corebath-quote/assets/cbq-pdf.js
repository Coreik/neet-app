/*
 * CoreBath quotation PDF (jsPDF + jspdf-autotable).
 * CBQ.pdf.generate(quote, state, catalog, {mode, returnDoc})
 */
(function (g) {
  "use strict";
  var CBQ = (g.CBQ = g.CBQ || {});

  var C = { ink: [24, 32, 38], muted: [105, 115, 122], brand: [14, 76, 82], accent: [196, 154, 84], line: [222, 226, 229], soft: [244, 247, 247], est: [176, 98, 0] };

  function money(n) { return CBQ.engine.inr(n); }
  function qtyStr(n) { return Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : n.toFixed(2); }

  // Indian number system in words: 3,14,100 -> "Three Lakh Fourteen Thousand One Hundred"
  function words(n) {
    n = Math.round(n);
    if (n === 0) return "Zero";
    var a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    var b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    function two(x) { return x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : ""); }
    function three(x) { var h = Math.floor(x / 100), r = x % 100; return (h ? a[h] + " Hundred" + (r ? " " : "") : "") + (r ? two(r) : ""); }
    var parts = [], crore = Math.floor(n / 1e7); n %= 1e7;
    var lakh = Math.floor(n / 1e5); n %= 1e5;
    var th = Math.floor(n / 1000); n %= 1000;
    if (crore) parts.push((crore > 999 ? words(crore) : three(crore)) + " Crore");
    if (lakh) parts.push(two(lakh) + " Lakh");
    if (th) parts.push(two(th) + " Thousand");
    if (n) parts.push(three(n));
    return parts.join(" ");
  }

  function addDays(iso, d) { var t = new Date(iso + "T00:00:00"); t.setDate(t.getDate() + d); return t; }
  function fmtDate(d) {
    if (typeof d === "string") d = new Date(d + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function generate(q, st, catalog, opts) {
    opts = opts || {};
    var jsPDF = (g.jspdf && g.jspdf.jsPDF) || g.jsPDF;
    if (!jsPDF) { g.alert("PDF library did not load. Check your internet connection and try again."); return null; }
    var E = CBQ.engine, S = q.settings, co = S.company;
    var doc = new jsPDF({ unit: "pt", format: "a4" });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40;
    var y;

    // ---- header band ----
    doc.setFillColor.apply(doc, C.brand); doc.rect(0, 0, W, 92, "F");
    doc.setFillColor.apply(doc, C.accent); doc.rect(0, 92, W, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal"); doc.setFontSize(24); doc.text("Core", M, 46);
    var cw = doc.getTextWidth("Core");
    doc.setFont("helvetica", "bold"); doc.text("Bath", M + cw, 46);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text((co.tagline || "") + "  |  " + (co.website || ""), M, 64);
    var contact = [co.phone, co.email].filter(Boolean).join("  |  ");
    if (contact) doc.text(contact, M, 77);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("QUOTATION", W - M, 42, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("No. " + st.quoteNo, W - M, 58, { align: "right" });
    doc.text("Date " + fmtDate(st.date) + "   Valid till " + fmtDate(addDays(st.date, +co.validityDays || 15)), W - M, 71, { align: "right" });
    if (co.gstin) doc.text("GSTIN " + co.gstin, W - M, 84, { align: "right" });

    // ---- client + bathroom blocks ----
    y = 118;
    var c = st.client, r = st.room, colW = (W - 2 * M - 16) / 2;
    function block(x, title, lines) {
      doc.setFillColor.apply(doc, C.soft); doc.roundedRect(x, y, colW, 84, 4, 4, "F");
      doc.setTextColor.apply(doc, C.brand); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
      doc.text(title.toUpperCase(), x + 10, y + 16);
      doc.setTextColor.apply(doc, C.ink); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      var yy = y + 31;
      lines.forEach(function (l, i) {
        if (!l) return;
        if (i === 0) doc.setFont("helvetica", "bold");
        var wrapped = doc.splitTextToSize(l, colW - 20).slice(0, 2);
        doc.text(wrapped, x + 10, yy); yy += 12 * wrapped.length;
        doc.setFont("helvetica", "normal");
      });
    }
    block(M, "Prepared for", [c.name || "Client", c.phone, c.email, c.address]);
    var x = st.context;
    block(M + colW + 16, "Bathroom", [
      r.length + " ft x " + r.width + " ft x " + r.height + " ft high",
      "Floor " + q.areas.floor + " sqft | Wall tiles " + q.areas.wall + " sqft (to " + r.tileHeight + " ft)",
      "Waterproofing " + q.areas.waterproof + " sqft | " + q.waterPoints + " water + " + q.drainPoints + " drain points",
      (r.demolition ? "Renovation with demolition" : "New bathroom, no demolition") + (r.tilesByUs ? "; tiles by CoreBath" : "; tiles by client"),
      "Package: " + E.mixLabel(st, catalog),
    ]);
    y += 100;

    // ---- section tables ----
    var head = [["#", "Description", "Qty", "Unit", "Rate (Rs)", "Amount (Rs)"]];
    var anyEst = false;
    q.sections.forEach(function (s) {
      if (!s.lines.length) return;
      var body = s.lines.map(function (l, i) {
        var sub = [];
        if (l.brand) sub.push(l.brand + (l.sku ? " | " + l.sku : ""));
        if (l.reason) sub.push("For: " + l.reason);
        if (l.note && opts.mode === "admin") sub.push("Note: " + l.note);
        var rate = money(l.rate);
        if (l.source === "estimate") { rate += " *"; anyEst = true; }
        if (l.source === "included") rate = "Included";
        if (l.source === "missing" || (l.source === "custom" && !l.rate)) rate = "TBC";
        return [s.id + (i + 1), { content: (l.item ? l.item + ": " : "") + l.desc + (sub.length ? "\n" + sub.join("\n") : ""), est: l.source === "estimate" }, qtyStr(l.qty), l.unit || "nos", rate, money(l.amount)];
      });
      if (y > H - 130) { doc.addPage(); y = 50; } // never leave a section heading alone at the foot of a page
      doc.autoTable({
        startY: y, margin: { left: M, right: M, top: 50, bottom: 50 },
        head: [[{ content: s.id + ".  " + s.title, colSpan: 5 }, { content: money(s.total), styles: { halign: "right" } }]],
        body: [head[0]].concat(body),
        theme: "plain",
        styles: { font: "helvetica", fontSize: 8.4, textColor: C.ink, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }, lineColor: C.line, valign: "top" },
        headStyles: { fillColor: C.brand, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9.5 },
        columnStyles: { 0: { cellWidth: 26, textColor: C.muted }, 2: { cellWidth: 38, halign: "right" }, 3: { cellWidth: 38 }, 4: { cellWidth: 66, halign: "right" }, 5: { cellWidth: 74, halign: "right", fontStyle: "bold" } },
        didParseCell: function (d) {
          if (d.section === "body" && d.row.index === 0) {
            d.cell.styles.fillColor = C.soft; d.cell.styles.textColor = C.muted; d.cell.styles.fontStyle = "bold"; d.cell.styles.fontSize = 7.5;
          }
          if (d.section === "body" && d.row.index > 0) d.cell.styles.lineWidth = { bottom: 0.5 };
          if (d.section === "body" && d.row.index > 0 && d.column.index === 4 && /\*$/.test(String(d.cell.raw))) d.cell.styles.textColor = C.est;
        },
        willDrawCell: function (d) {
          // brand / reason sub-lines are drawn by didDrawCell in a smaller grey font
          if (d.section === "body" && d.row.index > 0 && d.column.index === 1 && d.cell.text.length > 1) {
            d.cell._lines = d.cell.text; d.cell.text = [];
          }
        },
        didDrawCell: function (d) {
          var lines = d.cell._lines;
          if (!lines) return;
          var full = String(d.cell.raw.content || d.cell.raw);
          var firstLines = doc.splitTextToSize(full.split("\n")[0], d.cell.width - d.cell.padding("horizontal")).length;
          var yy = d.cell.y + d.cell.padding("top") + 8.4 * 0.85;
          lines.forEach(function (t, k) {
            var isSub = k >= firstLines;
            doc.setFontSize(isSub ? 7.2 : 8.4);
            doc.setTextColor.apply(doc, isSub ? C.muted : C.ink);
            doc.text(t, d.cell.x + d.cell.padding("left"), yy);
            yy += (isSub ? 7.2 : 8.4) * 1.15;
          });
          doc.setFontSize(8.4); doc.setTextColor.apply(doc, C.ink);
        },
      });
      y = doc.lastAutoTable.finalY + 12;
    });

    // ---- totals ----
    var t = q.totals;
    var totals = q.sections.filter(function (s) { return s.total > 0; }).map(function (s) { return [s.id + ". " + s.title.replace(/ \(.*\)$/, ""), money(s.total)]; });
    totals.push(["Subtotal", money(t.subtotal)]);
    if (t.discount) totals.push(["Discount", "-" + money(t.discount)]);
    totals.push(["GST @ " + t.gstPct + "%", money(t.gst)]);
    if (Math.abs(t.roundOff) >= 0.01) totals.push(["Round off", (t.roundOff < 0 ? "-" : "") + Math.abs(t.roundOff).toFixed(2)]);
    totals.push(["GRAND TOTAL (Rs)", money(t.grand)]);
    if (y > H - 220) { doc.addPage(); y = 50; }
    doc.autoTable({
      startY: y, margin: { left: W / 2 - 20, right: M }, body: totals, theme: "plain",
      styles: { font: "helvetica", fontSize: 9, textColor: C.ink, cellPadding: 3.5 },
      columnStyles: { 1: { halign: "right", cellWidth: 90 } },
      didParseCell: function (d) {
        var last = d.row.index === totals.length - 1;
        if (last) { d.cell.styles.fillColor = C.brand; d.cell.styles.textColor = [255, 255, 255]; d.cell.styles.fontStyle = "bold"; d.cell.styles.fontSize = 11.5; d.cell.styles.cellPadding = 7; }
        if (d.row.raw[0] === "Subtotal") { d.cell.styles.fontStyle = "bold"; d.cell.styles.lineWidth = { top: 0.6 }; d.cell.styles.lineColor = C.line; }
      },
    });
    y = doc.lastAutoTable.finalY + 14;
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor.apply(doc, C.muted);
    doc.text(doc.splitTextToSize("Rupees " + words(t.grand) + " only, inclusive of GST.", W - 2 * M), M, y);
    y += 18;

    function heading(txt) {
      if (y > H - 90) { doc.addPage(); y = 50; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor.apply(doc, C.brand);
      doc.text(txt, M, y); y += 6;
      doc.setDrawColor.apply(doc, C.accent); doc.setLineWidth(1); doc.line(M, y, M + 40, y); y += 12;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor.apply(doc, C.ink);
    }
    function bullets(list) {
      list.forEach(function (b) {
        var lines = doc.splitTextToSize(b, W - 2 * M - 12);
        if (y + lines.length * 11 > H - 50) { doc.addPage(); y = 50; }
        doc.text("•", M, y); doc.text(lines, M + 10, y); y += lines.length * 11 + 2;
      });
      y += 6;
    }

    // ---- recommended but not selected ----
    var pdfOpt = st.pdf || {}, hidden = pdfOpt.hiddenRecs || {};
    var notTaken = pdfOpt.showRecs === false ? [] : q.recommendations.filter(function (rc) {
      return rc.priority !== "optional" && !hidden[rc.key] && !(st.addons[rc.key] && st.addons[rc.key].on);
    });
    if (notTaken.length) {
      heading("Recommended for your bathroom (not included above)");
      bullets(notTaken.map(function (rc) {
        var unit = rc.addon.unit === "each" ? "" : rc.addon.unit === "per_drain" ? " per drain" : " per sqft";
        return rc.addon.name + " - Rs " + money(rc.addon.rate) + unit + ". " + rc.reason + (rc.priority === "essential" ? " (strongly advised)" : "");
      }));
    }

    // ---- AI advisor ----
    if (st.aiNotes && !st.aiNotes.error) {
      heading("Design advisor notes");
      var notes = [];
      if (st.aiNotes.summary) notes.push(st.aiNotes.summary);
      (st.aiNotes.recommendations || []).forEach(function (rc) { notes.push(rc.title + ": " + rc.reason); });
      (st.aiNotes.checks || []).forEach(function (ck) { notes.push(ck); });
      bullets(notes);
    }

    if (c.notes) { heading("Notes"); bullets([c.notes]); }
    if (anyEst) { heading("Estimated rates"); bullets(["Rates marked * are estimated from equivalent products and will be confirmed before ordering."]); }
    var pay = E.textLines(co.paymentTerms), terms = E.textLines(co.terms);
    if (pay.length) { heading("Payment schedule"); bullets(pay); }
    if (terms.length) { heading("Terms"); bullets(terms); }

    // ---- footer on every page ----
    var pages = doc.internal.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor.apply(doc, C.line); doc.setLineWidth(0.5); doc.line(M, H - 32, W - M, H - 32);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor.apply(doc, C.muted);
      doc.text(co.name + " | " + co.website + (co.address ? " | " + co.address : ""), M, H - 20);
      doc.text("Quote " + st.quoteNo + " | Page " + i + " of " + pages, W - M, H - 20, { align: "right" });
    }

    if (opts.returnDoc) return doc;
    var who = (c.name || "client").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    doc.save("CoreBath-Quote-" + st.quoteNo + "-" + who + ".pdf");
    return doc;
  }

  CBQ.pdf = { generate: generate, words: words };
})(typeof window !== "undefined" ? window : globalThis);
