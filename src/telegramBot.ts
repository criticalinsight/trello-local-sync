
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
        photo?: Array<{ file_id: string; file_size: number }>;
        document?: { file_id: string; file_name?: string; mime_type?: string };
    };
}

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
    try {
        const update = await request.json() as TelegramUpdate;

        if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const text = update.message.text;

            const [cmd, ...args] = text.split(' ');

            if (cmd === '/start') {
                await saveChatId(chatId, env);
                await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId,
                    "👋 **Welcome to Gemini Ops!**\n\nI am your mobile command center for AI prompt engineering.\n\n" +
                    "🚀 **Quick Start:**\n" +
                    "- `/new [title]` - Create a draft\n" +
                    "- `/list` - View recent drafts\n" +
                    "- `/run [id]` - Execute a prompt\n" +
                    "- `/latest` - See most recent output\n" +
                    "- `/status` - View board health"
                );
            } else if (cmd === '/help') {
                await saveChatId(chatId, env);
                await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId,
                    "🛠 **Available Commands:**\n\n" +
                    "📥 **Capture:**\n" +
                    "- `/new [title]` - Create a draft\n" +
                    "- `/list` - List recent drafts\n\n" +
                    "🔍 **Query:**\n" +
                    "- `/status` - Board summary\n" +
                    "- `/latest` - Last generated result\n" +
                    "- `/ping` - System check\n\n" +
                    "🎮 **Control:**\n" +
                    "- `/run [id]` - Trigger execution\n" +
                    "- `/retry [id]` - Re-run a failed prompt"
                );
            } else if (cmd === '/ping') {
                await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "🏓 Pong! Webhook is active.");
            } else if (cmd === '/status') {
                await handleStatus(chatId, env);
            } else if (cmd === '/new') {
                await handleNewPrompt(chatId, args.join(' '), env);
            } else if (cmd === '/list') {
                await handleList(chatId, env);
            } else if (cmd === '/run') {
                await handleRunPrompt(chatId, args[0], env);
            } else if (cmd === '/latest') {
                await handleLatest(chatId, env);
            } else if (cmd === '/retry') {
                await handleRunPrompt(chatId, args[0], env);
            } else if (cmd === '/refine') {
                await handleRefinePrompt(chatId, args[0], env);
            } else if (cmd === '/logs') {
                await handleLogs(chatId, env);
            } else {
                await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "❓ Unknown command. Try /help.");
            }
        } else if (update.message && (update.message.photo || update.message.document)) {
            const chatId = update.message.chat.id;
            const caption = update.message.text || "";

            if (update.message.photo) {
                const photo = update.message.photo[update.message.photo.length - 1]; // Get largest size
                await handleImageCapture(chatId, photo.file_id, caption, env);
            } else if (update.message.document) {
                await handleDocumentCapture(chatId, update.message.document.file_id, update.message.document.file_name || "Doc", caption, env);
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
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "📊 **Board Status:** Empty.");
    }
}

async function handleList(chatId: number, env: Env) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: "SELECT id, title FROM prompts WHERE status = 'draft' ORDER BY created_at DESC LIMIT 5"
        })
    });

    const data = await response.json() as { result: any[] };
    if (data.result && data.result.length > 0) {
        let list = "📝 **Recent Drafts:**\n\n";
        data.result.forEach(row => {
            list += `• ${row.title}\nID: \`${row.id}\`\n\n`;
        });
        list += "Copy an ID and use `/run [id]` to execute.";
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, list);
    } else {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "📝 No drafts found. Create one with `/new`.");
    }
}

async function handleRunPrompt(chatId: number, promptId: string, env: Env) {
    if (!promptId) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⚠️ Please provide a Prompt ID. Example: `/run [id]`");
        return;
    }

    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId })
    });

    if (response.status === 202) {
        await logActivity(env, 'run_started', promptId, `User triggered run via Telegram`);
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "🚀 **Execution Started!**\n\nThe AI is generating a response. I will notify you when it's done.");
    } else {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ **Failed to start run.** Status: ${response.status}`);
    }
}

async function handleLatest(chatId: number, env: Env) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/latest');
    const data = await response.json() as { result: any };

    if (data.result) {
        const { title, output, created_at } = data.result;
        const msg = `✨ **Latest Output:** ${title}\n` +
            `📅 ${new Date(created_at).toLocaleString()}\n\n` +
            `${output.substring(0, 3000)}${output.length > 3000 ? '...' : ''}`;
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, msg);
    } else {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "🔍 No generated outputs found yet.");
    }
}

async function handleRefinePrompt(chatId: number, promptId: string, env: Env) {
    if (!promptId) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⚠️ Please provide a Prompt ID. Example: `/refine [id]`");
        return;
    }

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "🧠 **Refining Prompt...**\n\nI'm asking the AI to critique and improve your prompt. One moment.");

    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId })
    });

    if (response.status === 200) {
        const data = await response.json() as any;
        await logActivity(env, 'prompt_refined', promptId, `AI Refinement version created`);
        const msg = `✨ **Prompt Refined!**\n\n**New Content:**\n${data.newContent}\n\n**Critique:**\n${data.critique}\n\nA new version has been created. Use \`/run ${promptId}\` to test it.`;
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, msg);
    } else {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ **Refinement failed.** Status: ${response.status}`);
    }
}

async function handleNewPrompt(chatId: number, titleText: string, env: Env) {
    const title = titleText.trim() || `Bot Draft ${new Date().toLocaleTimeString()}`;
    const id = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = Date.now();
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompts (id, title, board_id, status, pos, created_at, tags) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            params: [id, title, 'default', 'draft', now, now, '[]']
        })
    });

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompt_versions (id, prompt_id, content, system_instructions, temperature, top_p, max_tokens, model, created_at) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            params: [versionId, id, '', '', 0.7, 1, 2048, 'gemini-1.5-pro', now]
        })
    });

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `UPDATE prompts SET current_version_id = $1 WHERE id = $2`,
            params: [versionId, id]
        })
    });

    await logActivity(env, 'prompt_created', id, `Quick Draft created via Telegram: ${title}`);
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `📝 **Draft Created!**\n\nTitle: ${title}\nID: \`${id}\``);
}

async function handleImageCapture(chatId: number, fileId: string, caption: string, env: Env) {
    const title = `📸 Image Capture: ${caption.substring(0, 20) || 'Untitled'}`;
    const fileUrl = await getTelegramFileUrl(env.TELEGRAM_BOT_TOKEN, fileId);
    const id = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = Date.now();
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompts (id, title, board_id, status, pos, created_at, tags) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            params: [id, title, 'default', 'draft', now, now, '["image", "multimodal"]']
        })
    });

    const content = `[Image: ${fileUrl}]\n\nAnalyze this image: ${caption || 'Describe what you see.'}`;

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompt_versions (id, prompt_id, content, system_instructions, temperature, top_p, max_tokens, model, created_at) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            params: [versionId, id, content, '', 0.7, 1, 2048, 'gemini-1.5-pro', now]
        })
    });

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `UPDATE prompts SET current_version_id = $1 WHERE id = $2`,
            params: [versionId, id]
        })
    });

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `📸 **Image Draft Created!**\n\nI've saved the image URL to the prompt content. Use \`/run ${id}\` to analyze.`);
}

async function handleDocumentCapture(chatId: number, fileId: string, fileName: string, caption: string, env: Env) {
    const title = `📄 Doc Capture: ${fileName}`;
    const fileUrl = await getTelegramFileUrl(env.TELEGRAM_BOT_TOKEN, fileId);
    const id = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = Date.now();
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompts (id, title, board_id, status, pos, created_at, tags) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            params: [id, title, 'default', 'draft', now, now, '["document"]']
        })
    });

    const content = `[File: ${fileName} (${fileUrl})]\n\nContext/Instruction: ${caption || 'Please summarize or analyze this document.'}`;

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompt_versions (id, prompt_id, content, system_instructions, temperature, top_p, max_tokens, model, created_at) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            params: [versionId, id, content, '', 0.7, 1, 2048, 'gemini-1.5-pro', now]
        })
    });

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `UPDATE prompts SET current_version_id = $1 WHERE id = $2`,
            params: [versionId, id]
        })
    });

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `📄 **Document Draft Created!**\n\nFilename: ${fileName}\nUse \`/run ${id}\` to summarize.`);
}

async function getTelegramFileUrl(token: string, fileId: string): Promise<string> {
    const response = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data = await response.json() as any;
    if (data.ok) {
        return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
    }
    return `[Error retrieving file: ${fileId}]`;
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

async function saveChatId(chatId: number, env: Env) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: "INSERT INTO settings (key, value) VALUES ('telegram_owner_chat_id', $1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params: [String(chatId)]
        })
    });
}

export async function sendNotification(token: string, env: Env, text: string) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: "SELECT value FROM settings WHERE key = 'telegram_owner_chat_id'"
        })
    });
    const data = await response.json() as { result: any[] };
    if (data.result && data.result.length > 0) {
        const chatId = parseInt(data.result[0].value);
        await sendTelegramMessage(token, chatId, text);
    }
}

async function handleLogs(chatId: number, env: Env) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/logs');
    const data = await response.json() as { result: any[] };

    if (data.result && data.result.length > 0) {
        let logMsg = "📋 **Recent Activity:**\n\n";
        data.result.forEach(log => {
            const date = new Date(log.created_at).toLocaleTimeString();
            logMsg += `[${date}] **${log.event.toUpperCase()}**\n${log.details || ''}\n\n`;
        });
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, logMsg);
    } else {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "📋 No activity logs found.");
    }
}

async function logActivity(env: Env, event: string, entityId?: string, details?: string) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    await stub.fetch('http://do/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, entityId, details })
    });
}
