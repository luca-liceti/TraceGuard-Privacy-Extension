/**
 * Pick the local model that matches the machine, from what a browser will admit
 * about its GPU.
 *
 * No browser reports graphics memory. Chromium exposes the card's marketing
 * name through `WEBGL_debug_renderer_info`, and WebGPU's adapter info names the
 * vendor and architecture, but none of them says how much VRAM exists. So this
 * reads the name, looks it up in a table of common cards, and otherwise
 * recommends the smallest model that does the job rather than guessing high and
 * leaving the user with a model that spills into system memory.
 *
 * The recommended tags and sizes match the ladder in ROADMAP.md.
 */

export const SUMMARY_ONLY_MODEL = 'qwen3.5:0.8b';
export const IMPROVED_SUMMARY_MODEL = 'qwen3.5:4b';
export const FUNCTIONAL_MODEL = 'qwen3.5:9b';
export const BETTER_MODEL = 'gemma4:12b';
export const OUTSTANDING_MODEL = 'gemma4:26b';

/** Roughly 10 GB of graphics memory, including the policy report's context. */
export const POLICY_REPORT_VRAM_GB = 10;

const POLICY_CAPABLE_MODELS = new Set([FUNCTIONAL_MODEL, BETTER_MODEL, OUTSTANDING_MODEL]);

/** Whether a selected Ollama model is one of the policy-report-capable recommendations. */
export function isPolicyCapableModel(model: string): boolean {
    return POLICY_CAPABLE_MODELS.has(model.trim());
}

export type GpuKind = 'integrated' | 'discrete' | 'apple' | 'software' | 'unknown';

export type ModelTier = 'summaries' | 'functional' | 'better' | 'outstanding';

export interface HardwareProfile {
    /** The card name as the browser reported it, or '' when nothing was found. */
    gpu: string;
    kind: GpuKind;
    /** Graphics memory in GB when the card is in the table, otherwise null. */
    vramGb: number | null;
    tier: ModelTier;
    model: string;
    /** Download size to show next to the model, in GB. */
    sizeGb: string;
    /** One sentence on what this model can and cannot do here. */
    note: string;
}

/**
 * Graphics memory for common desktop and laptop cards. Longest and most
 * specific patterns come first, because `4060 Ti 16GB` also matches `4060 Ti`
 * and `3060 12GB` also matches `3060`.
 */
const GPU_MEMORY: Array<{ pattern: RegExp; vramGb: number }> = [
    { pattern: /5090/i, vramGb: 32 },
    { pattern: /rtx\s*(?:4090|3090)|7900\s*xtx/i, vramGb: 24 },
    { pattern: /rtx\s*(?:4080|5080|4070\s*ti\s*super|4060\s*ti\s*16)|7800\s*xt|6800\s*xt|6950\s*xt|arc\s*a770/i, vramGb: 16 },
    { pattern: /rtx\s*(?:4070(?:\s*ti)?|5070|3080\s*12|3060\s*12)|arc\s*b580/i, vramGb: 12 },
    { pattern: /rtx\s*(?:3080|2080\s*ti)/i, vramGb: 10 },
    { pattern: /rtx\s*(?:3070|4060(?:\s*ti)?|3060|3050|2080|2070)|gtx\s*(?:1080|1070)|rx\s*(?:6600|7600|580)|arc\s*a750/i, vramGb: 8 },
    { pattern: /gtx\s*(?:1660|1060)|rtx\s*2060|rx\s*5600/i, vramGb: 6 },
    { pattern: /gtx\s*(?:1650|1050)/i, vramGb: 4 },
];

/** Strip the ANGLE wrapper and API suffix, leaving the card's name. */
export function cleanGpuName(raw: string): string {
    const trimmed = raw.trim();
    const fromAngle = trimmed.replace(/^ANGLE\s*\(/i, '').split(',')[1] ?? trimmed;
    return fromAngle
        .replace(/^\s*(?:ANGLE\s+)?(?:Metal Renderer|D3D\d+|Vulkan|OpenGL)\s*:\s*/i, '')
        .replace(/\s+(?:Direct3D\d+|OpenGL|Metal|Vulkan)\b.*$/i, '')
        .replace(/\/PCIe(?:\/SSE2)?$/i, '')
        .replace(/\s+vs_\d+_\d+.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Classify a renderer or adapter name into a kind and, when known, a VRAM size. */
export function classifyRenderer(raw: string): Pick<HardwareProfile, 'gpu' | 'kind' | 'vramGb'> {
    const gpu = cleanGpuName(raw);
    const name = gpu.toLowerCase();

    if (/swiftshader|llvmpipe|software|basic render/i.test(name)) {
        return { gpu, kind: 'software', vramGb: null };
    }
    if (/apple\s+m\d/.test(name)) {
        return { gpu, kind: 'apple', vramGb: null };
    }
    if (/intel.*(?:uhd|iris|hd graphics)|radeon\s+graphics|mali|adreno|vram/i.test(name)) {
        return { gpu, kind: 'integrated', vramGb: null };
    }
    if (/nvidia|geforce|rtx|gtx|quadro|radeon\s+(?:rx|pro)|arc\s+[ab]\d|apple\s+gpu/i.test(name)) {
        const known = GPU_MEMORY.find(entry => entry.pattern.test(gpu));
        return { gpu, kind: 'discrete', vramGb: known?.vramGb ?? null };
    }
    return { gpu, kind: 'unknown', vramGb: null };
}

/** The model to suggest for a machine, before any GPU name is involved. */
export function recommendFor(
    kind: GpuKind,
    vramGb: number | null,
    gpu = '',
): HardwareProfile {
    if (kind === 'apple') {
        return {
            gpu,
            kind,
            vramGb,
            tier: 'functional',
            model: FUNCTIONAL_MODEL,
            sizeGb: '6.6 GB',
            note: 'Apple Silicon shares memory with the system. This handles all three jobs; a Mac with 24 GB or more can step up to gemma4:26b.',
        };
    }

    if (kind === 'discrete' && vramGb !== null) {
        if (vramGb >= 24) {
            return {
                gpu, kind, vramGb, tier: 'outstanding',
                model: OUTSTANDING_MODEL,
                sizeGb: '18.7 GB',
                note: 'Handles all three jobs, and is the least likely to have a long policy report discarded.',
            };
        }
        if (vramGb >= 12) {
            return {
                gpu, kind, vramGb, tier: 'better',
                model: BETTER_MODEL,
                sizeGb: '8.0 GB',
                note: 'Handles all three jobs with more headroom for long policies than the 9B model.',
            };
        }
        if (vramGb >= POLICY_REPORT_VRAM_GB) {
            return {
                gpu, kind, vramGb, tier: 'functional',
                model: FUNCTIONAL_MODEL,
                sizeGb: '6.6 GB',
                note: 'Handles all three jobs, including policy reports.',
            };
        }
        if (vramGb >= 4) {
            return {
                gpu, kind, vramGb, tier: 'summaries',
                model: IMPROVED_SUMMARY_MODEL,
                sizeGb: '3.3 GB',
                note: `Better summaries than the 0.8B model. Policy reports need about ${POLICY_REPORT_VRAM_GB} GB of graphics memory.`,
            };
        }
    }

    if (kind === 'discrete') {
        return {
            gpu, kind, vramGb, tier: 'summaries',
            model: IMPROVED_SUMMARY_MODEL,
            sizeGb: '3.3 GB',
            note: `This card's memory could not be read. Summaries work; a policy report needs about ${POLICY_REPORT_VRAM_GB} GB of graphics memory.`,
        };
    }

    if (kind === 'integrated' || kind === 'software') {
        return {
            gpu, kind, vramGb, tier: 'summaries',
            model: SUMMARY_ONLY_MODEL,
            sizeGb: '1.3 GB',
            note: `Integrated graphics share system memory, so summaries run small. Policy reports need a dedicated GPU with about ${POLICY_REPORT_VRAM_GB} GB.`,
        };
    }

    return {
        gpu, kind, vramGb, tier: 'summaries',
        model: SUMMARY_ONLY_MODEL,
        sizeGb: '1.3 GB',
        note: `No graphics hardware could be identified. Summaries stay small; policy reports need a dedicated GPU with about ${POLICY_REPORT_VRAM_GB} GB.`,
    };
}

/** Read the card name from WebGL, which names the exact model on desktop. */
function readWebGlName(): string | null {
    if (typeof document === 'undefined') return null;
    try {
        const canvas = document.createElement('canvas');
        const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
        if (!gl) return null;
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        const name = extension
            ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return typeof name === 'string' && name.trim() ? name : null;
    } catch {
        return null;
    }
}

interface AdapterInfo {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
}

/** Fall back to WebGPU, which names the vendor and architecture but not VRAM. */
async function readWebGpuName(): Promise<string | null> {
    try {
        const gpu = (navigator as Navigator & {
            gpu?: { requestAdapter(): Promise<{ info?: AdapterInfo } | null> };
        }).gpu;
        if (!gpu) return null;
        const adapter = await gpu.requestAdapter();
        const info = adapter?.info;
        if (!info) return null;
        const parts = [info.vendor, info.architecture, info.device, info.description]
            .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
        return parts.length > 0 ? parts.join(' ') : null;
    } catch {
        return null;
    }
}

/** Inspect this device and return the model to suggest. Never throws. */
export async function detectHardware(): Promise<HardwareProfile> {
    const webGlName = readWebGlName();
    if (webGlName) {
        const classified = classifyRenderer(webGlName);
        return recommendFor(classified.kind, classified.vramGb, classified.gpu);
    }

    const webGpuName = await readWebGpuName();
    if (webGpuName) {
        const classified = classifyRenderer(webGpuName);
        return recommendFor(classified.kind, classified.vramGb, classified.gpu);
    }

    return recommendFor('unknown', null);
}

/** The command a user pastes into a terminal to install the suggested model. */
export function pullCommand(model: string): string {
    return `ollama pull ${model}`;
}
