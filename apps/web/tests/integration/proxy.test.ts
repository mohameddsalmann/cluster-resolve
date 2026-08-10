import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { resolve } from 'path';

const WEB_DIR = resolve(__dirname, '..', '..');
const NEXT_ENTRY = resolve(WEB_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');
const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;

let serverProcess: ChildProcess | null = null;

function waitForServer(url: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.ok || res.status < 500) {
          resolve();
          return;
        }
      } catch {
        // not ready yet
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server at ${url} did not start within ${timeoutMs}ms`));
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

describe('proxy integration', () => {
  beforeAll(async () => {
    serverProcess = spawn('node', [NEXT_ENTRY, 'start', '-p', String(PORT)], {
      cwd: WEB_DIR,
      stdio: 'pipe',
      shell: false,
    });
    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[next start stderr]', data.toString());
    });
    await waitForServer(`${BASE_URL}/api/health/live`);
  }, 120000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      serverProcess = null;
    }
  });

  it('injects x-request-id header into response', async () => {
    const res = await fetch(`${BASE_URL}/api/health/live`);
    const requestId = res.headers.get('x-request-id');
    expect(requestId).toBeTruthy();
    expect(requestId!.length).toBeGreaterThan(0);
  });

  it('preserves existing x-request-id when provided', async () => {
    const customId = 'test-request-id-12345';
    const res = await fetch(`${BASE_URL}/api/health/live`, {
      headers: { 'x-request-id': customId },
    });
    const requestId = res.headers.get('x-request-id');
    expect(requestId).toBe(customId);
  });

  it('sets x-content-type-options security header', async () => {
    const res = await fetch(`${BASE_URL}/api/health/live`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('sets x-frame-options security header', async () => {
    const res = await fetch(`${BASE_URL}/api/health/live`);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });
}, 120000);
