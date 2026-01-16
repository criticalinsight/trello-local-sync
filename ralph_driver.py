import os
import subprocess
import time
import sys
import asyncio
import json

# Try to import MCP (only works if installed in venv)
try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False
    print("Warning: 'mcp' library not found. Graphiti integration disabled.")

# Ensure sys.stdin is not used in background
sys.stdin = open(os.devnull, 'r')

# Configuration
PRIMARY_MODEL = "gemini-3-pro-preview"
FALLBACK_MODEL = "gemini-3-flash-preview"
VENV_BIN = "./.ralph_venv/bin"
LLM_PATH = f"{VENV_BIN}/llm"
TASKS_FILE = "TASKS.md"

# Graphiti Configuration
GRAPHITI_VENV_PYTHON = "/Users/brixelectronics/Documents/mac/criticalinsight_repos/gemini-graphiti-mcp/venv/bin/python"
GRAPHITI_MODULE = "graphiti_mcp.server"

def run_command(command, check=True):
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, check=check)
        return result.stdout, result.stderr, result.returncode
    except subprocess.CalledProcessError as e:
        return e.stdout, e.stderr, e.returncode

def call_llm(prompt, model=PRIMARY_MODEL):
    # Use -m to specify the model explicitly using the GeminiPro source in llm-gemini
    # Escape double quotes in prompt for shell safety
    safe_prompt = prompt.replace('"', '\\"').replace("'", "'\\''")
    command = f'{LLM_PATH} -m {model} "{safe_prompt}"'
    
    stdout, stderr, code = run_command(command, check=False)
    if code != 0:
        if "429" in stderr or "RESOURCE_EXHAUSTED" in stderr:
            print(f"Rate limit hit (429) for model {model}.")
            return "429", stderr
        return None, stderr
    return stdout, None

async def get_graphiti_context(query="current active task"):
    """
    Connects to Graphiti MCP server and retrieves relevant memories.
    """
    if not MCP_AVAILABLE:
        return None

    server_params = StdioServerParameters(
        command=GRAPHITI_VENV_PYTHON,
        args=["-m", GRAPHITI_MODULE],
        env={
            **os.environ,
            "MCP_SERVER_NAME": "graphiti-mcp"
        }
    )

    print("Connecting to Graphiti MCP...")
    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                # Call search_memories tool
                result = await session.call_tool(
                    "search_memories",
                    arguments={"query": query, "limit": 5, "user_id": "ralph_agent"}
                )
                
                # Parse result
                if result and result.content:
                    # Result is a list of TextContent or ImageContent
                    text_content = "\n".join([item.text for item in result.content if item.type == 'text'])
                    return text_content
                return "No relevant memories found."
    except Exception as e:
        print(f"Error querying Graphiti: {e}")
        return None

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

    # Gather context: File tree
    file_tree, _, _ = run_command("ls -R | grep -v node_modules | grep -v .git | head -n 50")
    
    # Gather context: Graphiti Memories
    memory_context = ""
    if MCP_AVAILABLE:
        # Run async function in sync context
        try:
            print("Querying memory...")
            memories = asyncio.run(get_graphiti_context(query="project status and architectural decisions"))
            if memories:
                memory_context = f"\nRelevant Memories (Graphiti):\n{memories}\n"
                print("Memory context retrieved.")
        except Exception as e:
            print(f"Failed to retrieve memory: {e}")

    # Construct a robust prompt
    prompt = f"""You are Ralph, an autonomous senior developer.
Current Tasks:
{tasks}

Environment Context (File Tree Snippet):
{file_tree}
{memory_context}

Goal: Identify the next single, low-risk technical step to move the project forward.
Requirement: Provide ONLY the raw shell command to execute. No explanations, no markdown blocks.
"""
    
    output, error = call_llm(prompt, model=PRIMARY_MODEL)
    
    if output == "429":
        print("Primary model hit rate limit. Signaling 1-hour sleep.")
        sys.exit(42)  # Special exit code for 429
        
    if not output or not output.strip():
        print(f"Error calling primary model ({PRIMARY_MODEL}): {error}")
        print(f"Attempting fallback to {FALLBACK_MODEL}...")
        output, error = call_llm(prompt, model=FALLBACK_MODEL)
        
    if output == "429":
        print("Fallback model also hit rate limit. Signaling 1-hour sleep.")
        sys.exit(42)

    if not output or not output.strip():
        print(f"Fallback failed: {error}")
        return

    command = output.strip().split('\n')[0].strip('`')
    if not command:
        print("LLM returned an empty command.")
        return

    print(f"Executing: {command}")
    
    # Execute the command
    out, err, code = run_command(command, check=False)
    if out:
        print(f"STDOUT:\n{out}")
    if err:
        print(f"STDERR:\n{err}")

    print(f"Iteration complete with exit code {code}.")

if __name__ == "__main__":
    main()
