# ElectroSemi Agent

A conversation-first AI platform for electronics distribution.

Customers can talk to the company naturally to **discover products, ask technical questions, get quotes, place orders, and track them**.

The AI acts as the company's conversational representative while connecting to real business systems.

## Core Flow

```text
Customer
   |
   v
Conversation (Chat UI)
   |
   v
AI Agent (kaushix-api)
   |
+-------------------+
| Product Search    |  <- catalog (frontend JSON now, backend later)
| Pricing           |
| Inventory         |
| Orders            |  <- cart submit -> email to sales team
| Support           |
+-------------------+
   |
   v
Business Action (kaushix-api -> email)
   |
   v
Customer + Internal Team
```

## Key Features

* **Real-time AI chat** — messages sent to the kaushix-api ElectroSemi agent via `POST /api/electrosemi`
* **Conversation history** — full chat history sent with each request for multi-turn context
* **Conversational product discovery**
* **In-chat product catalog** with selectable suggestion cards
* **Shopping cart** with quantity control
* **Submit cart -> professional email to sales team** (HTML + plain text via Resend)
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
                |
                v
        Conversation UI  (static site: HTML/CSS/JS)
                |
      +---------+-------------+
      v         v             v
   Chat      Product       Cart
   (AI)     Catalog       Submit
             (products.json)
                |             |
                |             v
                |        kaushix-api  --> Email to sales team
                v         (FastAPI)
           /api/electrosemi
```

* **Frontend:** a static single-page chat app (no build step). Hosted on GitHub Pages.
* **Backend:** [kaushix-api](https://github.com/Eskaykaushik/kaushix-api) (FastAPI). Routes chat through the ElectroSemi AI agent and emails the sales team on cart submit.
* **Product data:** served from a local `products.json` in the frontend for the MVP. It will move behind the backend (real catalog / pgvector) later.

## Important Principle

The **AI handles conversation and reasoning**.

The **Backend handles business logic and transactions**.

```
AI -> Tool -> Validation -> Business Action
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
* `styles.css` — conversational UI styling (dark theme, inline animations, responsive).
* `app.js` — chat logic, backend integration, product fetching, cart state, and order submission.
* `products.json` — sample electronics catalog.

### Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

To point the cart submission at a different backend during local testing:

```
http://localhost:8000/?api=http://localhost:8000
```

### Deploy

In repo **Settings -> Pages -> Source**: deploy from a branch -> `master` / `(root)`.
The site goes live at `https://eskaykaushik.github.io/electrosemi-agent/`.

## Backend Contract (kaushix-api)

### Chat

When the customer sends a message, the frontend `POST`s to the **ElectroSemi agent** endpoint:

```
POST https://kaushix-api-service.onrender.com/api/electrosemi
Content-Type: application/json
```

```json
{
  "message": "I need 500 STM32 controllers",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

The endpoint returns:

```json
{ "response": "We carry several STM32 models..." }
```

### Cart Submit

When the customer submits the cart, the frontend sends the order details as a message. The agent calls its `send_order_email` tool, which composes and emails the order to `SALES_TEAM_EMAIL` via Resend. The email includes:

* Professional HTML template with ElectroSemi branding
* Customer details (name, email, company)
* Line-item table with SKUs, quantities, unit prices, and totals
* Grand total
* Optional notes

```json
{ "response": "Your order was sent to the sales team — someone will follow up shortly." }
```

The frontend displays that `response` text as the confirmation. `API_BASE` in `app.js` points at the Render deployment; override locally with `?api=...`. CORS is enabled on kaushix-api (`allow_origins=["*"]`), so the Pages site can call it directly.

## MVP

Start with:

1. Customer chat (real AI agent)
2. Product catalog + search (in-chat suggestions)
3. AI product Q&A
4. Inventory lookup (catalog stock)
5. Quote generation (cart submit -> team email)
6. Order creation (backend)
7. Professional email notification to the team (HTML + text via Resend)

## Suggested Stack

* **Frontend:** HTML + CSS + JavaScript (static, GitHub Pages)
* **Backend:** Python + FastAPI (kaushix-api)
* **AI:** Groq / Llama 3.3 with tool calling (kaushix-api)
* **Email:** Resend (transactional)
* **Database:** PostgreSQL (later)
* **Vector Search:** pgvector (later)
* **Deployment:** GitHub Pages (frontend) + Render (backend)

## Vision

Turn the company's sales and support process into a single conversation.

> **Ask -> Discover -> Quote -> Order -> Track**
