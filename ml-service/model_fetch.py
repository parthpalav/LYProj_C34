"""
ml-service/model_fetch.py
Downloads the trained classifier from Google Drive when it is missing.
"""
import logging
import os

log = logging.getLogger(__name__)

MODELS_URL = "https://drive.google.com/drive/folders/13T-KOgBviqkel-NUTkqJjlX4dSLdD92m"
REQUIRED = "finaura-v7-bge-base-en-v1.5/model.safetensors"


def ensure_models(base_dir):
    models_dir = os.path.join(base_dir, "models")
    if os.path.exists(os.path.join(models_dir, REQUIRED)):
        return
    log.info("Trained model missing, downloading from Google Drive...")
    import gdown  # shortcut: needs the Drive folder shared as "anyone with the link"
    os.makedirs(models_dir, exist_ok=True)
    gdown.download_folder(MODELS_URL, output=models_dir, quiet=False)
    if not os.path.exists(os.path.join(models_dir, REQUIRED)):
        raise RuntimeError(f"Model download failed: {REQUIRED} missing after download")
