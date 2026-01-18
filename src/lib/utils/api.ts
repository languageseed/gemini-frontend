/**
 * API client for Gemini Marathon Agent backend
 * Uses v2 endpoints with enhanced capabilities
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://gemini-agent-hackathon-production.up.railway.app';

// ============================================================
// TYPES
// ============================================================

interface AgentRequest {
	task: string;
	session_id?: string | null;
	max_iterations?: number;
}

interface ToolCall {
	name: string;
	arguments: Record<string, unknown>;
}

interface AgentResponse {
	text: string;
	tool_calls: ToolCall[];
	iterations: number;
	session_id: string | null;
	completed: boolean;
	error?: string | null;
}

interface HealthResponse {
	status: string;
	model: string;
	secured: boolean;
	version?: string;
	capabilities?: string[];
}

interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

// SSE Event types
type SSEEventType = 'start' | 'thinking' | 'token' | 'tool_start' | 'tool_result' | 'checkpoint' | 'error' | 'done';

interface SSEEvent {
	type: SSEEventType;
	[key: string]: unknown;
}

// ============================================================
// API CLIENT
// ============================================================

class ApiClient {
	private apiKey: string | null = null;

	setApiKey(key: string) {
		this.apiKey = key;
	}

	clearApiKey() {
		this.apiKey = null;
	}

	private getHeaders(): HeadersInit {
		const headers: HeadersInit = {
			'Content-Type': 'application/json'
		};
		if (this.apiKey) {
			headers['X-API-Key'] = this.apiKey;
		}
		return headers;
	}

	/**
	 * Health check endpoint
	 */
	async health(): Promise<HealthResponse> {
		const res = await fetch(`${API_BASE}/health`);
		if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
		return res.json();
	}

	/**
	 * Run Marathon Agent (v2)
	 */
	async agent(request: AgentRequest): Promise<AgentResponse> {
		const res = await fetch(`${API_BASE}/v2/agent`, {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(request)
		});
		
		if (!res.ok) {
			const error = await res.json().catch(() => ({ detail: res.statusText }));
			throw new Error(error.detail || `Request failed: ${res.status}`);
		}
		
		return res.json();
	}

	/**
	 * Run Marathon Agent with SSE streaming (v2)
	 */
	async agentStream(
		request: AgentRequest, 
		onEvent: (event: SSEEvent) => void
	): Promise<void> {
		const res = await fetch(`${API_BASE}/v2/agent/stream`, {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(request)
		});
		
		if (!res.ok) {
			const error = await res.json().catch(() => ({ detail: res.statusText }));
			throw new Error(error.detail || `Request failed: ${res.status}`);
		}

		const reader = res.body?.getReader();
		if (!reader) throw new Error('No response body');

		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			
			// Process complete SSE messages
			const lines = buffer.split('\n');
			buffer = lines.pop() || ''; // Keep incomplete line in buffer

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					try {
						const data = JSON.parse(line.slice(6));
						onEvent(data as SSEEvent);
					} catch {
						// Ignore parse errors
					}
				}
			}
		}
	}

	/**
	 * List available tools
	 */
	async tools(): Promise<ToolDefinition[]> {
		const res = await fetch(`${API_BASE}/v2/tools`);
		if (!res.ok) throw new Error(`Failed to fetch tools: ${res.status}`);
		const data = await res.json();
		return data.tools;
	}

	/**
	 * List sessions
	 */
	async sessions(): Promise<string[]> {
		const res = await fetch(`${API_BASE}/v2/sessions`, {
			headers: this.getHeaders()
		});
		if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
		const data = await res.json();
		return data.sessions;
	}

	/**
	 * Legacy: Simple generation
	 */
	async generate(prompt: string, systemInstruction?: string): Promise<{ text: string; model: string }> {
		const res = await fetch(`${API_BASE}/generate`, {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify({ prompt, system_instruction: systemInstruction })
		});
		
		if (!res.ok) {
			const error = await res.json().catch(() => ({ detail: res.statusText }));
			throw new Error(error.detail || `Request failed: ${res.status}`);
		}
		
		return res.json();
	}
}

export const api = new ApiClient();
export type { AgentRequest, AgentResponse, ToolCall, HealthResponse, ToolDefinition, SSEEvent, SSEEventType };
