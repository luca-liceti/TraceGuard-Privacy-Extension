import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listOllamaModels, summarizeWithOllama } from './ollama';
import type { SummaryRequest } from './types';

const request: SummaryRequest = {
    subject: 'site',
    subjectName: 'example.com',
    facts: [
        { label: 'Site', value: 'example.com' },
        { label: 'Website Safety Score', value: '72 out of 100' },
        { label: 'Trackers found', value: '4' },
    ],
};

beforeEach(() => {
    vi.stubGlobal('chrome', { runtime: { id: 'test-id', getURL: vi.fn(() => 'moz-extension://test-id/manifest.json') } });
    vi.stubGlobal('window', { location: { origin: 'moz-extension://test-id', protocol: 'moz-extension:', hostname: 'test-id' } });
});

const ollamaContentResponse = (content: string) => new Response(JSON.stringify({
    message: { role: 'assistant', content },
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

const ollamaResponse = (summary: string) => ollamaContentResponse(JSON.stringify({ summary }));

describe('Ollama model discovery', () => {
    it('returns sorted unique installed model names from the tags endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [
            { name: 'qwen3.5:0.8b' },
            { name: 'llama3.2:latest' },
            { name: 'qwen3.5:0.8b' },
            { name: '' },
            {},
            null,
            { name: 'x'.repeat(101) },
        ] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(listOllamaModels()).resolves.toEqual(['llama3.2:latest', 'qwen3.5:0.8b']);
        const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(options.method).toBe('GET');
        expect(options.signal).toBeInstanceOf(AbortSignal);
        expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags', options);
    });

    it('returns an empty list when Ollama has no installed models', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"models":[]}', { status: 200 })));
        await expect(listOllamaModels()).resolves.toEqual([]);
    });

    it('rejects malformed or unsuccessful model-list responses', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"unexpected":[]}', { status: 200 })));
        await expect(listOllamaModels()).rejects.toThrow('unexpected model list');

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
        await expect(listOllamaModels()).rejects.toThrow('HTTP 403');
    });

    it('names the origin allowlist when Ollama refuses the model list with 403', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
        await expect(listOllamaModels()).rejects.toThrow('OLLAMA_ORIGINS');
    });

    it('refuses model discovery from a non-extension origin', async () => {
        vi.stubGlobal('window', { location: { origin: 'https://attacker.example', protocol: 'https:', hostname: 'attacker.example' } });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(listOllamaModels()).rejects.toThrow('only from a TraceGuard extension view');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('Ollama summaries', () => {
    it('sends only supplied deterministic facts and accepts a checked response', async () => {
        const fetchMock = vi.fn().mockResolvedValue(ollamaResponse('The site example.com has a score of 72 out of 100, with 4 trackers found.'));
        vi.stubGlobal('fetch', fetchMock);

        await expect(summarizeWithOllama(request, 'qwen3.5:0.8b')).resolves.toMatchObject({
            text: 'The site example.com has a score of 72 out of 100, with 4 trackers found.',
            model: 'qwen3.5:0.8b',
        });
        expect(chrome.runtime.getURL).toHaveBeenCalledWith('manifest.json');
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('http://localhost:11434/api/chat');
        const body = JSON.parse(String(init.body));
        expect(body.stream).toBe(false);
        expect(body.think).toBe(false);
        expect(body.format).toBeDefined();
        expect(body.options.num_predict).toBeLessThanOrEqual(768);
        expect(body.options.num_ctx).toBeGreaterThanOrEqual(8_192);
        expect(JSON.stringify(body)).toContain('example.com');
        expect(JSON.stringify(body)).not.toContain('https://');
        expect(JSON.stringify(body)).not.toContain('crossSiteExposure');
        expect(JSON.stringify(body)).not.toContain('email');
        expect(JSON.stringify(body)).not.toContain('tracker URLs');
    });

    it('allows the runtime origin even when the browser uses a non-Chrome extension scheme', async () => {
        const fetchMock = vi.fn().mockResolvedValue(ollamaResponse('The site example.com has a score of 72 out of 100, with 4 trackers found.'));
        vi.stubGlobal('fetch', fetchMock);
        await expect(summarizeWithOllama(request, 'qwen3.5:0.8b')).resolves.toMatchObject({ model: 'qwen3.5:0.8b' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('refuses to send requests from a non-extension origin', async () => {
        vi.stubGlobal('window', { location: { origin: 'https://attacker.example', protocol: 'https:', hostname: 'attacker.example' } });
        vi.stubGlobal('chrome', { runtime: { id: 'test-id', getURL: () => 'moz-extension://test-id/manifest.json' } });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(summarizeWithOllama(request, 'qwen3.5:0.8b')).rejects.toThrow('only from a TraceGuard extension view');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('retries malformed model JSON once and accepts only a valid, checked retry', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(ollamaContentResponse('The score is 72 out of 100.'))
            .mockResolvedValueOnce(ollamaResponse('You have a score of 72 out of 100 and 4 trackers found on example.com.'));
        vi.stubGlobal('fetch', fetchMock);

        await expect(summarizeWithOllama(request, 'qwen3.5:0.8b')).resolves.toMatchObject({
            text: 'You have a score of 72 out of 100 and 4 trackers found on example.com.',
            model: 'qwen3.5:0.8b',
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const retryBody = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
        expect(retryBody.messages.at(-1).content).toContain('valid JSON object');
    });

    it('discards the result after a single retry also returns malformed JSON', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(ollamaContentResponse('The score is 72 out of 100.'))
            .mockResolvedValueOnce(ollamaContentResponse('Still not JSON.'));
        vi.stubGlobal('fetch', fetchMock);

        await expect(summarizeWithOllama(request, 'qwen3.5:0.8b'))
            .rejects.toThrow('invalid JSON twice, so the summary was discarded');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries a fact-guard rejection once and accepts only a supported rewrite', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(ollamaResponse('The score is 99.'))
            .mockResolvedValueOnce(ollamaResponse('The site example.com has a score of 72 out of 100, with 4 trackers found.'));
        vi.stubGlobal('fetch', fetchMock);

        await expect(summarizeWithOllama(request, 'qwen3.5:0.8b')).resolves.toMatchObject({
            text: 'The site example.com has a score of 72 out of 100, with 4 trackers found.',
            model: 'qwen3.5:0.8b',
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const retryBody = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
        expect(retryBody.messages.at(-1).content).toContain('directly supported by those facts');
        // The rejected value is named so a small model can remove it.
        expect(retryBody.messages.at(-1).content).toContain('99');
    });

    it('refuses an oversized fact without contacting Ollama', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await expect(summarizeWithOllama({
            ...request,
            facts: [{ label: 'Site', value: 'example.com' }, { label: 'Tracker evidence', value: 'x'.repeat(301) }],
        }, 'qwen3.5:0.8b')).rejects.toThrow('too large to send safely');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports empty facts as nothing recorded rather than as too large', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await expect(summarizeWithOllama({ ...request, facts: [] }, 'qwen3.5:0.8b'))
            .rejects.toThrow('no recorded facts');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('names the origin allowlist when Ollama refuses the request with 403', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(summarizeWithOllama(request, 'qwen3.5:0.8b'))
            .rejects.toThrow('Add chrome-extension://* to OLLAMA_ORIGINS and restart Ollama.');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('discards a fact-guard rejection when the single retry remains unsupported', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(ollamaResponse('The score is 99.'))
            .mockResolvedValueOnce(ollamaResponse('The site example.com has a score of 88 out of 100.'));
        vi.stubGlobal('fetch', fetchMock);

        await expect(summarizeWithOllama(request, 'qwen3.5:0.8b'))
            .rejects.toThrow('added a number that was not in your recorded facts');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('tells the model its reply was too long, then accepts the shorter retry', async () => {
        const longSummary = 'The site example.com has a score of 72 out of 100, with 4 trackers found. '.repeat(20);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(ollamaResponse(longSummary))
            .mockResolvedValueOnce(ollamaResponse('The site example.com has a score of 72 out of 100, with 4 trackers found.'));
        vi.stubGlobal('fetch', fetchMock);

        await expect(summarizeWithOllama(request, 'qwen3.5:0.8b')).resolves.toMatchObject({
            text: 'The site example.com has a score of 72 out of 100, with 4 trackers found.',
        });
        const retryBody = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
        expect(retryBody.messages.at(-1).content).toContain('too long');
        expect(retryBody.messages.at(-1).content).toContain('1000 characters');
    });

});
