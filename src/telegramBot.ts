
export interface Env {
    TELEGRAM_BOT_TOKEN: string;
    BOARD_DO: DurableObjectNamespace;
}

interface TelegramUpdate {
    update_id: number;
    message?: {
        message_id: number;
        from: {
            id: number;
            is_bot: boolean;
            first_name: string;
            username?: string;
        };
        chat: {
            id: number;
            type: string;
        };
        date: number;
        text?: string;
    };
}

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
    try {
        const update = await request.json() as TelegramUpdate;

        if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const text = update.message.text;

            // Command switch
            const [cmd, ...args] = text.split(' ');

            if (cmd === '/start') {
                await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId,
                    "👋 **Welcome to Gemini Ops!**\n\nI am your mobile command center for AI prompt engineering.\n\n" +
                    "🚀 **Quick Start:**\n" +
                    "- `/new [title]` - Create a new prompt draft\n" +
                    "- `/status` - View board health\n" +
                    "- `/help` - See full list of capabilities"
                );
            } else if (cmd === '/help') {
                await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId,
                    "🛠 **Available Commands:**\n\n" +
                    "📥 **Capture:**\n" +
                    "- `/new [title]` - Create a draft\n\n" +
                    "🔍 **Query:**\n" +
                    "- `/status` - Summary of all cards\n" +
                    "- `/ping` - Check system health\n\n" +
                    "🎮 **Control (Coming Soon):**\n" +
                    "- `/runall` - Batch execute drafts\n" +
                    "- `/latest` - Fetch last output"
                );
            } else if (cmd === '/ping') {
                await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "🏓 Pong! Webhook is active.");
            } else if (cmd === '/status') {
                await handleStatus(chatId, env);
            } else if (cmd === '/new') {
                await handleNewPrompt(chatId, args.join(' '), env);
            } else {
                await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "❓ Unknown command. Try /help.");
            }
        }

        return new Response('OK');
    } catch (error) {
        console.error('[Telegram] Error:', error);
        return new Response('Error', { status: 500 });
    }
}

async function handleStatus(chatId: number, env: Env) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: 'SELECT status, COUNT(*) as count FROM prompts GROUP BY status'
        })
    });

    const data = await response.json() as { result: any[] };
    if (data.result && data.result.length > 0) {
        let report = "📊 **Board Status:**\n\n";
        data.result.forEach(row => {
            const emoji = row.status === 'deployed' ? '✅' :
                row.status === 'error' ? '❌' :
                    row.status === 'generating' ? '⏳' : '📝';
            report += `${emoji} ${row.status.toUpperCase()}: ${row.count}\n`;
        });
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, report);
    } else {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "📊 **Board Status:** Empty. Create your first draft with `/new`!");
    }
}

async function handleNewPrompt(chatId: number, titleText: string, env: Env) {
    const title = titleText.trim() || `Bot Draft ${new Date().toLocaleTimeString()}`;
    const id = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = Date.now();
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));

    // 1. Insert Prompt
    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompts (id, title, board_id, status, pos, created_at, tags) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            params: [id, title, 'default', 'draft', now, now, '[]']
        })
    });

    // 2. Insert Initial Version
    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompt_versions (id, prompt_id, content, system_instructions, temperature, top_p, max_tokens, model, created_at) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            params: [versionId, id, '', '', 0.7, 1, 2048, 'gemini-1.5-pro', now]
        })
    });

    // 3. Update prompt with version
    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `UPDATE prompts SET current_version_id = $1 WHERE id = $2`,
            params: [versionId, id]
        })
    });

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `📝 **Draft Created!**\n\nTitle: ${title}\nID: \`${id}\``);
}

export async function registerWebhook(env: Env, host: string): Promise<Response> {
    if (!env.TELEGRAM_BOT_TOKEN) {
        return new Response('Missing TELEGRAM_BOT_TOKEN', { status: 500 });
    }

    const webhookUrl = `https://${host}/api/telegram/webhook`;
    const apiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

    const response = await fetch(apiUrl);
    const result = await response.json();

    return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function sendTelegramMessage(token: string, chatId: number, text: string) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        })
    });
}
