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
async function extractParameters(runtime, message, tool) {
  var _a, _b, _c, _d;
  console.log(`\u{1F50D} Extracting parameters for tool: ${tool.name}`);
  const messageText = ((_a = message.content) == null ? void 0 : _a.text) || "";
  if (!tool.schema || !messageText) {
    console.log("\u2705 Using empty parameters (tool needs no input)");
    return {};
  }
  try {
    const toolSchema = tool.schema ? JSON.stringify(tool.schema, null, 2) : "No schema available";
    const extractionPrompt = `Based on the user's message and the tool description, extract the required parameters in JSON format.

User Message: "${messageText}"
Tool: ${tool.name}
Tool Description: ${tool.description}
Tool Schema: ${toolSchema}

Instructions:
- Extract only the parameters that the tool requires
- Use the tool's schema to understand parameter types and requirements
- If a parameter is not mentioned in the message, omit it or use null
- Return valid JSON only, no explanations

Example format:
{
  "parameter1": "value1",
  "parameter2": 123,
  "parameter3": true
}

Extract parameters:`;
    const response = await runtime.useModel({
      messages: [{ role: "user", content: extractionPrompt }]
    });
    const responseText = ((_d = (_c = (_b = response.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content) || response.content || "";
    const cleanedResponse = responseText.trim().replace(/^```json\s*|\s*```$/g, "");
    let parameters;
    try {
      parameters = JSON.parse(cleanedResponse);
    } catch (_parseError) {
      console.warn(`\u26A0\uFE0F Failed to parse parameters as JSON: ${cleanedResponse}`);
      parameters = extractSimpleParameters(messageText);
    }
    console.log("\u2705 Extracted parameters:", parameters);
    return parameters;
  } catch (error) {
    console.warn("\u26A0\uFE0F Error in parameter extraction, using simple fallback:", error);
    return extractSimpleParameters(messageText);
  }
}
function extractSimpleParameters(messageText) {
  const parameters = {};
  const patterns = {
    amount: /(\d+(?:\.\d+)?)\s*(?:tokens?|coins?|eth|matic|sol|usdc|usdt)?/i,
    address: /(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/,
    recipient: /(?:to|send to|transfer to|recipient)\s*:?\s*([a-zA-Z0-9]{32,44}|0x[a-fA-F0-9]{40})/i,
    symbol: /(?:symbol|ticker|token)\s*:?\s*([A-Z]{2,6})/i
  };
  for (const [key, pattern] of Object.entries(patterns)) {
    if (key === "amount") {
      const match = messageText.match(pattern);
      if (match) parameters.amount = Number.parseFloat(match[1]);
    } else {
      const match = messageText.match(pattern);
      if (match) parameters[key] = match[1];
    }
  }
  if (Object.keys(parameters).length === 0 && messageText) {
    parameters.query = messageText;
  }
  console.log("\u2705 Simple parameter extraction result:", parameters);
  return parameters;
}
async function getAgentKitActions({
  getClient: getClient2
}) {
  console.log("\u{1F527} Setting up AgentKit tools...");
  const agentkit = await getClient2();
  console.log("\u{1F50D} AgentKit instance:", agentkit);
  console.log("\u{1F50D} AgentKit constructor:", agentkit.constructor.name);
  let tools;
  try {
    console.log("\u{1F50D} Calling getLangChainTools...");
    const toolsResult = await getLangChainTools(agentkit);
    console.log("\u{1F50D} getLangChainTools result:", toolsResult);
    console.log("\u{1F50D} Type of result:", typeof toolsResult);
    if (!toolsResult) {
      console.error("\u274C getLangChainTools returned undefined/null");
      throw new Error("getLangChainTools returned undefined/null");
    }
    if (!Array.isArray(toolsResult)) {
      console.error("\u274C getLangChainTools did not return an array:", toolsResult);
      throw new Error(`getLangChainTools returned ${typeof toolsResult}, expected array`);
    }
    tools = toolsResult;
    console.log(`\u{1F4CB} Found ${tools.length} AgentKit tools`);
    tools.forEach((tool, index) => {
      console.log(`\u{1F527} Tool ${index + 1}: ${tool.name} - ${tool.description}`);
    });
  } catch (error) {
    console.error("\u274C Error calling getLangChainTools:", error);
    console.log("\u{1F504} Attempting to create basic wallet tools as fallback...");
    tools = await createFallbackTools(agentkit);
  }
  const actions2 = tools.map((tool) => ({
    name: tool.name.toUpperCase(),
    similes: [],
    description: tool.description,
    validate: async () => true,
    handler: async (runtime, message, _state, _options, callback) => {
      try {
        console.log(`\u{1F680} Executing AgentKit action: ${tool.name}`);
        const parameters = await extractParameters(runtime, message, tool);
        const result = await tool.invoke(parameters);
        const response = typeof result === "string" ? result : JSON.stringify(result);
        if (callback) {
          callback({
            text: response,
            content: {
              text: response,
              action: tool.name,
              parameters,
              source: "agentkit",
              success: true
            }
          });
        }
        return true;
      } catch (error) {
        console.error(`\u274C Error executing ${tool.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        if (callback) {
          callback({
            text: `Error executing ${tool.name}: ${errorMessage}`,
            content: {
              text: `Failed to execute ${tool.name}`,
              error: errorMessage,
              action: tool.name,
              source: "agentkit",
              success: false
            }
          });
        }
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
async function createFallbackTools(agentkit) {
  console.log("\u{1F504} Creating fallback tools...");
  try {
    console.log("\u{1F50D} Available methods on AgentKit:", Object.getOwnPropertyNames(Object.getPrototypeOf(agentkit)));
    const agentkitWithMethods = agentkit;
    if ("getActions" in agentkit && typeof agentkitWithMethods.getActions === "function") {
      console.log("\u{1F50D} Found getActions method, trying it...");
      const actions2 = agentkitWithMethods.getActions();
      console.log("\u{1F50D} getActions result:", actions2);
    }
    const walletInfoTool = {
      name: "get_wallet_info",
      description: "Get wallet information including address and balance",
      schema: {
        type: "object",
        properties: {},
        required: []
      },
      invoke: async () => {
        try {
          const agentkitWithWallet = agentkit;
          const walletProvider2 = agentkitWithWallet._walletProvider;
          if (walletProvider2 == null ? void 0 : walletProvider2.address) {
            return `Wallet Address: ${walletProvider2.address}`;
          }
          return "Wallet information not available";
        } catch (error) {
          return `Error getting wallet info: ${error}`;
        }
      }
    };
    console.log("\u2705 Created fallback wallet info tool");
    return [walletInfoTool];
  } catch (error) {
    console.error("\u274C Error creating fallback tools:", error);
    return [];
  }
}

// src/index.ts
var requiredEnvVars = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET"];
function validateEnvironment() {
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error("\u274C Missing required environment variables for AgentKit plugin:");
    for (const varName of missingVars) {
      console.error(`   - ${varName}`);
    }
    console.error("\n\u{1F4DD} Please set these environment variables to use the AgentKit plugin.");
    console.error("   Example: CDP_API_KEY_ID=your_key_id CDP_API_KEY_SECRET=your_secret");
    throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
  }
}
async function initializeActions() {
  try {
    console.log("\n\u250C\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2510");
    console.log("\u2502          AGENTKIT PLUGIN               \u2502");
    console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log("\u2502  Initializing AgentKit Plugin...       \u2502");
    console.log("\u2502  Version: 0.25.6-alpha.18 (1.x Compat)\u2502");
    console.log("\u2514\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2518");
    console.log("\u{1F680} Initializing AgentKit client...");
    const actions2 = await getAgentKitActions({
      getClient
    });
    console.log("\u2714 AgentKit actions initialized successfully.");
    console.log(`\u2714 Loaded ${actions2.length} AgentKit actions.`);
    return actions2;
  } catch (error) {
    console.error("\u274C Failed to initialize AgentKit actions:", error);
    throw error;
  }
}
validateEnvironment();
var actions = await initializeActions();
var agentKitPlugin = {
  name: "agentkit",
  description: "AgentKit integration for ElizaOS - enables blockchain and crypto operations",
  actions,
  providers: [walletProvider],
  evaluators: [],
  services: []
};
var index_default = agentKitPlugin;
export {
  agentKitPlugin,
  index_default as default
};
//# sourceMappingURL=index.js.map