import { pathToFileURL } from 'url';
import { runCli } from './cli/run-cli.js';

export { runCli } from './cli/run-cli.js';

const entryFileUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (entryFileUrl === import.meta.url) {
  void runCli();
}
