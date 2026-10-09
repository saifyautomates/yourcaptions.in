const fs = require('fs');
const content = fs.readFileSync('C:/Users/jackx/.gemini/antigravity-ide/brain/e87b9af5-ba59-4f56-a809-f9a23825772d/.system_generated/steps/1099/content.md', 'utf8');

const rscChunks = [];
const rscRegex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
let match;
while ((match = rscRegex.exec(content)) !== null) {
  try {
    const unescaped = JSON.parse(`"${match[1]}"`);
    rscChunks.push(unescaped);
  } catch (e) {
    rscChunks.push(match[1]);
  }
}

const fullRsc = rscChunks.join('');
fs.writeFileSync('scripts/rsc_data.txt', fullRsc, 'utf8');
console.log('Total RSC extracted bytes:', fullRsc.length);

// Search for templates or template objects
const templateMatches = [...fullRsc.matchAll(/\{[^{}]*"name":\s*"([^"]+)"[^{}]*\}/g)];
console.log('Template objects found:', templateMatches.length);
