// Worker entry point for Cloudflare
export { BoardDO } from './BoardDO';

interface Env {
    BOARD_DO: DurableObjectNamespace;
    ASSETS: Fetcher;
    MEDIA_BUCKET: R2Bucket;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Upload Route: PUT /api/upload/:filename
        if (request.method === 'PUT' && url.pathname.startsWith('/api/upload/')) {
            const filename = url.pathname.split('/').pop();
            if (!filename) return new Response('Missing filename', { status: 400 });

            // Stream body to R2
            await env.MEDIA_BUCKET.put(filename, request.body, {
                httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' }
            });

            const publicUrl = `/api/media/${filename}`;
            return new Response(JSON.stringify({ url: publicUrl }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Media Route: GET /api/media/:filename
        if (request.method === 'GET' && url.pathname.startsWith('/api/media/')) {
            const filename = url.pathname.split('/').pop();
            if (!filename) return new Response('Missing filename', { status: 400 });

            const object = await env.MEDIA_BUCKET.get(filename);
            if (!object) return new Response('Not found', { status: 404 });

            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);

            return new Response(object.body, { headers });
        }

        // Route WebSocket and API requests to Durable Object
        if (url.pathname.startsWith('/api') || request.headers.get('Upgrade') === 'websocket') {
            const boardId = url.searchParams.get('board') || 'default';
            const id = env.BOARD_DO.idFromName(boardId);
            const stub = env.BOARD_DO.get(id);
            return stub.fetch(request);
        }

        // Serve static assets from build
        return env.ASSETS.fetch(request);
    }
};
