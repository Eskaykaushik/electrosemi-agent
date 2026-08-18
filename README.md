# Conversational Commerce Platform

A conversation-first AI platform for electronics distribution.

Customers can talk to the company naturally to **discover products, ask technical questions, get quotes, place orders, and track them**.

The AI acts as the company's conversational representative while connecting to real business systems.

## Core Flow

```text
Customer
   ↓
Conversation (Chat UI)
   ↓
AI Agent (kaushix-api)
   ↓
┌───────────────┐
│ Product Search│  ← catalog (frontend JSON now, backend later)
│ Pricing       │
│ Inventory     │
│ Orders        │  ← cart submit → email to sales team
│ Support       │
└───────────────┘
   ↓
Business Action (kaushix-api → email)
   ↓
Customer + Internal Team
```

## Key Features

* Conversational product discovery
* In-chat product catalog with selectable suggestions
* Shopping cart with quantity control
* Submit cart → email to the sales team (via backend)
* Technical/product Q&A
* Inventory and pricing lookup
* Quote generation
* Conversational order placement
* Order status and tracking
* Email notifications to the sales team
* AI-powered customer communication
* Human approval for sensitive actions
* Conversation and action history

## Example

**Customer**

> I need 500 STM32 controllers for an industrial project.

**AI**

> I can help with that. We stock a range of STM32 and other microcontrollers. Want me to show options you can add to a cart?

*(The assistant lists matching parts as selectable cards. The customer adds items to the cart and submits.)*

**AI**

> Sent! Our sales team will follow up shortly with a formal quote.

## Architecture

```text
             Customer
                │
                ▼
        Conversation UI  (static site: HTML/CSS/JS)
                │
      ┌─────────┼─────────────┐
      ▼         ▼             ▼
   Chat      Product       Cart
   (mock)    Catalog       Submit
             (products.json)
                │             │
                │             ▼
                │        kaushix-api  ──► Email to sales team
                ▼         (FastAPI)
           /api/assistant (future)
```

* **Frontend:** a static single-page chat app (no build step). Hosted on GitHub Pages.
* **Backend:** [kaushix-api](https://github.com/Eskaykaushik/kaushix-api) (FastAPI). For now it receives the cart and emails the team; chat/LLM routing can be added later.
* **Product data:** served from a local `products.json` in the frontend for the MVP. It will move behind the backend (real catalog / pgvector) later.

## Important Principle

The **AI handles conversation and reasoning**.

The **backend handles business logic and transactions**.

```text
AI → Tool → Validation → Business Action
```

The AI should never invent:

* Prices
* Inventory
* Product specifications
* Delivery dates
* Order status

Product information shown to the customer comes from the real catalog (`products.json` now, backend later) — never from the model's imagination.

## Frontend (this repo)

Vanilla **HTML / CSS / JavaScript**, no bundler, no dependencies. It is served directly by GitHub Pages from the `master` branch root.

### Files

* `index.html` — chat layout, catalog browse, cart drawer.
* `styles.css` — conversational UI styling.
* `app.js` — chat logic, product fetching, cart state, and order submission.
* `products.json` — sample electronics catalog.

### Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

To point the cart submission at a different backend during local testing:

```text
http://localhost:8000/?api=http://localhost:8000
```

### Deploy

In repo **Settings → Pages → Source**: deploy from a branch → `master` / `(root)`.
The site goes live at `https://eskaykaushik.github.io/electrosemi-agent/`.

## Backend Contract (kaushix-api)

When the customer submits the cart, the frontend `POST`s the order to the
**ElectroSemi agent** endpoint:

```text
POST https://kaushix-api-service.onrender.com/api/electrosemi
Content-Type: application/json
```

```json
{
  "message": "A customer submitted a new order. Call the send_order_email tool with these exact details:\n{ \"customer\": { \"name\": \"Jane Doe\", \"email\": \"jane@acme.com\", \"company\": \"Acme\" }, \"items\": [ { \"sku\": \"STM32F407VGT6\", \"name\": \"STM32F407VGT6 - ARM Cortex-M4 MCU\", \"quantity\": 500, \"unitPrice\": 7.85 } ], \"notes\": \"Industrial project\" }",
  "history": []
}
```

The `electrosemi` agent calls its **`send_order_email`** tool, which composes
the order and emails it to `SALES_TEAM_EMAIL` via Resend. The endpoint returns:

```json
{ "response": "Your order was sent to the sales team — someone will follow up shortly." }
```

The frontend shows that `response` text as the confirmation. `API_BASE` in
`app.js` points at the Render deployment; override locally with `?api=...`.
CORS is enabled on kaushix-api (`allow_origins=["*"]`), so the Pages site can
call it directly.

## MVP

Start with:

1. Customer chat
2. Product catalog + search (in-chat suggestions)
3. AI product Q&A
4. Inventory lookup (catalog stock)
5. Quote generation (cart submit → team email)
6. Order creation (backend)
7. Email notification to the team

## Suggested Stack

* **Frontend:** HTML + CSS + JavaScript (static, GitHub Pages)
* **Backend:** Python + FastAPI (kaushix-api)
* **Database:** PostgreSQL (later)
* **Vector Search:** pgvector (later)
* **AI:** LLM with tool calling (kaushix-api)
* **Email:** SMTP / transactional email provider
* **Deployment:** GitHub Pages (frontend) + Hugging Face Spaces / Docker (backend)

## Vision

Turn the company's sales and support process into a single conversation.

> **Ask → Discover → Quote → Order → Track**
