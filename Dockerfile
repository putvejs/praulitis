FROM python:3.11-slim

WORKDIR /app

# Install ffmpeg for HLS transcoding
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create data and upload directories
RUN mkdir -p data app/static/uploads/photos app/static/uploads/videos app/static/uploads/audio

EXPOSE 5002

CMD ["python", "main.py"]
