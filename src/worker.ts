// Worker entry point for Cloudflare
export { BoardDO } from './BoardDO';

interface Env {
    BOARD_DO: DurableObjectNamespace;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Route WebSocket and API requests to Durable Object
        if (url.pathname.startsWith('/api') || request.headers.get('Upgrade') === 'websocket') {
            const boardId = url.searchParams.get('board') || 'default';
            const id = env.BOARD_DO.idFromName(boardId);
            const stub = env.BOARD_DO.get(id);
            return stub.fetch(request);
        }

        // Serve static assets (in production, use Cloudflare Pages or R2)
        return new Response('Trello Sync Worker', { status: 200 });
    }
};
