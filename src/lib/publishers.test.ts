import { beforeEach, describe, expect, it } from 'vitest';
import { publishers } from '../../db/schema';
import { createTestDatabase } from '../../db/test-helpers';
import type { Database } from './db';
import { getAllPublishers } from './publishers';

describe('publisher data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all publishers ordered by name', async () => {
        await db.insert(publishers).values([
            { name: 'Zed Games', description: 'z' },
            { name: 'Alpha Games', description: 'a' },
        ]);

        const all = await getAllPublishers(db);

        expect(all).toEqual([
            { id: expect.any(Number), name: 'Alpha Games' },
            { id: expect.any(Number), name: 'Zed Games' },
        ]);
    });

    it('returns an empty list when no publishers exist', async () => {
        expect(await getAllPublishers(db)).toEqual([]);
    });
});
