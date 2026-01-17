import { writable, derived } from 'svelte/store';

export interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
	toolCalls?: Array<{
		name: string;
		arguments: Record<string, unknown>;
	}>;
	iterations?: number;
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
		updateLastMessage: (content: string) => {
			update((messages) => {
				if (messages.length === 0) return messages;
				const updated = [...messages];
				updated[updated.length - 1] = {
					...updated[updated.length - 1],
					content
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

// Derived store for message count
export const messageCount = derived(messages, ($messages) => $messages.length);
