# FINAURA MVP

FINAURA is a proactive financial companion app that builds a Financial Digital Twin, classifies spending, calculates FMI, tracks retirement feasibility, and provides a rule-based chatbot.

## Run Instructions

Server (Node + Express + MongoDB):

```bash
cd FINAURA/server
npm install
npm run dev
```

Client (Expo + React Native):

```bash
cd FINAURA/client
npm install
npx expo start
```

## Notes

- MongoDB is expected at `mongodb://127.0.0.1:27017/finaura` (configurable via `MONGODB_URI`).
- JWT secret can be set with `JWT_SECRET`.
- The MVP uses rule-based models in `server/src/services/` for easy replacement with ML models later.
