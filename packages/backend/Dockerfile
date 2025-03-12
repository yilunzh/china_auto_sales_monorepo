FROM python:3.9-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Python package
COPY . .

# Install the package in development mode
RUN pip install -e .

# Expose the port
EXPOSE 8000

# Set environment variables
ENV PYTHON_ENV=production

# Run the API server
CMD ["python", "-m", "src.api.main"]
