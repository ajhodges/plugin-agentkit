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
var parameterExtractionTemplate = `
Based on the user's message and the tool description, extract the required parameters in JSON format.

User Message: "{{message.content.text}}"
Tool: {{toolName}}
Tool Description: {{toolDescription}}

{{#if toolSchema}}
Tool Schema: {{toolSchema}}
{{/if}}

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
async function extractParameters(runtime, message, tool) {
  var _a, _b;
  try {
    console.log(`\u{1F50D} Extracting parameters for tool: ${tool.name}`);
    const toolSchema = tool.schema ? JSON.stringify(tool.schema, null, 2) : void 0;
    const extractionPrompt = parameterExtractionTemplate.replace("{{message.content.text}}", ((_a = message.content) == null ? void 0 : _a.text) || "").replace("{{toolName}}", tool.name).replace("{{toolDescription}}", tool.description).replace("{{toolSchema}}", toolSchema || "No schema available");
    const response = await runtime.generateText({
      context: extractionPrompt,
      modelClass: "SMALL"
    });
    const cleanedResponse = response.trim().replace(/^```json\s*|\s*```$/g, "");
    let parameters;
    try {
      parameters = JSON.parse(cleanedResponse);
    } catch (_parseError) {
      console.warn(`\u26A0\uFE0F Failed to parse parameters as JSON: ${cleanedResponse}`);
      parameters = extractSimpleParameters(((_b = message.content) == null ? void 0 : _b.text) || "");
    }
    console.log("\u2705 Extracted parameters:", parameters);
    return parameters;
  } catch (error) {
    console.error("\u274C Error extracting parameters:", error);
    return {};
  }
}
function extractSimpleParameters(text) {
  const params = {};
  const patterns = {
    amount: /(\d+(?:\.\d+)?)\s*(?:tokens?|coins?|eth|matic|sol)?/i,
    address: /(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/,
    recipient: /(?:to|send to|transfer to)\s+([a-zA-Z0-9]{32,44})/i,
    symbol: /(?:symbol|ticker)\s+([A-Z]{2,6})/i
  };
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match) {
      params[key] = match[1];
    }
  }
  return params;
}
async function getAgentKitActions({
  getClient: getClient2
}) {
  console.log("\u{1F527} Setting up AgentKit tools...");
  const agentkit = await getClient2();
  const tools = getLangChainTools(agentkit);
  console.log(`\u{1F4CB} Found ${tools.length} AgentKit tools`);
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

// src/index.ts
console.log("\n\u250C\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2510");
console.log("\u2502          AGENTKIT PLUGIN               \u2502");
console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
console.log("\u2502  Initializing AgentKit Plugin...       \u2502");
console.log("\u2502  Version: 0.25.6-alpha.8 (Runtime Fix)\u2502");
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