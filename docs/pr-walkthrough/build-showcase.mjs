#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const archifyBin = process.env.ARCHIFY_BIN;
if (!archifyBin || !fs.existsSync(archifyBin)) {
  console.error('Set ARCHIFY_BIN to .../archify/bin/archify.mjs before running build-showcase.mjs');
  process.exit(2);
}

const withVideo = process.argv.includes('--with-video');
const engineHead = spawnSync('git', ['-C', path.resolve(path.dirname(archifyBin), '..', '..'), 'rev-parse', 'HEAD'], { encoding: 'utf8' });
const engineRevision = engineHead.status === 0 ? engineHead.stdout.trim() : null;
const specsDir = root;
const imagesDir = path.join(root, 'images');
const stillsDir = path.join(root, 'stills');
const stagesDir = path.join(root, 'stages');
const videosDir = path.join(root, 'videos');

for (const dir of [imagesDir, stillsDir, stagesDir, videosDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

function runArchify(args) {
  const res = spawnSync(process.execPath, [archifyBin, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ARCHIFY_UPDATE_CHECK_DISABLED: '1' },
  });
  if (res.status !== 0) {
    console.error(res.stdout);
    console.error(res.stderr);
    throw new Error(`archify ${args.join(' ')} failed (${res.status})`);
  }
  return res.stdout ? JSON.parse(res.stdout) : null;
}

const existingManifestPath = path.join(root, 'showcase-manifest.json');
const existingManifest = fs.existsSync(existingManifestPath) ? JSON.parse(fs.readFileSync(existingManifestPath, 'utf8')) : {};
const existingById = new Map(
  (existingManifest.cases || [])
    .map((entry) => [entry.id, entry]),
);

const specs = fs.readdirSync(specsDir).filter((name) => name.endsWith('.choreography.json')).sort();
const summary = [];

for (const file of specs) {
  const id = file.replace(/\.choreography\.json$/, '');
  const specPath = path.join(specsDir, file);
  const svg = runArchify(['story', 'svg', specPath, path.join(imagesDir, id), '--theme', 'both', '--still', '--repo-root', root, '--json']);
  for (const stale of fs.readdirSync(stillsDir)) {
    if (stale.startsWith(`${id}-still-`) && stale.endsWith('.svg')) {
      fs.rmSync(path.join(stillsDir, stale), { force: true });
    }
  }
  for (const still of svg.stills || []) {
    const dest = path.join(stillsDir, path.basename(still.path));
    fs.renameSync(still.path, dest);
    still.path = dest;
  }
  const stage = runArchify(['story', 'stage', specPath, path.join(stagesDir, `${id}.stage.html`), '--theme', 'dark', '--repo-root', root, '--json']);
  let video = null;
  if (withVideo) {
    const builtVideo = runArchify(['story', 'video', specPath, path.join(videosDir, `${id}.mp4`), '--fps', '30', '--theme', 'light', '--repo-root', root, '--json']);
    video = { path: path.relative(root, builtVideo.output).replace(/\\/g, '/'), bytes: builtVideo.bytes, engineRevision };
  } else {
    const mp4Path = path.join(videosDir, `${id}.mp4`);
    if (fs.existsSync(mp4Path)) {
      video = { path: path.relative(root, mp4Path).replace(/\\/g, '/'), bytes: fs.statSync(mp4Path).size, engineRevision: existingById.get(id)?.video?.engineRevision || existingManifest.engineRevision || null };
    } else if (existingById.get(id)?.video) {
      video = existingById.get(id).video;
    }
  }
  summary.push({
    id,
    duration: svg.duration,
    steps: svg.steps,
    outputs: svg.outputs.map((o) => path.relative(root, o.path).replace(/\\/g, '/')),
    stills: (svg.stills || []).map((s) => path.relative(root, s.path).replace(/\\/g, '/')),
    stage: path.relative(root, stage.output).replace(/\\/g, '/'),
    ...(video ? { video } : {}),
  });
  console.log(`[ok] ${id}: ${svg.steps} steps (${svg.duration}s) -> ${svg.outputs.length} SVGs, ${svg.stills.length} stills, stage HTML${video ? `, MP4 (${(video.bytes / 1048576).toFixed(2)} MB)` : ''}`);
}

fs.writeFileSync(existingManifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), engineRevision, cases: summary }, null, 2)}\n`);
