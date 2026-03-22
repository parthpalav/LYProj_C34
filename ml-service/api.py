from flask import Flask, jsonify, request

from fmi_model import compute_fmi
from predictor import detect_threshold_alerts
from sentiment import score_sentiment

app = Flask(__name__)


@app.get('/health')
def health():
    return jsonify({'ok': True, 'service': 'ml-service'})


@app.post('/sentiment')
def sentiment_endpoint():
    payload = request.get_json(force=True)
    text = payload.get('text', '')
    score = score_sentiment(text)
    return jsonify({'score': score})


@app.post('/fmi')
def fmi_endpoint():
    payload = request.get_json(force=True)
    score = compute_fmi(
        sentiment=float(payload.get('sentiment', 0.0)),
        spending_deviation=float(payload.get('spending_deviation', 0.0)),
        income_stability=float(payload.get('income_stability', 0.0)),
        upcoming_bills=float(payload.get('upcoming_bills', 0.0)),
    )
    return jsonify({'score': score})


@app.post('/predict')
def predict_endpoint():
    payload = request.get_json(force=True)
    series = payload.get('spending_series', [])
    balance = float(payload.get('balance', 0))
    prediction = detect_threshold_alerts(series, balance)
    return jsonify(prediction)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
