#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get version from package.json
const packagePath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const currentVersion = packageJson.version;

console.log(`\n🔖 CSV Tools Frontend Version Manager`);
console.log(`Current version: ${currentVersion}`);

// Get git status
try {
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
  if (gitStatus.trim()) {
    console.log('\n⚠️  Warning: You have uncommitted changes');
    console.log('Please commit your changes before creating a new version');
    process.exit(1);
  }
} catch (error) {
  console.log('\n⚠️  Warning: Not a git repository or git not available');
}

// Get the type of version bump from command line
const versionType = process.argv[2];
if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
  console.log('\n📋 Usage:');
  console.log('  node version.js patch   # Bug fixes (1.0.0 → 1.0.1)');
  console.log('  node version.js minor   # New features (1.0.0 → 1.1.0)');
  console.log('  node version.js major   # Breaking changes (1.0.0 → 2.0.0)');
  console.log('\n💡 Examples:');
  console.log('  patch: Bug fixes, small improvements');
  console.log('  minor: New features, enhancements');
  console.log('  major: Breaking changes, major rewrites');
  process.exit(1);
}

// Calculate new version
const [major, minor, patch] = currentVersion.split('.').map(Number);
let newVersion;

switch (versionType) {
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
}

console.log(`\n🚀 Bumping version: ${currentVersion} → ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

// Update version.json if it exists
const versionJsonPath = path.join(__dirname, 'version.json');
if (fs.existsSync(versionJsonPath)) {
  const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
  versionJson.version = newVersion;
  versionJson.releaseDate = new Date().toISOString().split('T')[0];
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2) + '\n');
}

// Create git tag and commit
try {
  console.log('\n📝 Creating git commit and tag...');
  execSync('git add package.json version.json', { stdio: 'inherit' });
  execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' });
  execSync(`git tag -a v${newVersion} -m "Release version ${newVersion}"`, { stdio: 'inherit' });
  
  console.log('\n✅ Version updated successfully!');
  console.log(`\n📋 Next steps:`);
  console.log(`1. Review the changes`);
  console.log(`2. Push to GitHub: git push origin main --tags`);
  console.log(`3. Create a release on GitHub`);
  console.log(`4. Update CHANGELOG.md with release notes`);
  
} catch (error) {
  console.error('\n❌ Error creating git commit:', error.message);
  process.exit(1);
}
