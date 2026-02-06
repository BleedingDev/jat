import { describe, it, expect } from 'vitest';
import { buildAgentMessageRequest } from './agentMessageRequest';

describe('buildAgentMessageRequest', () => {
	it('builds per-agent endpoint and payload for a task thread', () => {
		const request = buildAgentMessageRequest('CodexAgent', 'jat-123', 'Please pick up the next item');

		expect(request.endpoint).toBe('/api/agents/CodexAgent/message');
		expect(request.endpoint).not.toBe('/api/agents/message');
		expect(request.payload).toEqual({
			subject: 'Re: jat-123',
			body: 'Please pick up the next item',
			thread: 'jat-123'
		});
	});

	it('URL-encodes agent names and trims message body', () => {
		const request = buildAgentMessageRequest('Codex Agent/Blue', 'jat-99', '  Ship it  ');

		expect(request.endpoint).toBe('/api/agents/Codex%20Agent%2FBlue/message');
		expect(request.payload.body).toBe('Ship it');
	});

	it('throws when agent name is empty', () => {
		expect(() => buildAgentMessageRequest('', 'jat-123', 'hello')).toThrow('Agent name is required');
	});

	it('throws when thread id is empty', () => {
		expect(() => buildAgentMessageRequest('CodexAgent', '', 'hello')).toThrow('Thread ID is required');
	});

	it('throws when message body is empty', () => {
		expect(() => buildAgentMessageRequest('CodexAgent', 'jat-123', '   ')).toThrow('Message body is required');
	});
});

