// Prove The Deep: every segment of every room, at the given tiers, by the bot, two at a time.
// usage: node tools/deepcheck.js [tiers=0,4] [rooms filter regex] -> build/deep/check.json (and a summary)
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const D = require('../src/sim.js');
const dir = path.join(__dirname, '../build/deep');
const tiers = (process.argv[2] || '0,4').split(',').map(Number);
const filt = new RegExp(process.argv[3] || '.');
const JOBS = +(process.env.JOBS || 2), T = +(process.env.SEGT || 420);
const out = path.join(dir, 'check.json');
const res = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
const jobs = [];
for (const f of fs.readdirSync(dir).filter(f => /^[a-z]+\d\.json$/.test(f) && filt.test(f)).sort()) {
  const L = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const n = D.makeWorld(L).checks.length;           // segments: tether k -> k+1, and the last one to the goal
  for (const t of tiers) for (let k = 0; k < n; k++) {
    const key = `${f.replace('.json', '')}@${t}#${k}`;
    if (res[key] && res[key].ok && !process.env.FORCE) continue;
    jobs.push({ f, t, k, key });
  }
}
console.log('segments to prove', jobs.length);
let run = 0, done = 0;
function next() {
  if (!jobs.length) { if (!run) finish(); return; }
  const j = jobs.shift(); run++;
  const p = spawn('timeout', [String(T), 'node', path.join(__dirname, 'bot.js'), j.f, '/dev/null', String(j.k)], { cwd: dir, env: Object.assign({}, process.env, { DEEPTIER: String(j.t), BOTMAX: process.env.BOTMAX || '400000' }) });
  let txt = ''; p.stdout.on('data', d => txt += d); p.stderr.on('data', d => txt += d);
  const t0 = Date.now();
  p.on('close', (code) => {
    run--; done++;
    const line = (txt.split('\n').find(l => l.startsWith('segment')) || ('exit ' + code)).trim();
    res[j.key] = { ok: /: ok /.test(line), line, s: Math.round((Date.now() - t0) / 1000) };
    fs.writeFileSync(out, JSON.stringify(res, null, 1));
    console.log(`${done} ${j.key} ${res[j.key].ok ? 'ok ' : 'FAIL'} ${res[j.key].s}s  ${line}`);
    next();
  });
}
function finish() {
  const bad = Object.entries(res).filter(([k, v]) => !v.ok && filt.test(k));
  console.log('done.', bad.length ? 'FAILED: ' + bad.map(b => b[0]).join(' ') : 'all proven');
}
for (let i = 0; i < JOBS; i++) next();
