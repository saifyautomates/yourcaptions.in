const fs = require('fs');

const content = fs.readFileSync('C:/Users/jackx/.gemini/antigravity-ide/brain/e87b9af5-ba59-4f56-a809-f9a23825772d/.system_generated/steps/1099/content.md', 'utf8');

const templateRegex = /<video[^>]*src="([^"]+)"[^>]*poster="([^"]+)"[^>]*aria-label="([^"]+) caption template preview"[^>]*>([\s\S]*?)<p[^>]*class="[^"]*truncate[^"]*"[^>]*>([^<]+)<\/p>/g;

const templates = [];
let match;
while ((match = templateRegex.exec(content)) !== null) {
  const cardHtml = match[4];
  const isBehindYou = cardHtml.includes('Behind you');
  const isNew = cardHtml.includes('New');
  
  templates.push({
    id: match[1].replace('/previews/t/', '').replace('.mp4', ''),
    name: match[5].trim(),
    video: match[1],
    poster: match[2],
    isBehindYou,
    isNew,
  });
}

console.log('Total extracted:', templates.length);
fs.writeFileSync('scripts/captik_extracted.json', JSON.stringify(templates, null, 2), 'utf8');
