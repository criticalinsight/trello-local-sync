#!/bin/bash

# Ralph Autonomous Loop
# ---------------------

while true; do
  # Run the driver
  ./.ralph_venv/bin/python3 ralph_driver.py
  EXIT_CODE=$?

  # Check for 429 (Rate Limit) - Exit code 42
  if [ $EXIT_CODE -eq 42 ]; then
    echo "Ralph hit a rate limit. Sleeping for 1 hour..."
    sleep 3600
    continue
  fi

  # Sync to GitHub
  echo "Syncing changes to GitHub..."
  git add .
  git commit -m "Ralph: Autonomous Iteration - $(date)" || echo "No changes to commit"
  git push

  # Small breather to prevent accidental rapid loops
  sleep 10
done
