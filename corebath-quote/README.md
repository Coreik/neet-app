# CoreBath quotation builder

Builds a quote for a custom bathroom package and outputs it as a PDF. It runs on its own as a web page, or as a section on the corebath.in Shopify store.

1. **Pick a starting package.** Choose a brand (Jaquar, Kohler, Hindware, Cera, Parryware, Grohe) and a tier (Essential, Signature, Luxe). This loads all 9 visible fixtures from your product list.
2. **Swap any fixture.** Each fixture can come from any brand or tier, which is what makes the package custom.
3. **Concealed parts are matched for you.** Every in-wall or connection part follows the brand and series of the fixture it connects to:
   - the diverter body matches the diverter trim
   - the concealed cistern matches the wall-hung WC
   - basin mixer: 2 angle valves and 2 braided hoses
   - basin: waste coupling and bottle trap
   - health faucet: 1 angle valve
   - hand shower: flexi pipe
   - geyser: 2 more angle valves
   - main stop cock

   If two parts won't fit each other (for example a trim and body from different brands), you get a warning. You can override or untick any part.
4. **Civil work is priced from the room size.** Enter length × width × height and how high the wall tiles go. The tool then works out the areas and prices demolition, debris removal, waterproofing (floor, 1 ft up every wall, plus shower walls), floor screed, tile supply (an allowance per tier, plus wastage), adhesive and grout, and tile laying. Concealed water and drain points are counted from the fixtures you chose. Fixing labour is priced per item.
5. **Hidden charges are added automatically:** consumables (% of works), site protection, transport and handling, deep cleaning, project management (%) and an optional contingency.
6. **Add-ons are recommended from the bathroom itself.** Each one is marked essential, recommended or optional, with a reason. They're based on the selections and on the facts you enter: no geyser, no window, elderly users, children, hard water, room size, tier. Electrical points for the add-ons are added automatically.
7. **The PDF** includes:
   - your header, client and bathroom details
   - sections A–G with brand and SKU on each line
   - totals with GST, and the amount in words (Indian numbering)
   - recommended add-ons not taken, payment schedule and terms

## Filling in missing rates and adding extra charges (admin mode)

- **Rate book** (*Rates & settings*). 142 catalogue items have no price ("Get dealer quote"). Until you enter one, the quote uses the median price of the same item in the same tier across other brands. It is marked **EST** on screen and `*` in the PDF.
- You can also type a rate straight into any line on the Fixtures tab.
- **Additional items & services** (*Add-ons & extras* tab). Add any line with its own description, quantity, unit and rate, e.g. "shift WC outlet", "window grill", "extra electrical".
- **Every rate is editable:** demolition, waterproofing, tiling, points, fixing labour per item, site charges, GST, product markup %, tile allowance per tier, add-on rates and company details.
- **Discount**, by percent or by amount.
- **Where your rates are saved.** They stay in your browser. **Download cbq-rates.js** to publish them to the Shopify store, and **Import** to load them on another computer.

Run locally: open `index.html` (admin). Add `?mode=customer` to the address to see the shopper view.

## Put it on Shopify

1. In Shopify admin, go to **Online Store → Themes → … → Edit code**.
2. Under **Assets**, upload every file in `assets/`: `cbq.css`, `cbq-catalog.js`, `cbq-config.js`, `cbq-rates.js`, `cbq-engine.js`, `cbq-pdf.js`, `cbq-app.js`.
3. Under **Sections**, add `corebath-quote.liquid` from `shopify/sections/`.
4. Create a page (for example *Get a quote*). In the theme editor, add the **CoreBath quotation** section to it.
5. Shoppers get the customer view: they choose fixtures and add-ons, then download the PDF. **Send to CoreBath** posts the full quote to your store's contact form, so it arrives in your Shopify inbox.
6. To get admin mode on the live site, tag your own customer account `corebath-admin` and log in.
7. To publish rates for shoppers: in admin mode, click **Download cbq-rates.js** and replace that file in the theme assets.

## Update prices from the Excel

```bash
pip install openpyxl
python3 tools/import_catalog.py data/CoreBath_Package_Product_List.xlsx
```

This rewrites `assets/cbq-catalog.js`. Re-upload that file to Shopify.

## Optional: Claude AI design advisor

`ai/worker.js` is a Cloudflare Worker. It sends the priced quote to Claude (`claude-opus-5-5`, with automatic fallback if a request is declined) and gets back a summary, extra recommendations and compatibility checks. These appear on screen and in the PDF.

The built-in rules work without it.

```bash
cd ai && npm install
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```

Put the worker URL in the section setting **AI advisor URL** (or `data-ai-endpoint` in `index.html`), and list your domains in `ALLOWED_ORIGINS` in `wrangler.toml`. The API key stays on the worker and is never in the theme.

## Tests

```bash
node tools/test_engine.cjs
```

The tests cover:
- every brand × tier
- concealed matching and angle-valve counts
- rate book vs estimate
- markup, discount, GST and rounding
- recommendations
- amount in words

## Default rates to check

These are starting points (₹, excluding GST). Set your own in *Rates & settings*.

| Item | Rate |
|---|---|
| Demolition | 35/sqft |
| Waterproofing | 70/sqft |
| Screed | 45/sqft |
| Floor laying | 55/sqft |
| Wall laying | 60/sqft |
| Adhesive + grout | 25/sqft |
| Tile allowance | 85 / 140 / 240 per sqft (Essential / Signature / Luxe) |
| Water point | 1,800 |
| Drain point | 1,500 |
| Project management | 8% |
| Consumables | 4% |
| Cleaning | 2,500 |
| Site protection | 1,500 |
| Transport | 2,500 |
| GST | 18% |
