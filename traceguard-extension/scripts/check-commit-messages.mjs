#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK COMMIT MESSAGES, reject assistant credit
 * =============================================================================
 *
 * The project rules forbid crediting an AI tool or assistant anywhere in this
 * repository's history. A rule that depends on remembering is not enforcement,
 * so this script is what CI runs over the commits a push or a pull request adds.
 *
 * The assistant names below appear only so they can be detected. Nothing else
 * in this repository may contain them.
 *
 * The checks match credit, not vocabulary. Names are only rejected inside a
 * credit line, because this project legitimately discusses some of the same
 * tools as product decisions: record 0008 covers Gemini Nano, and a commit that
 * implements the query box has to name it.
 *
 * Usage:
 *   node scripts/check-commit-messages.mjs --range origin/main..HEAD
 *   node scripts/check-commit-messages.mjs --last 3
 *
 * Exits 1 when any commit in the range carries credit, 0 otherwise.
 * =============================================================================
 */
import { execFileSync } from 'node:child_process';

/** Names that must never appear as a credit line, lowercased. */
const ASSISTANT_NAMES = [
    'codebuff',
    'claude',
    'chatgpt',
    'copilot',
    'openai',
    'anthropic',
    'cursor agent',
];

/** The one name with no legitimate reason to appear in a message at all. */
const NEVER_MENTIONED = 'codebuff';

const ASSISTANT_ALTERNATION = ASSISTANT_NAMES.map((name) => name.replace(/ /g, '\\s+')).join('|');

const CHECKS = [
    {
        label: 'a "Generated with" trailer',
        test: (message) => /^\s*generated with\s+\S/im.test(message),
    },
    {
        label: 'an assistant named as a co-author',
        test: (message) => new RegExp(`^\\s*co-authored-by:.*(${ASSISTANT_ALTERNATION})`, 'im').test(message),
    },
    {
        label: 'the assistant named anywhere in the message',
        test: (message) => message.toLowerCase().includes(NEVER_MENTIONED),
    },
    {
        label: 'a robot emoji credit marker',
        test: (message) => message.includes('\u{1F916}'),
    },
];

function git(args) {
    return execFileSync('git', args, { encoding: 'utf8' });
}

function parseArgs(argv) {
    let range = null;
    let last = 1;

    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--range' && argv[i + 1]) {
            range = argv[i + 1];
            i += 1;
        } else if (argv[i] === '--last' && argv[i + 1]) {
            const parsed = Number(argv[i + 1]);
            if (!Number.isInteger(parsed) || parsed < 1) {
                throw new Error(`--last expects a positive integer, received "${argv[i + 1]}"`);
            }
            last = parsed;
            i += 1;
        } else {
            throw new Error(`Unrecognised argument "${argv[i]}". Use --range <A..B> or --last <N>.`);
        }
    }

    return { range, last };
}

function listCommits({ range, last }) {
    const args = range
        ? ['rev-list', range]
        : ['rev-list', `--max-count=${last}`, 'HEAD'];
    return git(args).split('\n').map((line) => line.trim()).filter(Boolean);
}

function main() {
    let options;
    try {
        options = parseArgs(process.argv.slice(2));
    } catch (error) {
        console.error(`[commit-messages] ${error.message}`);
        process.exit(1);
    }

    let shas;
    try {
        shas = listCommits(options);
    } catch (error) {
        // An unresolvable range usually means a shallow clone. Failing loudly is
        // correct: silence here would report a clean history that was never read.
        console.error(`[commit-messages] Could not list commits: ${error.message.trim()}`);
        process.exit(1);
    }

    if (shas.length === 0) {
        console.log('[commit-messages] No commits in range, nothing to check.');
        return;
    }

    const offenders = [];
    for (const sha of shas) {
        const message = git(['log', '-1', '--format=%B', sha]);
        const labels = CHECKS.filter((check) => check.test(message)).map((check) => check.label);
        if (labels.length > 0) {
            offenders.push({ sha, subject: message.split('\n')[0].trim(), labels });
        }
    }

    if (offenders.length === 0) {
        console.log(`[commit-messages] Checked ${shas.length} commit(s), no assistant credit found.`);
        return;
    }

    console.error(`[commit-messages] ${offenders.length} of ${shas.length} commit(s) credit an assistant:\n`);
    for (const offender of offenders) {
        console.error(`  ${offender.sha.slice(0, 7)} ${offender.subject}`);
        console.error(`    contains ${offender.labels.join(' and ')}`);
    }
    console.error('\nRemove the credit line and amend the commit before pushing. This check refuses a');
    console.error('message rather than editing history.');
    process.exit(1);
}

main();
