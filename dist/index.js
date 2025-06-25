// src/provider.ts
import { CdpWalletProvider } from "@coinbase/agentkit";
import { AgentKit } from "@coinbase/agentkit";
import * as fs from "node:fs";
import * as path from "node:path";
var client = null;
var getClient = async () => {
  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    throw new Error(
      "Missing required CDP API credentials. Please set CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables."
    );
  }
  if (client) {
    return client;
  }
  const networkId = process.env.CDP_AGENT_KIT_NETWORK || "base-sepolia";
  const walletDataPath = path.join(process.cwd(), "wallet_data.txt");
  try {
    let walletProvider2;
    if (fs.existsSync(walletDataPath)) {
      try {
        const walletDataStr = fs.readFileSync(walletDataPath, "utf8");
        console.log("Loading existing wallet...");
        walletProvider2 = await CdpWalletProvider.configureWithWallet({
          cdpWalletData: walletDataStr,
          networkId,
          apiKeyId: process.env.CDP_API_KEY_ID,
          apiKeyPrivate: process.env.CDP_API_KEY_SECRET
        });
      } catch (error) {
        console.error("Error reading wallet data:", error);
        throw error;
      }
    } else {
      console.log("Creating new wallet...");
      walletProvider2 = await CdpWalletProvider.configureWithWallet({
        networkId,
        apiKeyId: process.env.CDP_API_KEY_ID,
        apiKeyPrivate: process.env.CDP_API_KEY_SECRET
      });
      const exportedWallet = await walletProvider2.exportWallet();
      const walletDataToSave = typeof exportedWallet === "string" ? exportedWallet : JSON.stringify(exportedWallet);
      fs.writeFileSync(walletDataPath, walletDataToSave);
      console.log("Wallet data saved to wallet_data.txt");
    }
    client = await AgentKit.from({
      walletProvider: walletProvider2
    });
    client._walletProvider = walletProvider2;
    console.log("\u2705 AgentKit initialized successfully");
    return client;
  } catch (error) {
    console.error("Failed to initialize AgentKit:", error);
    throw error;
  }
};
var walletProvider = {
  async get() {
    try {
      const client2 = await getClient();
      const storedWalletProvider = client2._walletProvider;
      if (storedWalletProvider == null ? void 0 : storedWalletProvider.address) {
        return `AgentKit Wallet Address: ${storedWalletProvider.address}`;
      }
      return "Wallet details not available";
    } catch (error) {
      console.error("Error in AgentKit provider:", error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
};

// src/actions.ts
import { getLangChainTools } from "@coinbase/agentkit-langchain";
var composeParameterContext = (tool, state) => {
  return `You are an AI agent with access to the ${tool.name} action.
    
Tool Description: ${tool.description}

Current conversation context:
${state.recentMessagesData.map((msg) => {
    var _a, _b;
    return `${((_a = msg.user) == null ? void 0 : _a.name) || "User"}: ${((_b = msg.content) == null ? void 0 : _b.text) || ""}`;
  }).join("\n")}

Based on this context, determine the appropriate parameters for the ${tool.name} action.
If no specific parameters are mentioned, use reasonable defaults or ask for clarification.`;
};
var composeResponseContext = (tool, result, state) => {
  return `You have successfully executed the ${tool.name} action.

Result: ${JSON.stringify(result, null, 2)}

Please provide a natural, conversational response to the user about what was accomplished.
Be specific about the results but keep the tone friendly and helpful.

Current context:
${state.recentMessagesData.slice(-3).map((msg) => {
    var _a, _b;
    return `${((_a = msg.user) == null ? void 0 : _a.name) || "User"}: ${((_b = msg.content) == null ? void 0 : _b.text) || ""}`;
  }).join("\n")}`;
};
var generateParameters = async (runtime, parameterContext, tool) => {
  if (!tool.schema || Object.keys(tool.schema).length === 0) {
    return {};
  }
  const response = await runtime.generateText({
    context: parameterContext,
    modelClass: "SMALL",
    stop: ["\n"]
  });
  try {
    return JSON.parse(response);
  } catch {
    return {};
  }
};
var executeToolAction = async (tool, parameters) => {
  console.log(`\u{1F3AF} Executing AgentKit tool: ${tool.name} with parameters:`, parameters);
  const result = await tool.invoke(parameters);
  console.log(`\u2705 Tool ${tool.name} completed with result:`, result);
  return result;
};
var generateResponse = async (runtime, responseContext) => {
  return await runtime.generateText({
    context: responseContext,
    modelClass: "SMALL",
    stop: ["\n\n"]
  });
};
async function getAgentKitActions({
  getClient: getClient2
}) {
  const agentKit = await getClient2();
  const tools = await getLangChainTools(agentKit);
  console.log(
    "\u{1F527} Available AgentKit tools:",
    tools.map((tool) => ({
      name: tool.name,
      description: `${tool.description.substring(0, 100)}...`
    }))
  );
  const actions2 = tools.map((tool) => ({
    name: tool.name.toUpperCase().replace(/-/g, "_"),
    description: tool.description,
    similes: [],
    validate: async () => true,
    handler: async (runtime, message, state, _options, callback) => {
      var _a;
      try {
        console.log(
          `\u{1F680} Handling action ${tool.name} for message: ${(_a = message.content) == null ? void 0 : _a.text}`
        );
        const _client = await getClient2();
        let currentState = state ?? await runtime.composeState(message);
        currentState = await runtime.updateRecentMessageState(currentState);
        const parameterContext = composeParameterContext(tool, currentState);
        const parameters = await generateParameters(runtime, parameterContext, tool);
        const result = await executeToolAction(tool, parameters);
        const responseContext = composeResponseContext(tool, result, currentState);
        const response = await generateResponse(runtime, responseContext);
        callback == null ? void 0 : callback({ text: response, content: result });
        return true;
      } catch (error) {
        console.error(`\u274C Error executing AgentKit action ${tool.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        callback == null ? void 0 : callback({
          text: `Sorry, I encountered an error while executing ${tool.name}: ${errorMessage}`,
          content: { error: errorMessage }
        });
        return false;
      }
    },
    examples: []
  }));
  console.log(
    "\u{1F3AF} Generated ElizaOS actions:",
    actions2.map((action) => ({
      name: action.name,
      similes: action.similes.length
    }))
  );
  return actions2;
}

// src/index.ts
console.log("\n\u250C\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2510");
console.log("\u2502          AGENTKIT PLUGIN               \u2502");
console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
console.log("\u2502  Initializing AgentKit Plugin...       \u2502");
console.log("\u2502  Version: 0.25.6-alpha.7               \u2502");
console.log("\u2514\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2518");
var initializeActions = async () => {
  try {
    const apiKeyId = process.env.CDP_API_KEY_ID;
    const apiKeySecret = process.env.CDP_API_KEY_SECRET;
    if (!apiKeyId || !apiKeySecret) {
      console.warn("\u26A0\uFE0F Missing CDP API credentials - AgentKit actions will not be available");
      console.warn(
        "   Please set CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables"
      );
      return [];
    }
    console.log("\u{1F680} Initializing AgentKit client...");
    const actions2 = await getAgentKitActions({
      getClient
    });
    console.log("\u2714 AgentKit actions initialized successfully.");
    console.log(`\u2714 Loaded ${actions2.length} AgentKit actions.`);
    return actions2;
  } catch (error) {
    console.error("\u274C Failed to initialize AgentKit actions:", error);
    return [];
  }
};
var actions = await initializeActions();
var agentKitPlugin = {
  name: "[AgentKit] Integration",
  description: "AgentKit integration plugin for onchain AI agent actions",
  providers: [walletProvider],
  evaluators: [],
  services: [],
  actions
};
var index_default = agentKitPlugin;
export {
  agentKitPlugin,
  index_default as default
};
//# sourceMappingURL=index.js.map