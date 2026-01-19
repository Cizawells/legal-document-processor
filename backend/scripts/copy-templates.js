const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'email', 'templates');
const destDir = path.join(__dirname, '..', 'dist', 'email', 'templates');

console.log('📧 Copying email templates...');
console.log(`Source: ${srcDir}`);
console.log(`Destination: ${destDir}`);

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  console.log('✅ Created destination directory');
}

// Copy all template files
try {
  const files = fs.readdirSync(srcDir);

  files.forEach((file) => {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);

    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, destFile);
      console.log(`✅ Copied: ${file}`);
    }
  });

  console.log(`🎉 Successfully copied ${files.length} template files!`);
} catch (error) {
  console.error('❌ Error copying templates:', error);
  process.exit(1);
}
