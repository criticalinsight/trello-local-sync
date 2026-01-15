import os
import subprocess
import time
import sys

# Configuration
PRIMARY_MODEL = "gemini-3-pro-preview"
FALLBACK_MODEL = "gemini-3-flash-preview"
VENV_BIN = "./.ralph_venv/bin"
LLM_PATH = f"{VENV_BIN}/llm"
TASKS_FILE = "TASKS.md"

def run_command(command, check=True):
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, check=check)
        return result.stdout, result.stderr, result.returncode
    except subprocess.CalledProcessError as e:
        return e.stdout, e.stderr, e.returncode

def call_llm(prompt, model=PRIMARY_MODEL):
    stdout, stderr, code = run_command(f"{LLM_PATH} -m {model} '{prompt}'", check=False)
    if code != 0:
        if "429" in stderr or "RESOURCE_EXHAUSTED" in stderr:
            print("Rate limit hit (429).")
            return "429", stderr
        return None, stderr
    return stdout, None

def main():
    print(f"--- Ralph Driver Iteration: {time.ctime()} ---")
    
    if not os.path.exists(TASKS_FILE):
        print(f"Error: {TASKS_FILE} not found.")
        return

    # Check for active task
    with open(TASKS_FILE, 'r') as f:
        tasks = f.read()
    
    # Simple check for the first unchecked box
    if "- [ ]" not in tasks:
        print("No active tasks found in TASKS.md.")
        return

    # Call LLM for next action
    prompt = f"You are Ralph, an autonomous developer. Based on the following TASKS.md, what is the next single technical step to take? Provide ONLY the shell command to execute.\n\nTASKS.md:\n{tasks}"
    
    output, error = call_llm(prompt)
    
    if output == "429":
        print("Rate limit detected. Signaling 1-hour sleep.")
        sys.exit(42)  # Special exit code for 429
        
    if not output:
        print(f"Error calling primary model: {error}")
        print("Trying fallback model...")
        output, error = call_llm(prompt, model=FALLBACK_MODEL)
        
    if not output:
        print(f"Fallback failed: {error}")
        return

    command = output.strip().strip('`')
    print(f"Executing: {command}")
    
    # Execute the command
    out, err, code = run_command(command, check=False)
    print(out)
    if err:
        print(f"Error output: {err}")

    # Log completion or progress (this would usually be more sophisticated)
    print("Iteration complete.")

if __name__ == "__main__":
    main()
