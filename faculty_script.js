// filter-xml-sax.js - Faster but more complex
const fs = require('fs');
const sax = require('sax');

const TARGET_FAC_ID = '50000172';
const inputFile = '/Enrollment_data.xml';
const outputFile = '/filtered_Enrollment_data.xml';

if (!inputFile || !fs.existsSync(inputFile)) {
  console.error('Usage: node faculty_script.js');
  process.exit(1);
}

const saxStream = sax.createStream(true, { 
  xmlns: true,
  trim: false,
  normalize: false
});

const writeStream = fs.createWriteStream(outputFile);

let inEntry = false;
let entryBuffer = [];
let entryDepth = 0;
let keepEntry = false;
let inFacIdElement = false;
let facIdText = '';

let stats = { total: 0, kept: 0 };
let headerWritten = false;
let rootTag = null;

// Helper to reconstruct tag with attributes
function reconstructTag(node) {
  let str = `<${node.name}`;
  for (const [key, val] of Object.entries(node.attributes)) {
    str += ` ${key}="${val.value}"`;
  }
  if (node.isSelfClosing) {
    str += '/>';
  } else {
    str += '>';
  }
  return str;
}

saxStream.on('opentag', (node) => {
  const name = node.local || node.name; // Handle namespaced tags
  
  if (name === 'entry') {
    inEntry = true;
    entryDepth = 1;
    entryBuffer = [reconstructTag(node)];
    keepEntry = false;
  } else if (inEntry) {
    entryDepth++;
    entryBuffer.push(reconstructTag(node));
    
    // Check if this is d:FacId element
    if (name === 'FacId' || node.name === 'd:FacId' || name === 'd:FacId') {
      inFacIdElement = true;
      facIdText = '';
    }
  } else {
    // Before first entry - write header directly
    if (!headerWritten) {
      if (!rootTag && name !== '?xml' && !name.includes(':')) {
        rootTag = node.name;
      }
      writeStream.write(reconstructTag(node));
    }
  }
});

saxStream.on('text', (text) => {
  if (inEntry) {
    entryBuffer.push(text);
    if (inFacIdElement) {
      facIdText += text;
    }
  } else if (!headerWritten) {
    writeStream.write(text);
  }
});

saxStream.on('closetag', (nodeName) => {
  const name = (typeof nodeName === 'string' ? nodeName : nodeName.local) || nodeName;
  
  if (name === 'entry' && inEntry) {
    entryDepth--;
    
    if (entryDepth === 0) {
      // Entry complete
      entryBuffer.push(`</${nodeName}>`);
      stats.total++;
      
      if (keepEntry) {
        writeStream.write(entryBuffer.join('') + '\n');
        stats.kept++;
      }
      
      if (stats.total % 5000 === 0) {
        console.log(`Processed: ${stats.total.toLocaleString()}, Kept: ${stats.kept.toLocaleString()}`);
      }
      
      inEntry = false;
      entryBuffer = [];
    } else {
      entryBuffer.push(`</${nodeName}>`);
    }
  } else if (inEntry) {
    entryDepth--;
    entryBuffer.push(`</${nodeName}>`);
    
    // Check if we just closed a FacId element
    if ((name === 'FacId' || name === 'd:FacId') && inFacIdElement) {
      inFacIdElement = false;
      if (facIdText.trim() === TARGET_FAC_ID) {
        keepEntry = true;
      }
    }
  } else {
    // Outside entry
    if (!headerWritten) {
      writeStream.write(`</${nodeName}>`);
      if (name === (rootTag || 'feed')) {
        headerWritten = true;
      }
    }
  }
});

saxStream.on('attribute', (attr) => {
  // SAX sometimes fires this separately
});

saxStream.on('error', (err) => {
  console.error('SAX Error:', err);
  process.exit(1);
});

console.log('🔍 Starting SAX parser...');
console.log(`🎯 Target: <d:FacId>${TARGET_FAC_ID}</d:FacId>`);

fs.createReadStream(inputFile).pipe(saxStream);

saxStream.on('end', () => {
  writeStream.end();
  console.log(`\n✅ Complete!`);
  console.log(`📊 Total entries: ${stats.total.toLocaleString()}`);
  console.log(`📊 Kept: ${stats.kept.toLocaleString()} (${stats.total > 0 ? ((stats.kept/stats.total)*100).toFixed(2) : 0}%)`);
});