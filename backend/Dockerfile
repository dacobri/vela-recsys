# Vela RecSys API — Hugging Face Spaces (Docker SDK).
#
# Serving is torch-free: it loads precomputed embeddings (.npy) + the MovieLens
# "small" subset, so the lean requirements keep the image small and dodge the
# torch/faiss OpenMP conflict.
#
# Build context must be the PROJECT ROOT (so data/ and backend/artifacts/ are
# available), e.g. from vela/:   docker build -f backend/Dockerfile -t vela-api .
# The live Hugging Face Space (dacobri/vela) uses an equivalent Dockerfile at its
# own repo root; see DEPLOY.md.
FROM python:3.11-slim

# libgomp1 = OpenMP runtime, required by faiss-cpu and implicit (ALS).
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN useradd -m -u 1000 user

COPY backend/requirements-serve.txt ./backend/requirements-serve.txt
RUN pip install --no-cache-dir -r backend/requirements-serve.txt

COPY --chown=user . /app
USER user

# HOME must be writable: config.py mkdir()s data/processed + artifacts at import.
ENV OMP_NUM_THREADS=1 \
    KMP_DUPLICATE_LIB_OK=TRUE \
    VELA_DATASET=small \
    HOME=/app

WORKDIR /app/backend
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
