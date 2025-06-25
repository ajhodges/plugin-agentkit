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

// Helper functions for action execution
const composeParameterContext = (tool: StructuredTool, state: State): string => {
    return `You are an AI agent with access to the ${tool.name} action.
    
Tool Description: ${tool.description}

Current conversation context:
${state.recentMessagesData.map((msg) => `${msg.user?.name || 'User'}: ${msg.content?.text || ''}`).join('\n')}

Based on this context, determine the appropriate parameters for the ${tool.name} action.
If no specific parameters are mentioned, use reasonable defaults or ask for clarification.`;
};

const composeResponseContext = (tool: StructuredTool, result: unknown, state: State): string => {
    return `You have successfully executed the ${tool.name} action.

Result: ${JSON.stringify(result, null, 2)}

Please provide a natural, conversational response to the user about what was accomplished.
Be specific about the results but keep the tone friendly and helpful.

Current context:
${state.recentMessagesData
    .slice(-3)
    .map((msg) => `${msg.user?.name || 'User'}: ${msg.content?.text || ''}`)
    .join('\n')}`;
};

const generateParameters = async (
    runtime: IAgentRuntime,
    parameterContext: string,
    tool: StructuredTool
): Promise<Record<string, unknown>> => {
    // For tools that don't require parameters (like get_wallet_details), return empty object
    if (!tool.schema || Object.keys(tool.schema).length === 0) {
        return {};
    }

    const response = await runtime.generateText({
        context: parameterContext,
        modelClass: 'SMALL',
        stop: ['\n'],
    });

    try {
        return JSON.parse(response) as Record<string, unknown>;
    } catch {
        return {};
    }
};

const executeToolAction = async (tool: StructuredTool, parameters: Record<string, unknown>): Promise<unknown> => {
    console.log(`🎯 Executing AgentKit tool: ${tool.name} with parameters:`, parameters);
    const result = await tool.invoke(parameters);
    console.log(`✅ Tool ${tool.name} completed with result:`, result);
    return result;
};

const generateResponse = async (
    runtime: IAgentRuntime,
    responseContext: string
): Promise<string> => {
    return await runtime.generateText({
        context: responseContext,
        modelClass: 'SMALL',
        stop: ['\n\n'],
    });
};

/**
 * Get all AgentKit actions
 */
export async function getAgentKitActions({
    getClient,
}: GetAgentKitActionsParams): Promise<Action[]> {
    const agentKit = await getClient();
    const tools = await getLangChainTools(agentKit);

    console.log(
        '🔧 Available AgentKit tools:',
        tools.map((tool) => ({
            name: tool.name,
            description: `${tool.description.substring(0, 100)}...`,
        }))
    );

    const actions = tools.map((tool: StructuredTool) => ({
        name: tool.name.toUpperCase().replace(/-/g, '_'),
        description: tool.description,
        similes: [],
        validate: async () => true,
        handler: async (
            runtime: IAgentRuntime,
            message: Memory,
            state: State | undefined,
            _options?: Record<string, unknown>,
            callback?: HandlerCallback
        ): Promise<boolean> => {
            try {
                console.log(
                    `🚀 Handling action ${tool.name} for message: ${message.content?.text}`
                );

                const _client = await getClient();
                let currentState = state ?? (await runtime.composeState(message));
                currentState = await runtime.updateRecentMessageState(currentState);

                const parameterContext = composeParameterContext(tool, currentState);
                const parameters = await generateParameters(runtime, parameterContext, tool);

                const result = await executeToolAction(tool, parameters);

                const responseContext = composeResponseContext(tool, result, currentState);
                const response = await generateResponse(runtime, responseContext);

                callback?.({ text: response, content: result });
                return true;
            } catch (error) {
                console.error(`❌ Error executing AgentKit action ${tool.name}:`, error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                callback?.({
                    text: `Sorry, I encountered an error while executing ${tool.name}: ${errorMessage}`,
                    content: { error: errorMessage },
                });
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
