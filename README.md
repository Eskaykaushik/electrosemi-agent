# Conversational Commerce Platform

A conversation-first AI platform for electronics distribution.

Customers can talk to the company naturally to **discover products, ask technical questions, get quotes, place orders, and track them**.

The AI acts as the company's conversational representative while connecting to real business systems.

## Core Flow

```text
Customer
   ↓
Conversation
   ↓
AI Agent
   ↓
┌───────────────┐
│ Product Search│
│ Pricing       │
│ Inventory     │
│ Orders        │
│ Support       │
└───────────────┘
   ↓
Business Action
   ↓
Customer + Internal Team
```

## Key Features

* Conversational product discovery
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

> I found a suitable part with 620 units available.
> Would you like me to prepare a quote for 500 units?

**Customer**

> Yes.

**AI**

> Quote created and sent to our sales team for approval. I'll update you here once it's approved.

## Architecture

```text
             Customer
                │
                ▼
        Conversation API
                │
                ▼
           AI Agent
                │
      ┌─────────┼─────────┐
      ▼         ▼         ▼
   Catalog   Inventory   Orders
      │         │         │
      └─────────┼─────────┘
                ▼
        Business Database
                │
                ▼
        Email / Notifications
```

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

## MVP

Start with:

1. Customer chat
2. Product catalog + search
3. AI product Q&A
4. Inventory lookup
5. Quote generation
6. Order creation
7. Email notification to the team

## Suggested Stack

* **Backend:** Python + FastAPI
* **Database:** PostgreSQL
* **Vector Search:** pgvector
* **Frontend:** React + TypeScript
* **AI:** LLM with tool calling
* **Email:** SMTP / transactional email provider
* **Deployment:** Docker

## Vision

Turn the company's sales and support process into a single conversation.

> **Ask → Discover → Quote → Order → Track**
