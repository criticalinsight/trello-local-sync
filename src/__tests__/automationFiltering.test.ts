import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock BoardDO logic for unit testing the filtering
describe('Automation Filtering Logic', () => {
    const mockWorkflows = [
        {
            id: 'prompt-1',
            workflow: JSON.stringify({
                enabled: true,
                triggers: [{ type: 'card_added', config: { listId: 'list-1' } }]
            })
        },
        {
            id: 'prompt-2',
            workflow: JSON.stringify({
                enabled: true,
                triggers: [{ type: 'card_tagged', config: { tag: 'prio' } }]
            })
        },
        {
            id: 'prompt-3',
            workflow: JSON.stringify({
                enabled: false,
                triggers: [{ type: 'card_added' }]
            })
        }
    ];

    test('matches listId filter for card_added', () => {
        const card = { id: 'card-1', list_id: 'list-1', tags: '[]' };
        const triggerType = 'card_added';

        const matched = mockWorkflows.filter(pw => {
            const config = JSON.parse(pw.workflow);
            if (!config.enabled) return false;
            return config.triggers.some(t => {
                if (t.type !== triggerType) return false;
                if (t.config?.listId && t.config.listId !== card.list_id) return false;
                return true;
            });
        });

        expect(matched.length).toBe(1);
        expect(matched[0].id).toBe('prompt-1');
    });

    test('does not match listId filter if different', () => {
        const card = { id: 'card-1', list_id: 'list-2', tags: '[]' };
        const triggerType = 'card_added';

        const matched = mockWorkflows.filter(pw => {
            const config = JSON.parse(pw.workflow);
            if (!config.enabled) return false;
            return config.triggers.some(t => {
                if (t.type !== triggerType) return false;
                if (t.config?.listId && t.config.listId !== card.list_id) return false;
                return true;
            });
        });

        expect(matched.length).toBe(0);
    });

    test('matches tag filter for card_tagged', () => {
        const card = { id: 'card-1', list_id: 'list-1', tags: '["prio", "bug"]' };
        const triggerType = 'card_tagged';
        const cardTags = JSON.parse(card.tags);

        const matched = mockWorkflows.filter(pw => {
            const config = JSON.parse(pw.workflow);
            if (!config.enabled) return false;
            return config.triggers.some(t => {
                if (t.type !== triggerType) return false;
                if (t.config?.tag && !cardTags.includes(t.config.tag)) return false;
                return true;
            });
        });

        expect(matched.length).toBe(1);
        expect(matched[0].id).toBe('prompt-2');
    });

    test('ignores disabled workflows', () => {
        const card = { id: 'card-1', list_id: 'list-1', tags: '[]' };
        const triggerType = 'card_added';

        const matched = mockWorkflows.filter(pw => {
            const config = JSON.parse(pw.workflow);
            return config.enabled && config.triggers.some(t => t.type === triggerType);
        });

        expect(matched.some(m => m.id === 'prompt-3')).toBe(false);
    });
});
