"""FMI feature engineering, label construction, and inference helpers.

The old rule-based FMI formula has been removed. This module now provides the
shared implementation for the retirement-progress ML pipeline used by both the
training script and the Flask prediction API.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
import math
import pickle
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


RETIREMENT_AGE = 65
EXPECTED_ANNUAL_RETURN = 0.075
MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "fmi_model.pkl"
PREPROCESSOR_PATH = MODEL_DIR / "fmi_preprocessor.pkl"
FEATURE_INFO_PATH = MODEL_DIR / "fmi_feature_info.json"

NUMERIC_FEATURES = [
    "age",
    "monthly_income",
    "monthly_expenses",
    "monthly_savings",
    "debt",
    "retirement_goal",
    "current_retirement_savings",
    "investment_contribution",
    "loan_term_months",
    "monthly_emi",
    "loan_interest_rate",
    "debt_to_income_ratio",
    "credit_score",
    "savings_to_income_ratio",
    "expense_ratio",
    "savings_rate",
    "debt_burden_ratio",
    "retirement_horizon_years",
    "required_monthly_retirement_savings",
    "projected_years_to_goal",
    "trajectory_gap_years",
    "retirement_gap",
    "retirement_gap_ratio",
    "food_spend_ratio",
    "entertainment_spend_ratio",
    "shopping_spend_ratio",
    "essential_spend_ratio",
    "discretionary_spend_ratio",
    "essential_vs_discretionary_ratio",
    "income_stability_proxy",
    "spend_volatility_proxy",
    "record_year",
    "record_month",
]

CATEGORICAL_FEATURES = [
    "gender",
    "education_level",
    "employment_status",
    "job_title",
    "has_loan",
    "loan_type",
    "region",
]

MODEL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
TARGET_COLUMN = "fmi_score"


def _series(frame: pd.DataFrame, column: str, default: Any) -> pd.Series:
    if column in frame.columns:
        return frame[column]
    return pd.Series([default] * len(frame), index=frame.index)


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        if isinstance(value, str) and not value.strip():
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        if isinstance(value, str) and not value.strip():
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _as_str(value: Any, default: str = "Unknown") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _is_yes(value: Any) -> int:
    return int(_as_str(value).lower() in {"yes", "true", "1", "y"})


def _clip(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _estimate_category_mix(expense_ratio: float, age: float, has_loan_flag: int, employment_status: str, job_title: str) -> dict[str, float]:
    job_title = job_title.lower()
    employment_status = employment_status.lower()

    weights = {
        "food_spend_ratio": 0.18 + (0.03 if age < 35 else 0.0) + (0.02 if job_title in {"student", "driver"} else 0.0),
        "entertainment_spend_ratio": 0.08 + (0.03 if age < 32 else 0.0),
        "shopping_spend_ratio": 0.12 + (0.03 if has_loan_flag else 0.0) + (0.01 if employment_status == "self-employed" else 0.0),
        "essential_spend_ratio": 0.28 + (0.02 if has_loan_flag else 0.0),
        "groceries_spend_ratio": 0.18 + (0.02 if employment_status == "student" else 0.0),
        "health_spend_ratio": 0.08 + (0.02 if age >= 50 else 0.0),
        "other_spend_ratio": 0.18,
    }

    total_weight = sum(weights.values()) or 1.0
    ratios = {key: expense_ratio * value / total_weight for key, value in weights.items()}
    essential = ratios["essential_spend_ratio"] + ratios["groceries_spend_ratio"] + ratios["health_spend_ratio"]
    discretionary = ratios["food_spend_ratio"] + ratios["entertainment_spend_ratio"] + ratios["shopping_spend_ratio"]

    ratios["essential_spend_ratio"] = essential
    ratios["discretionary_spend_ratio"] = discretionary
    ratios["essential_vs_discretionary_ratio"] = essential / max(discretionary, 0.05)

    return ratios


def _project_years_to_goal(current_retirement_savings: float, monthly_contribution: float, retirement_goal: float, annual_return: float = EXPECTED_ANNUAL_RETURN) -> float:
    if retirement_goal <= 0:
        return 0.0
    if current_retirement_savings >= retirement_goal:
        return 0.0

    monthly_rate = annual_return / 12.0
    if monthly_rate <= 0:
        if monthly_contribution <= 0:
            return 50.0
        return max(0.0, (retirement_goal - current_retirement_savings) / monthly_contribution / 12.0)

    if monthly_contribution <= 0:
        if current_retirement_savings <= 0:
            return 50.0
        months = math.log(retirement_goal / current_retirement_savings) / math.log1p(monthly_rate)
        return max(0.0, months / 12.0)

    growth_factor = monthly_contribution / monthly_rate
    numerator = retirement_goal + growth_factor
    denominator = current_retirement_savings + growth_factor
    if denominator <= 0 or numerator <= denominator:
        return 0.0

    months = math.log(numerator / denominator) / math.log1p(monthly_rate)
    return max(0.0, months / 12.0)


def _normalise_record_date(frame: pd.DataFrame) -> pd.DataFrame:
    normalised = frame.copy()
    record_dates = pd.to_datetime(_series(normalised, "record_date", "2024-06-01"), errors="coerce")
    normalised["record_year"] = record_dates.dt.year.fillna(2024).astype(int)
    normalised["record_month"] = record_dates.dt.month.fillna(6).astype(int)
    return normalised


def _canonicalise_columns(frame: pd.DataFrame) -> pd.DataFrame:
    normalised = frame.copy()
    rename_map = {
        "monthly_income_usd": "monthly_income",
        "monthly_expenses_usd": "monthly_expenses",
        "savings_usd": "current_retirement_savings",
        "loan_amount_usd": "debt",
        "monthly_emi_usd": "monthly_emi",
        "loan_interest_rate_pct": "loan_interest_rate",
    }
    normalised = normalised.rename(columns={key: value for key, value in rename_map.items() if key in normalised.columns})
    return _normalise_record_date(normalised)


def engineer_feature_frame(raw_frame: pd.DataFrame) -> pd.DataFrame:
    frame = _canonicalise_columns(raw_frame)

    frame["age"] = pd.to_numeric(_series(frame, "age", 35), errors="coerce").fillna(35).clip(lower=18, upper=100)
    frame["monthly_income"] = pd.to_numeric(_series(frame, "monthly_income", 0.0), errors="coerce").fillna(0.0).clip(lower=0.0)
    frame["monthly_expenses"] = pd.to_numeric(_series(frame, "monthly_expenses", 0.0), errors="coerce").fillna(0.0).clip(lower=0.0)
    frame["current_retirement_savings"] = pd.to_numeric(_series(frame, "current_retirement_savings", 0.0), errors="coerce").fillna(0.0).clip(lower=0.0)
    frame["debt"] = pd.to_numeric(_series(frame, "debt", 0.0), errors="coerce").fillna(0.0).clip(lower=0.0)
    frame["monthly_emi"] = pd.to_numeric(_series(frame, "monthly_emi", 0.0), errors="coerce").fillna(0.0).clip(lower=0.0)
    frame["loan_interest_rate"] = pd.to_numeric(_series(frame, "loan_interest_rate", 0.0), errors="coerce").fillna(0.0).clip(lower=0.0)
    frame["loan_term_months"] = pd.to_numeric(_series(frame, "loan_term_months", 0.0), errors="coerce").fillna(0.0).clip(lower=0.0)
    frame["debt_to_income_ratio"] = pd.to_numeric(_series(frame, "debt_to_income_ratio", 0.0), errors="coerce").fillna(0.0).clip(lower=0.0)
    frame["credit_score"] = pd.to_numeric(_series(frame, "credit_score", 580.0), errors="coerce").fillna(580.0).clip(lower=300.0, upper=850.0)
    frame["savings_to_income_ratio"] = pd.to_numeric(_series(frame, "savings_to_income_ratio", 0.0), errors="coerce").fillna(0.0).clip(lower=0.0)

    frame["gender"] = _series(frame, "gender", "Unknown").map(_as_str)
    frame["education_level"] = _series(frame, "education_level", "Unknown").map(_as_str)
    frame["employment_status"] = _series(frame, "employment_status", "Unknown").map(_as_str)
    frame["job_title"] = _series(frame, "job_title", "Unknown").map(_as_str)
    frame["has_loan"] = _series(frame, "has_loan", "No").map(_as_str)
    frame["loan_type"] = _series(frame, "loan_type", "None").map(_as_str)
    frame["region"] = _series(frame, "region", "Unknown").map(_as_str)

    frame["expense_ratio"] = frame.apply(lambda row: _safe_ratio(row["monthly_expenses"], max(row["monthly_income"], 1.0)), axis=1)
    frame["savings_rate"] = frame.apply(lambda row: _safe_ratio(max(row["monthly_income"] - row["monthly_expenses"] - row["monthly_emi"], 0.0), max(row["monthly_income"], 1.0)), axis=1)
    frame["debt_burden_ratio"] = frame.apply(lambda row: _safe_ratio(max(row["monthly_emi"], row["debt"] / max(row["loan_term_months"], 1.0)), max(row["monthly_income"], 1.0)), axis=1)

    frame["retirement_horizon_years"] = frame["age"].apply(lambda value: max(RETIREMENT_AGE - float(value), 0.0))
    frame["retirement_goal"] = frame["monthly_expenses"].apply(lambda value: max(value * 12.0 * 25.0, 1.0))
    frame["retirement_gap"] = frame["retirement_goal"] - frame["current_retirement_savings"]
    frame["retirement_gap_ratio"] = frame.apply(lambda row: _safe_ratio(max(row["retirement_gap"], 0.0), max(row["retirement_goal"], 1.0)), axis=1)
    frame["required_monthly_retirement_savings"] = frame.apply(
        lambda row: _safe_ratio(max(row["retirement_gap"], 0.0), max(row["retirement_horizon_years"] * 12.0, 1.0)),
        axis=1,
    )

    frame["monthly_savings"] = frame.apply(lambda row: max(row["monthly_income"] - row["monthly_expenses"] - row["monthly_emi"], 0.0), axis=1)
    frame["investment_contribution"] = frame.apply(
        lambda row: min(
            row["monthly_savings"],
            max(row["monthly_income"] * _clip(row["savings_to_income_ratio"] / 100.0, 0.02, 0.25), 0.0),
        ),
        axis=1,
    )

    frame["has_loan_flag"] = frame["has_loan"].map(_is_yes)
    frame["income_stability_proxy"] = frame.apply(
        lambda row: _clip(
            1.0
            - (0.18 if row["employment_status"].lower() in {"self-employed", "student"} else 0.0)
            - (0.08 if row["has_loan_flag"] else 0.0),
            0.0,
            1.0,
        ),
        axis=1,
    )
    frame["spend_volatility_proxy"] = frame.apply(
        lambda row: _clip(abs((row["monthly_expenses"] - row["monthly_savings"]) / max(row["monthly_income"], 1.0)), 0.0, 1.5),
        axis=1,
    )

    mix_frame = frame.apply(
        lambda row: pd.Series(
            _estimate_category_mix(
                expense_ratio=row["expense_ratio"],
                age=row["age"],
                has_loan_flag=row["has_loan_flag"],
                employment_status=row["employment_status"],
                job_title=row["job_title"],
            )
        ),
        axis=1,
    )
    frame = pd.concat([frame, mix_frame], axis=1)

    frame["projected_years_to_goal"] = frame.apply(
        lambda row: _project_years_to_goal(
            current_retirement_savings=row["current_retirement_savings"],
            monthly_contribution=row["investment_contribution"],
            retirement_goal=row["retirement_goal"],
        ),
        axis=1,
    ).clip(lower=0.0, upper=60.0)
    frame["trajectory_gap_years"] = frame["projected_years_to_goal"] - frame["retirement_horizon_years"]

    return frame[MODEL_FEATURES]


def build_training_target(feature_frame: pd.DataFrame) -> pd.Series:
    trajectory_component = 0.5 + 0.5 * np.tanh((feature_frame["retirement_horizon_years"] - feature_frame["projected_years_to_goal"]) / 6.0)
    savings_buffer_component = 0.5 + 0.5 * np.tanh((feature_frame["current_retirement_savings"] / feature_frame["retirement_goal"].replace(0, np.nan).fillna(1.0) - 0.20) * 4.0)
    debt_component = 0.5 + 0.5 * np.tanh((0.25 - feature_frame["debt_to_income_ratio"]) * 4.0)
    investment_component = 0.5 + 0.5 * np.tanh((feature_frame["investment_contribution"] / feature_frame["monthly_income"].replace(0, np.nan).fillna(1.0) - 0.10) * 8.0)
    expense_component = 0.5 + 0.5 * np.tanh((0.65 - feature_frame["expense_ratio"]) * 5.0)
    credit_component = ((feature_frame["credit_score"] - 300.0) / 550.0).clip(0.0, 1.0)
    category_component = 0.5 + 0.5 * np.tanh((feature_frame["essential_spend_ratio"] - feature_frame["discretionary_spend_ratio"]) * 3.0)
    stability_component = 0.5 + 0.5 * np.tanh((feature_frame["income_stability_proxy"] - 0.5) * 4.0)

    score = (
        0.30 * trajectory_component
        + 0.15 * savings_buffer_component
        + 0.13 * debt_component
        + 0.12 * investment_component
        + 0.10 * expense_component
        + 0.08 * credit_component
        + 0.07 * category_component
        + 0.05 * stability_component
    ) * 100.0

    return score.clip(0.0, 100.0).round(2)


def load_training_data(dataset_path: Path) -> tuple[pd.DataFrame, pd.Series]:
    raw_frame = pd.read_csv(dataset_path)
    feature_frame = engineer_feature_frame(raw_frame)
    target = build_training_target(feature_frame)
    return feature_frame, target


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(steps=[("imputer", SimpleImputer(strategy="median"))]),
                NUMERIC_FEATURES,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                    ]
                ),
                CATEGORICAL_FEATURES,
            ),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )


def train_model(X_train: pd.DataFrame, y_train: pd.Series) -> RandomForestRegressor:
    model = RandomForestRegressor(
        n_estimators=280,
        max_depth=16,
        min_samples_leaf=3,
        min_samples_split=4,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    return model


@dataclass
class FmiArtifacts:
    preprocessor: ColumnTransformer
    model: RandomForestRegressor
    feature_importances: list[dict[str, float]]
    validation_metrics: dict[str, float]
    test_metrics: dict[str, float]


def evaluate_predictions(y_true: pd.Series, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def extract_feature_importance(preprocessor: ColumnTransformer, model: RandomForestRegressor, top_k: int = 15) -> list[dict[str, float]]:
    feature_names = list(preprocessor.get_feature_names_out())
    importances = model.feature_importances_
    ranked = sorted(zip(feature_names, importances), key=lambda item: item[1], reverse=True)
    return [{"feature": name, "importance": round(float(score), 6)} for name, score in ranked[:top_k]]


def save_artifacts(artifacts: FmiArtifacts) -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with MODEL_PATH.open("wb") as handle:
        pickle.dump(artifacts.model, handle)
    with PREPROCESSOR_PATH.open("wb") as handle:
        pickle.dump(artifacts.preprocessor, handle)
    with FEATURE_INFO_PATH.open("w", encoding="utf-8") as handle:
        json.dump(
            {
                "numeric_features": NUMERIC_FEATURES,
                "categorical_features": CATEGORICAL_FEATURES,
                "target": TARGET_COLUMN,
                "retirement_age_assumption": RETIREMENT_AGE,
                "expected_annual_return": EXPECTED_ANNUAL_RETURN,
                "top_feature_importances": artifacts.feature_importances,
                "validation_metrics": artifacts.validation_metrics,
                "test_metrics": artifacts.test_metrics,
            },
            handle,
            indent=2,
        )


def load_artifacts() -> tuple[ColumnTransformer | None, RandomForestRegressor | None, list[dict[str, float]]]:
    if not MODEL_PATH.exists() or not PREPROCESSOR_PATH.exists():
        return None, None, []

    with PREPROCESSOR_PATH.open("rb") as handle:
        preprocessor = pickle.load(handle)
    with MODEL_PATH.open("rb") as handle:
        model = pickle.load(handle)

    feature_importances: list[dict[str, float]] = []
    if hasattr(preprocessor, "get_feature_names_out") and hasattr(model, "feature_importances_"):
        feature_importances = extract_feature_importance(preprocessor, model, top_k=20)

    return preprocessor, model, feature_importances


def _status_from_score(score: float) -> str:
    if score < 40:
        return "behind"
    if score < 60:
        return "on_track"
    return "ahead"


def explain_prediction(profile: pd.Series, score: float) -> list[str]:
    explanations: list[str] = []

    trajectory_gap = float(profile.get("trajectory_gap_years", 0.0))
    debt_to_income_ratio = float(profile.get("debt_to_income_ratio", 0.0))
    investment_rate = _safe_ratio(float(profile.get("investment_contribution", 0.0)), max(float(profile.get("monthly_income", 1.0)), 1.0))
    expense_ratio = float(profile.get("expense_ratio", 0.0))
    savings_ratio = _safe_ratio(float(profile.get("current_retirement_savings", 0.0)), max(float(profile.get("retirement_goal", 1.0)), 1.0))
    credit_score = float(profile.get("credit_score", 0.0))
    discretionary = float(profile.get("discretionary_spend_ratio", 0.0))
    essential = float(profile.get("essential_spend_ratio", 0.0))

    if trajectory_gap <= -4:
        explanations.append("Projected retirement timeline is ahead of schedule.")
    elif trajectory_gap >= 4:
        explanations.append("Current contribution pace lags the retirement timeline.")

    if debt_to_income_ratio <= 0.25:
        explanations.append("Debt-to-income burden is low.")
    elif debt_to_income_ratio >= 0.45:
        explanations.append("Debt-to-income burden is suppressing retirement progress.")

    if investment_rate >= 0.15:
        explanations.append("Investment contributions are strong relative to income.")
    elif investment_rate <= 0.06:
        explanations.append("Investment contributions are below a healthy retirement pace.")

    if expense_ratio <= 0.55:
        explanations.append("Monthly spending leaves enough room for long-term saving.")
    elif expense_ratio >= 0.70:
        explanations.append("Monthly expenses are consuming too much of income.")

    if savings_ratio >= 0.35:
        explanations.append("Retirement corpus coverage is healthy.")
    elif savings_ratio <= 0.12:
        explanations.append("Retirement corpus coverage is still thin.")

    if credit_score >= 700:
        explanations.append("Credit quality is supporting financial flexibility.")
    elif credit_score <= 550:
        explanations.append("Credit score is limiting financial resilience.")

    if essential >= discretionary:
        explanations.append("Essential spending outweighs discretionary spending.")
    else:
        explanations.append("Discretionary spending is heavier than the essential mix.")

    if not explanations:
        explanations.append("Profile is balanced and near the retirement target.")

    if score >= 60 and "ahead" not in explanations[0].lower():
        explanations.insert(0, "The retirement trajectory is comfortably ahead of target.")
    elif score < 40 and "behind" not in explanations[0].lower():
        explanations.insert(0, "The retirement trajectory is behind target.")

    return explanations[:4]


def predict_from_profile(profile: dict[str, Any], preprocessor: ColumnTransformer | None = None, model: RandomForestRegressor | None = None, feature_importances: list[dict[str, float]] | None = None) -> dict[str, Any]:
    if preprocessor is None or model is None:
        preprocessor, model, loaded_feature_importances = load_artifacts()
        if feature_importances is None:
            feature_importances = loaded_feature_importances

    if preprocessor is None or model is None:
        raise FileNotFoundError("FMI model artifacts are missing. Run train_fmi_model.py first.")

    feature_frame = engineer_feature_frame(pd.DataFrame([profile]))
    transformed = preprocessor.transform(feature_frame)
    prediction = float(model.predict(transformed)[0])
    prediction = max(0.0, min(100.0, prediction))

    tree_predictions: list[float] = []
    if hasattr(model, "estimators_"):
        for estimator in model.estimators_:
            tree_predictions.append(float(estimator.predict(transformed)[0]))
    prediction_std = float(np.std(tree_predictions)) if tree_predictions else 0.0
    confidence = max(0.0, min(1.0, 1.0 - prediction_std / 18.0))

    enriched_profile = feature_frame.iloc[0].to_dict()
    important_factors = explain_prediction(feature_frame.iloc[0], prediction)
    retirement_status = _status_from_score(prediction)

    if feature_importances is None:
        feature_importances = []

    return {
        "fmi_score": round(prediction, 1),
        "retirement_status": retirement_status,
        "years_to_goal": round(float(feature_frame.iloc[0]["projected_years_to_goal"]), 1),
        "important_factors": important_factors,
        "confidence": round(confidence, 3),
        "prediction_std_dev": round(prediction_std, 3),
        "feature_importances": feature_importances[:8],
        "model_version": "fmi_random_forest_v1",
        "feature_snapshot": {
            "retirement_goal": round(float(enriched_profile["retirement_goal"]), 2),
            "current_retirement_savings": round(float(enriched_profile["current_retirement_savings"]), 2),
            "monthly_savings": round(float(enriched_profile["monthly_savings"]), 2),
            "debt_to_income_ratio": round(float(enriched_profile["debt_to_income_ratio"]), 4),
            "investment_contribution": round(float(enriched_profile["investment_contribution"]), 2),
        },
    }


def feature_importance_report(preprocessor: ColumnTransformer, model: RandomForestRegressor, top_k: int = 10) -> list[dict[str, float]]:
    return extract_feature_importance(preprocessor, model, top_k=top_k)


def prepare_training_split(feature_frame: pd.DataFrame, target: pd.Series, random_state: int = 42) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, pd.Series]:
    X_train, X_temp, y_train, y_temp = train_test_split(feature_frame, target, test_size=0.30, random_state=random_state)
    X_validation, X_test, y_validation, y_test = train_test_split(X_temp, y_temp, test_size=0.50, random_state=random_state)
    return X_train, X_validation, X_test, y_train, y_validation, y_test

