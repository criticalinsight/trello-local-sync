#!/bin/bash

# Ralph Autonomous Loop
while true; do
  echo "--- Starting Ralph Iteration: $(date) ---"
  
  # Run the driver
  ./.ralph_venv/bin/python3 ralph_driver.py
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 42 ]; then
    echo "Ralph hit a rate limit (429). Sleeping for 1 hour..."
    sleep 3600
    continue
  fi

  echo "Syncing changes to GitHub..."
  git add .
  if ! git diff --cached --quiet; then
    git commit -m "Ralph: Autonomous Iteration - $(date)"
    git push origin master
  fi

  sleep 10
done
