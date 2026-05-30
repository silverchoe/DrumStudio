const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));

const version = pkg.version;
let changed = false;

if (tauriConf.version !== version) {
  tauriConf.version = version;
  changed = true;
}

const expectedTitle = `Drum Studio v${version}`;
if (tauriConf.app?.windows?.[0] && tauriConf.app.windows[0].title !== expectedTitle) {
  tauriConf.app.windows[0].title = expectedTitle;
  changed = true;
}

if (changed) {
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`[sync-tauri-version] tauri.conf.json → v${version}`);
} else {
  console.log(`[sync-tauri-version] already in sync (v${version})`);
}
