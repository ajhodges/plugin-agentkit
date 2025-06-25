import {
    type Action,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
} from '@elizaos/core';
import type { AgentKit } from '@coinbase/agentkit';
import { getLangChainTools } from '@coinbase/agentkit-langchain';
import type { StructuredTool } from '@langchain/core/tools';

type GetAgentKitActionsParams = {
    getClient: () => Promise<AgentKit>;
};

/**
 * Template for extracting parameters from user messages
 */
const parameterExtractionTemplate = `
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

/**
 * Extract parameters from user message using LLM
 */
async function extractParameters(
    runtime: IAgentRuntime,
    message: Memory,
    tool: StructuredTool
): Promise<Record<string, unknown>> {
    try {
        console.log(`🔍 Extracting parameters for tool: ${tool.name}`);

        // Get tool schema information
        const toolSchema = tool.schema ? JSON.stringify(tool.schema, null, 2) : undefined;

        // Generate parameter extraction prompt
        const extractionPrompt = parameterExtractionTemplate
            .replace('{{message.content.text}}', message.content?.text || '')
            .replace('{{toolName}}', tool.name)
            .replace('{{toolDescription}}', tool.description)
            .replace('{{toolSchema}}', toolSchema || 'No schema available');

        // Use runtime to generate parameters
        const response = await runtime.generateText({
            context: extractionPrompt,
            modelClass: 'SMALL',
        });

        // Parse the JSON response
        const cleanedResponse = response.trim().replace(/^```json\s*|\s*```$/g, '');
        let parameters: Record<string, unknown>;

        try {
            parameters = JSON.parse(cleanedResponse);
        } catch (_parseError) {
            console.warn(`⚠️ Failed to parse parameters as JSON: ${cleanedResponse}`);
            // If JSON parsing fails, try to extract simple parameters
            parameters = extractSimpleParameters(message.content?.text || '');
        }

        console.log('✅ Extracted parameters:', parameters);
        return parameters;

    } catch (error) {
        console.error('❌ Error extracting parameters:', error);
        return {};
    }
}

/**
 * Fallback: Extract simple parameters from message text
 */
function extractSimpleParameters(text: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    
    // Extract common patterns
    const patterns = {
        amount: /(\d+(?:\.\d+)?)\s*(?:tokens?|coins?|eth|matic|sol)?/i,
        address: /(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/,
        recipient: /(?:to|send to|transfer to)\s+([a-zA-Z0-9]{32,44})/i,
        symbol: /(?:symbol|ticker)\s+([A-Z]{2,6})/i,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
        const match = text.match(pattern);
        if (match) {
            params[key] = match[1];
        }
    }

    return params;
}

/**
 * Get actions for AgentKit integration with ElizaOS
 */
export async function getAgentKitActions({
    getClient,
}: GetAgentKitActionsParams): Promise<Action[]> {
    console.log('🔧 Setting up AgentKit tools...');

    // Get the AgentKit client
    const agentkit = await getClient();

    // Get LangChain tools from AgentKit
    const tools = getLangChainTools({ agentkit });

    console.log(`📋 Found ${tools.length} AgentKit tools`);

    // Create ElizaOS actions from AgentKit tools
    const actions = tools.map((tool: StructuredTool) => ({
        name: tool.name.toUpperCase(),
        similes: [],
        description: tool.description,
        validate: async () => true,
        handler: async (
            runtime: IAgentRuntime,
            message: Memory,
            _state: State | undefined,
            _options?: Record<string, unknown>,
            callback?: HandlerCallback
        ): Promise<boolean> => {
            try {
                console.log(`🚀 Executing AgentKit action: ${tool.name}`);

                // Extract parameters from user message
                const parameters = await extractParameters(runtime, message, tool);

                // Execute the tool with extracted parameters
                const result = await tool.invoke(parameters);

                const response = typeof result === 'string' ? result : JSON.stringify(result);

                if (callback) {
                    callback({
                        text: response,
                        content: {
                            text: response,
                            action: tool.name,
                            parameters,
                            source: 'agentkit',
                            success: true,
                        },
                    });
                }

                return true;
            } catch (error) {
                console.error(`❌ Error executing ${tool.name}:`, error);
                
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                
                if (callback) {
                    callback({
                        text: `Error executing ${tool.name}: ${errorMessage}`,
                        content: {
                            text: `Failed to execute ${tool.name}`,
                            error: errorMessage,
                            action: tool.name,
                            source: 'agentkit',
                            success: false,
                        },
                    });
                }

                return false;
            }
        },
        examples: [],
    }));

    console.log(
        '🎯 Generated ElizaOS actions:',
        actions.map((action) => ({
            name: action.name,
            similes: action.similes.length,
        }))
    );

    return actions;
}
