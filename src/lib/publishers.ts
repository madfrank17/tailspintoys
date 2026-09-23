/**
 * Provides build-time data-access helpers for publisher records.
 */
import { asc } from 'drizzle-orm';
import { publishers } from '../../db/schema';
import type { Publisher } from '../types/game';
import type { Database } from './db';

/**
 * Returns all publishers ordered alphabetically by name.
 *
 * @param db - The injectable database connection used to query publishers.
 * @returns A promise resolving to publisher ids and names.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
}
