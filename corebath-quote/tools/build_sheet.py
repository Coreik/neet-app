#!/usr/bin/env python3
"""Build google-sheet/CoreBath_Quotation_Data.xlsx (upload to Drive as a Google Sheet).

    node tools/build_sheet.cjs > /tmp/cbq.json && python3 tools/build_sheet.py /tmp/cbq.json
"""
import json, sys
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule

data = json.load(open(sys.argv[1]))
cat, cfg = data["catalog"], data["defaults"]
PKG = {"essential": "Core Essential", "signature": "Core Signature", "luxe": "Core Luxe"}
LABEL = {it["key"]: it["label"] for it in cat["items"]}
HEAD_FILL = PatternFill("solid", fgColor="0E4C52")
HEAD_FONT = Font(bold=True, color="FFFFFF")
TODO_FILL = PatternFill("solid", fgColor="FFF2CC")

wb = Workbook()

def table(ws, headers, rows, widths):
    ws.append(headers)
    for c in ws[1]:
        c.fill, c.font = HEAD_FILL, HEAD_FONT
        c.alignment = Alignment(vertical="center", wrap_text=True)
    for r in rows:
        ws.append(r)
    for i, w in enumerate(widths):
        ws.column_dimensions[chr(65 + i)].width = w
    ws.freeze_panes = "A2"

# --- Setup
ws = wb.active
ws.title = "Setup"
lines = [
    ["CoreBath quotation data", ""],
    ["This sheet feeds the quotation tool (products, prices, add-ons, rates) and stores every saved quote.", ""],
    ["Admin key", "(run setup in Apps Script to fill this)"],
    ["Web app URL", "(paste the /exec URL here after deploying)"],
    ["", ""],
    ["One-time setup", ""],
    ["1", "Extensions > Apps Script. Delete the sample code and paste the contents of Code.gs (in the same Drive folder). Save."],
    ["2", "Choose the function 'setup' and click Run. Allow access when Google asks. The admin key appears in B3."],
    ["3", "Deploy > New deployment > type Web app. Execute as: Me. Who has access: Anyone. Deploy and copy the URL ending in /exec."],
    ["4", "In the quotation tool: Rates & settings > Google Sheet > paste the URL and the admin key. On Shopify, paste the URL in the section setting 'Google Sheet web app URL'."],
    ["5", "After changing Code.gs later: Deploy > Manage deployments > Edit > Version: New version, so the same URL keeps working."],
    ["", ""],
    ["Day-to-day", ""],
    ["Prices", "Edit 'Price (Rs)' on the Products tab. Yellow = no price yet (the tool shows an estimate marked EST). Changes show in the tool on next load or 'Reload from sheet'."],
    ["New products", "Add a row on Products: pick Brand, Package and Item from the lists, type the product and price. Leave ID blank, it is filled in automatically."],
    ["New brand", "Just type a new brand name on new rows. Give it at least one row per Item so customers can pick it for every fixture."],
    ["Quotes", "Every PDF downloaded, 'Send to CoreBath' and 'Save quote to Google Sheet' adds or updates a row on Quotes, with line items on Quote Lines."],
]
for l in lines:
    ws.append(l)
ws["A1"].font = Font(bold=True, size=16, color="0E4C52")
for r in (6, 13):
    ws.cell(r, 1).font = Font(bold=True, size=12, color="0E4C52")
for r in (3, 4):
    ws.cell(r, 1).font = Font(bold=True)
    ws.cell(r, 2).fill = TODO_FILL
ws.column_dimensions["A"].width = 16
ws.column_dimensions["B"].width = 120
for row in ws.iter_rows(min_row=7):
    row[1].alignment = Alignment(wrap_text=True, vertical="top")

# --- Products
wp = wb.create_sheet("Products")
headers = ["Brand", "Package", "Item", "Product", "SKU", "Qty", "Price (Rs)", "Included in set", "Price basis", "Link", "Notes", "ID"]
order = {k: i for i, k in enumerate(["essential", "signature", "luxe"])}
sl = {it["key"]: it["sl"] for it in cat["items"]}
prods = sorted(cat["products"], key=lambda p: (p["brand"], order[p["pkg"]], sl[p["key"]]))
rows = [[p["brand"], PKG[p["pkg"]], LABEL[p["key"]], p["name"], p["sku"] or "", p["qty"],
         "" if p["price"] is None else p["price"], bool(p["included"]), p["basis"] or "", p["link"] or "", p["notes"] or "", p["id"]]
        for p in prods]
table(wp, headers, rows, [12, 15, 28, 52, 22, 6, 12, 10, 26, 30, 40, 34])
n = len(rows) + 1
dv_pkg = DataValidation(type="list", formula1='"Core Essential,Core Signature,Core Luxe"', allow_blank=True)
dv_item = DataValidation(type="list", formula1="=Lists!$A$1:$A$%d" % len(cat["items"]), allow_blank=True)
dv_inc = DataValidation(type="list", formula1='"TRUE,FALSE"', allow_blank=True)
for dv, col in ((dv_pkg, "B"), (dv_item, "C"), (dv_inc, "H")):
    wp.add_data_validation(dv)
    dv.add("%s2:%s2000" % (col, col))
wp.conditional_formatting.add("G2:G2000", FormulaRule(formula=['AND($A2<>"",$G2="",$H2<>TRUE)'], fill=TODO_FILL))
for r in range(2, n + 1):
    wp.cell(r, 7).number_format = "#,##0"

# --- Add-ons
wa = wb.create_sheet("Add-ons")
table(wa, ["Key", "Add-on", "Rate (Rs)", "Unit", "Fixing (Rs)", "Electrical points", "Angle valves"],
      [[a["key"], a["name"], a["rate"], a["unit"], a.get("fixing", 0), a.get("elecPoints", 0), a.get("angleValves", 0)] for a in cfg["addons"]],
      [16, 62, 11, 12, 11, 15, 12])
dv_unit = DataValidation(type="list", formula1='"each,sqft_floor,sqft_tiled,per_drain"', allow_blank=True)
wa.add_data_validation(dv_unit); dv_unit.add("D2:D200")

# --- Settings
desc = {
    "pricing.productMarkupPct": "Markup added to product prices (%)", "pricing.gstPct": "GST (%)", "pricing.roundTo": "Round the grand total to nearest Rs",
    "services.demolitionPerSqft": "Break and remove old tiles + bed, per sqft of tiled area", "services.sanitaryDismantleLump": "Remove old WC, basin, fittings (lump)",
    "services.debrisDisposalLump": "Debris bagging and disposal (lump)", "services.waterproofPerSqft": "Waterproofing per sqft",
    "services.waterproofUpturnFt": "Height waterproofed up every wall (ft)", "services.showerWallWpSqft": "Extra shower-wall waterproofing (sqft)",
    "services.screedPerSqft": "Floor bed with slope, per sqft", "services.floorTileLayPerSqft": "Floor tile laying per sqft",
    "services.wallTileLayPerSqft": "Wall tile laying per sqft", "services.adhesiveGroutPerSqft": "Tile adhesive + grout per sqft",
    "services.tileWastagePct": "Tile wastage (%)", "services.doorDeductionSqft": "Door opening deducted from wall area (sqft)",
    "services.waterPointRate": "Concealed CPVC water point, each", "services.drainPointRate": "Drain point, each",
    "siteCharges.projectMgmtPct": "Project management (% of products + works)", "siteCharges.consumablesPct": "Consumables (% of civil + plumbing)",
    "siteCharges.siteProtectionLump": "Site protection (lump)", "siteCharges.transportLump": "Transport and handling (lump)",
    "siteCharges.cleaningLump": "Deep cleaning (lump)", "siteCharges.contingencyPct": "Contingency (%)",
}
srows = []
for sec in ["pricing", "services", "siteCharges", "tileAllowance", "fixing"]:
    for k, v in cfg[sec].items():
        d = desc.get(sec + "." + k)
        if sec == "tileAllowance": d = "Tile supply allowance per sqft, " + PKG[k]
        if sec == "fixing": d = "Fixing labour per unit: " + LABEL.get(k, k)
        if sec == "fixing" and k in ("addon", "custom"): continue
        srows.append([sec, k, v, d or ""])
for k in ["phone", "email", "address", "gstin", "validityDays", "quotePrefix"]:
    srows.append(["company", k, cfg["company"].get(k, ""), "Shown on the PDF"])
srows.append(["company", "paymentTerms", "\n".join(cfg["company"]["paymentTerms"]), "Payment schedule at the end of the PDF, one point per line (Alt+Enter for a new line)"])
srows.append(["company", "terms", "\n".join(cfg["company"]["terms"]), "Terms at the end of the PDF, one point per line (Alt+Enter for a new line)"])
wsets = wb.create_sheet("Settings")
table(wsets, ["Section", "Key", "Value", "What it is"], srows, [14, 24, 14, 60])

# --- Quotes + lines
QH = ["Saved at", "Quote No", "Source", "Client", "Phone", "Email", "Site address", "Package", "Brands", "Bathroom size",
      "A. Fixtures", "B. Concealed", "C. Civil", "D. Plumbing & fixing", "E. Add-ons", "F. Additional", "G. Site & project",
      "Subtotal", "Discount", "GST", "Grand total", "Estimated rates", "Notes", "Quote data (JSON)"]
wq = wb.create_sheet("Quotes")
table(wq, QH, [], [18, 18, 14, 20, 14, 24, 30, 40, 26, 16] + [12] * 11 + [10, 30, 20])
wl = wb.create_sheet("Quote Lines")
table(wl, ["Quote No", "Section", "Item", "Description", "Brand", "SKU", "Qty", "Unit", "Rate", "Amount", "Rate source"], [],
      [18, 30, 24, 52, 12, 20, 8, 8, 12, 12, 12])

# --- Lists (for dropdowns)
wlst = wb.create_sheet("Lists")
for it in cat["items"]:
    wlst.append([it["label"]])
wlst.sheet_state = "hidden"

out = Path(__file__).resolve().parent.parent / "google-sheet" / "CoreBath_Quotation_Data.xlsx"
wb.save(out)
print("Wrote", out, len(rows), "products")
