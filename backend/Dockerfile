FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Runがリクエストを待つポートを環境変数から取得
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}