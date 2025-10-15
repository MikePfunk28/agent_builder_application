great should can we make sure that we are using the latest models, like anthropic.claude-sonnet-4-5-20250929-v1:0 this is the id for claude in bedrock.  right now there is a model selector, that does not list models in bedrock, nor lists ollama ones as well, plus there is no way to actually test the model after created.  Could we use agentcore to host the agent, as it can take container images?  Also this project uses convex, so is that all setup or what?  Can we check that?  Then look at the image, we need more bedrock models, also if we are giving them the script then thats fine, but could we run it in a docker container to test it?  How would we accomplish this?  Also in the second image notice it is not using the full list of tools, the strandsagents tools, which have https://github.com/strands-agents/tools/tree/main/src/strands_tools.  But we need to remember that some tools need to be pip installed, and the need to be imported as well.

anthropic.claude-opus-4-1-20250805-v1:0
anthropic.claude-opus-4-20250514-v1:0
anthropic.claude-sonnet-4-20250514-v1:0
anthropic.claude-3-7-sonnet-20250219-v1:0
anthropic.claude-3-5-haiku-20241022-v1:0
amazon.nova-pro-v1:0
amazon.nova-lite-v1:0
anthropic.claude-3-haiku-20240307-v1:0
amazon.nova-micro-v1:0
amazon.nova-canvas-v1:0
amazon.nova-reel-v1:0
amazon.titan-image-generator-v2:0
amazon.nova-premier-v1:0
anthropic.claude-opus-4-20250514-v1:0

Please just come up with a plan and do not implement anything yet  for more info

we should probably add ollama models right, but how would we get them to work?  Then if we can generate for those platforms, could we potentially use an mcp server to get the docs needed to know how to implement it on other platforms, like Azure, Google, or where-ever?  Yes the ollama, and the llama 3.3, you have to make sure they are correct, and make sure it is using the  decorator.  Use qwen3:4b, qwen3:8b, use the .cursor\docs\ folder to get info for tools, for models etc, and what needs to be pip installed, and then can we create a way to test any model we built?  Also I want a smart interpreter for the prompt, like we should add potentially a workflow for it where it does the requested task, and knows if we need to create a tool for it, with meta-tooling and can create the tool using the  decorator over a python module that does what is needed.  Then the agent we create needs to have all the agentcore, and strandsagents imports, remember some need to be pip installed, which if we create a container it should have all that specified.

Use /docs/ to get everything needed, if you need more information use the context7 mcp, or add the aws mcp to the agentcore, and other documentation.  Also create a diagram of the agent implementation, and of the one we have here.

yes it seems good.  You should keep the lists the same like the tools, models lists, and it uses agentcore for some tools, and uses strandsagents for others and the main   implementation, as well as convex and cloudflare pages.  It uses convex for the backend and cloudflare for the frontend and AWS, and Ollama for the models, and strandsagents and agentcore for models and setup, then AWS or Ollama to host.  However, I also want to provide them all the files they need, agent.py which we use the agent decorator to build and make our own tool that allows other models to specify pre or post processes, as well as the model, system prompt, and tools and will create an agent with @agent. So we make it a tool as well that the models can easily call if they need help on a task, or if the user wants a swarm, or some reason.  Then not only do we supply the agent.py that will run the agent they made, and the dockerfile to load it into agentcore to host the agent I want you to implement a push button deployment to aws, and remember please do not make a mock implementation.

  Check the docs folder for any information you need to know.

  Google OAuth
  GOOGLE_CLIENT_ID
  89369419857-jmqp714gpkr10tjp2i7acioml3d3u8ko.apps.googleusercontent.com

  GOOGLE_CLIENT_SECRET
  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

  AUTH_GITHUB_ID
  Ov23liUe2U4dpqlFQch3

  AUTH_GITHUB_SECRET
  8cd92ac09f06ac6e553535f23e30cc767d6f5dc5