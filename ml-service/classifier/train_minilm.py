"""
classifier/train_minilm.py
--------------------------
Phase 5: Trains a Sequence Classification model initialized from
'sentence-transformers/all-MiniLM-L6-v2'.

It performs standard cross-entropy fine-tuning on the prepared
finaura_training_data.csv and evaluates on finaura_validation_data.csv.

Metrics reported:
 - Accuracy
 - Macro F1, Weighted F1
 - Per-class Precision, Recall, F1
 - Confusion Matrix
There is NO hardcoded accuracy threshold.

Run:
    cd ml-service && python3 -m classifier.train_minilm
"""

import os
import json
import logging
import pandas as pd
import numpy as np

from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    Trainer,
    TrainingArguments,
)
from datasets import Dataset

from classifier.category_map import FINAURA_CATEGORIES

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_OUT = os.path.join(BASE_DIR, "models", "minilm-finaura")

def compute_metrics(pred):
    labels = pred.label_ids
    preds = pred.predictions.argmax(-1)
    
    precision, recall, f1, support = precision_recall_fscore_support(labels, preds, zero_division=0)
    acc = accuracy_score(labels, preds)
    
    macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(labels, preds, average='macro', zero_division=0)
    weight_p, weight_r, weight_f1, _ = precision_recall_fscore_support(labels, preds, average='weighted', zero_division=0)
    
    cm = confusion_matrix(labels, preds)
    
    return {
        'accuracy': acc,
        'macro_f1': macro_f1,
        'weighted_f1': weight_f1,
        'precision_per_class': precision.tolist(),
        'recall_per_class': recall.tolist(),
        'f1_per_class': f1.tolist(),
        'confusion_matrix': cm.tolist(),
    }


def prepare_hf_dataset(df: pd.DataFrame, tokenizer, label2id: dict) -> Dataset:
    """Convert pandas DataFrame to HuggingFace Dataset and tokenize."""
    # Ensure no missing text/categories
    df = df.dropna(subset=['text', 'category']).copy()
    
    df['label'] = df['category'].map(label2id)
    # Filter out any that didn't map (though there shouldn't be any)
    df = df.dropna(subset=['label'])
    df['label'] = df['label'].astype(int)
    
    ds = Dataset.from_pandas(df[['text', 'label']])
    
    def tokenize_function(examples):
        return tokenizer(examples['text'], padding='max_length', truncation=True, max_length=64)
    
    tokenized_ds = ds.map(tokenize_function, batched=True)
    return tokenized_ds


def main():
    print("=" * 70)
    print("  PHASE 5: TRAINING MINILM CLASSIFIER")
    print("=" * 70)
    
    # ─── Load Data ───────────────────────────────────────────
    train_path = os.path.join(OUT_DIR, "finaura_training_data.csv")
    val_path = os.path.join(OUT_DIR, "finaura_validation_data.csv")
    
    if not os.path.exists(train_path) or not os.path.exists(val_path):
        log.error("Training or validation data not found. Run prepare_dataset.py first.")
        return
        
    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)
    print(f"Loaded {len(train_df)} training and {len(val_df)} validation rows.")
    
    # ─── Setup Labels ────────────────────────────────────────
    id2label = {i: cat for i, cat in enumerate(FINAURA_CATEGORIES)}
    label2id = {cat: i for i, cat in id2label.items()}
    num_labels = len(FINAURA_CATEGORIES)
    
    # ─── Model & Tokenizer ───────────────────────────────────
    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    print(f"\nLoading base model: {model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=num_labels,
        id2label=id2label,
        label2id=label2id
    )
    
    # ─── Prepare HF Datasets ─────────────────────────────────
    print("Tokenizing datasets...")
    train_dataset = prepare_hf_dataset(train_df, tokenizer, label2id)
    val_dataset = prepare_hf_dataset(val_df, tokenizer, label2id)
    
    # ─── Training Arguments ──────────────────────────────────
    training_args = TrainingArguments(
        output_dir=os.path.join(BASE_DIR, "models", "checkpoints"),
        eval_strategy="epoch",
        save_strategy="epoch",
        learning_rate=2e-5,
        per_device_train_batch_size=64,
        per_device_eval_batch_size=64,
        num_train_epochs=3,
        weight_decay=0.01,
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        logging_steps=50,
        report_to="none"
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
    )
    
    # ─── Train ───────────────────────────────────────────────
    print("\n🚀 Starting training...")
    trainer.train()
    
    # ─── Evaluate ────────────────────────────────────────────
    print("\n📊 Running final evaluation on validation set...")
    eval_results = trainer.evaluate()
    
    print("\n" + "=" * 70)
    print("  VALIDATION RESULTS")
    print("=" * 70)
    print(f"Accuracy:    {eval_results.get('eval_accuracy', 0)*100:.2f}%")
    print(f"Macro F1:    {eval_results.get('eval_macro_f1', 0)*100:.2f}%")
    print(f"Weighted F1: {eval_results.get('eval_weighted_f1', 0)*100:.2f}%")
    
    print("\nPer-class Metrics (Precision / Recall / F1):")
    p = eval_results.get('eval_precision_per_class', [])
    r = eval_results.get('eval_recall_per_class', [])
    f = eval_results.get('eval_f1_per_class', [])
    
    for i, cat in id2label.items():
        if i < len(p):
            print(f"  {cat:15s} : {p[i]*100:5.1f}% / {r[i]*100:5.1f}% / {f[i]*100:5.1f}%")
            
    print("\nConfusion Matrix:")
    cm = eval_results.get('eval_confusion_matrix', [])
    if cm:
        df_cm = pd.DataFrame(cm, index=[cat[:3] for cat in FINAURA_CATEGORIES], columns=[cat[:3] for cat in FINAURA_CATEGORIES])
        print(df_cm)
    
    # ─── Save Model ──────────────────────────────────────────
    print(f"\n💾 Saving fine-tuned model to {MODEL_OUT}...")
    os.makedirs(MODEL_OUT, exist_ok=True)
    trainer.save_model(MODEL_OUT)
    tokenizer.save_pretrained(MODEL_OUT)
    
    print("\n✅ Training complete.")

if __name__ == '__main__':
    main()
