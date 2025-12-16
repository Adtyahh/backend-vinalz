const fs = require('fs');
const path = require('path');

// Initialize upload directories
const initializeUploadDirectories = () => {
  const directories = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../uploads/signatures'),
    path.join(__dirname, '../uploads/documents'),
    path.join(__dirname, '../uploads/photos'),
    path.join(__dirname, '../uploads/temp')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    } else {
      console.log(`📁 Directory already exists: ${dir}`);
    }
  });

  // Create .gitkeep files to track empty directories
  directories.forEach(dir => {
    const gitkeepPath = path.join(dir, '.gitkeep');
    if (!fs.existsSync(gitkeepPath)) {
      fs.writeFileSync(gitkeepPath, '');
      console.log(`📝 Created .gitkeep in: ${dir}`);
    }
  });

  console.log('\n✅ Upload directories initialized successfully!\n');
};

// Run initialization
initializeUploadDirectories();

module.exports = initializeUploadDirectories;