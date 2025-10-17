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