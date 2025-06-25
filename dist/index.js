// src/provider.ts
import { AgentKit, CdpWalletProvider } from "@coinbase/agentkit";
import * as fs from "node:fs";
var WALLET_DATA_FILE = "wallet_data.txt";
async function getClient() {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  if (!apiKeyId || !apiKeySecret) {
    throw new Error(
      "Missing required CDP API credentials. Please set CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables."
    );
  }
  const networkId = process.env.NETWORK_ID || "base-sepolia";
  const _walletSecret = process.env.CDP_WALLET_SECRET;
  let walletDataStr = null;
  if (fs.existsSync(WALLET_DATA_FILE)) {
    try {
      walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
    } catch (error) {
      console.error("Error reading wallet data:", error);
    }
  }
  try {
    const walletProvider2 = await CdpWalletProvider.configureWithWallet({
      apiKeyId,
      apiKeyPrivate: apiKeySecret,
      networkId,
      cdpWalletData: walletDataStr || void 0
    });
    const agentKit = await AgentKit.from({
      walletProvider: walletProvider2
    });
    const exportedWallet = await walletProvider2.exportWallet();
    const walletDataToSave = typeof exportedWallet === "string" ? exportedWallet : JSON.stringify(exportedWallet);
    fs.writeFileSync(WALLET_DATA_FILE, walletDataToSave);
    return agentKit;
  } catch (error) {
    console.error("Failed to initialize AgentKit:", error);
    throw new Error(`Failed to initialize AgentKit: ${error.message || "Unknown error"}`);
  }
}
var walletProvider = {
  async get(_runtime) {
    try {
      const client = await getClient();
      const walletInfo = await client.getWalletDetails();
      return `AgentKit Wallet Address: ${walletInfo.address}`;
    } catch (error) {
      console.error("Error in AgentKit provider:", error);
      return `Error initializing AgentKit wallet: ${error.message}`;
    }
  }
};

// src/actions.ts
import {
  generateText,
  ModelClass,
  composeContext,
  generateObject
} from "@elizaos/core";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
async function getAgentKitActions({
  getClient: getClient2
}) {
  const agentKit = await getClient2();
  const tools = await getLangChainTools(agentKit);
  const actions = tools.map((tool) => ({
    name: tool.name.toUpperCase().replace(/_/g, "_"),
    description: tool.description,
    similes: [],
    validate: async () => true,
    handler: async (runtime, message, state, _options, callback) => {
      try {
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        callback == null ? void 0 : callback({
          text: `Error executing action ${tool.name}: ${errorMessage}`,
          content: { error: errorMessage }
        });
        return false;
      }
    },
    examples: []
  }));
  return actions;
}
async function executeToolAction(tool, parameters) {
  return await tool.call(parameters);
}
function composeParameterContext(tool, state) {
  const contextTemplate = `{{recentMessages}}

Given the recent messages, extract the following information for the action "${tool.name}":
${tool.description}

Schema: ${JSON.stringify(tool.schema, null, 2)}
`;
  return composeContext({ state, template: contextTemplate });
}
async function generateParameters(runtime, context, tool) {
  const { object } = await generateObject({
    runtime,
    context,
    modelClass: ModelClass.LARGE,
    schema: tool.schema
  });
  return object;
}
function composeResponseContext(tool, result, state) {
  const responseTemplate = `
# Action Examples
{{actionExamples}}

# Knowledge
{{knowledge}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

The action "${tool.name}" was executed successfully.
Here is the result:
${JSON.stringify(result, null, 2)}

{{actions}}

Respond to the message knowing that the action was successful and these were the previous messages:
{{recentMessages}}
`;
  return composeContext({ state, template: responseTemplate });
}
async function generateResponse(runtime, context) {
  return generateText({
    runtime,
    context,
    modelClass: ModelClass.LARGE
  });
}

// src/index.ts
console.log("\n\u250C\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2510");
console.log("\u2502          AGENTKIT PLUGIN               \u2502");
console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
console.log("\u2502  Initializing AgentKit Plugin...       \u2502");
console.log("\u2502  Version: 0.25.6-alpha.3 (Updated)    \u2502");
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
    const actions = await getAgentKitActions({
      getClient
    });
    console.log("\u2714 AgentKit actions initialized successfully.");
    console.log(`\u2714 Loaded ${actions.length} AgentKit actions.`);
    return actions;
  } catch (error) {
    console.error("\u274C Failed to initialize AgentKit actions:", error);
    return [];
  }
};
var agentKitPlugin = {
  name: "[AgentKit] Integration",
  description: "AgentKit integration plugin for onchain AI agent actions",
  providers: [walletProvider],
  evaluators: [],
  services: [],
  actions: await initializeActions()
};
var index_default = agentKitPlugin;
export {
  agentKitPlugin,
  index_default as default
};
//# sourceMappingURL=index.js.map