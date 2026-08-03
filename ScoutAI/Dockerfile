FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# scikit-learn wheels use the GNU OpenMP runtime on Debian-based images.
RUN apt-get update \
    && apt-get install --no-install-recommends -y libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY ScoutAI/requirements.txt ./ScoutAI/requirements.txt
RUN python -m pip install --no-cache-dir \
    -r ScoutAI/requirements.txt

# Copy only the files required by the API runtime. Notebook, tests, and the
# local virtual environment are intentionally excluded from the image.
COPY ScoutAI/api.py ScoutAI/scout_engine.py ScoutAI/fm_dataset.csv ./ScoutAI/

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "ScoutAI.api:app", "--host", "0.0.0.0", "--port", "8000"]
