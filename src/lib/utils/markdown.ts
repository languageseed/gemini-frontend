import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({
	gfm: true,
	breaks: true
});

export function renderMarkdown(content: string): string {
	return marked.parse(content) as string;
}
