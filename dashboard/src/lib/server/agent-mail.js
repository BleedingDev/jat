/**
 * Server-side Agent Mail integration
 * Wraps lib/agent-mail.js for use in SvelteKit server routes
 */

import agentMail from '../../../../lib/agent-mail.js';

/**
 * Get all messages in a thread
 * @param {string} threadId - Thread identifier
 * @returns {Array} - Array of message objects
 */
export function getThreadMessages(threadId) {
	return agentMail.getThreadMessages(threadId);
}

/**
 * Get inbox messages for an agent in a specific thread
 * @param {string} agentName - Agent name
 * @param {string} threadId - Thread identifier
 * @returns {Array} - Array of message objects
 */
export function getInboxForThread(agentName, threadId) {
	return agentMail.getInboxForThread(agentName, threadId);
}

/**
 * Get all registered agents
 * @param {string|null} projectPath - Optional project path to filter by
 * @returns {Array} - Array of agent objects
 */
export function getAgents(projectPath = null) {
	return agentMail.getAgents(projectPath);
}

/**
 * Get all message threads
 * @returns {Array} - Array of thread objects
 */
export function getThreads() {
	return agentMail.getThreads();
}

/**
 * Search messages by query string
 * @param {string} query - Search query
 * @returns {Array} - Array of matching message objects
 */
export function searchMessages(query) {
	return agentMail.searchMessages(query);
}

/**
 * Get file reservations
 * @param {string|null} agentName - Optional agent name to filter by
 * @param {string|null} projectPath - Optional project path to filter by
 * @returns {Array} - Array of reservation objects
 */
export function getReservations(agentName = null, projectPath = null) {
	return agentMail.getReservations(agentName, projectPath);
}
