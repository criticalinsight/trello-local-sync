export interface Attachment {
    id: string;
    cardId: string;
    name: string;
    url: string;
    type: string;
    size: number;
    createdAt: number;
}

export interface Comment {
    id: string;
    cardId: string;
    text: string;
    createdAt: number;
}

export interface Card {
    id: string;
    title: string;
    listId: string;
    pos: number;
    createdAt: number;
    description?: string;
    tags?: string[]; // JSON array
    checklist?: { id: string; text: string; done: boolean }[]; // JSON array
    dueDate?: number; // timestamp
}

export interface List {
    id: string;
    title: string;
    pos: number;
}

export interface Board {
    id: string;
    title: string;
    lists: List[];
    cards: Card[];
}

// Sync message types
export type SyncMessage =
    | { type: 'EXECUTE_SQL'; sql: string; params: unknown[]; clientId: string }
    | { type: 'SQL_RESULT'; sql: string; params: unknown[]; result: unknown }
    | { type: 'SYNC_STATE'; cards: Card[]; lists: List[] }
    | { type: 'CLIENT_ID'; id: string };

export interface StoreState {
    lists: Record<string, List>;
    cards: Record<string, Card>;
    connected: boolean;
    syncing: boolean;
}

// ============= PROMPT ENGINEERING TYPES =============

export type PromptStatus = 'draft' | 'queued' | 'generating' | 'deployed' | 'error';

export interface PromptParameters {
    temperature: number;
    topP: number;
    maxTokens: number;
}

export interface PromptVersion {
    id: string;
    promptId: string;
    content: string;
    systemInstructions?: string;
    parameters: PromptParameters;
    output?: string;
    createdAt: number;
    executionTime?: number;
    error?: string;
}

export type TriggerType = 'card_added' | 'card_moved' | 'card_tagged';

export interface WorkflowTrigger {
    type: TriggerType;
    config?: {
        listId?: string;
        tag?: string;
    };
}

export interface PromptWorkflow {
    enabled: boolean;
    triggers: WorkflowTrigger[];
}

export interface PromptCard {
    id: string;
    title: string;
    boardId: string;
    status: PromptStatus;
    currentVersionId?: string;
    pos: number;
    createdAt: number;
    deployedAt?: number;
    starred?: boolean;
    archived?: boolean;
    schedule?: {
        cron: string;
        enabled: boolean;
        lastRun?: number;
        nextRun?: number;
    };
    workflow?: PromptWorkflow;
}

export interface PromptBoardMeta {
    id: string;
    title: string;
    createdAt: number;
}

// Extend sync messages for prompts
export type PromptSyncMessage =
    | { type: 'PROMPT_UPDATE'; prompt: PromptCard; clientId: string }
    | { type: 'VERSION_UPDATE'; version: PromptVersion; clientId: string }
    | { type: 'PROMPT_DELETE'; promptId: string; clientId: string }
    | { type: 'SYNC_PROMPTS'; prompts: PromptCard[]; versions: PromptVersion[] };
