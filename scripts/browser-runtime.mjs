import { existsSync } from 'node:fs';
export function browserExecutable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  return [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(existsSync);
}
// The Windows antivirus injects an unrelated script into HTTP pages. Isolate only
// that script in this owned test context; do not change any antivirus settings.
export const isInjectedSecurityURL = (url) => new URL(url).hostname.endsWith('.kaspersky-labs.com');
export async function isolateTestContext(context) {
  await context.route(/https?:\/\/[^/]*\.kaspersky-labs\.com\//, (route) => route.abort());
}
