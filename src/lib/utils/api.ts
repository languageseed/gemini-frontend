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
	reasoning_model?: string;
	secured: boolean;
	version?: string;
	capabilities?: string[];
	config?: {
		e2b_configured?: boolean;
		gemini_configured?: boolean;
	};
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

const API_KEY_STORAGE_KEY = 'gemini_api_key';
const STORAGE_TYPE_KEY = 'gemini_api_key_storage_type';

type StorageType = 'session' | 'local' | 'memory';

class ApiClient {
	private apiKey: string | null = null;
	private storageType: StorageType = 'session'; // Default to session for security

	constructor() {
		if (typeof window !== 'undefined') {
			// Check preferred storage type
			const storedType = localStorage.getItem(STORAGE_TYPE_KEY) as StorageType | null;
			this.storageType = storedType || 'session';
			
			// Load API key from appropriate storage
			if (this.storageType === 'local') {
				this.apiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
			} else if (this.storageType === 'session') {
				this.apiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
			}
			// 'memory' mode = don't persist, just keep in memory
		}
	}

	/**
	 * Set storage type for API key
	 * - 'session': Cleared when browser tab closes (more secure)
	 * - 'local': Persists across sessions (convenient but less secure)
	 * - 'memory': Never persisted (most secure, but lost on refresh)
	 */
	setStorageType(type: StorageType) {
		this.storageType = type;
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_TYPE_KEY, type);
			
			// Migrate existing key if needed
			if (this.apiKey) {
				this.setApiKey(this.apiKey);
			}
		}
	}

	getStorageType(): StorageType {
		return this.storageType;
	}

	setApiKey(key: string) {
		this.apiKey = key;
		if (typeof window !== 'undefined') {
			// Clear from both storages first
			localStorage.removeItem(API_KEY_STORAGE_KEY);
			sessionStorage.removeItem(API_KEY_STORAGE_KEY);
			
			// Store in appropriate location
			if (this.storageType === 'local') {
				localStorage.setItem(API_KEY_STORAGE_KEY, key);
			} else if (this.storageType === 'session') {
				sessionStorage.setItem(API_KEY_STORAGE_KEY, key);
			}
			// 'memory' mode = don't store anywhere
		}
	}

	clearApiKey() {
		this.apiKey = null;
		if (typeof window !== 'undefined') {
			localStorage.removeItem(API_KEY_STORAGE_KEY);
			sessionStorage.removeItem(API_KEY_STORAGE_KEY);
		}
	}

	getApiKey(): string | null {
		return this.apiKey;
	}

	hasApiKey(): boolean {
		return !!this.apiKey;
	}

	getHeaders(): HeadersInit {
		const headers: HeadersInit = {
			'Content-Type': 'application/json'
		};
		// Only add API key header if we have one
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

	/**
	 * Analyze a GitHub repository (v3 - Hackathon Feature)
	 */
	async analyzeRepo(request: AnalyzeRepoRequest): Promise<AnalyzeRepoResponse> {
		const res = await fetch(`${API_BASE}/v3/analyze`, {
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
	 * List codebase analyst tools (v3)
	 */
	async codebaseTools(): Promise<ToolDefinition[]> {
		const res = await fetch(`${API_BASE}/v3/tools`);
		if (!res.ok) throw new Error(`Failed to fetch tools: ${res.status}`);
		const data = await res.json();
		return data.tools;
	}

	/**
	 * Submit an async analysis job (v4)
	 * Uses polling instead of SSE to avoid Railway's 5-minute timeout
	 */
	async submitAsyncJob(request: AsyncJobRequest): Promise<AsyncJobResponse> {
		const res = await fetch(`${API_BASE}/v4/analyze/async`, {
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
	 * Get async job status (v4)
	 */
	async getJobStatus(jobId: string): Promise<AsyncJobStatus> {
		const res = await fetch(`${API_BASE}/v4/jobs/${jobId}`, {
			headers: this.getHeaders()
		});
		
		if (!res.ok) {
			const error = await res.json().catch(() => ({ detail: res.statusText }));
			throw new Error(error.detail || `Request failed: ${res.status}`);
		}
		
		return res.json();
	}

	/**
	 * Poll job until complete
	 */
	async pollJobUntilComplete(
		jobId: string,
		onProgress: (status: AsyncJobStatus) => void,
		intervalMs: number = 3000
	): Promise<AsyncJobStatus> {
		while (true) {
			const status = await this.getJobStatus(jobId);
			onProgress(status);
			
			if (status.status === 'completed' || status.status === 'failed') {
				return status;
			}
			
			await new Promise(resolve => setTimeout(resolve, intervalMs));
		}
	}
}

// V3 Types - Codebase Analyst
interface AnalyzeRepoRequest {
	repo_url: string;
	focus?: 'bugs' | 'security' | 'performance' | 'architecture' | 'all';
	branch?: string;
	path_filter?: string;
	session_id?: string;
}

interface AnalyzeRepoResponse {
	analysis: string;
	repo_url: string;
	files_analyzed: number;
	issues_found: number;
	tool_calls: ToolCall[];
	iterations: number;
	session_id: string | null;
	completed: boolean;
}

// V4 Async Job Types
interface AsyncJobRequest {
	repo_url: string;
	focus?: string;
	verify?: boolean;
	branch?: string;
	webhook_url?: string;
}

interface AsyncJobResponse {
	job_id: string;
	status: string;
	status_url: string;
	estimated_seconds: number;
}

interface AsyncJobStatus {
	job_id: string;
	status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
	created_at: string;
	started_at?: string;
	completed_at?: string;
	result?: unknown;
	error?: string;
	progress?: {
		phase: string;
		issues_found: number;
		verified: number;
	};
}

export const api = new ApiClient();
export type { 
	AgentRequest, AgentResponse, ToolCall, HealthResponse, ToolDefinition, 
	SSEEvent, SSEEventType, AnalyzeRepoRequest, AnalyzeRepoResponse,
	AsyncJobRequest, AsyncJobResponse, AsyncJobStatus
};
