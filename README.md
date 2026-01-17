# Gemini Agent Frontend

Modern SvelteKit frontend for the Gemini Agent hackathon project.

## Tech Stack

- **SvelteKit** + Svelte 5 + TypeScript
- **Tailwind CSS** with custom dark theme
- **Lucide Icons** for iconography
- **marked** for Markdown rendering
- **svelte-sonner** for toast notifications

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create a `.env` file (optional - defaults to Railway deployment):

```bash
VITE_API_URL=https://gemini-agent-hackathon-production.up.railway.app
```

## Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Or push to GitHub and connect to Vercel for auto-deploy.

## Features

- Chat interface with Gemini Agent
- Markdown rendering for AI responses
- Tool call visualization
- API key input for secured backends
- Real-time connection status
- Dark mode by default
- Responsive design

## Project Structure

```
src/
├── lib/
│   ├── components/     # Svelte components
│   │   ├── ChatMessage.svelte
│   │   ├── ChatInput.svelte
│   │   ├── StatusIndicator.svelte
│   │   └── ApiKeyInput.svelte
│   ├── stores/         # Svelte stores
│   │   └── chat.ts
│   └── utils/          # Utilities
│       ├── api.ts      # API client
│       ├── cn.ts       # Class utilities
│       └── markdown.ts # Markdown parser
├── routes/
│   ├── +layout.svelte  # Root layout
│   └── +page.svelte    # Main chat page
├── app.css             # Global styles + Tailwind
└── app.html            # HTML template
```

## Backend API

This frontend connects to the Gemini Agent backend:
- **Production**: https://gemini-agent-hackathon-production.up.railway.app
- **API Docs**: https://gemini-agent-hackathon-production.up.railway.app/docs

## License

MIT - Hackathon Project
