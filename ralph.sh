#!/bin/bash

# Ralph Autonomous Loop
# Individual command redirection used for stability on macOS

while true; do
  echo "--- Starting Ralph Iteration: $(date) ---" >> ralph.log 2>&1
  
  # Run the driver
  ./.ralph_venv/bin/python3 ralph_driver.py >> ralph.log 2>&1
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 42 ]; then
    echo "Ralph hit a rate limit (429). Sleeping for 1 hour..." >> ralph.log 2>&1
    sleep 3600
    continue
  fi

  echo "Syncing changes to GitHub..." >> ralph.log 2>&1
  git add .
  if ! git diff --cached --quiet; then
    git commit -m "Ralph: Autonomous Iteration - $(date)" >> ralph.log 2>&1
    git push origin master >> ralph.log 2>&1
  fi

  sleep 10
done
