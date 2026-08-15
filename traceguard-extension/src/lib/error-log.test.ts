import { describe, it, expect } from 'vitest';
import { recordError, getErrorLog, clearErrorLog } from './error-log';

describe('error-log', () => {
    it('records and returns errors with a timestamp', async () => {
        await recordError('boom', 'context');
        const log = await getErrorLog();
        expect(log).toHaveLength(1);
        expect(log[0].message).toBe('boom');
        expect(log[0].context).toBe('context');
        expect(typeof log[0].timestamp).toBe('number');
    });

    it('caps the buffer at 100 entries (oldest dropped)', async () => {
        for (let i = 0; i < 150; i++) await recordError(`e${i}`);
        const log = await getErrorLog();
        expect(log.length).toBeLessThanOrEqual(100);
        expect(log[log.length - 1].message).toBe('e149');
    });

    it('clears the log', async () => {
        await recordError('x');
        await clearErrorLog();
        expect(await getErrorLog()).toHaveLength(0);
    });
});
