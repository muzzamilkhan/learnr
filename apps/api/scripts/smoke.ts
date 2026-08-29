import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Does the thing we actually ship start, and answer?
 *
 * Every other check in this repo looks at the source. `tsc` typechecks it,
 * vitest runs it through tsx, and both resolve module formats that plain
 * `node` loading an esbuild bundle does not. So the artifact that boots on Fly
 * was, until this script, the only version of this server nothing had ever
 * run - and the first thing to find out that it could not boot was the machine,
 * by failing its health check five minutes into a deploy.
 *
 * That is what `@fastify/cors` did on 2026-08-29: bundled rather than
 * externalised, its CommonJS `require` became esbuild's `__require` shim and
 * threw on the first line that ran. A green suite, a green typecheck, and a
 * crash loop in production.
 *
 * So: build, boot it exactly as the Dockerfile does, and ask it for `/health`.
 * No database is needed - the server is built to answer without one - which is
 * what keeps this cheap enough to run on every push.
 */

const PORT = '3999';
const DEADLINE_MS = 20_000;

const server = spawn('node', ['dist/main.js'], {
  // A real DATABASE_URL is not wanted here. The placeholder counts as absent,
  // so the server boots without persistence and still answers - see `env.ts`.
  env: { ...process.env, PORT, DATABASE_URL: '' },
  stdio: ['ignore', 'inherit', 'inherit'],
});

let exited: number | null = null;
server.on('exit', (code) => {
  exited = code ?? 1;
});

const stop = () => {
  if (exited === null) server.kill('SIGTERM');
};

const started = Date.now();

while (Date.now() - started < DEADLINE_MS) {
  // A process that has already died will never answer, and waiting out the
  // deadline to say so buries the stack trace it printed on the way out.
  if (exited !== null) {
    console.error(`\nsmoke: the server exited with ${exited} before answering.`);
    process.exit(1);
  }

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/health`);
    if (response.ok) {
      console.log(`\nsmoke: /health answered ${response.status} - the bundle boots.`);
      stop();
      process.exit(0);
    }
    console.error(`\nsmoke: /health answered ${response.status}.`);
    stop();
    process.exit(1);
  } catch {
    // Not listening yet. Fastify binds in milliseconds, but a cold import of
    // Prisma's client is not instant on a loaded CI runner.
    await sleep(250);
  }
}

console.error(`\nsmoke: no answer from /health within ${DEADLINE_MS}ms.`);
stop();
process.exit(1);
