const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const version = pkg.version;

// tauri.conf.json
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
let tauriChanged = false;

if (tauriConf.version !== version) {
  tauriConf.version = version;
  tauriChanged = true;
}

const expectedTitle = `Drum Studio v${version}`;
if (tauriConf.app?.windows?.[0] && tauriConf.app.windows[0].title !== expectedTitle) {
  tauriConf.app.windows[0].title = expectedTitle;
  tauriChanged = true;
}

if (tauriChanged) {
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`[sync-tauri-version] tauri.conf.json → v${version}`);
}

// Cargo.toml — [package] 섹션의 첫 version 라인만 교체
const cargoPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
const cargoOrig = fs.readFileSync(cargoPath, 'utf-8');
const cargoNew = cargoOrig.replace(/^version = ".*"$/m, `version = "${version}"`);

if (cargoNew !== cargoOrig) {
  fs.writeFileSync(cargoPath, cargoNew);
  console.log(`[sync-tauri-version] Cargo.toml → v${version}`);
}

if (!tauriChanged && cargoNew === cargoOrig) {
  console.log(`[sync-tauri-version] already in sync (v${version})`);
}
