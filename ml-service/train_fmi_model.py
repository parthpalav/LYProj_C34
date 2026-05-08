"""Train the retirement-progress FMI regressor.

This script derives a continuous FMI target from the synthetic personal finance
dataset, fits a real ML regressor, evaluates the model, and saves the trained
artifacts into ml-service/models/.
"""

from __future__ import annotations

from pathlib import Path
import json

from fmi_model import (
    FEATURE_INFO_PATH,
    MODEL_DIR,
    FmiArtifacts,
    build_preprocessor,
    evaluate_predictions,
    feature_importance_report,
    load_training_data,
    prepare_training_split,
    save_artifacts,
    train_model,
)


BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "data" / "synthetic_personal_finance_dataset.csv"


def main() -> None:
    feature_frame, target = load_training_data(DATASET_PATH)

    print(f"[DATA] rows={len(feature_frame):,} features={len(feature_frame.columns)}")
    print("[DATA] columns:")
    print(", ".join(feature_frame.columns))

    X_train, X_validation, X_test, y_train, y_validation, y_test = prepare_training_split(feature_frame, target)

    preprocessor = build_preprocessor()
    X_train_processed = preprocessor.fit_transform(X_train)
    X_validation_processed = preprocessor.transform(X_validation)
    X_test_processed = preprocessor.transform(X_test)

    model = train_model(X_train_processed, y_train)

    validation_predictions = model.predict(X_validation_processed)
    test_predictions = model.predict(X_test_processed)

    validation_metrics = evaluate_predictions(y_validation, validation_predictions)
    test_metrics = evaluate_predictions(y_test, test_predictions)

    print("\n[VALIDATION]")
    print(json.dumps(validation_metrics, indent=2))
    print("\n[TEST]")
    print(json.dumps(test_metrics, indent=2))

    feature_importances = feature_importance_report(preprocessor, model, top_k=15)

    print("\n[TOP FEATURES]")
    for item in feature_importances[:10]:
        print(f"  {item['feature']}: {item['importance']:.6f}")

    sample_rows = X_test.head(8).copy()
    sample_predictions = model.predict(preprocessor.transform(sample_rows))
    print("\n[SAMPLE PREDICTIONS]")
    for idx, (actual, predicted) in enumerate(zip(y_test.head(8), sample_predictions), start=1):
        print(f"  sample_{idx}: actual={actual:.2f} predicted={predicted:.2f}")

    artifacts = FmiArtifacts(
        preprocessor=preprocessor,
        model=model,
        feature_importances=feature_importances,
        validation_metrics=validation_metrics,
        test_metrics=test_metrics,
    )
    save_artifacts(artifacts)

    print(f"\n[SAVED] {FEATURE_INFO_PATH}")
    print(f"[SAVED] {MODEL_DIR / 'fmi_preprocessor.pkl'}")
    print(f"[SAVED] {MODEL_DIR / 'fmi_model.pkl'}")


if __name__ == "__main__":
    main()