import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** scripts/tool-pipeline/ */
export const PIPELINE_DIR = fileURLToPath(new URL('..', import.meta.url));
/** repository root (…/Clovertools/) */
export const REPO = fileURLToPath(new URL('../../../', import.meta.url));

export const CONFIG_FILE = join(REPO, 'tool-pipeline.config.json');
export const BACKLOG_FILE = join(PIPELINE_DIR, 'backlog.json');
export const SPECS_DIR = join(PIPELINE_DIR, 'specs');
export const TEMPLATES_DIR = join(PIPELINE_DIR, 'templates');

export const STATE_DIR = join(REPO, '.editorial/tool-pipeline');
export const QUEUE_FILE = join(STATE_DIR, 'queue.json');
export const STATE_FILE = join(STATE_DIR, 'state.json');
export const PAUSE_FILE = join(STATE_DIR, 'PAUSED');
export const PROPOSALS_DIR = join(STATE_DIR, 'proposals');

export const RUNS_DIR = join(REPO, '.editorial/tool-runs');
export const WORKTREES_DIR = join(REPO, '.editorial/tool-worktrees');
export const LATEST_FILE = join(RUNS_DIR, 'latest.json');
export const NIGHTLY_LOG = join(RUNS_DIR, 'nightly.log');
