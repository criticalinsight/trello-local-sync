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

// Store state
export interface StoreState {
    lists: Record<string, List>;
    cards: Record<string, Card>;
    connected: boolean;
    syncing: boolean;
}
