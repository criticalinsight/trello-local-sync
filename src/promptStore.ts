// Prompt Engineering Store - Dedicated state management for AI prompts
import { createStore, produce } from 'solid-js/store';
import { PGlite } from '@electric-sql/pglite';
import type {
    PromptCard,
    PromptVersion,
    PromptStatus,
    PromptParameters,
    PromptBoardMeta,
    PromptSyncMessage,
    PromptWorkflow,
} from './types';
import { generateTags } from './utils/autoTagger';
import { syncManager } from './syncManager';

// ============= STATE =============

interface PromptStoreState {
    prompts: Record<string, PromptCard>;
    versions: Record<string, PromptVersion>;
    boards: Record<string, PromptBoardMeta>;
    connected: boolean;
    syncing: boolean;
    executionQueue: string[]; // prompt IDs queued for execution
}

export const [promptStore, setPromptStore] = createStore<PromptStoreState>({
    prompts: {},
    versions: {},
    boards: {},
    connected: false,
    syncing: false,
    executionQueue: [],
});

// Database and WebSocket references
let pglite: PGlite | null = null;
let socket: WebSocket | null = null;
let clientId: string = '';
let currentBoardId: string = '';

// ============= UTILITIES =============

export const genId = () => crypto.randomUUID();

const defaultParameters: PromptParameters = {
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 2048,
};

// ============= BOARD EVENT HANDLER =============

async function handleBoardEvent(event: { type: string; cardId: string; listId?: string; data?: any }) {
    // Find prompts with active workflows matching this event
    const activePrompts = Object.values(promptStore.prompts).filter(p =>
        p.workflow?.enabled &&
        p.workflow.triggers.some(t => {
            if (t.type === 'card_added' && event.type === 'card_added') {
                return !t.config?.listId || t.config.listId === event.listId;
            }
            if (t.type === 'card_moved' && event.type === 'card_moved') {
                return !t.config?.listId || t.config.listId === event.listId;
            }
            if (t.type === 'card_tagged' && event.type === 'card_updated' && event.data?.tags) {
                return !t.config?.tag || event.data.tags.includes(t.config.tag);
            }
            return false;
        })
    );

    if (activePrompts.length > 0) {
        console.log(`[Workflow] Triggering ${activePrompts.length} prompts for event: ${event.type}`);
        for (const prompt of activePrompts) {
            // Dynamically import to avoid circular dependency
            const { runSinglePrompt } = await import('./promptStore');
            runSinglePrompt(prompt.id);
        }
    }
}

// ============= DATABASE INITIALIZATION =============

export async function initPromptPGlite(boardId: string) {
    if (pglite && currentBoardId === boardId) {
        console.log(`[PromptStore] PGlite already initialized for board: ${boardId}`);
        return;
    }

    console.log(`[PromptStore] Initializing PGlite for board: ${boardId}`);
    currentBoardId = boardId;

    // Close previous instance if it exists to prevent handle leaks
    if (pglite) {
        try {
            console.log('[PromptStore] Closing previous instance...');
            await pglite.close();
            pglite = null;
        } catch (e) {
            console.warn('[PromptStore] Failed to close previous PGlite instance', e);
        }
    }

    try {
        // Sanitize boardId for IndexDB name
        const dbName = `prompt-board-${boardId.replace(/[^a-zA-Z0-9-]/g, '_')}`;
        // Create new PGlite instance for prompts
        pglite = new PGlite(`idb://${dbName}`);
        await pglite.waitReady;
        console.log(`[PromptStore] PGlite ready: ${dbName}`);
    } catch (e) {
        console.error('[PromptStore] PGlite failed to initialize', e);
        throw e;
    }

    // Create prompts table
    await pglite.exec(`
        CREATE TABLE IF NOT EXISTS prompts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            board_id TEXT NOT NULL,
            status TEXT DEFAULT 'draft',
            current_version_id TEXT,
            pos REAL NOT NULL,
            created_at BIGINT NOT NULL,
            deployed_at BIGINT,
            starred INTEGER DEFAULT 0,
            archived INTEGER DEFAULT 0,
            schedule_json TEXT,
            workflow_json TEXT,
            tags TEXT
        );
    `);

    // Create mutation queue table for offline sync
    await pglite.exec(`
        CREATE TABLE IF NOT EXISTS mutation_queue (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            type TEXT NOT NULL,
            data JSON NOT NULL,
            created_at BIGINT NOT NULL,
            synced INTEGER DEFAULT 0
        );
    `);

    // Migration: Add columns if they don't exist
    try {
        await pglite.exec(`ALTER TABLE prompts ADD COLUMN schedule_json TEXT;`);
    } catch (e) {
        // Column already exists, ignore
    }
    try {
        await pglite.exec(`ALTER TABLE prompts ADD COLUMN workflow_json TEXT;`);
    } catch (e) {
        // Column already exists, ignore
    }
    try {
        await pglite.exec(`ALTER TABLE prompt_versions ADD COLUMN model TEXT;`);
    } catch (e) {
        // Column already exists, ignore
    }
    // Migration: Add tags column to prompts if not exists
    try {
        await pglite.exec(`ALTER TABLE prompts ADD COLUMN tags TEXT;`); // Stored as JSON string
    } catch (e) {
        // Column already exists, ignore
    }

    // Subscribe to board events
    const { onBoardEvent } = await import('./store');
    onBoardEvent(handleBoardEvent);

    // Create versions table
    await pglite.exec(`
        CREATE TABLE IF NOT EXISTS prompt_versions (
            id TEXT PRIMARY KEY,
            prompt_id TEXT NOT NULL,
            content TEXT NOT NULL,
            system_instructions TEXT,
            temperature REAL DEFAULT 0.7,
            top_p REAL DEFAULT 0.9,
            max_tokens INTEGER DEFAULT 2048,
            output TEXT,
            created_at BIGINT NOT NULL,
            execution_time INTEGER,
            error TEXT,
            model TEXT
        );
    `);

    // Create boards meta table
    await pglite.exec(`
        CREATE TABLE IF NOT EXISTS prompt_boards (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at BIGINT NOT NULL
        );
    `);

    // Ensure this board metadata exists
    try {
        await pglite.query(
            `INSERT INTO prompt_boards (id, title, created_at)
             VALUES ($1, $2, $3)
             ON CONFLICT(id) DO NOTHING`,
            [boardId, 'New Prompt Board', Date.now()]
        );
    } catch (e) {
        console.warn('[PromptStore] Meta entry failed (non-critical)', e);
    }

    // Load existing data
    console.log('[PromptStore] Loading prompts from DB...');
    await loadPromptsFromDB();
    console.log('[PromptStore] Prompts loaded');

    // Initialize memory store
    const { initMemoryStore } = await import('./memoryStore');
    await initMemoryStore(boardId, pglite);

    // Initialize Sync Manager
    const { syncManager } = await import('./syncManager');
    await syncManager.init(pglite, boardId);

    console.log('[PromptStore] Initialization complete');
}

async function loadPromptsFromDB() {
    if (!pglite) return;

    // Load prompts
    const promptsResult = await pglite.query<any>(
        `SELECT id, title, board_id as "boardId", status, current_version_id as "currentVersionId", 
         pos, created_at as "createdAt", deployed_at as "deployedAt", 
         starred = 1 as starred, archived = 1 as archived, schedule_json, workflow_json, tags
         FROM prompts WHERE board_id = $1 AND archived = 0 ORDER BY pos`,
        [currentBoardId]
    );

    // Load versions
    const versionsResult = await pglite.query<any>(
        `SELECT v.id, v.prompt_id as "promptId", v.content, v.system_instructions as "systemInstructions",
         v.temperature, v.top_p as "topP", v.max_tokens as "maxTokens", v.model, v.output,
         v.created_at as "createdAt", v.execution_time as "executionTime", v.error
         FROM prompt_versions v
         INNER JOIN prompts p ON v.prompt_id = p.id
         WHERE p.board_id = $1`,
        [currentBoardId]
    );

    // Update store
    setPromptStore(produce((s) => {
        s.prompts = {};
        s.versions = {};

        const promptsMap: Record<string, PromptCard> = {};
        promptsResult.rows.forEach((row: any) => {
            let tags: string[] = [];
            try {
                if (row.tags) {
                    tags = JSON.parse(row.tags);
                }
            } catch (e) {
                console.warn('Failed to parse tags for prompt', row.id, e);
            }

            promptsMap[row.id] = {
                id: row.id,
                title: row.title,
                boardId: row.boardId,
                status: row.status as PromptStatus,
                currentVersionId: row.currentVersionId,
                pos: row.pos,
                createdAt: row.createdAt,
                deployedAt: row.deployedAt,
                starred: row.starred ? true : false,
                archived: row.archived ? true : false,
                schedule: row.schedule_json ? JSON.parse(row.schedule_json) : undefined,
                workflow: row.workflow_json ? JSON.parse(row.workflow_json) : undefined,
                tags: tags
            };
        });
        s.prompts = promptsMap;

        for (const row of (versionsResult.rows as any[])) {
            s.versions[row.id] = {
                ...row,
                parameters: {
                    temperature: row.temperature ?? 0.7,
                    topP: row.topP ?? 0.9,
                    maxTokens: row.maxTokens ?? 2048,
                    model: row.model
                }
            };
        }
    }));
}

// ============= PROMPT CRUD =============

export async function addPrompt(title: string): Promise<string> {
    const id = genId();
    const now = Date.now();

    // Calculate position (end of draft list)
    const draftPrompts = Object.values(promptStore.prompts)
        .filter(p => p.status === 'draft')
        .sort((a, b) => b.pos - a.pos);
    const pos = draftPrompts.length > 0 ? draftPrompts[0].pos + 1000 : 1000;

    const prompt: PromptCard = {
        id,
        title,
        boardId: currentBoardId,
        status: 'draft',
        pos,
        createdAt: now,
        tags: []
    };

    // Update store immediately (optimistic)
    setPromptStore(produce((s) => {
        s.prompts[id] = prompt;
    }));

    // Persist to DB
    if (pglite) {
        await pglite.query(
            `INSERT INTO prompts (id, title, board_id, status, pos, created_at, tags)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, title, currentBoardId, 'draft', pos, now, JSON.stringify([])]
        );

        // Sync
        await syncManager.enqueue(
            `INSERT INTO prompts (id, title, board_id, status, pos, created_at, tags) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, title, currentBoardId, 'draft', pos, now, JSON.stringify([])]
        );
    }

    // Create initial version
    await createVersion(id, '', '', defaultParameters);

    return id;
}

export async function updatePrompt(id: string, updates: Partial<PromptCard>) {
    const existing = promptStore.prompts[id];
    if (!existing) return;

    // Update store
    setPromptStore(produce((s) => {
        Object.assign(s.prompts[id], updates);
    }));

    // Persist to DB
    if (pglite) {
        try {
            const fields: string[] = [];
            const values: unknown[] = [];
            let idx = 1;

            if (updates.title !== undefined) {
                fields.push(`title = $${idx++}`);
                values.push(updates.title);
            }
            if (updates.status !== undefined) {
                fields.push(`status = $${idx++}`);
                values.push(updates.status);
            }
            if (updates.currentVersionId !== undefined) {
                fields.push(`current_version_id = $${idx++}`);
                values.push(updates.currentVersionId);
            }
            if (updates.pos !== undefined) {
                fields.push(`pos = $${idx++}`);
                values.push(updates.pos);
            }
            if (updates.deployedAt !== undefined) {
                fields.push(`deployed_at = $${idx++}`);
                values.push(updates.deployedAt);
            }
            if (updates.starred !== undefined) {
                fields.push(`starred = $${idx++}`);
                values.push(updates.starred ? 1 : 0);
            }
            if (updates.archived !== undefined) {
                fields.push(`archived = $${idx++}`);
                values.push(updates.archived ? 1 : 0);
            }
            if (updates.schedule !== undefined) {
                fields.push(`schedule_json = $${idx++}`);
                values.push(JSON.stringify(updates.schedule));
            }
            if (updates.workflow !== undefined) {
                fields.push(`workflow_json = $${idx++}`);
                values.push(JSON.stringify(updates.workflow));
            }
            if (updates.tags !== undefined) {
                fields.push(`tags = $${idx++}`);
                values.push(JSON.stringify(updates.tags));
            }

            if (fields.length > 0) {
                values.push(id);
                await pglite.query(
                    `UPDATE prompts SET ${fields.join(', ')} WHERE id = $${idx}`,
                    values
                );

                // Sync (Convert $n to ?)
                // Note: values array matches order.
                const syncFields = fields.map(f => f.split('=')[0] + '= ?');
                await syncManager.enqueue(
                    `UPDATE prompts SET ${syncFields.join(', ')} WHERE id = ?`,
                    values
                );
            }
        } catch (error) {
            console.error('[WARN] updatePrompt: DB update failed', error);
        }
    }
}

export async function deletePrompt(id: string) {
    // Remove from store
    setPromptStore(produce((s) => {
        // Delete associated versions
        Object.keys(s.versions)
            .filter(vId => s.versions[vId].promptId === id)
            .forEach(vId => delete s.versions[vId]);
        delete s.prompts[id];
    }));

    // Delete from DB
    if (pglite) {
        await pglite.query(`DELETE FROM prompt_versions WHERE prompt_id = $1`, [id]);
        await pglite.query(`DELETE FROM prompts WHERE id = $1`, [id]);

        // Sync
        await syncManager.enqueue(`DELETE FROM prompt_versions WHERE prompt_id = ?`, [id]);
        await syncManager.enqueue(`DELETE FROM prompts WHERE id = ?`, [id]);
    }
}

export async function deletePromptsByStatus(status: PromptStatus) {
    const promptsToDelete = Object.values(promptStore.prompts).filter(p => p.status === status);
    if (promptsToDelete.length === 0) return;

    // Remove from store
    setPromptStore(produce((s) => {
        promptsToDelete.forEach(p => {
            // Delete associated versions
            Object.keys(s.versions)
                .filter(vId => s.versions[vId].promptId === p.id)
                .forEach(vId => delete s.versions[vId]);
            delete s.prompts[p.id];
        });
    }));

    // Delete from DB (Batch)
    if (pglite) {
        await pglite.query(`DELETE FROM prompt_versions WHERE prompt_id IN (SELECT id FROM prompts WHERE status = $1)`, [status]);
        await pglite.query(`DELETE FROM prompts WHERE status = $1`, [status]);

        // Sync (Batched where possible, or iterative)
        // Simple logic: delete versions by subquery logic isn't easily supported by simple syncManager unless we execute exact SQL
        // Let's iterate for safety in sync queue for now, or use the logic if supported by downstream.
        // Assuming syncManager replays SQL on sqlite.
        await syncManager.enqueue(`DELETE FROM prompt_versions WHERE prompt_id IN (SELECT id FROM prompts WHERE status = ?)`, [status]);
        await syncManager.enqueue(`DELETE FROM prompts WHERE status = ?`, [status]);
    }
}

// ============= VERSION MANAGEMENT =============

export async function createVersion(
    promptId: string,
    content: string,
    systemInstructions: string,
    parameters: PromptParameters
): Promise<string> {
    const id = genId();
    const now = Date.now();

    // Auto-Tagging
    if (content) {
        const newTags = generateTags(content);
        if (newTags.length > 0) {
            await updatePrompt(promptId, { tags: newTags });
        }
    }

    const version: PromptVersion = {
        id,
        promptId,
        content,
        systemInstructions: systemInstructions || undefined,
        parameters,
        createdAt: now,
    };

    // Update store
    setPromptStore(produce((s) => {
        s.versions[id] = version;
        if (s.prompts[promptId]) {
            s.prompts[promptId].currentVersionId = id;
        }
    }));

    // Persist to DB
    if (pglite) {
        await pglite.query(
            `INSERT INTO prompt_versions (id, prompt_id, content, system_instructions, temperature, top_p, max_tokens, model, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, promptId, content, systemInstructions || null, parameters.temperature, parameters.topP, parameters.maxTokens, parameters.model || null, now]
        );

        await pglite.query(
            `UPDATE prompts SET current_version_id = $1 WHERE id = $2`,
            [id, promptId]
        );

        // Sync
        await syncManager.enqueue(
            `INSERT INTO prompt_versions (id, prompt_id, content, system_instructions, temperature, top_p, max_tokens, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, promptId, content, systemInstructions || null, parameters.temperature, parameters.topP, parameters.maxTokens, parameters.model || null, now]
        );

        await syncManager.enqueue(
            `UPDATE prompts SET current_version_id = ? WHERE id = ?`,
            [id, promptId]
        );
    }

    return id;
}

export async function updateVersion(id: string, updates: Partial<PromptVersion>) {
    const existing = promptStore.versions[id];
    if (!existing) return;

    setPromptStore(produce((s) => {
        Object.assign(s.versions[id], updates);
    }));

    if (pglite) {
        // Auto-Tagging on update if content changed
        if (updates.content !== undefined) {
            const newTags = generateTags(updates.content);
            if (newTags.length > 0) {
                await updatePrompt(existing.promptId, { tags: newTags });
            }
        }

        const fields: string[] = [];
        const values: unknown[] = [];
        let idx = 1;

        if (updates.output !== undefined) {
            fields.push(`output = $${idx++}`);
            values.push(updates.output);
        }
        if (updates.content !== undefined) {
            fields.push(`content = $${idx++}`);
            values.push(updates.content);
        }
        if (updates.systemInstructions !== undefined) {
            fields.push(`system_instructions = $${idx++}`);
            values.push(updates.systemInstructions);
        }
        if (updates.parameters?.temperature !== undefined) {
            fields.push(`temperature = $${idx++}`);
            values.push(updates.parameters.temperature);
        }
        if (updates.parameters?.topP !== undefined) {
            fields.push(`top_p = $${idx++}`);
            values.push(updates.parameters.topP);
        }
        if (updates.parameters?.maxTokens !== undefined) {
            fields.push(`max_tokens = $${idx++}`);
            values.push(updates.parameters.maxTokens);
        }
        if (updates.parameters?.model !== undefined) {
            fields.push(`model = $${idx++}`);
            values.push(updates.parameters.model);
        }
        if (updates.executionTime !== undefined) {
            fields.push(`execution_time = $${idx++}`);
            values.push(updates.executionTime);
        }
        if (updates.error !== undefined) {
            fields.push(`error = $${idx++}`);
            values.push(updates.error);
        }

        if (fields.length > 0) {
            values.push(id);
            await pglite.query(
                `UPDATE prompt_versions SET ${fields.join(', ')} WHERE id = $${idx}`,
                values
            );

            // Sync
            const syncFields = fields.map(f => f.split('=')[0] + '= ?');
            await syncManager.enqueue(
                `UPDATE prompt_versions SET ${syncFields.join(', ')} WHERE id = ?`,
                values
            );
        }
    }
}

export function getVersionsForPrompt(promptId: string): PromptVersion[] {
    return Object.values(promptStore.versions)
        .filter(v => v.promptId === promptId)
        .sort((a, b) => a.createdAt - b.createdAt);
}

export async function revertToVersion(promptId: string, versionId: string) {
    const version = promptStore.versions[versionId];
    if (!version || version.promptId !== promptId) return;

    await updatePrompt(promptId, { currentVersionId: versionId });
}

// ============= STATUS TRANSITIONS =============

export async function moveToQueued(promptId: string, priority: 'high' | 'normal' = 'normal') {
    await updatePrompt(promptId, { status: 'queued' });
    setPromptStore(produce((s) => {
        if (!s.executionQueue.includes(promptId)) {
            if (priority === 'high') {
                s.executionQueue.unshift(promptId); // Add to front
            } else {
                s.executionQueue.push(promptId); // Add to back
            }
        } else if (priority === 'high') {
            // If already queued but high priority, move to front
            s.executionQueue = s.executionQueue.filter(id => id !== promptId);
            s.executionQueue.unshift(promptId);
        }
    }));
}


export async function moveToGenerating(promptId: string) {
    await updatePrompt(promptId, { status: 'generating' });
}

export async function moveToDeployed(promptId: string) {
    await updatePrompt(promptId, {
        status: 'deployed',
        deployedAt: Date.now()
    });
    setPromptStore(produce((s) => {
        s.executionQueue = s.executionQueue.filter(id => id !== promptId);
    }));
}

export async function moveToError(promptId: string) {
    await updatePrompt(promptId, { status: 'error' });
    setPromptStore(produce((s) => {
        s.executionQueue = s.executionQueue.filter(id => id !== promptId);
    }));
}

export async function moveToDraft(promptId: string) {
    await updatePrompt(promptId, { status: 'draft' });
}


// ============= BATCH EXECUTION =============

const CONCURRENT_LIMIT = 5;
const STAGGER_MS = 100;
let activeCount = 0;

export async function runAllDrafts() {
    const drafts = Object.values(promptStore.prompts)
        .filter(p => p.status === 'draft')
        .sort((a, b) => a.pos - b.pos);

    // Move all to queued first
    for (const prompt of drafts) {
        await moveToQueued(prompt.id);
    }

    // Process in batches with staggering
    await processExecutionQueue();
}

export async function runSinglePrompt(promptId: string) {
    // Immediate visual feedback - card moves to Generating lane right away
    await moveToGenerating(promptId);
    await moveToQueued(promptId, 'high');
    await processExecutionQueue();
}

export async function processExecutionQueue() {
    // Check global store for queued items
    // Use a loop to keep checking as long as we have capacity and items
    const candidates = promptStore.executionQueue.filter(id =>
        promptStore.prompts[id]?.status === 'queued'
    );

    if (candidates.length === 0) return;

    for (const promptId of candidates) {
        if (activeCount >= CONCURRENT_LIMIT) break;

        // Check availability again
        if (promptStore.prompts[promptId]?.status !== 'queued') continue;

        activeCount++;

        // Execute without awaiting to allow concurrency (fire and forget)
        executePrompt(promptId).finally(() => {
            activeCount--;
            processExecutionQueue();
        });
    }
}

async function executePrompt(promptId: string) {
    const prompt = promptStore.prompts[promptId];
    if (!prompt) return;

    const version = prompt.currentVersionId
        ? promptStore.versions[prompt.currentVersionId]
        : null;

    if (!version || !version.content.trim()) {
        await updateVersion(version?.id || '', { error: 'Empty prompt content' });
        await moveToError(promptId);
        return;
    }

    try {
        await moveToGenerating(promptId);

        const startTime = Date.now();

        // Import AI service and memory store
        const { generateWithFallback } = await import('./aiService');
        const { getMemoriesForContext, addMemory } = await import('./memoryStore');

        // 1. Context Injection
        const contextMemories = getMemoriesForContext(10, version.content);

        const result = await generateWithFallback({
            prompt: version.content,
            systemInstructions: version.systemInstructions,
            parameters: version.parameters,
            contextMemories,
        });

        // 2. Memory & Relation Extraction
        const { addEdge } = await import('./memoryStore');

        if (result.extractedMemories && result.extractedMemories.length > 0) {
            for (const mem of result.extractedMemories) {
                await addMemory(mem.key, mem.value, ['auto-extracted']);
            }
        }

        // Handle extracted relations from result (if any)
        if ((result as any).extractedRelations && (result as any).extractedRelations.length > 0) {
            for (const rel of (result as any).extractedRelations) {
                // Find node IDs for source and target keys
                const nodes = Object.values((await import('./memoryStore')).memoryStore.nodes);
                const source = nodes.find(n => n.key === rel.sourceKey);
                const target = nodes.find(n => n.key === rel.targetKey);

                if (source && target) {
                    await addEdge(source.id, target.id, rel.relationType);
                }
            }
        }

        await updateVersion(version.id, {
            output: result.content,
            executionTime: result.executionTime,
            parameters: {
                ...version.parameters,
                model: result.model
            }
        });

        await moveToDeployed(promptId);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Prompt ${promptId}] Failed:`, errorMessage);
        await updateVersion(version.id, { error: errorMessage });
        await moveToError(promptId);
    }
}

// ============= HELPERS =============

export function getPromptsByStatus(status: PromptStatus): PromptCard[] {
    return Object.values(promptStore.prompts)
        .filter(p => p.status === status && !p.archived)
        .sort((a, b) => a.pos - b.pos);
}

export function getCurrentVersion(promptId: string): PromptVersion | null {
    const prompt = promptStore.prompts[promptId];
    if (!prompt?.currentVersionId) return null;
    return promptStore.versions[prompt.currentVersionId] || null;
}

// ============= INITIALIZATION =============

export async function initPromptStore(boardId: string) {
    await initPromptPGlite(boardId);
    // TODO: Connect WebSocket for sync
}

// ============= SCHEDULER =============

export async function schedulePrompt(
    promptId: string,
    cron: string,
    enabled: boolean
) {
    const prompt = promptStore.prompts[promptId];
    if (!prompt) return;

    const schedule = {
        cron,
        enabled,
        lastRun: prompt.schedule?.lastRun,
        nextRun: prompt.schedule?.nextRun,
    };

    // Update locally (state and DB)
    await updatePrompt(promptId, { schedule });

    // Sync to Server
    const version = getCurrentVersion(promptId);
    const payload = {
        id: crypto.randomUUID(),
        promptId,
        content: version?.content || '',
        system: version?.systemInstructions || '',
        params: version?.parameters || defaultParameters,
        cron,
        enabled
    };

    try {
        const workerUrl = import.meta.env.VITE_AI_WORKER_URL || '';
        if (!workerUrl) return;

        const response = await fetch(`${workerUrl}/api/scheduler/schedule?board=${currentBoardId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('Failed to schedule prompt on server');
        }
    } catch (error) {
        console.error('Schedule sync failed:', error);
    }
}

export async function configureWorkflow(
    promptId: string,
    workflow: PromptWorkflow
) {
    const prompt = promptStore.prompts[promptId];
    if (!prompt) return;

    // Update locally (state and DB)
    await updatePrompt(promptId, { workflow });
}

// ============= AUTONOMOUS AGENT ORCHESTRATION =============

import type { CritiqueConfig, AgentMode } from './types';

/**
 * Decomposes a coordinator prompt into worker sub-tasks and runs them in parallel.
 */
export async function decomposeAndDelegate(coordinatorId: string): Promise<void> {
    const coordinator = promptStore.prompts[coordinatorId];
    if (!coordinator) return;

    const version = getCurrentVersion(coordinatorId);
    if (!version?.content) return;

    console.log(`[Agent] Decomposing coordinator: ${coordinatorId}`);
    await updatePrompt(coordinatorId, { agentMode: 'coordinator', status: 'queued' });

    const { decomposeTask } = await import('./aiService');
    const subtasks = await decomposeTask(version.content, 3);

    const childIds: string[] = [];

    for (const task of subtasks) {
        // Create worker prompt
        const workerId = await addPrompt(`[Worker] ${task.title}`);
        childIds.push(workerId);

        // Set worker metadata
        await updatePrompt(workerId, {
            agentMode: 'worker',
            parentId: coordinatorId,
        });

        // Set worker content
        const workerVersion = getCurrentVersion(workerId);
        if (workerVersion) {
            await updateVersion(workerVersion.id, {
                content: task.description,
                systemInstructions: `You are a specialized worker agent. Complete the following sub-task thoroughly.\n\nMAIN CONTEXT: ${version.content}`,
            });
        }

        // Queue worker execution
        runSinglePrompt(workerId);
    }

    // Link children to coordinator
    await updatePrompt(coordinatorId, { childIds });

    console.log(`[Agent] Spawned ${childIds.length} workers for coordinator ${coordinatorId}`);
}

/**
 * Called after all workers complete. Aggregates outputs and synthesizes final response.
 */
export async function synthesizeFromWorkers(coordinatorId: string): Promise<void> {
    const coordinator = promptStore.prompts[coordinatorId];
    if (!coordinator?.childIds?.length) return;

    // Check if all children are complete
    const children = coordinator.childIds.map(id => promptStore.prompts[id]).filter(Boolean);
    const allDone = children.every(c => c.status === 'deployed' || c.status === 'error');

    if (!allDone) {
        console.log(`[Agent] Not all workers complete for ${coordinatorId}`);
        return;
    }

    // Gather outputs
    const workerOutputs = children.map(child => {
        const v = getCurrentVersion(child.id);
        return `## ${child.title}\n${v?.output || '(no output)'}`;
    }).join('\n\n---\n\n');

    const version = getCurrentVersion(coordinatorId);
    if (!version) return;

    console.log(`[Agent] Synthesizing from ${children.length} workers...`);
    await updatePrompt(coordinatorId, { status: 'generating' });

    const { generateWithFallback } = await import('./aiService');

    const result = await generateWithFallback({
        prompt: `Synthesize the following worker outputs into a cohesive final answer.

ORIGINAL QUESTION:
${version.content}

WORKER OUTPUTS:
${workerOutputs}

Provide a comprehensive, well-structured answer.`,
        parameters: version.parameters,
    });

    await updateVersion(version.id, {
        output: result.content,
        executionTime: result.executionTime,
    });

    await updatePrompt(coordinatorId, { status: 'deployed' });
    console.log(`[Agent] Coordinator ${coordinatorId} synthesis complete.`);
}

/**
 * Runs a prompt with critique-based self-correction loop.
 */
export async function runWithCritique(promptId: string): Promise<void> {
    const prompt = promptStore.prompts[promptId];
    if (!prompt?.critique?.enabled) {
        await runSinglePrompt(promptId);
        return;
    }

    const maxRetries = prompt.critique.maxRetries || 2;
    let currentRetry = 0;
    let lastFeedback = '';

    while (currentRetry <= maxRetries) {
        console.log(`[Critique] Attempt ${currentRetry + 1}/${maxRetries + 1} for ${promptId}`);

        // Update critique state
        await updatePrompt(promptId, {
            critique: { ...prompt.critique, currentRetry, lastFeedback }
        });

        // Run prompt
        await runSinglePrompt(promptId);

        // Get output
        const version = getCurrentVersion(promptId);
        if (!version?.output) break;

        // Critique the output
        const { critiqueOutput } = await import('./aiService');
        const critique = await critiqueOutput(version.output, prompt.critique.constraints);

        console.log(`[Critique] Score: ${critique.score}, Pass: ${critique.pass}`);

        await updatePrompt(promptId, {
            critique: { ...prompt.critique, lastScore: critique.score, lastFeedback: critique.feedback }
        });

        if (critique.pass) {
            console.log(`[Critique] Output passed for ${promptId}`);
            return;
        }

        // Prepare for retry with feedback injection
        lastFeedback = critique.feedback;
        currentRetry++;

        // Inject feedback into system instructions for next run
        if (currentRetry <= maxRetries) {
            const newSystem = `${version.systemInstructions || ''}\n\n[CRITIC FEEDBACK - IMPROVE YOUR RESPONSE]\n${critique.feedback}`;
            await updateVersion(version.id, { systemInstructions: newSystem, output: undefined });
            await updatePrompt(promptId, { status: 'draft' }); // Reset for re-run
        }
    }

    console.log(`[Critique] Max retries reached for ${promptId}. Using last output.`);
}
