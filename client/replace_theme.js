const fs = require('fs');
const path = require('path');
const d = 'c:/Users/KIIT0001/OneDrive/Desktop/mini project/client/src';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else if (f.endsWith('.css') || f.endsWith('.jsx')) {
      callback(path.join(dir, f));
    }
  });
}

walkDir(d, function(p) {
  let c = fs.readFileSync(p, 'utf8');
  let r = c;
  
  // Replace RGBs
  r = r.replace(/139, 92, 246/g, '16, 185, 129') // emerald 500
       .replace(/124, 58, 237/g, '5, 150, 105') // emerald 600
       .replace(/167, 139, 250/g, '52, 211, 153') // emerald 400
       .replace(/196, 181, 253/g, '110, 231, 183') // emerald 300
       .replace(/59, 130, 246/g, '34, 197, 94') // green 500
       .replace(/56, 189, 248/g, '52, 211, 153') // emerald 400
       .replace(/38bdf8/g, '34d399')
       .replace(/99, 102, 241/g, '16, 185, 129') // emerald 500
       .replace(/236, 72, 153/g, '16, 185, 129') // emerald 500 replacing pink
       .replace(/244, 63, 94/g, '5, 150, 105'); // emerald 600 replacing rose

  // Replace Hexes (exact strings or specific variables)
  r = r.replace(/#7c3aed/g, '#059669')
       .replace(/#3b82f6/g, '#10b981')
       .replace(/#c4b5fd/g, '#6ee7b7')
       .replace(/#a78bfa/g, '#34d399')
       .replace(/#38bdf8/g, '#34d399')
       .replace(/#8b5cf6/g, '#10b981')
       .replace(/#ec4899/g, '#10b981')
       .replace(/#f43f5e/g, '#059669')
       .replace(/#f9a8d4/g, '#6ee7b7'); // pink-300 to emerald-300

  // Replace Tailwind specific color classes
  const colors = ['violet', 'blue', 'sky', 'indigo', 'fuchsia', 'pink', 'cyan'];
  colors.forEach(color => {
    r = r.replace(new RegExp(`text-${color}-`, 'g'), 'text-emerald-');
    r = r.replace(new RegExp(`bg-${color}-`, 'g'), 'bg-emerald-');
    r = r.replace(new RegExp(`border-${color}-`, 'g'), 'border-emerald-');
    r = r.replace(new RegExp(`from-${color}-`, 'g'), 'from-emerald-');
    r = r.replace(new RegExp(`to-${color}-`, 'g'), 'to-emerald-');
    r = r.replace(new RegExp(`via-${color}-`, 'g'), 'via-emerald-');
    r = r.replace(new RegExp(`shadow-${color}-`, 'g'), 'shadow-emerald-');
    r = r.replace(new RegExp(`ring-${color}-`, 'g'), 'ring-emerald-');
  });
  
  // Specific replacements for layouts
  r = r.replace(/#1d4ed8/g, '#059669'); // blue-700
  
  if (c !== r) {
    fs.writeFileSync(p, r);
    console.log("Updated", p);
  }
});
console.log('Script execution finished');
