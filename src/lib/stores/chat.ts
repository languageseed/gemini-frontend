import { writable, derived } from 'svelte/store';

export interface ToolCall {
	name: string;
	arguments: Record<string, unknown>;
}

export interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
	toolCalls?: ToolCall[];
	iterations?: number;
	sessionId?: string | null;
	completed?: boolean;
	thinkingLevel?: string;
}

function createChatStore() {
	const { subscribe, set, update } = writable<Message[]>([]);

	return {
		subscribe,
		addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => {
			update((messages) => [
				...messages,
				{
					...message,
					id: crypto.randomUUID(),
					timestamp: new Date()
				}
			]);
		},
		updateLastMessage: (updates: Partial<Message>) => {
			update((messages) => {
				if (messages.length === 0) return messages;
				const updated = [...messages];
				updated[updated.length - 1] = {
					...updated[updated.length - 1],
					...updates
				};
				return updated;
			});
		},
		clear: () => set([]),
		reset: () => set([])
	};
}

export const messages = createChatStore();
export const isLoading = writable(false);
export const error = writable<string | null>(null);
export const currentSessionId = writable<string | null>(null);

// Derived store for message count
export const messageCount = derived(messages, ($messages) => $messages.length);
