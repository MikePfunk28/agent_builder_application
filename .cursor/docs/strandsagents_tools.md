Strands offers an optional, community-supported tools package strands-agents-tools which includes pre-built tools to get started quickly experimenting with agents and tools during development. The package is also open source and available on GitHub.

Install the strands-agents-tools package by running:


pip install strands-agents-tools
Some tools require additional dependencies. Install the additional required dependencies in order to use the following tools:

mem0_memory

pip install 'strands-agents-tools[mem0_memory]'
local_chromium_browser

pip install 'strands-agents-tools[local_chromium_browser]'
agent_core_browser

pip install 'strands-agents-tools[agent_core_browser]'
agent_core_code_interpreter

pip install 'strands-agents-tools[agent_core_code_interpreter]'
a2a_client

pip install 'strands-agents-tools[a2a_client]'
diagram

pip install 'strands-agents-tools[diagram]'
rss

pip install 'strands-agents-tools[rss]'
use_computer

pip install 'strands-agents-tools[use_computer]'
Available Tools¶
RAG & Memory¶
retrieve: Semantically retrieve data from Amazon Bedrock Knowledge Bases for RAG, memory, and other purposes
memory: Agent memory persistence in Amazon Bedrock Knowledge Bases
agent_core_memory: Integration with Amazon Bedrock Agent Core Memory
mem0_memory: Agent memory and personalization built on top of Mem0
File Operations¶
editor: File editing operations like line edits, search, and undo
file_read: Read and parse files
file_write: Create and modify files
Shell & System¶
environment: Manage environment variables
shell: Execute shell commands
cron: Task scheduling with cron jobs
use_computer: Automate desktop actions and GUI interactions
Code Interpretation¶
python_repl: Run Python code
Not supported on Windows due to the fcntl module not being available on Windows.
code_interpreter: Execute code in isolated sandboxes
Web & Network¶
http_request: Make API calls, fetch web data, and call local HTTP servers
slack: Slack integration with real-time events, API access, and message sending
browser: Automate web browser interactions
rss: Manage and process RSS feeds
Multi-modal¶
generate_image_stability: Create images with Stability AI
image_reader: Process and analyze images
generate_image: Create AI generated images with Amazon Bedrock
nova_reels: Create AI generated videos with Nova Reels on Amazon Bedrock
speak: Generate speech from text using macOS say command or Amazon Polly
diagram: Create cloud architecture and UML diagrams
AWS Services¶
use_aws: Interact with AWS services
Utilities¶
calculator: Perform mathematical operations
current_time: Get the current date and time
load_tool: Dynamically load more tools at runtime
sleep: Pause execution with interrupt support
Agents & Workflows¶
graph: Create and manage multi-agent systems using Strands SDK Graph implementation
agent_graph: Create and manage graphs of agents
journal: Create structured tasks and logs for agents to manage and work from
swarm: Coordinate multiple AI agents in a swarm / network of agents
stop: Force stop the agent event loop
handoff_to_user: Enable human-in-the-loop workflows by pausing agent execution for user input or transferring control entirely to the user
use_agent: Run a new AI event loop with custom prompts and different model providers
think: Perform deep thinking by creating parallel branches of agentic reasoning
use_llm: Run a new AI event loop with custom prompts
workflow: Orchestrate sequenced workflows
batch: Call multiple tools from a single model request
a2a_client: Enable agent-to-agent communication
Tool Consent and Bypassing¶
By default, certain tools that perform potentially sensitive operations (like file modifications, shell commands, or code execution) will prompt for user confirmation before executing. This safety feature ensures users maintain control over actions that could modify their system.

To bypass these confirmation prompts, you can set the BYPASS_TOOL_CONSENT environment variable:


# Set this environment variable to bypass tool confirmation prompts
export BYPASS_TOOL_CONSENT=true
Setting the environment variable within Python:


import os

os.environ["BYPASS_TOOL_CONSENT"] = "true"
When this variable is set to true, tools will execute without asking for confirmation. This is particularly useful for:

Automated workflows where user interaction isn't possible
Development and testing environments
CI/CD pipelines
Situations where you've already validated the safety of operations
Note: Use this feature with caution in production environments, as it removes an important safety check.

Human-in-the-Loop with handoff_to_user¶
The handoff_to_user tool enables human-in-the-loop workflows by allowing agents to pause execution for user input or transfer control entirely to a human operator. It offers two modes: Interactive Mode (breakout_of_loop=False) which collects input and continues, and Complete Handoff Mode (breakout_of_loop=True) which stops the event loop and transfers control to the user.

```python
from strands import Agent
from strands_tools import handoff_to_user

agent = Agent(tools=[handoff_to_user])

# Request user input and continue
response = agent.tool.handoff_to_user(
    message="I need your approval to proceed. Type 'yes' to confirm.",
    breakout_of_loop=False
)

# Complete handoff to user (stops agent execution)
agent.tool.handoff_to_user(
    message="Task completed. Please review the results.",
    breakout_of_loop=True
)
```
This tool is designed for terminal environments as an example implementation. For production applications, you may want to implement custom handoff mechanisms tailored to your specific UI/UX requirements, such as web interfaces or messaging platforms.