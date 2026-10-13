# CoreSpace website: developer handover

Working prototype of the CoreSpace website (Bengaluru renovation and interiors). Target launch: **18 November 2026**.

- `index.html`: the whole site in one file (pages, estimators, photo quote, shop, bathroom kits, booking, owner dashboard).
- `img/`: real project photos and the logo (`corespace-logo.svg` is the master; letters are outlined).
- Requirements brief: shared separately by the owner (claude.ai doc). It is the source of truth for scope, prices and terms.

## Run it locally

```
cd corespace-website
python3 -m http.server 8080   # then open http://localhost:8080
```

Pages are hash routes: `#home`, `#bathroom`, `#kitchen`, `#flooring`, `#ceiling`, `#wardrobe`, `#more`, `#living`, `#painting`, `#fullhome`, `#shop`, `#kits`, `#photo`, `#process`, `#projects`, `#about`, `#book`, `#terms`, `#account`, `#admin`.

## What is real and what is a prototype stand-in

The prototype ran inside claude.ai and used its built-in runtime (`window.claude.use(...)`). Outside claude.ai these return nothing and the site falls back to WhatsApp. For production, replace each one:

| Prototype feature | Used for | Production replacement |
| --- | --- | --- |
| `claude.use("db")` | Saving leads and order requests; prices and "bookings paused" set from the dashboard | A real backend and database (e.g. Supabase or Firebase, free tier). Collections: `leads/<customer>/items`, `config/site`, and per-customer private `data/users/<customer>/profile` and `/cart` |
| `claude.use("user")` | Who the visitor is: customer accounts (`#account`) and who can open `#admin` | Customer sign-in with mobile number + one-time code (OTP); separate owner login for the dashboard |
| `claude.use("sample")` with images | Photo quote: reads an uploaded photo and picks job, package and add-ons | Server-side call to the Claude API (Messages API with an image). Reuse the prompt in `handlePhoto()`. Keep the API key on the server |
| `claude.use("downloads")` | Estimate PDF and leads CSV | Normal browser download (`a[download]` / Blob URL) |
| none | New-lead alerts | Email and/or WhatsApp alert to the owner on every new lead (not built) |
| none | Analytics | Google Analytics 4 + Search Console; track estimator use, WhatsApp clicks, bookings, order requests |

## Customer accounts

`#account` lets a customer create a profile (name, mobile, email, contact preference, area, apartment, flat, home type, notes), edit or delete it, see every booking and order they've sent with its live status, and keep a cart saved across devices. Saved details pre-fill every booking and order form; after a first booking without a profile, the confirmation offers "Create my profile". The dashboard has a **Customers** tab grouping requests by mobile number. In production: OTP sign-in, each customer can read only their own profile, cart and requests; the owner reads all requests but not private profiles unless the customer shares them; profile deletion must actually delete (DPDP Act).

## Data to replace before launch

All site data is in plain JS objects near the top of the `<script>`:

- `CO`: contact details (WhatsApp 918660117432, phone +91 99450 39109, email Corebuildconindia@gmail.com).
- `JOBS`: packages, approved prices, add-ons, Gate text, FAQs.
- `PRODUCTS`: shop catalogue. **Prices are placeholders**, so replace them with the dealer price list and add product photos.
- `KITDEF`: which products make up each one-bathroom kit and how quantities are calculated.
- `SPLIT`: payment split 10% / 40% / 40% / 10% (signing, work start, after the Gate, handover).

Business rules: the ₹999 site-visit fee is adjusted against the first payment if the client signs, is non-refundable, and is collected offline (agreed on the confirmation call). The website takes **no online payments** at launch (PhonePe Payment Gateway later). Prices exclude GST.

## Putting it on the CoreSpace domain

1. Confirm the owner controls the domain at its registrar (GoDaddy, Hostinger, etc.). The domain is not confirmed yet; ask the owner.
2. Host the site on a free static host (Cloudflare Pages, Netlify or Vercel) connected to this repo folder.
3. In the host, add the custom domain (`example.in` and `www.example.in`).
4. At the registrar, add the DNS records the host shows (usually a CNAME for `www` and an A/ALIAS record for the root). HTTPS is issued automatically.
5. Point the backend (step above) at the production domain, then test booking, order request, admin and photo quote on the live URL.

## Before launch checklist

- [ ] Backend and database for leads, orders, prices and bookings toggle
- [ ] Customer sign-in (mobile OTP), profile, saved cart, My requests
- [ ] Owner login for the dashboard
- [ ] New-lead alerts (email/WhatsApp)
- [ ] Photo quote via server-side Claude API call
- [ ] Dealer prices and product photos in the shop
- [ ] Privacy, Terms and Refund pages reviewed by the owner
- [ ] GA4, Search Console, page titles and LocalBusiness schema
- [ ] Domain connected with HTTPS
- [ ] Test on mobile (most visitors) and desktop
