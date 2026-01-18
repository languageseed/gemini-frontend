import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for safe rendering
marked.setOptions({
	gfm: true,
	breaks: true
});

// DOMPurify config - allow safe HTML only
const PURIFY_CONFIG = {
	ALLOWED_TAGS: [
		'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
		'p', 'br', 'hr',
		'ul', 'ol', 'li',
		'strong', 'b', 'em', 'i', 'u', 's', 'del',
		'code', 'pre', 'blockquote',
		'a', 'img',
		'table', 'thead', 'tbody', 'tr', 'th', 'td',
		'div', 'span',
	],
	ALLOWED_ATTR: [
		'href', 'src', 'alt', 'title', 'class',
		'target', 'rel',  // for links
	],
	ALLOW_DATA_ATTR: false,
	// Force all links to open in new tab with noopener
	ADD_ATTR: ['target', 'rel'],
};

export function renderMarkdown(content: string): string {
	// First convert markdown to HTML
	const html = marked.parse(content) as string;
	
	// Then sanitize to prevent XSS
	const clean = DOMPurify.sanitize(html, PURIFY_CONFIG);
	
	// Add target="_blank" rel="noopener" to all links
	return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}
