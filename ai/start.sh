#! /usr/bin/env bash
set -e

# Start application
echo "Starting application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
