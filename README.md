# LY Project C34: Financial Wellness Platform

A comprehensive financial management and wellness platform for personal finance tracking, retirement planning, and intelligent spending insights.

## Architecture Overview

The platform consists of three integrated components:

### 1. **React Native Mobile Client** (`/client`)
- Cross-platform iOS/Android app using Expo
- Real-time dashboard with FMI score, spending trends, and alerts
- Features:
	- Onboarding flow (income, retirement goals, DOB)
	- Transaction entry and categorization
	- FMI wellness meter
	- Spending analytics and envelope budgeting
	- Goal tracking
	- Chat assistant integration

### 2. **Node.js/Express Backend** (`/server`)
- REST API on port 4000
- MongoDB persistence for user data
- Controllers: dashboard, transactions, FMI, goals, envelopes, profiles
- Services layer for business logic
	- `FMIService.js`: Calls FMI microservice
	- Transaction classification
	- Behavior analytics
	- Prediction and recommendations
- Models: User, Transaction, Income, Goal, Envelope, Alert, FMIHistory

### 3. **Python/Flask ML Microservice** (`/ml-service`)
- Runs on port 5001
- **FMI Scoring Engine:** Transparent, mathematically-grounded financial wellness index
- **Expense Classification:** TF-IDF + LogReg for automatic category prediction
- **NLP Services:** Sentiment analysis and chat support

## Financial Maturity Index (FMI)

### What is FMI?

FMI is a **transparent financial wellness score** (0-100) that measures retirement readiness:
- **FMI = 50:** User is on track to meet retirement goal
- **FMI < 50:** User is behind target (needs intervention)
- **FMI > 50:** User is ahead of target (exceeding goals)

### How FMI Works

FMI uses **financial mathematics** to compute retirement readiness:

1. **Required Monthly Contribution**: Uses Future Value equation to calculate how much user must save monthly to hit retirement goal
	 ```
	 FV = PV(1+r)^n + PMT * [((1+r)^n - 1) / r]
   
	 Solves for PMT = required monthly contribution
	 ```

2. **Savings Ratio**: Compares actual savings (including investments) to required amount

3. **Scoring Adjustments**:
	 - Debt penalty (higher debt reduces score)
	 - Consistency bonus (regular savers get bonus)
	 - Readiness adjustment (surpassing goal gets bonus)

4. **Status Bands**:
	 | Score | Status | Meaning |
	 |-------|--------|---------|
	 | 0–30 | Critical | Severely behind |
	 | 31–45 | Behind | Trending behind |
	 | 46–55 | On Track | Meeting goals |
	 | 56–75 | Ahead | Exceeding targets |
	 | 76–100 | Excellent | Well ahead |

### Why Not ML?

The initial implementation attempted supervised ML with engineered labels, which had critical flaws:
- **No ground truth:** No real retirement outcomes in dataset
- **Label leakage:** Features directly used in label formula
- **Perfect accuracy:** ~0.998 R² indicated model was just inverting the formula, not learning patterns

**Solution:** Transparent scoring engine based on financial principles, not ML approximation.

For detailed architecture rationale, see [ml-service/FMI_ARCHITECTURE.md](ml-service/FMI_ARCHITECTURE.md).

## Setup & Installation

### Prerequisites
- Node.js 18+
- Python 3.9+
- MongoDB (local or Atlas)
- npm/yarn

### Backend Setup

```bash
# Navigate to server
cd server

# Install dependencies
npm install

# Create .env file with MongoDB connection
# .env:
# MONGODB_URI=mongodb://localhost:27017/lyproj
# PORT=4000
# ML_SERVICE_URL=http://localhost:5001

# Seed database (optional)
npm run seed

# Start server
npm start
```

Server runs on `http://localhost:4000`

### ML Microservice Setup

```bash
# Navigate to ml-service
cd ml-service

# Create Python environment (optional)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Train expense classifier (one-time)
python3 train_classifier.py

# Start Flask service
python3 api.py
```

Service runs on `http://localhost:5001`

### Mobile Client Setup

```bash
# Navigate to client
cd client

# Install dependencies
npm install

# Start Expo server
npm start

# On iOS:
# Press 'i' to open iOS simulator
# Or scan QR code with Expo Go app

# On Android:
# Press 'a' to open Android emulator
# Or scan QR code with Expo Go app
```

## API Documentation

### FMI Endpoint

**POST** `http://localhost:5001/fmi-score`

Calculate Financial Maturity Index for a user profile.

**Request:**
```json
{
	"age": 45,
	"retirement_age": 65,
	"current_retirement_savings": 500000,
	"retirement_goal": 2000000,
	"monthly_income": 8000,
	"monthly_savings": 1500,
	"investment_contribution": 500,
	"debt": 50000,
	"savings_consistency": 0.8,
	"annual_interest_rate": 0.05,
	"annual_inflation_rate": 0.03
}
```

**Response:**
```json
{
	"score": 60.55,
	"status": "Ahead",
	"required_monthly_savings": 1566.0,
	"actual_monthly_savings": 2000.0,
	"monthly_gap": 434.0,
	"projected_retirement_corpus": 2178387.48,
	"years_remaining": 20,
	"months_remaining": 240,
	"savings_rate_performance": 1.277,
	"debt_to_income_ratio": 0.026,
	"savings_consistency_score": 0.7,
	"retirement_readiness_pct": 108.92,
	"assumptions": {...},
	"warnings": []
}
```

### Expense Classification Endpoint

**POST** `http://localhost:5001/classify`

Classify expense transactions using TF-IDF + LogReg.

**Request:**
```json
{
	"text": "500rs pizza"
}
```

**Response:**
```json
{
	"category": "Food",
	"confidence": 0.92,
	"all_probs": {...},
	"sentiment": "negative",
	"sentiment_emoji": "🔴",
	"sentiment_label": "Watch Out",
	"verdict": "Discretionary spend — think before you pay!"
}
```

### Dashboard API

**GET** `http://localhost:4000/dashboard`

Get complete financial dashboard with FMI, transactions, and trends.

## Database Schema

### User
```javascript
{
	_id: ObjectId,
	email: String,
	age: Number,
	retirementAge: Number,
	monthlyIncome: Number,
	createdAt: Date
}
```

### Transaction
```javascript
{
	_id: ObjectId,
	userId: ObjectId,
	amount: Number,
	category: String,
	description: String,
	date: Date,
	isRecurring: Boolean
}
```

### FMIHistory
```javascript
{
	_id: ObjectId,
	userId: ObjectId,
	fmiScore: Number,
	status: String,
	factorsSnapshot: Object,
	calculatedAt: Date
}
```

## ML Models

### Expense Classifier
- **Algorithm:** TF-IDF + Logistic Regression
- **Features:** 5000 TF-IDF features (unigrams + bigrams)
- **Training Data:** 343 expense descriptions
- **Categories:** 10 (Food, Travel, Entertainment, Shopping, Bills, Groceries, Health, Party, Education, Misc)
- **Artifact:** `ml-service/classifier_model.pkl`, `ml-service/tfidf_vectorizer.pkl`

### FMI Scoring Engine
- **Type:** Deterministic (NOT supervised ML)
- **Foundation:** Future Value equations from corporate finance
- **Inputs:** 10 financial profile fields
- **Outputs:** 0-100 score + explainability factors
- **No training required:** Pure mathematical computation
- **Code:** `ml-service/fmi_engine.py`

## Development Workflow

### Running All Services

```bash
# Terminal 1: Backend
cd server && npm start

# Terminal 2: ML Service
cd ml-service && python3 api.py

# Terminal 3: Mobile
cd client && npm start
```

### Testing

```bash
# Test FMI calculation directly
cd ml-service
python3 -c "from fmi_engine import calculate_fmi; r = calculate_fmi(age=45, retirement_age=65, current_retirement_savings=500000, retirement_goal=2000000, monthly_income=8000, monthly_savings=1500); print(f'FMI: {r.score} ({r.status})')"

# Test backend FMI endpoint
curl -X GET http://localhost:4000/fmi -H "Authorization: Bearer {token}"

# Test classification
curl -X POST http://localhost:5001/classify -H "Content-Type: application/json" -d '{"text":"500 coffee"}'
```

## Project Structure

```
├── client/                  # React Native / Expo mobile app
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── screens/         # Screen components
│   │   ├── navigation/       # Navigation stacks
│   │   ├── services/        # API integration
│   │   ├── store/           # Zustand state management
│   │   └── types/           # TypeScript types
│   └── App.tsx
│
├── server/                  # Node.js Express backend
│   ├── controllers/         # Route handlers
│   ├── models/              # MongoDB schemas
│   ├── services/            # Business logic
│   ├── config/              # Database config
│   ├── routes/              # API routes
│   └── index.js             # Express app entry
│
└── ml-service/              # Python Flask microservice
		├── fmi_engine.py        # FMI scoring logic
		├── api.py               # Flask endpoints
		├── classifier_model.pkl # Trained model
		├── train_classifier.py  # Training script
		└── requirements.txt     # Python dependencies
```

## Key Files

- **FMI Architecture:** [ml-service/FMI_ARCHITECTURE.md](ml-service/FMI_ARCHITECTURE.md)
- **FMI Engine:** [ml-service/fmi_engine.py](ml-service/fmi_engine.py)
- **FMI Service:** [server/services/FMIService.js](server/services/FMIService.js)
- **FMI Endpoint:** [ml-service/api.py](ml-service/api.py) - POST `/fmi-score`

## Academic Integrity

This project demonstrates proper engineering judgment in technology selection:
- ✅ **Explainable:** FMI uses documented financial mathematics
- ✅ **No label leakage:** Features independent from scoring formula
- ✅ **Legitimate ML:** Expense classification uses real supervised learning
- ✅ **Transparent:** Every calculation is auditable and reproducible
- ✅ **Defensible:** Rejects inappropriate ML approaches (engineered labels)

## Future Enhancements

### ML Integration Opportunities
- Behavioral prediction: Forecast savings consistency from transaction history
- Expense forecasting: ML model for spending trends
- Anomaly detection: Flag unusual spending patterns
- Personalized recommendations: Suggest category-specific savings opportunities

### Platform Features
- Multi-currency support
- Bill reminder and autopay
- Investment portfolio tracking
- Collaborative budgeting
- Mobile notifications
- Data export and reporting

## License

[Your License Here]

## Contact

For questions or contributions, contact the development team.