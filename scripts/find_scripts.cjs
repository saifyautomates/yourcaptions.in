const fs = require('fs');
const content = fs.readFileSync('C:/Users/jackx/.gemini/antigravity-ide/brain/e87b9af5-ba59-4f56-a809-f9a23825772d/.system_generated/steps/1099/content.md', 'utf8');

const scripts = content.match(/<script[\s\S]*?<\/script>/g) || [];
console.log('Total scripts found:', scripts.length);
scripts.forEach((s, idx) => {
  if (s.includes('Property reels') || s.includes('captik_glow') || s.includes('templates')) {
    console.log(`Script ${idx} has relevant data, length:`, s.length);
    fs.writeFileSync(`scripts/script_${idx}.txt`, s.slice(0, 5000), 'utf8');
  }
});
