interface AgentMessagePayload {
	subject: string;
	body: string;
	thread: string;
}

interface AgentMessageRequest {
	endpoint: string;
	payload: AgentMessagePayload;
}

/**
 * Build a normalized message request for a specific agent.
 * Keeps endpoint/payload construction in one place to avoid regressions.
 */
export function buildAgentMessageRequest(
	agentName: string,
	threadId: string,
	messageBody: string
): AgentMessageRequest {
	const normalizedAgentName = agentName?.trim();
	const normalizedThreadId = threadId?.trim();
	const normalizedMessageBody = messageBody?.trim();

	if (!normalizedAgentName) {
		throw new Error('Agent name is required');
	}

	if (!normalizedThreadId) {
		throw new Error('Thread ID is required');
	}

	if (!normalizedMessageBody) {
		throw new Error('Message body is required');
	}

	return {
		endpoint: `/api/agents/${encodeURIComponent(normalizedAgentName)}/message`,
		payload: {
			subject: `Re: ${normalizedThreadId}`,
			body: normalizedMessageBody,
			thread: normalizedThreadId
		}
	};
}

