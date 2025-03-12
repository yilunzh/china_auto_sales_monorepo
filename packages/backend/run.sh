#!/bin/bash
# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Install the package in development mode
pip install -e .

# Make sure we're using environment variables from both .env and .env.local
export $(grep -v '^#' .env | xargs) 2>/dev/null || true
if [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | xargs) 2>/dev/null || true
fi

# Run the server
python -m src.api.main