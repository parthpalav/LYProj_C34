<div align="center">

<img src="docs/readme/hero.svg" alt="FINAURA: your money, understood" width="100%"/>

<br/>

**Adaptive Financial Intelligence System**: a mobile app, a web app, an API and an ML service that turn everyday transactions into a health score, household insights and a retirement plan.

<br/>

![React Native](https://img.shields.io/badge/React_Native-0.88-61DAFB?logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo_SDK-58-000020?logo=expo&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-Express_4-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_8-47A248?logo=mongodb&logoColor=white)
![Python](https://img.shields.io/badge/Python-Flask_3-3776AB?logo=python&logoColor=white)
![PyTorch](https://img.shields.io/badge/Model-bge--base_v7-EE4C2C?logo=pytorch&logoColor=white)
![Gemini](https://img.shields.io/badge/AI-Gemini_1.5_Flash-8E75B2?logo=googlegemini&logoColor=white)

[At a glance](#-at-a-glance) · [Tour](#-take-the-tour) · [Features](#-what-finaura-does) · [How it works](#-how-it-works) · [Run it](#-getting-started) · [Tests](#-testing)

</div>

---

## ⚡ At a glance

> **One sentence:** you record a payment (or paste a bank SMS line), FINAURA labels it automatically, scores how healthy your month is, shows what your family is doing together without exposing anyone's private data, and simulates 10,000 possible futures to tell you whether you'll retire on time.

<table>
<tr>
<td width="50%" valign="top">

### What it is
- 📱 **Mobile app** (iOS / Android, Expo) and 🖥️ **web app** (React) with the same features
- 🧠 **ML service** that labels any payment text into **14 categories × Need / Want / Investment**
- 📊 **FMI**: one 0–100 score of your financial health, fully explainable
- 👨‍👩‍👧 **Family mode**: pooled household score, fair per-member split (Shapley values), private by design
- 🔮 **Future**: goals, FIRE target, Monte Carlo retirement odds, what-if lab
- 💬 **AI assistant** that answers from your own numbers

</td>
<td width="50%" valign="top">

### How it fits together
```
 Mobile app ─┐
             ├─► Express API :4000 ─► MongoDB :27017
 Web app ────┘         │
                       ├─► ML service :5001
                       │     classifier · Monte Carlo · Apriori
                       └─► Gemini (advice only, optional)
```
### Run it in three commands
```bash
./scripts/dev-check.sh   # pre-flight
./scripts/dev-start.sh   # ML + API + web
open http://localhost:5173
```

</td>
</tr>
</table>

| You do… | FINAURA does… | You see… |
| :--- | :--- | :--- |
| Type `swiggy dinner 450` or paste `UPI/DR/…/SWIGGY` | Merchant memory → rules → fine-tuned v7 model → confidence gate | `Food & Dining · Want`, or a "Check AI guesses" card if unsure |
| Spend through the month | Compares your saving and spending against what your goals need | **FMI 0–100** with three pillar scores and the reasons behind them |
| Join a family | Pools income and spending, re-scores the household with and without each member | **Household FMI** and "who contributes what" points |
| Add loans, cards, FDs, SIPs | Auto-deducts bills on their due date, compounds FDs/RDs, tracks card cycles | **Net worth**, upcoming bills, "free to use after bills" |
| Ask "can I retire at 55?" | Runs 10,000 market paths with the same random numbers across scenarios | Funded probability, P10 / P50 / P90 corpus, required monthly saving |

---

## 📚 Table of Contents

- [At a glance](#-at-a-glance)
- [Take the tour](#-take-the-tour)
- [What FINAURA does](#-what-finaura-does)
  - [Money: activity, payment methods, net worth](#1-money-activity-payment-methods-and-net-worth)
  - [Understand: FMI, insights, predictions](#2-understand-fmi-insights-and-predictions)
  - [Family & household](#3-family-and-household)
  - [Future: goals, FIRE, Monte Carlo](#4-future-goals-fire-and-monte-carlo)
  - [AI assistant, reports, notifications](#5-ai-assistant-reports-and-notifications)
- [How it works](#-how-it-works)
  - [System architecture](#system-architecture)
  - [Life of a transaction](#life-of-a-transaction)
  - [The classifier](#the-classifier)
  - [Financial Maturity Index](#financial-maturity-index-fmi)
  - [Family FMI and the Shapley breakdown](#family-fmi-and-the-shapley-breakdown)
  - [Purchase prediction (Apriori)](#purchase-prediction-apriori)
  - [Monte Carlo retirement engine](#monte-carlo-retirement-engine)
  - [Bills, cards and deposits](#bills-cards-and-deposits)
  - [AI assistant routing](#ai-assistant-routing)
  - [Authentication](#authentication)
  - [Data model](#data-model)
- [Screenshot gallery](#-screenshot-gallery)
- [Technology stack](#-technology-stack)
- [Repository structure](#-repository-structure)
- [Getting started](#-getting-started)
- [Testing](#-testing)
- [Research and benchmarks](#-research-and-benchmarks)
- [Security](#-security)
- [Privacy model](#-privacy-model)
- [Current limitations](#-current-limitations)
- [Disclaimer, contributors, license](#-disclaimer)

---

## 🎬 Take the tour

<table>
<tr>
<td width="72%" align="center"><img src="docs/readme/web-tour.gif" alt="Web app tour: overview, activity, net worth, FMI, family, scenario lab, assistant, dark mode"/><br/><sub><b>Web app</b>: Overview → Activity → Net worth → FMI → Family → Scenario lab → Assistant → Dark mode</sub></td>
<td width="28%" align="center"><img src="docs/readme/mobile-tour.gif" alt="Mobile app tour" /><br/><sub><b>Mobile app</b>: Home → Activity → New expense → FMI → Outlook → What-if → Family → AI</sub></td>
</tr>
</table>

> All screenshots are captured from the running apps. Web shots use the seeded **Mehta family** demo household (and a test account for Net worth). Mobile shots come from the iOS simulator capture in [`docs/ux-overhaul/after`](docs/ux-overhaul/after).

---

## ✨ What FINAURA does

The web sidebar and the mobile tab bar group everything the same way: **Money**, **Understand**, **Future**.

### 1. Money: activity, payment methods and net worth

<table>
<tr>
<td width="62%"><img src="docs/readme/web/activity.png" alt="Activity page"/></td>
<td width="38%" valign="top">

**Activity** is your ledger, grouped by month with spent and invested totals per month.

- ✍️ Add an expense by typing plain text: the category and type fill in automatically.
- 🏦 Bank strings work too: UPI, POS, NEFT and IMPS narrations are cleaned before classification.
- 🧠 **Merchant memory**: correct a label once and that merchant stays corrected for you.
- 🔍 Search, filter by category, type and date range (7D … All, or custom).
- 🔁 **Subscription detection**: charges that repeat weekly (5–9 days apart) or monthly (25–35 days) at about the same amount (±10%), three or more times, get a "Track as bill" suggestion.
- 💸 **Income** tab: salary and other receipts, with volatility for gig income.

</td>
</tr>
</table>

<table>
<tr>
<td width="38%" valign="top">

**Net worth** puts everything you own and owe on one page.

- **Assets** grouped into Deposits (FD / RD), Investments, Retirement, Cash & bank, Property & other.
- **FD / RD** values are computed by the server (quarterly compounding) from principal, rate and tenure. They are locked until maturity.
- **SIPs** and market investments get a one-step **Update value** and a monthly check-in reminder.
- Each asset is tagged `FIRE_INVESTABLE`, `SEMI_LIQUID` or `NON_INVESTABLE`, which feeds the retirement corpus and the emergency buffer.
- **Liabilities**: Loans & EMIs (balance, rate, months left), credit cards, bills & subscriptions.

</td>
<td width="62%"><img src="docs/readme/web/networth-assets.png" alt="Net worth page, assets tab"/></td>
</tr>
</table>

**Payment methods** (Profile): UPI IDs, debit cards and credit cards. Only a nickname plus the last 4 digits (or the UPI ID) are stored, never full card numbers or CVV.

- Credit cards have a limit, a statement day and a due day. A purchase over the available limit is blocked.
- The bill is paid with a manual **Pay bill**, which cannot exceed the outstanding amount.
- Existing card debt can be entered as "total used now" plus "unpaid from last statement".
- UPI, debit and cash all move the bank balance. Card spend moves the card's outstanding instead.

<table>
<tr>
<td><img src="docs/readme/web/networth-liabilities.png" alt="Liabilities tab"/><br/><sub>Liabilities: loans, cards, bills</sub></td>
<td><img src="docs/readme/web/committed.png" alt="Committed balance card"/><br/><sub>Overview: "free to use after bills" and upcoming obligations</sub></td>
<td><img src="docs/readme/web/roundups.png" alt="Round-ups"/><br/><sub>Round-ups: spare change into a vault</sub></td>
</tr>
</table>

### 2. Understand: FMI, insights and predictions

<table>
<tr>
<td width="62%"><img src="docs/readme/web/insights-fmi.png" alt="FMI insights"/></td>
<td width="38%" valign="top">

**Financial Maturity Index (FMI)** is a 0–100 score for *this month*, computed with plain math (not ML), so every point can be explained.

| Pillar | Weight | Question it answers |
| :--- | :---: | :--- |
| **D1** Saving Discipline | 40% | Are you saving what your goals need? |
| **D2** Spending Control | 30% | Will you stay inside your budget? |
| **D3** Behavioral Risk | 30% | Impulse, late-night and spiky spending? |

The FMI history chart shows how the score moved and why.

</td>
</tr>
</table>

- **Spending insights**: Needs / Wants / Investments totals, trend chart, category breakdown, spending calendar heatmap.
- **Behaviour**: detected patterns (food spikes, late-night purchases, high-frequency shopping) and anomalous outflows against your own baseline.
- **Check AI guesses**: every label the model wasn't sure about lands in a review queue. Confirming or fixing it teaches merchant memory.
- **Likely next purchases**: association rules (Apriori) over your daily baskets predict what you'll probably buy today and what is often bought together.

<table>
<tr>
<td><img src="docs/readme/web/predicted.png" alt="Likely next purchases"/><br/><sub>Apriori: likely next purchases and rules</sub></td>
<td><img src="docs/readme/web/review.png" alt="Check AI guesses"/><br/><sub>Review queue for low-confidence labels</sub></td>
<td><img src="docs/readme/web/insights-spending.png" alt="Spending insights"/><br/><sub>Spending: Needs / Wants / Investments</sub></td>
</tr>
</table>

### 3. Family and household

<table>
<tr>
<td width="38%" valign="top">

Invite other FINAURA users into a household. Accounts are **never merged**.

- **Household FMI** is computed from pooled income, spending and saving against the pooled requirement. It is not an average of member scores.
- **Who contributes what** splits the household score fairly with **Shapley values**: the household is re-scored with and without each member, and the differences are averaged.
- The **owner** sees each member's rupee amounts. A **member** sees only their own amounts, plus points and percentage shares for the others.
- Raw transactions, assets, liabilities and retirement plans stay private to each person.

</td>
<td width="62%"><img src="docs/readme/web/family-breakdown.png" alt="Family breakdown with Shapley contributions"/></td>
</tr>
</table>

### 4. Future: goals, FIRE and Monte Carlo

<table>
<tr>
<td width="62%"><img src="docs/readme/web/plan-scenarios.png" alt="Scenario lab"/></td>
<td width="38%" valign="top">

- 🎯 **Goals**: targets with dates, the monthly saving each one needs, and progress.
- 🔥 **FIRE**: retirement corpus target, projected corpus at retirement age, projected FIRE age, under conservative, base and optimistic assumptions.
- 🎲 **Monte Carlo**: 10,000 simulated market paths by default (100 to 50,000). The result is the funded probability and P10 / P25 / P50 / P75 / P90 corpus.
- 🧪 **Scenario lab / What-if**: change investment, retirement age, return or inflation and compare with your baseline. Nothing is saved to your profile.
- 📈 Contribution modes: `NOMINAL_FLAT`, `REAL_CONSTANT` (grows with inflation), `STEP_UP` (grows by a yearly %, up to 50%).
- 🧮 **Solvers**: the monthly saving needed for a target confidence, and the earliest age your money lasts to life expectancy.

</td>
</tr>
</table>

<p align="center"><img src="docs/readme/monte-carlo.svg" alt="Animated Monte Carlo fan chart" width="100%"/></p>

### 5. AI assistant, reports and notifications

<table>
<tr>
<td><img src="docs/readme/web/assistant.png" alt="Assistant"/><br/><sub><b>Assistant</b>: factual questions are answered from your data, advice comes from Gemini</sub></td>
<td><img src="docs/readme/web/reports.png" alt="Reports"/><br/><sub><b>Reports</b>: weekly, monthly, history, CSV export, print / PDF</sub></td>
</tr>
</table>

- 🔔 **Notifications** (web bell / mobile Notifications): bills and card dues coming up, family invites, AI guesses to check, and a monthly value check-in for mutual funds, equity, gold, commodities and crypto.
- 🌗 **Light and dark themes** on both apps, plus a 4-step onboarding (about you, income, current balance, retirement target).
- 🌍 **Timezone aware**: card cycles, due dates and reports use the user's timezone (default `Asia/Kolkata`).
- 📱 Mobile extras: **Recap** (a swipeable month story), floating glass tab bar, pull to refresh, haptic celebrations.

---

## 🧭 How it works

### System architecture

```mermaid
flowchart LR
    subgraph Clients
        M["📱 Mobile app<br/>React Native 0.88 · Expo 58<br/>Zustand · Reanimated"]
        W["🖥️ Web app<br/>React 19 · Vite 8<br/>React Router 7 · Recharts"]
    end

    subgraph API["Express API :4000"]
        direction TB
        SEC["Helmet · CORS · rate limits<br/>JWT auth middleware"]
        CTRL["Controllers<br/>transactions · assets · liabilities<br/>family · reports · predictions"]
        SVC["Services<br/>FMI · FamilyFMI · Shapley<br/>Commitments · Subscriptions<br/>MerchantMemory · ChatIntentRouter"]
        SCH["⏱️ LiabilityScheduler<br/>hourly: auto-deduct bills,<br/>refresh FD / RD values"]
        SEC --> CTRL --> SVC
    end

    subgraph ML["ML service :5001 (Flask)"]
        direction TB
        CLS["/classify<br/>rules → v7 bge-base"]
        MC["/simulate<br/>Monte Carlo GBM + solvers"]
        AR["/association-rules<br/>Apriori"]
        FMIE["/fmi-score · /sentiment"]
    end

    DB[("MongoDB :27017<br/>users · transactions · assets<br/>liabilities · families · FMI history")]
    G["✨ Google Gemini<br/>advice only"]
    GD["☁️ Google Drive<br/>model weights on first start"]

    M -- "REST + Bearer JWT" --> SEC
    W -- "REST + Bearer JWT" --> SEC
    SVC <--> DB
    SCH <--> DB
    SVC -- "internal HTTP" --> CLS
    SVC --> MC
    SVC --> AR
    SVC -. "grounded prompt" .-> G
    GD -. "gdown" .-> CLS
```

**Why this split?** The clients only talk to the API. The API owns all data, every user check and all deterministic finance math (FMI, Shapley, bills, cards). Python only does what it is best at: the neural classifier, vectorised Monte Carlo and rule mining. If the ML service is down, the API falls back to a keyword classifier, so recording a transaction never fails.

### Life of a transaction

```mermaid
sequenceDiagram
    autonumber
    actor U as You
    participant App as Mobile / Web
    participant API as Express API
    participant MM as Merchant memory
    participant ML as ML service
    participant DB as MongoDB

    U->>App: "swiggy dinner" · ₹450 · paid with HDFC card
    App->>API: POST /api/transactions
    API->>MM: Have you labelled this merchant before?
    alt you corrected it before
        MM-->>API: your label wins
    else new merchant
        API->>ML: POST /classify
        ML-->>API: Food & Dining · Want · 0.97 · needsReview=false
    end
    API->>API: card limit check, sentiment tags (impulse, late-night)
    API->>DB: save transaction, update card outstanding or bank balance
    API-->>App: 201 + label + confidence
    App-->>U: Shows in Activity. FMI, insights and family totals refresh
    Note over App,API: needsReview=true sends it to "Check AI guesses"
```

### The classifier

<p align="center"><img src="docs/readme/pipeline.svg" alt="Animated classification pipeline" width="100%"/></p>

Every description goes through four layers, from cheapest to most expensive:

1. **Merchant memory** (server, per user): a label you gave this merchant before always wins.
2. **Normalise and rules** (`ml-service/classifier/normalize.py`, `rules.py`): strips UPI / POS / NEFT noise, reference numbers and bank handles, keeps the merchant, then checks known-merchant rules (confidence 0.95–1.0).
3. **FINAURA v7** (`models/finaura-v7-bge-base-en-v1.5`): `BAAI/bge-base-en-v1.5` fine-tuned on about 140k rows to predict one of **21 joint `Category|Type` labels**, with temperature-calibrated probabilities (T = 1.7). The active model is chosen in `models/active_model.json`.
4. **Confidence gate**: joint confidence ≥ **0.78** is auto-accepted (tuned for 95% precision). Anything lower is saved but flagged for review.

If the v7 weights are missing, `model_fetch.py` downloads them from Google Drive on start. If that fails, the pipeline falls back to the legacy TF-IDF + MiniLM heads.

<details>
<summary><b>The 14 categories and allowed types</b></summary>

| Category | Types | Category | Types |
| :--- | :--- | :--- | :--- |
| Food & Dining | Want, Need | Entertainment | Want |
| Groceries | Need, Want | Health | Need, Want |
| Transport & Travel | Need, Want | Education | Need |
| Housing | Need | Personal Care | Want, Need |
| Utilities & Bills | Need | Insurance | Need |
| Debt & Loan Payments | Need | Investments | Investment |
| Shopping | Want, Need | Misc | Need, Want |

</details>

**Accuracy** (from [`research/results/classifier_v7_eval.md`](research/results/classifier_v7_eval.md), rules + model end to end):

| Evaluation set | n | Category acc. | Joint (category + type) acc. | Previous model (v6) joint |
| :--- | ---: | ---: | ---: | ---: |
| Gold v7: realistic Indian narrations | 926 | **94.5%** | **93.7%** | 69.7% |
| Challenge: adversarial | 157 | 98.1% | 98.1% | 93.6% |
| Human-labelled held-out | 140 | 95.7% | 93.6% | 93.6% |
| Synthetic unseen merchants | 3,468 | 90.3% | 83.8% | 92.6% |

Median latency is about 16 ms per transaction on CPU. The gold set was written with an LLM, so treat it as optimistic. The synthetic set has noisy labels, which explains the drop against v6.

### Financial Maturity Index (FMI)

```mermaid
flowchart LR
    TX["This month's<br/>transactions"] --> D1
    GOALS["Goals + FIRE target<br/>→ required monthly saving"] --> D1
    INC["Declared + received<br/>income"] --> D2
    TX --> D2
    TX --> D3
    D1["D1 Saving Discipline<br/>actual saving ÷ required"] -->|"× 0.40"| S
    D2["D2 Spending Control<br/>projected spend vs budget"] -->|"× 0.30"| S
    D3["D3 Behavioral Risk<br/>impulse · late-night · Want share"] -->|"× 0.30"| S
    S(("FMI<br/>0–100")) --> H["FMI history<br/>+ explanations"]
```

$$\text{FMI} = \text{round}(0.40 \cdot D_1 + 0.30 \cdot D_2 + 0.30 \cdot D_3)$$

The FMI uses only month-to-date data, so it moves day by day. Each snapshot is stored in `FMIHistory` with its pillar scores, which is what the "what moved your score" view reads.

### Family FMI and the Shapley breakdown

```mermaid
flowchart TB
    R["Rajesh"] & K["Kavita"] & A["Aarav"] --> POOL["Pool income, spending,<br/>saving and requirement"]
    POOL --> HF["Household FMI = 60"]
    HF --> SH["Shapley: score every subset<br/>{}, {R}, {K}, {A}, {R,K} … {R,K,A}<br/>and average each member's marginal gain"]
    SH --> OUT["R +9.9 · K +38.1 · A +11.7<br/>adds up to 60"]
    OUT --> RED{"Viewer is owner?"}
    RED -->|yes| ALL["Sees all members' ₹ amounts"]
    RED -->|no| OWN["Sees own ₹ amounts,<br/>others as points and % only"]
```

`server/utils/shapley.js` computes exact Shapley values by listing all 2ⁿ subsets (a household has at most 6 members, so at most 64 subsets), with v(∅) = 0. Each member's share is computed for the total score and for each pillar.

### Purchase prediction (Apriori)

```mermaid
flowchart LR
    T["12 months of<br/>transactions"] --> B["One basket per day<br/>{Food & Dining, @swiggy, dow:Fri}"]
    B --> AP["Apriori (pure Python)<br/>support ≥ 0.05 · confidence ≥ 0.4<br/>itemsets up to 3"]
    AP --> RU["Rules with lift > 1<br/>Tea + Fridays → Lunch"]
    TOD["Today's purchases<br/>+ today's weekday"] --> MATCH
    RU --> MATCH["Rules whose left side<br/>you've already hit today"]
    MATCH --> RANK["Rank by m-estimate confidence (m = 2)<br/>fill gaps with your most frequent buys"]
    RANK --> UI["Likely next purchases"]
```

Baskets skip bill payments and investments because those are scheduled, not chosen. Merchants count as items only after they appear on 3 or more days. At least 14 baskets are needed. The weekday item lets rules fire before you've bought anything today.

### Monte Carlo retirement engine

- **Median-anchored geometric Brownian motion**: yearly returns are lognormal and scaled so that the median path matches plain compound growth. The simple projection and the simulation therefore agree on the middle case.
- **Common Random Numbers**: the baseline and each scenario use the same random draws, so the difference between them shows the effect of the change and not sampling noise. In testing this cut the variance of the difference estimate by **29.09%** (30 batches × 2,000 paths).
- **Solvers**: `contribution_solver.py` finds the monthly saving that reaches a target probability. `funded_age_solver.py` finds the earliest age at which the corpus lasts to life expectancy.
- Up to 50,000 paths per request, vectorised in NumPy.

### Bills, cards and deposits

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Scheduled: liability saved (autoDeduct on)
    Scheduled --> Claimed: hourly scheduler finds a due occurrence
    Claimed --> Paid: transaction created, bank balance reduced
    Claimed --> Scheduled: worker died, claim recovered after 10 min
    Paid --> Scheduled: next due date computed (user timezone)
    Scheduled --> Manual: autoDeduct off, you record the payment
    Manual --> Scheduled
```

- **Committed balance** = this month's remaining auto-deduct bills. The Overview shows "still to be deducted", "free to use after bills" and "already deducted". Card dues, SIPs and manual bills are left out because the scheduler never debits them.
- **Credit card cycle** (`server/utils/creditCycle.js`): a statement covers purchases up to the statement day, and the bill is due on the next due day after it. Payments clear billed amounts first.
- **FD / RD**: quarterly compounding (`server/utils/fixedIncome.js`), refreshed on every read and hourly by the scheduler.

### AI assistant routing

```mermaid
flowchart LR
    Q["Your question"] --> IR{"ChatIntentRouter<br/>is it a factual question?"}
    IR -->|"What's my balance? FMI?<br/>Spent on food? Bills due?"| DET["Answer straight from your data<br/>no LLM call"]
    IR -->|"Advice / why / how"| CTX["ChatContextService<br/>verified read-only figures"]
    CTX --> GEM["Gemini 1.5 Flash<br/>told not to recompute numbers"]
    GEM --> A["Answer + saved chat history"]
    DET --> A
```

Without `GEMINI_API_KEY`, factual questions still work. Advice questions return a clear "not configured" message.

### Authentication

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant D as MongoDB
    C->>A: POST /auth/login (email, password)
    A->>D: bcrypt compare · lockout after 5 failures (15 min)
    A-->>C: access JWT (15 min) + refresh token (7 days)
    C->>A: any /api call with Bearer access token
    A->>A: verify JWT, scope every query to req.user.id
    C->>A: POST /auth/refresh (when the access token expires)
    A->>D: refresh token stored as SHA-256 hash, single use
    A-->>C: new pair, old one revoked (reuse is detected)
```

### Data model

```mermaid
erDiagram
    USER ||--o{ TRANSACTION : records
    USER ||--o{ INCOME : receives
    USER ||--o{ ASSET : owns
    USER ||--o{ LIABILITY : owes
    USER ||--o{ PAYMENT_METHOD : pays_with
    USER ||--o{ GOAL : plans
    USER ||--o{ FMI_HISTORY : scored
    USER ||--o{ MERCHANT_PREFERENCE : corrects
    USER ||--o{ ALERT : notified
    USER }o--o| FAMILY : "member of"
    FAMILY ||--o{ FAMILY_INVITATION : sends
    LIABILITY ||--o{ TRANSACTION : "auto-deducts"
    PAYMENT_METHOD ||--o{ TRANSACTION : "paid via"
    TRANSACTION {
        string description
        number amount
        string category
        string type "Need | Want | Investment"
        number confidenceScore
        bool needsReview
        string paymentMethodId
    }
    ASSET {
        string assetType "FD, RD, Mutual Fund..."
        string assetClass "FIRE_INVESTABLE..."
        bool includedInFireCorpus
        number currentValue
        number monthlyContribution "SIP / RD"
        number tenureMonths
        string liquidity "liquid | locked"
    }
    LIABILITY {
        number amount
        string frequency
        bool autoDeduct
        date nextDueDate
        number outstandingBalance
    }
```

---

## 🖼️ Screenshot gallery

<details open>
<summary><b>🖥️ Web app</b></summary>
<br/>

| | | |
| :---: | :---: | :---: |
| <img src="docs/readme/web/landing.png" alt="Landing"/><br/><sub>Landing</sub> | <img src="docs/readme/web/login.png" alt="Login"/><br/><sub>Sign in</sub> | <img src="docs/readme/web/overview.png" alt="Overview"/><br/><sub>Overview</sub> |
| <img src="docs/readme/web/overview-dark.png" alt="Overview dark"/><br/><sub>Overview, dark</sub> | <img src="docs/readme/web/activity-income.png" alt="Income"/><br/><sub>Income streams</sub> | <img src="docs/readme/web/networth-breakdown.png" alt="Net worth breakdown"/><br/><sub>Net worth breakdown</sub> |
| <img src="docs/readme/web/insights-behaviour.png" alt="Behaviour"/><br/><sub>Behaviour patterns</sub> | <img src="docs/readme/web/family.png" alt="Family"/><br/><sub>Family & household</sub> | <img src="docs/readme/web/plan-goals.png" alt="Goals"/><br/><sub>Goals</sub> |
| <img src="docs/readme/web/plan-fire.png" alt="FIRE"/><br/><sub>FIRE projection</sub> | <img src="docs/readme/web/profile.png" alt="Profile"/><br/><sub>Profile & payment methods</sub> | <img src="docs/readme/web/review.png" alt="Review"/><br/><sub>Check AI guesses</sub> |

</details>

<details open>
<summary><b>📱 Mobile app</b></summary>
<br/>

| | | | | |
| :---: | :---: | :---: | :---: | :---: |
| <img src="docs/readme/mobile/login.png" alt="Login"/><br/><sub>Sign in</sub> | <img src="docs/readme/mobile/onboarding.png" alt="Onboarding"/><br/><sub>Onboarding</sub> | <img src="docs/readme/mobile/home.png" alt="Home"/><br/><sub>Home</sub> | <img src="docs/readme/mobile/home-spending.png" alt="Home spending"/><br/><sub>Spending this month</sub> | <img src="docs/readme/mobile/new-expense.png" alt="New expense"/><br/><sub>New expense</sub> |
| <img src="docs/readme/mobile/activity.png" alt="Activity"/><br/><sub>Activity</sub> | <img src="docs/readme/mobile/review.png" alt="Review"/><br/><sub>Check AI guesses</sub> | <img src="docs/readme/mobile/fmi.png" alt="FMI"/><br/><sub>Financial Maturity</sub> | <img src="docs/readme/mobile/fmi-detail.png" alt="FMI detail"/><br/><sub>FMI explained</sub> | <img src="docs/readme/mobile/insights.png" alt="Insights"/><br/><sub>Insights</sub> |
| <img src="docs/readme/mobile/plan.png" alt="Plan"/><br/><sub>Plan</sub> | <img src="docs/readme/mobile/outlook.png" alt="Outlook"/><br/><sub>Future outlook</sub> | <img src="docs/readme/mobile/whatif.png" alt="What-if"/><br/><sub>What-if lab</sub> | <img src="docs/readme/mobile/goals.png" alt="Goals"/><br/><sub>Goals</sub> | <img src="docs/readme/mobile/income.png" alt="Income"/><br/><sub>Income & 50/30/20</sub> |
| <img src="docs/readme/mobile/bills.png" alt="Bills"/><br/><sub>Bills</sub> | <img src="docs/readme/mobile/assets.png" alt="Assets"/><br/><sub>Assets</sub> | <img src="docs/readme/mobile/family.png" alt="Family"/><br/><sub>Family</sub> | <img src="docs/readme/mobile/chat.png" alt="AI chat"/><br/><sub>FINAURA AI</sub> | <img src="docs/readme/mobile/notifications.png" alt="Notifications"/><br/><sub>Notifications</sub> |
| <img src="docs/readme/mobile/roundups.png" alt="Round-ups"/><br/><sub>Round-ups</sub> | <img src="docs/readme/mobile/recap.png" alt="Recap"/><br/><sub>Month recap</sub> | <img src="docs/readme/mobile/profile.png" alt="Profile"/><br/><sub>You</sub> | <img src="docs/readme/mobile/home-dark.png" alt="Home dark"/><br/><sub>Home, dark</sub> | <img src="docs/readme/mobile/fmi-dark.png" alt="FMI dark"/><br/><sub>FMI, dark</sub> |

</details>

---

## 🧰 Technology stack

| Layer | Technologies |
| :--- | :--- |
| **Mobile** | React Native 0.88, Expo SDK 58, React 19.3, React Navigation 6, Zustand 5, Reanimated 4, react-native-svg, Expo SecureStore, TypeScript 6 |
| **Web** | React 19, Vite 8, React Router 7, Recharts 3, Lucide, TypeScript 6 |
| **API** | Node.js ≥ 18, Express 4.22, Mongoose 8.12, Zod 4, Helmet 8, express-rate-limit 8, jsonwebtoken 9, bcryptjs 3, Nodemailer |
| **Database** | MongoDB 6+ or MongoDB Atlas |
| **ML service** | Python 3.9+, Flask 3.1, PyTorch + Hugging Face Transformers (`BAAI/bge-base-en-v1.5` fine-tune), sentence-transformers, scikit-learn, NumPy, Pandas, gdown |
| **AI** | `@google/generative-ai` (Gemini 1.5 Flash) behind a deterministic intent router |
| **Tooling** | Oxlint, `tsc`, plain-Node and Python test scripts, shell orchestration in `scripts/` |

---

## 🗂️ Repository structure

```
LYProj_C34/
├── client/                 # 📱 React Native / Expo app
│   └── src/
│       ├── screens/        #   Dashboard, Transactions, NetWorth, Fmi, Family, Chat, Recap, …
│       ├── components/     #   ui/ (Aurora glass kit), motion/, bills/, family/, outlook/
│       ├── navigation/     #   floating tab bar: Home · Activity · + · Plan · AI
│       └── store/          #   Zustand stores (auth, theme, data)
├── web/                    # 🖥️ React 19 / Vite app
│   └── src/
│       ├── pages/          #   Overview, Activity, NetWorth, Insights, Family, Plan, Reports, …
│       ├── components/     #   dashboard/, activity/, insights/, family/, plan/, reports/
│       └── hooks/ utils/   #   data hooks, timezone, month grouping, due alerts
├── server/                 # 🔌 Express API
│   ├── controllers/        #   route handlers
│   ├── services/           #   FMI, FamilyFMI, Commitment, PurchasePrediction, Subscription,
│   │                       #   MerchantMemory, ChatIntentRouter, LiabilityScheduler, …
│   ├── utils/              #   shapley.js, creditCycle.js, fixedIncome.js, financialMath.js, userTime.js
│   ├── models/             #   Mongoose schemas
│   └── scripts/            #   seedDemoFamily.js, migrate_indexes.js
├── ml-service/             # 🧠 Flask ML service
│   ├── api.py              #   /classify /simulate /association-rules /fmi-score /sentiment /health
│   ├── classifier/         #   hybrid_pipeline.py, normalize.py, rules.py, training scripts
│   ├── models/             #   finaura-v7-bge-base-en-v1.5 (downloaded), active_model.json
│   ├── monte_carlo.py      #   GBM engine · contribution_solver.py · funded_age_solver.py
│   ├── association_rules.py#   Apriori
│   └── evaluation/ benchmarks/ tests/
├── research/               # 📑 benchmark scripts, results, figures
├── docs/                   # 📸 README assets, UX before/after
├── scripts/                # 🛠️ dev-check.sh, dev-start.sh, dev-stop.sh
├── SECURITY.md
└── README.md
```

---

## 🚀 Getting started

### Prerequisites

- **Node.js** 18+ (20+ recommended) and npm 9+
- **Python** 3.9+ with `pip` and `venv`
- **MongoDB** 6+ on `localhost:27017`, or an Atlas URI
- About 1 GB free for the v7 model (downloaded automatically on first start)
- Optional: Xcode / Android Studio or Expo Go for the mobile app

### Install

```bash
git clone https://github.com/parthpalav/LYProj_C34.git
cd LYProj_C34

(cd server && npm install)
(cd web && npm install)
(cd client && npm install)

cd ml-service
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### Configure

Copy each `.env.example` to `.env`.

<details>
<summary><b><code>server/.env</code></b></summary>

| Variable | Required | Default / example | What it does |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `4000` | API port |
| `NODE_ENV` | No | `development` | `development`, `production` or `test` |
| `MONGO_URI` | Yes in prod | `mongodb://127.0.0.1:27017/lyproj` | MongoDB connection (must not be localhost in production) |
| `JWT_SECRET` | **Yes** | `openssl rand -hex 32` | Signs access tokens, at least 32 characters |
| `ALLOWED_ORIGINS` | Yes in prod | `http://localhost:5173,http://127.0.0.1:5173` | CORS allowlist |
| `BCRYPT_ROUNDS` | No | `10` | Password hashing cost |
| `ML_SERVICE_URL` | No | `http://localhost:5001` | ML service address |
| `GEMINI_API_KEY` | No | none | Turns on advice answers in the assistant |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | No | `smtp.mailtrap.io` / `587` / – / – / `false` | Email verification and password reset |
| `EMAIL_FROM` | No | `"FINAURA Security <no-reply@finaura.app>"` | Sender address |
| `APP_BASE_URL` | No | `http://localhost:4000` | Base URL used in email links |

</details>

<details>
<summary><b><code>ml-service/.env</code>, <code>web/.env</code>, <code>client/.env</code></b></summary>

| File | Variable | Default | What it does |
| :--- | :--- | :--- | :--- |
| `ml-service/.env` | `FLASK_APP` | `api.py` | Flask entry point |
| `ml-service/.env` | `MODEL_BACKEND` | `legacy` | `legacy` loads the hybrid pipeline: rules, then the model in `models/active_model.json` (v7), then TF-IDF / MiniLM as fallback |
| `web/.env` | `VITE_API_URL` | `http://localhost:4000` | API base URL |
| `client/.env` | `EXPO_PUBLIC_API_URL` | Expo host | Set to your computer's LAN IP when using a real phone |

</details>

### Run

**Automated (recommended)**: needs MongoDB already running.

```bash
./scripts/dev-check.sh    # checks runtimes, ports, secrets, model weights
./scripts/dev-start.sh    # ML :5001 → API :4000 → web :5173, waits until each is healthy
./scripts/dev-stop.sh     # stops all three
```

Logs go to `.logs/ml-service.log`, `.logs/server.log` and `.logs/web.log`.

**Manual**: one terminal each.

```bash
brew services start mongodb-community          # or: mongod --dbpath /data/db
cd ml-service && source .venv/bin/activate && python3 api.py
cd server && npm start
cd web && npm run dev                          # http://localhost:5173
cd client && npm start                         # i = iOS sim, a = Android, or scan with Expo Go
```

### Demo data

Seed a three-person household with 12 months of history. Every entry goes through the live classifier, so the API and the ML service must be running.

```bash
cd server
node scripts/seedDemoFamily.js --probe   # classify every description, write nothing
node scripts/seedDemoFamily.js           # seed (refuses if the accounts exist)
node scripts/seedDemoFamily.js --reset   # delete the demo accounts, then seed again
```

This creates `rajesh.mehta@example.com` (household owner), `kavita.mehta@example.com` and `aarav.mehta@example.com`, all with the password `Demo#2026`, in the "Mehta Family". Use these accounts only on a local database.

---

## 🧪 Testing

```bash
npm run test:core          # client + web + ML (fast, no services needed)
npm run test:client        # 17 mobile UX / navigation suites
npm run test:web           # 5 web suites (due alerts, date ranges, month groups, family, CSV)
npm run test:ml            # 9 ML suites (classifier, normalisation, Monte Carlo, solvers, Apriori, security)
npm run test:server        # 30 API suites (FMI, family, Shapley, liabilities, cards, assets, predictions, auth)
npm run test:integration   # API ↔ ML contracts (needs MongoDB + ML service running)
npm run test:research      # research acceptance audit
```

> ⚠️ Some server suites clear the `Liability` and `Transaction` collections. Point them at a separate database, for example `MONGO_URI=mongodb://127.0.0.1:27017/lyproj_test npm run test:server`, so your demo data survives.

Type-check and lint:

```bash
npm --prefix web run typecheck && npm --prefix web run lint
npm --prefix client run typecheck
```

---

## 📑 Research and benchmarks

`research/` holds reproduction scripts, results and figures. See [`research/README.md`](research/README.md).

```bash
python3 research/scripts/generate_benchmarks.py
```

- **Classifier history**: v4 → v5 → v6 → v7 evaluations in `research/results/classifier_v*_eval.md`.
- **Common Random Numbers**: 29.09% lower variance on scenario differences.
- **Family FMI characterisation**: shows why pooling beats averaging (`research/results/family_fmi_characterisation.csv`). For example, if one partner saves a lot and the other spends a lot, an average hides the household's real cash flow. Pooling shows it.

---

## 🔒 Security

Full details are in [SECURITY.md](SECURITY.md).

- **Tokens**: 15-minute HS256 access JWTs. Refresh tokens last 7 days, rotate on each use, are stored as SHA-256 hashes, and reuse is detected.
- **Passwords**: bcrypt (cost 10), `select: false` on the schema, 15-minute lockout after 5 failed logins.
- **HTTP**: Helmet headers (HSTS in production), strict CORS allowlist, 1 MB body limit (4.5 MB only for avatar upload).
- **Rate limits**: separate limiters for auth, password reset, AI chat, classification and scenario runs.
- **Isolation**: every query is scoped to `req.user.id` from the verified token. Family views are redacted on the server.
- **Cards**: only a nickname and the last 4 digits are stored, never full numbers or CVV.
- **Logs**: tokens, passwords, secrets and API keys are redacted.

## 🛡️ Privacy model

1. **Separate accounts**: joining a family never merges logins or data.
2. **Raw data stays private**: members never see each other's transactions, income sources, assets or debts.
3. **Pooled numbers only**: the household view shows totals, Household FMI and Shapley points. Only the owner sees rupee amounts per member.
4. **Retirement is personal**: there is no family FIRE. Each person's retirement plan is private.

## ⚠️ Current limitations

- **No live bank feeds**: transactions are entered by hand, pasted, or created by scheduled bills. There is no Account Aggregator or Plaid connection.
- **Training data is mostly synthetic or LLM-labelled**, based on real Indian merchant and UPI patterns. Accuracy on a real personal bank statement has not been measured yet.
- **Rate limits are in memory**: running several API instances would need a shared store such as Redis.
- **The web app keeps tokens in `sessionStorage`**, not HttpOnly cookies.
- **Projections assume lognormal returns** and do not model market regime shifts.

## 📜 Disclaimer

FINAURA is an educational and research project. Scores, projections and AI answers are for information and demonstration only. They are not financial, investment, tax or legal advice.

## 👥 Contributors

**Project team** (K. J. Somaiya School of Engineering, Somaiya Vidyavihar University)
- Parth Palav (16010123229)
- Neekunj Zavar (16010123210)
- Rahee Bhoomkar (16010123246)

**Project guide**: Prof. Shweta Dhawan Chachra, Department of Computer Engineering

## License

No open-source license is provided. All rights reserved by the authors. For academic or evaluation enquiries, contact the maintainers.
