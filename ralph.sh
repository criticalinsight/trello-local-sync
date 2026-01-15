#!/bin/bash

# Ralph Autonomous Loop
# ---------------------
# Internal logging
exec >> ralph.log 2>&1

while true; do
  echo "--- Starting Ralph Iteration: $(date) ---" | tee -a ralph.log
  
  # Run the driver with explicit redirection and null input to avoid descriptor issues
  PYTHONUNBUFFERED=1 ./.ralph_venv/bin/python3 ralph_driver.py < /dev/null >> ralph.log 2>&1
  EXIT_CODE=$?

  # Check for 429 (Rate Limit) - Exit code 42 signaled by driver
  if [ $EXIT_CODE -eq 42 ]; then
    echo "Ralph hit a rate limit (429). Sleeping for 1 hour to let quotas reset..."
    sleep 3600
    continue
  fi

  # Sync to GitHub
  # This section ensures autonomy by pushing changes immediately.
  # .gitignore is expected to handle sensitive files.
  echo "Syncing changes to GitHub..."
  git add .
  
  # Only commit if there are changes
  if ! git diff --cached --quiet; then
    COMMIT_MSG="Ralph: Autonomous Iteration - $(date '+%Y-%m-%d %H:%M:%S')"
    git commit -m "$COMMIT_MSG"
    echo "Pushing to remote..."
    git push origin main || git push # Fallback to default branch if main is not explicit
  else
    echo "No changes detected in this iteration."
  fi

  # Small breather to prevent runaway loops in case of instant failures
  echo "Iteration complete. Waiting 10 seconds before next cycle..."
  sleep 10
done
