FROM python:3.11-slim

# Install Node.js 20 for Word export
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Node.js dependencies for Word export
COPY package.json .
RUN npm install

# Copy all source files
COPY . .

# Create data directories
RUN mkdir -p data/hop_dong data/crm data/mau

EXPOSE 8501

CMD streamlit run app_nhanvien.py \
    --server.port=$PORT \
    --server.address=0.0.0.0 \
    --server.headless=true \
    --browser.gatherUsageStats=false
