export interface Env {
    TELEGRAM_BOT_TOKEN: string;
    BOARD_DO: DurableObjectNamespace;
    RESEARCH_DO: DurableObjectNamespace;
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
        voice?: { file_id: string; mime_type: string }; // Phase 22: Voice
    };
    callback_query?: {
        id: string;
        from: { id: number; first_name: string };
        message: { message_id: number; chat: { id: number }; text?: string };
        data: string;
    };
}

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
    try {
        const update = (await request.json()) as TelegramUpdate;

        // Phase 22: Handle Callback Queries (Buttons)
        if (update.callback_query) {
            const chatId = update.callback_query.message.chat.id;
            const data = update.callback_query.data;
            const messageId = update.callback_query.message.message_id;

            await handleCallbackQuery(chatId, messageId, data, update.callback_query.id, env);
            return new Response('OK');
        }

        if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const text = update.message.text;

            const [cmd, ...args] = text.split(' ');

            if (cmd === '/start') {
                await saveChatId(chatId, env);
                await sendTelegramMessage(
                    env.TELEGRAM_BOT_TOKEN,
                    chatId,
                    '👋 **Welcome to Gemini Ops!**\n\nI am your mobile command center for AI prompt engineering.\n\n' +
                    '🚀 **Quick Start:**\n' +
                    '- `/new [title]` - Create a draft\n' +
                    '- `/research [query]` - Deep Research Agent\n' + // Phase 22
                    '- `/list` - View recent drafts',
                );
            } else if (cmd === '/help') {
                await saveChatId(chatId, env);
                await sendTelegramMessage(
                    env.TELEGRAM_BOT_TOKEN,
                    chatId,
                    '🛠 **Available Commands:**\n\n' +
                    '📥 **Capture:**\n' +
                    '- `/new [title]` - Create a draft\n' +
                    '- `[Voice Note]` - Create draft from audio\n' + // Phase 22
                    '- `/list` - List recent drafts\n\n' +
                    '🧠 **AI Agents:**\n' +
                    '- `/research [query]` - Deep Research\n\n' + // Phase 22
                    '🔍 **Query:**\n' +
                    '- `/status` - Board summary\n' +
                    '- `/search [query]` - Fuzzy search\n' +
                    '- `/tags` - List all tags\n' +
                    '- `/tag [name]` - Filter by tag\n' +
                    '- `/latest` - Last generated result\n' +
                    '- `/stats` - Performance analytics\n' +
                    '- `/health` - System health check\n\n' + // Phase 22B
                    '🎮 **Control:**\n' +
                    '- `/run [id]` - Trigger execution\n' +
                    '- `/clone [id]` - Duplicate\n' + // Phase 22
                    '- `/delete [id]` - Delete prompt\n' + // Phase 22
                    '- `/assign [id] [model]` - Switch model\n' +
                    '- `/agents` - List available models\n' +
                    '- `/refine [id]` - AI Improvement\n' +
                    '- `/retry [id]` - Re-run failed',
                );
            } else if (cmd === '/ping') {
                await sendTelegramMessage(
                    env.TELEGRAM_BOT_TOKEN,
                    chatId,
                    '🏓 Pong! Webhook is active.',
                );
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
            } else if (cmd === '/search') {
                await handleSearch(chatId, args.join(' '), env);
            } else if (cmd === '/tags') {
                await handleTags(chatId, env);
            } else if (cmd === '/tag') {
                await handleTagFilter(chatId, args[0], env);
            } else if (cmd === '/stats') {
                await handleStats(chatId, env);
            } else if (cmd === '/agents') {
                await handleAgents(chatId, env);
            } else if (cmd === '/assign') {
                await handleAssign(chatId, args[0], args[1], env);
            } else if (cmd === '/research') { // Phase 22
                await handleResearch(chatId, args.join(' '), env);
            } else if (cmd === '/clone') { // Phase 22
                await handleClone(chatId, args[0], env);
            } else if (cmd === '/delete') { // Phase 22
                await handleDelete(chatId, args[0], env);
            } else if (cmd === '/health') { // Phase 22B
                await handleHealth(chatId, env);
            } else {
                await sendTelegramMessage(
                    env.TELEGRAM_BOT_TOKEN,
                    chatId,
                    '❓ Unknown command. Try /help.',
                );
            }
        } else if (update.message && (update.message.photo || update.message.document || update.message.voice)) {
            const chatId = update.message.chat.id;
            const caption = update.message.text || '';

            if (update.message.photo) {
                const photo = update.message.photo[update.message.photo.length - 1]; // Get largest size
                await handleImageCapture(chatId, photo.file_id, caption, env);
            } else if (update.message.document) {
                await handleDocumentCapture(
                    chatId,
                    update.message.document.file_id,
                    update.message.document.file_name || 'Doc',
                    caption,
                    env,
                );
            } else if (update.message.voice) { // Phase 22
                await handleVoiceCapture(
                    chatId,
                    update.message.voice.file_id,
                    env
                );
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
            sql: 'SELECT status, COUNT(*) as count FROM prompts GROUP BY status',
        }),
    });

    const data = (await response.json()) as { result: any[] };
    if (data.result && data.result.length > 0) {
        let report = '📊 **Board Status:**\n\n';
        data.result.forEach((row) => {
            const emoji =
                row.status === 'deployed'
                    ? '✅'
                    : row.status === 'error'
                        ? '❌'
                        : row.status === 'generating'
                            ? '⏳'
                            : '📝';
            report += `${emoji} ${row.status.toUpperCase()}: ${row.count}\n`;
        });
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, report);
    } else {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, '📊 **Board Status:** Empty.');
    }
}

async function handleList(chatId: number, env: Env, page: number = 0) {
    const limit = 3;
    const offset = page * limit;

    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `SELECT id, title, status, count(*) OVER() as full_count FROM prompts WHERE status = 'draft' ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        }),
    });

    const data = (await response.json()) as { result: any[] };
    if (data.result && data.result.length > 0) {
        const totalCount = data.result[0].full_count;
        const totalPages = Math.ceil(totalCount / limit);

        // Only send header on first page or if explicitly requested (could be optimized)
        if (page === 0) {
            await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, '📝 **Recent Drafts:**');
        }

        for (const row of data.result) {
            const keyboard = {
                inline_keyboard: [[
                    { text: '🚀 Run', callback_data: `RUN:${row.id}` },
                    { text: '🗑 Delete', callback_data: `DELETE:${row.id}` }
                ]]
            };
            await sendTelegramMessage(
                env.TELEGRAM_BOT_TOKEN,
                chatId,
                `📌 **${escapeMarkdownV2(row.title)}**\nStatus: ${row.status}`,
                keyboard
            );
        }

        // Pagination Controls
        if (totalPages > 1) {
            const paginationButtons = [];
            if (page > 0) {
                paginationButtons.push({ text: '⬅️ Prev', callback_data: `LIST_PAGE:${page - 1}` });
            }
            if (page < totalPages - 1) {
                paginationButtons.push({ text: 'Next ➡️', callback_data: `LIST_PAGE:${page + 1}` });
            }

            if (paginationButtons.length > 0) {
                await sendTelegramMessage(
                    env.TELEGRAM_BOT_TOKEN,
                    chatId,
                    `Page ${page + 1} of ${totalPages}`,
                    { inline_keyboard: [paginationButtons] }
                );
            }
        }

    } else {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            '📝 No drafts found. Create one with `/new`.',
        );
    }
}

async function handleRunPrompt(chatId: number, promptId: string, env: Env) {
    if (!promptId) {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            '⚠️ Please provide a Prompt ID. Example: `/run [id]`',
        );
        return;
    }

    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId }),
    });

    if (response.status === 202) {
        await logActivity(env, 'run_started', promptId, `User triggered run via Telegram`);
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "🚀 **Execution Started!**\n\nThe AI is generating a response. I will notify you when it's done.",
        );
    } else {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            `❌ **Failed to start run.** Status: ${response.status}`,
        );
    }
}

async function handleLatest(chatId: number, env: Env) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/latest');
    const data = (await response.json()) as { result: any };

    if (data.result) {
        const { title, output, created_at } = data.result;
        const msg =
            `✨ **Latest Output:** ${title}\n` +
            `📅 ${new Date(created_at).toLocaleString()}\n\n` +
            `${output.substring(0, 3000)}${output.length > 3000 ? '...' : ''}`;
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, msg);
    } else {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            '🔍 No generated outputs found yet.',
        );
    }
}

async function handleRefinePrompt(chatId: number, promptId: string, env: Env) {
    if (!promptId) {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            '⚠️ Please provide a Prompt ID. Example: `/refine [id]`',
        );
        return;
    }

    await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        "🧠 **Refining Prompt...**\n\nI'm asking the AI to critique and improve your prompt. One moment.",
    );

    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId }),
    });

    if (response.status === 200) {
        const data = (await response.json()) as any;
        await logActivity(env, 'prompt_refined', promptId, `AI Refinement version created`);
        const msg = `✨ **Prompt Refined!**\n\n**New Content:**\n${data.newContent}\n\n**Critique:**\n${data.critique}\n\nA new version has been created. Use \`/run ${promptId}\` to test it.`;
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, msg);
    } else {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            `❌ **Refinement failed.** Status: ${response.status}`,
        );
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
            params: [id, title, 'default', 'draft', now, now, '[]'],
        }),
    });

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompt_versions (id, prompt_id, content, system_instructions, temperature, top_p, max_tokens, model, created_at) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            params: [versionId, id, '', '', 0.7, 1, 2048, 'gemini-1.5-pro', now],
        }),
    });

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `UPDATE prompts SET current_version_id = $1 WHERE id = $2`,
            params: [versionId, id],
        }),
    });

    await logActivity(env, 'prompt_created', id, `Quick Draft created via Telegram: ${title}`);

    // Smart Replies (Phase 2)
    const keyboard = {
        inline_keyboard: [[
            { text: '🚀 Run', callback_data: `RUN:${id}` },
            { text: '🧠 Refine', callback_data: `REFINE:${id}` },
            { text: '🗑 Delete', callback_data: `DELETE:${id}` }
        ]]
    };

    await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        `📝 **Draft Created!**\n\nTitle: ${escapeMarkdownV2(title)}\nID: \`${id}\``,
        keyboard
    );
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
            params: [id, title, 'default', 'draft', now, now, '["image", "multimodal"]'],
        }),
    });

    const content = `[Image: ${fileUrl}]\n\nAnalyze this image: ${caption || 'Describe what you see.'}`;

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompt_versions (id, prompt_id, content, system_instructions, temperature, top_p, max_tokens, model, created_at) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            params: [versionId, id, content, '', 0.7, 1, 2048, 'gemini-1.5-pro', now],
        }),
    });

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `UPDATE prompts SET current_version_id = $1 WHERE id = $2`,
            params: [versionId, id],
        }),
    });

    await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        `📸 **Image Draft Created!**\n\nI've saved the image URL to the prompt content. Use \`/run ${id}\` to analyze.`,
    );
}

async function handleDocumentCapture(
    chatId: number,
    fileId: string,
    fileName: string,
    caption: string,
    env: Env,
) {
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
            params: [id, title, 'default', 'draft', now, now, '["document"]'],
        }),
    });

    const content = `[File: ${fileName} (${fileUrl})]\n\nContext/Instruction: ${caption || 'Please summarize or analyze this document.'}`;

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompt_versions (id, prompt_id, content, system_instructions, temperature, top_p, max_tokens, model, created_at) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            params: [versionId, id, content, '', 0.7, 1, 2048, 'gemini-1.5-pro', now],
        }),
    });

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `UPDATE prompts SET current_version_id = $1 WHERE id = $2`,
            params: [versionId, id],
        }),
    });

    await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        `📄 **Document Draft Created!**\n\nFilename: ${fileName}\nUse \`/run ${id}\` to summarize.`,
    );
}

async function getTelegramFileUrl(token: string, fileId: string): Promise<string> {
    const response = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data = (await response.json()) as any;
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
        headers: { 'Content-Type': 'application/json' },
    });
}

async function sendTelegramMessage(token: string, chatId: number, text: string, keyboard?: any, parseMode: string = 'Markdown') {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body: any = {
        chat_id: chatId,
        text: text,
        parse_mode: parseMode,
    };

    if (keyboard) {
        body.reply_markup = keyboard;
    }

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function editTelegramMessage(token: string, chatId: number, messageId: number, text: string, keyboard?: any, parseMode: string = 'Markdown') {
    const url = `https://api.telegram.org/bot${token}/editMessageText`;
    const body: any = {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: parseMode,
    };

    if (keyboard) {
        body.reply_markup = keyboard;
    }

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function escapeMarkdownV2(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
    const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: text,
        }),
    });
}

async function saveChatId(chatId: number, env: Env) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: "INSERT INTO settings (key, value) VALUES ('telegram_owner_chat_id', $1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params: [String(chatId)],
        }),
    });
}

export async function sendNotification(token: string, env: Env, text: string) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: "SELECT value FROM settings WHERE key = 'telegram_owner_chat_id'",
        }),
    });
    const data = (await response.json()) as { result: any[] };
    if (data.result && data.result.length > 0) {
        const chatId = parseInt(data.result[0].value);
        await sendTelegramMessage(token, chatId, text);
    }
}

async function handleLogs(chatId: number, env: Env) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/logs');
    const data = (await response.json()) as { result: any[] };

    if (data.result && data.result.length > 0) {
        let logMsg = '📋 **Recent Activity:**\n\n';
        data.result.forEach((log) => {
            const date = new Date(log.created_at).toLocaleTimeString();
            logMsg += `[${date}] **${log.event.toUpperCase()}**\n${log.details || ''}\n\n`;
        });
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, logMsg);
    } else {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, '📋 No activity logs found.');
    }
}

async function logActivity(env: Env, event: string, entityId?: string, details?: string) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    await stub.fetch('http://do/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, entityId, details }),
    });
}

async function handleSearch(chatId: number, query: string, env: Env) {
    if (!query) {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            '⚠️ Please provide a search query. Example: `/search Draft` ',
        );
        return;
    }

    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });

    const data = (await response.json()) as { result: any[] };
    if (data.result && data.result.length > 0) {
        let list = `🔍 **Search Results for "${query}":**\n\n`;
        data.result.forEach((row) => {
            list += `• **${row.title}**\nID: \`${row.id}\`\n\n`;
        });
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, list);
    } else {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            `🔍 No results found for "${query}".`,
        );
    }
}

async function handleTags(chatId: number, env: Env) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/tags');
    const data = (await response.json()) as { tags: string[] };

    if (data.tags && data.tags.length > 0) {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            `🏷 **Board Tags:**\n\n${data.tags.map((t) => `#${t}`).join(' ')}\n\nUse \`/tag [name]\` to filter.`,
        );
    } else {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, '🏷 No tags found on the board.');
    }
}

async function handleTagFilter(chatId: number, tag: string, env: Env) {
    if (!tag) {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            '⚠️ Please provide a tag name. Example: `/tag image` ',
        );
        return;
    }

    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: 'SELECT id, title FROM prompts WHERE tags LIKE $1 LIMIT 10',
            params: [`%${tag}%`],
        }),
    });

    const data = (await response.json()) as { result: any[] };
    if (data.result && data.result.length > 0) {
        let list = `🏷 **Prompts tagged #${tag}:**\n\n`;
        data.result.forEach((row) => {
            list += `• ${row.title}\nID: \`${row.id}\`\n\n`;
        });
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, list);
    } else {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            `🏷 No prompts found with tag #${tag}.`,
        );
    }
}

async function handleStats(chatId: number, env: Env) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/analytics');
    const data = (await response.json()) as { stats: any };

    if (data.stats) {
        let msg = '📊 **Board Health & Analytics:**\n\n';
        msg += `⏱ **Avg Execution:** ${Math.round(data.stats.averageExecutionTime)}ms\n\n`;

        msg += '**Status Distribution:**\n';
        data.stats.distribution.forEach((d: any) => {
            msg += `• ${d.status.toUpperCase()}: ${d.count}\n`;
        });

        msg += '\n**Model Usage:**\n';
        data.stats.models.forEach((m: any) => {
            msg += `• ${m.model}: ${m.count}\n`;
        });

        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, msg);
    } else {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, '📊 Unable to fetch analytics.');
    }
}

async function handleAgents(chatId: number, env: Env) {
    const msg =
        '🤖 **Available Gemini Models & Agents:**\n\n' +
        '⚡ **Models:**\n' +
        '- `gemini-1.5-flash` (Speed/Efficiency)\n' +
        '- `gemini-1.5-pro` (Reasoning/Complex)\n' +
        '- `gemini-2.0-flash-exp` (Next-gen Fast)\n\n' +
        '🧠 **Specialized Agents:**\n' +
        '- `deep-research-pro` (Multimodal analysis)\n\n' +
        "Use `/assign [id] [model]` to change a prompt's configuration.";
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, msg);
}

async function handleAssign(chatId: number, promptId: string, model: string, env: Env) {
    if (!promptId || !model) {
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            '⚠️ Format: `/assign [id] [model]`\nUse `/agents` to see available names.',
        );
        return;
    }

    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId, model }),
    });

    if (response.ok) {
        await logActivity(env, 'model_assigned', promptId, `Assigned model: ${model}`);
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            `🤖 **Success!** Prompt \`${promptId}\` is now using **${model}**.`,
        );
    }
}

// Phase 22: Handling Button Clicks
async function handleCallbackQuery(chatId: number, messageId: number, data: string, callbackId: string, env: Env) {
    const [action, id] = data.split(':');

    if (action === 'RUN') {
        await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackId, '🚀 Starting run...');
        await handleRunPrompt(chatId, id, env);
    } else if (action === 'REFINE') {
        await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackId, '🧠 Starting refinement...');
        await handleRefinePrompt(chatId, id, env);
    } else if (action === 'DELETE') {
        await handleDelete(chatId, id, env);
        await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackId, '🗑 Deleted');
    } else if (action === 'RESEARCH_REFRESH') {
        await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackId, '🔄 Refreshing...');
        await updateResearchStatus(chatId, messageId, id, env);
    } else if (action === 'LIST_PAGE') {
        await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackId); // No visual feedback needed
        const page = parseInt(id, 10);
        // Maybe we should edit the message instead of sending new ones? 
        // For now, simpler to just send the new page.
        await handleList(chatId, env, page);
    } else {
        await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackId, '❓ Unknown action');
    }
}

async function handleResearch(chatId: number, query: string, env: Env) {
    if (!query) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, '⚠️ Usage: `/research [topic]`');
        return;
    }

    const jobId = crypto.randomUUID();
    const researchStub = env.RESEARCH_DO.get(env.RESEARCH_DO.idFromName(jobId));

    // Start job
    const response = await researchStub.fetch('http://do/start', {
        method: 'POST',
        body: JSON.stringify({ input: query, jobId }),
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Failed to start research: ${response.statusText}`);
        return;
    }

    // Send initial status message with Refresh button
    const keyboard = {
        inline_keyboard: [[
            { text: '🔄 Refresh Status', callback_data: `RESEARCH_REFRESH:${jobId}` }
        ]]
    };

    await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        `🕵️‍♂️ **Research Started!**\n\nTopic: "${query}"\nJob ID: \`${jobId.slice(0, 8)}\`\n\nStatus: ⏳ PROCESSING...\n\n(Click Refresh to check progress)`,
        keyboard
    );
}

async function updateResearchStatus(chatId: number, messageId: number, jobId: string, env: Env) {
    const researchStub = env.RESEARCH_DO.get(env.RESEARCH_DO.idFromName(jobId));
    const response = await researchStub.fetch('http://do/status');
    const data = await response.json() as any;

    const status = data.status || 'unknown';
    const text = data.text || '';
    const error = data.error || '';

    let msg = '';
    let keyboard = null;

    if (status === 'completed') {
        msg = `✅ **Research Complete!**\n\n${text.substring(0, 3000)}${text.length > 3000 ? '...' : ''}`;
    } else if (status === 'failed') {
        msg = `❌ **Research Failed**\n\nError: ${error}`;
    } else {
        msg = `🕵️‍♂️ **Research In Progress**\n\nStatus: ⏳ ${status.toUpperCase()}...\n\nLog: ${text.slice(-200) || 'Analyzing...'}`;
        keyboard = {
            inline_keyboard: [[
                { text: '🔄 Refresh Status', callback_data: `RESEARCH_REFRESH:${jobId}` }
            ]]
        };
    }

    try {
        await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, msg, keyboard);
    } catch (e) {
        // Ignore errors
    }
}

async function handleVoiceCapture(chatId: number, fileId: string, env: Env) {
    const fileUrl = await getTelegramFileUrl(env.TELEGRAM_BOT_TOKEN, fileId);
    const title = `🎙️ Voice Note ${new Date().toLocaleTimeString()}`;
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
            params: [id, title, 'default', 'draft', now, now, '["voice"]'],
        }),
    });

    const content = `[Voice Note: ${fileUrl}]\n\n(To transcribe, please run this prompt with a multimodal model)`;

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `INSERT INTO prompt_versions (id, prompt_id, content, system_instructions, temperature, top_p, max_tokens, model, created_at) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            params: [versionId, id, content, '', 0.7, 1, 2048, 'gemini-1.5-flash', now],
        }),
    });

    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: `UPDATE prompts SET current_version_id = $1 WHERE id = $2`,
            params: [versionId, id],
        }),
    });

    const keyboard = {
        inline_keyboard: [[
            { text: '🚀 Transcribe (Run)', callback_data: `RUN:${id}` }
        ]]
    };

    await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        `🎙️ **Voice Note Saved!**\n\nID: \`${id}\`\nReady to transcribe.`,
        keyboard
    );
}

async function handleClone(chatId: number, id: string, env: Env) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, '⚠️ Clone not implemented yet.');
}

async function handleDelete(chatId: number, id: string, env: Env) {
    if (!id) return;
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    await stub.fetch('http://do/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sql: "DELETE FROM prompts WHERE id = $1",
            params: [id]
        })
    });
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `🗑 Prompt \`${id}\` deleted.`);
}

// Phase 22B: Health Monitoring
async function handleHealth(chatId: number, env: Env) {
    const stub = env.BOARD_DO.get(env.BOARD_DO.idFromName('default'));
    const response = await stub.fetch('http://do/api/health');
    const health = await response.json() as any;

    const statusEmoji = health.status === 'HEALTHY' ? '✅' : '⚠️';

    let msg = `${statusEmoji} **System Health: ${health.status}**\n\n`;
    msg += `📊 **Summary:**\n`;
    msg += `• Total Prompts: ${health.summary?.totalPrompts || 0}\n`;
    msg += `• Deployed: ${health.summary?.deployed || 0}\n`;
    msg += `• Errors: ${health.summary?.errors || 0}\n\n`;

    if (health.lastDeployed) {
        msg += `🚀 **Last Deployed:**\n`;
        msg += `• ${health.lastDeployed.title}\n`;
        msg += `• At: ${health.lastDeployed.at}\n\n`;
    }

    if (health.recentErrors && health.recentErrors.length > 0) {
        msg += `⚠️ **Recent Errors:**\n`;
        health.recentErrors.forEach((err: any) => {
            msg += `• ${err.details || 'No details'}\n`;
        });
    }

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, msg);
}
