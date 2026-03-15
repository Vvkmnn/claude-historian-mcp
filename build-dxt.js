#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const buildDir = 'claude-historian-mcp-dxt';
const dxtFile = 'claude-historian-mcp.dxt';

console.log('🏗️  Building Claude Historian DXT package...');

// Clean previous build
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true });
}
if (fs.existsSync(dxtFile)) {
  fs.unlinkSync(dxtFile);
}

// Create build directory
fs.mkdirSync(buildDir);

// Copy essential files
const filesToCopy = ['manifest.json', 'package.json', 'README.md', 'LICENSE'];

filesToCopy.forEach((file) => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(buildDir, file));
    console.log(`✅ Copied ${file}`);
  }
});

// Copy dist directory
execSync(`cp -r dist ${buildDir}/`, { stdio: 'inherit' });
console.log('✅ Copied dist/');

// Install production dependencies in build directory
console.log('📦 Installing dependencies...');
process.chdir(buildDir);

// Create a production package.json
const originalPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const productionPackage = {
  ...originalPackage,
  devDependencies: undefined,
  scripts: {
    start: 'node dist/index.js',
  },
};
fs.writeFileSync('package.json', JSON.stringify(productionPackage, null, 2));

// Install production dependencies
execSync('npm install --production --no-optional', { stdio: 'inherit' });

// Go back to root
process.chdir('..');

// Create DXT archive (tar.gz with .dxt extension)
console.log('📦 Creating DXT archive...');
execSync(`tar -czf ${dxtFile} -C ${buildDir} .`, { stdio: 'inherit' });

// Cleanup
fs.rmSync(buildDir, { recursive: true });

console.log(`🎉 DXT package created: ${dxtFile}`);
console.log(`📏 Size: ${(fs.statSync(dxtFile).size / 1024 / 1024).toFixed(1)} MB`);
console.log('');
console.log('🚀 To install in Claude Desktop:');
console.log(`   1. Double-click ${dxtFile}`);
console.log('   2. Claude Desktop will prompt to install');
console.log('   3. Restart Claude Desktop');
console.log('   4. Test with conversation search!');
