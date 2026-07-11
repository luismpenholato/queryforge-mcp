import { execFileSync, execSync } from 'node:child_process';

function quoteArg(arg) {
  if (/[\s"]/g.test(arg)) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }

  return arg;
}

export function runNpm(args, options = {}) {
  const stdio = options.stdio ?? ['ignore', 'pipe', 'pipe'];

  if (process.platform === 'win32') {
    const command = `npm ${args.map(quoteArg).join(' ')}`;
    return execSync(command, {
      encoding: 'utf8',
      cwd: options.cwd,
      stdio
    });
  }

  return execFileSync('npm', args, {
    encoding: 'utf8',
    cwd: options.cwd,
    stdio,
    ...options
  });
}
