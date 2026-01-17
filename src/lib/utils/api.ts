/**
 * API client for Gemini Agent backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://gemini-agent-hackathon-production.up.railway.app';

interface AgentRequest {
	prompt: string;
	system_instruction?: string;
	max_iterations?: number;
}

interface ToolCall {
	name: string;
	arguments: Record<string, unknown>;
}

interface AgentResponse {
	text: string;
	model: string;
	tool_calls: ToolCall[];
	iterations: number;
}

interface HealthResponse {
	status: string;
	model: string;
	secured: boolean;
}

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

	async health(): Promise<HealthResponse> {
		const res = await fetch(`${API_BASE}/health`);
		if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
		return res.json();
	}

	async agent(request: AgentRequest): Promise<AgentResponse> {
		const res = await fetch(`${API_BASE}/agent`, {
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
export type { AgentRequest, AgentResponse, ToolCall, HealthResponse };
