"""
classifier/exp2_train.py
------------------------
Experiment 2: Train MiniLM v2 on the highly augmented Indian dataset.
Saves to models/minilm-finaura-v2/.

This script mimics the architecture of train_minilm.py but uses the
newly generated datasets from Experiment 2.
"""

import os
import logging
import pandas as pd
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
from datasets import Dataset

from classifier.category_map import FINAURA_CATEGORIES

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_OUT = os.path.join(BASE_DIR, "models", "minilm-finaura-v2")

def compute_metrics(pred):
    labels = pred.label_ids
    preds = pred.predictions.argmax(-1)
    
    acc = accuracy_score(labels, preds)
    _, _, macro_f1, _ = precision_recall_fscore_support(labels, preds, average='macro', zero_division=0)
    
    return {
        'accuracy': acc,
        'macro_f1': macro_f1,
    }

def prepare_hf_dataset(df: pd.DataFrame, tokenizer, label2id: dict) -> Dataset:
    df = df.dropna(subset=['text', 'category']).copy()
    df['label'] = df['category'].map(label2id).astype(int)
    
    ds = Dataset.from_pandas(df[['text', 'label']])
    
    def tokenize_function(examples):
        return tokenizer(examples['text'], padding='max_length', truncation=True, max_length=64)
    
    return ds.map(tokenize_function, batched=True)

def main():
    print("=" * 60)
    print(" EXPERIMENT 2: TRAINING MINILM-V2 (INDIAN DOMAIN)")
    print("=" * 60)
    
    train_path = os.path.join(OUT_DIR, "exp2_train_data.csv")
    val_path = os.path.join(OUT_DIR, "exp2_val_data.csv")
    
    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)
    
    print(f"Loaded {len(train_df)} training and {len(val_df)} validation rows.")
    
    id2label = {i: cat for i, cat in enumerate(FINAURA_CATEGORIES)}
    label2id = {cat: i for i, cat in id2label.items()}
    num_labels = len(FINAURA_CATEGORIES)
    
    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name, num_labels=num_labels, id2label=id2label, label2id=label2id
    )
    
    train_dataset = prepare_hf_dataset(train_df, tokenizer, label2id)
    val_dataset = prepare_hf_dataset(val_df, tokenizer, label2id)
    
    training_args = TrainingArguments(
        output_dir=os.path.join(BASE_DIR, "models", "checkpoints-v2"),
        eval_strategy="epoch",
        save_strategy="epoch",
        learning_rate=3e-5,  # slightly higher LR for faster adaptation
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
    
    print("\n🚀 Starting training for v2...")
    trainer.train()
    
    print(f"\n💾 Saving fine-tuned v2 model to {MODEL_OUT}...")
    os.makedirs(MODEL_OUT, exist_ok=True)
    trainer.save_model(MODEL_OUT)
    tokenizer.save_pretrained(MODEL_OUT)
    print("✅ Training complete.")

if __name__ == '__main__':
    main()
