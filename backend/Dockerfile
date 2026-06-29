# Vela RecSys API — Hugging Face Spaces (Docker SDK).
# Serving is torch-free: it loads precomputed embeddings (.npy) + the deploy
# data subset, so the lean requirements keep the image small and dodge the
# torch/faiss OpenMP conflict.
FROM python:3.11-slim

WORKDIR /app
RUN useradd -m -u 1000 user

COPY requirements-serve.txt .
RUN pip install --no-cache-dir -r requirements-serve.txt

COPY --chown=user . .
USER user

ENV OMP_NUM_THREADS=1 \
    KMP_DUPLICATE_LIB_OK=TRUE \
    VELA_DATASET=deploy

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
