// Renders index.html to ../demo.mp4 and ../demo.gif.
//
//   node docs/demo/render.mjs
//
// Needs ffmpeg on PATH, Google Chrome installed, and playwright-core resolvable — either installed,
// or pointed at with PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const frames = join(process.env.FRAMES_DIR ?? tmpdir(), 'wifi-aware-demo-frames');
const FPS = 30;
const DURATION = 16;

rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
// 1200x675 at 1.6x is exactly 1920x1080.
const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1.6 });
await page.goto(`${pathToFileURL(join(here, 'index.html'))}?capture`);
for (let i = 0; i < FPS * DURATION; i++) {
  await page.evaluate((t) => window.renderAt(t), i / FPS);
  await page.screenshot({ path: join(frames, `f${String(i).padStart(4, '0')}.png`) });
}
await browser.close();

const input = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f%04d.png')];
execFileSync('ffmpeg', [...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
  '-movflags', '+faststart', join(here, '..', 'demo.mp4')]);
execFileSync('ffmpeg', [...input, '-vf',
  'fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];' +
  '[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', join(here, '..', 'demo.gif')]);
console.log('wrote docs/demo.mp4 and docs/demo.gif');
