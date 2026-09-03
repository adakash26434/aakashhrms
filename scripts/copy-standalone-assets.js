const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');

if (fs.existsSync(standaloneDir)) {
  const staticSrc = path.join(rootDir, '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
    console.log('✓ Copied .next/static into .next/standalone/.next/static');
  }

  const publicSrc = path.join(rootDir, 'public');
  const publicDest = path.join(standaloneDir, 'public');
  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
    console.log('✓ Copied public/ into .next/standalone/public');
  }

  const migrationsSrc = path.join(rootDir, 'lib', 'db', 'migrations');
  const migrationsDest = path.join(standaloneDir, 'lib', 'db', 'migrations');
  if (fs.existsSync(migrationsSrc)) {
    fs.mkdirSync(path.dirname(migrationsDest), { recursive: true });
    fs.cpSync(migrationsSrc, migrationsDest, { recursive: true, force: true });
    console.log('✓ Copied lib/db/migrations into .next/standalone/lib/db/migrations');
  }
}
