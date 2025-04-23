/**
 * This script updates all the test files to use program IDs from the .env file
 * instead of hardcoded values.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Program IDs from .env
const PROGRAM_IDS = {
  hub: process.env.HUB_PROGRAM_ID,
  offer: process.env.OFFER_PROGRAM_ID,
  price: process.env.PRICE_PROGRAM_ID,
  profile: process.env.PROFILE_PROGRAM_ID,
  trade: process.env.TRADE_PROGRAM_ID
};

// Map to find program names from their IDs
const ID_TO_PROGRAM = {
  "3dF7ebo6DErpveMLxGAg6KTkTanGYLHmVXvqTWkqhpmL": "hub",
  "8V7KPa396tMUbU1HpuGGWAWMddfsuQ5K5vLMnxdAurFv": "offer",
  "HpUVnehKAfNRzC12m9EYwhwjMwbWKTbcaCwPpwVGoNrC": "price",
  "HNKH412Fsfe8vdBudCnsbmB9PwYxcxYfktfmyTWgiKbd": "profile", 
  "c4zS4D2VUbXrp48rUVWTSuFbJf9iSdd4Qn2aJSyBpXN": "trade",
  // Legacy IDs
  "FHVko2rGMf6x2Tw6WSCbJBY8wLNymfSFqjtgESmvivwG": "hub",
  "GaupCSNN86LpjFQYiLhYGBsXPwWxUW3XmRGdBLkr1tMn": "offer",
  "51GmuXVNFTveMq1UtrmzWT8q564YjBKD5Zx2zbsMaWHG": "price",
  "3FDN5CZQZrBydRA9wW2UAif4p3xmP1VQwkg97Bc8CrNq": "profile",
  "kXcoGbvG1ib18vK6YLdkbEdnc9NsqrhAS256yhreacB": "trade",
  // Full-lifecycle.test.ts IDs
  "HPX5EkkHVJxDrvqWcw9Uk6ELxH4jbjkmJYYWRJ9CcN7M": "price",
  "5J5vJxZy34aPXhHHDJNFKB8kEyDzwD3GVThuoynsuUso": "profile",
  "CMBCybcewXGrJYGxXqibdXzPcEvQc9fAZoRj7a42eBBh": "hub",
  "Fqb9ufNCYs8N1PyCtGWCiyFHWTBFiLrXLHYLcXobwq5x": "offer"
};

// Patterns for different types of program ID declarations
const PATTERNS = [
  {
    regex: /new PublicKey\(["']([A-Za-z0-9]{32,})["']\)/g,
    replace: (match, programId) => {
      const programName = ID_TO_PROGRAM[programId];
      if (programName) {
        return `PROGRAM_IDS.${programName}`;
      }
      return match; // If not a program ID, leave it unchanged
    }
  },
  {
    regex: /const (\w+)_PROGRAM_ID = new PublicKey\(["']([A-Za-z0-9]{32,})["']\)/g,
    replace: (match, name, programId) => {
      const programName = ID_TO_PROGRAM[programId];
      if (programName) {
        return `const ${name}_PROGRAM_ID = PROGRAM_IDS.${programName}`;
      }
      return match;
    }
  },
  {
    regex: /{\s*(\w+):\s*new PublicKey\(["']([A-Za-z0-9]{32,})["']\)/g,
    replace: (match, key, programId) => {
      const programName = ID_TO_PROGRAM[programId];
      if (programName && key === programName) {
        return `{ ${key}: PROGRAM_IDS.${programName}`;
      }
      return match;
    }
  },
  {
    regex: /pubkey:\s*new PublicKey\(["']([A-Za-z0-9]{32,})["']\)/g,
    replace: (match, programId) => {
      const programName = ID_TO_PROGRAM[programId];
      if (programName) {
        return `pubkey: PROGRAM_IDS.${programName}`;
      }
      return match;
    }
  }
];

// Directories to search
const TEST_DIRS = [
  './tests',
  './tests/integration'
];

// Special cases that should be skipped
const SKIP_FILES = [
  'config.ts',
  'simple-verify.ts'  // This file is specifically designed to compare IDs
];

function updateFile(filePath: string): number {
  const filename = path.basename(filePath);
  
  // Skip special files
  if (SKIP_FILES.includes(filename)) {
    console.log(`Skipping ${filePath} (special case)`);
    return 0;
  }
  
  console.log(`Processing ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let replacements = 0;
  
  // Check if file already imports from config
  const hasConfigImport = content.includes("import { PROGRAM_IDS } from ");
  
  // Add import if needed - do this first before replacing
  if (!hasConfigImport) {
    const importStatement = `import { PROGRAM_IDS } from "./config";\n`;
    const importPath = filePath.includes('/integration/') ? `import { PROGRAM_IDS } from "../config";\n` : importStatement;
    
    // Find a good place to insert the import
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfImportLine = content.indexOf('\n', lastImportIndex) + 1;
      content = content.slice(0, endOfImportLine) + importPath + content.slice(endOfImportLine);
      replacements++;
    }
  }
  
  // Apply each pattern
  for (const pattern of PATTERNS) {
    content = content.replace(pattern.regex, pattern.replace);
  }
  
  // Check if content changed after applying patterns
  if (content !== originalContent) {
    replacements++;
  }
  
  // Write the modified content back to the file
  if (replacements > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath} with ${replacements} changes`);
  } else {
    console.log(`No changes needed in ${filePath}`);
  }
  
  return replacements;
}

function processDirectory(dir: string): number {
  console.log(`Scanning directory: ${dir}`);
  let totalReplacements = 0;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Process subdirectories if needed
      totalReplacements += processDirectory(fullPath);
    } else if (file.endsWith('.ts')) {
      totalReplacements += updateFile(fullPath);
    }
  }
  
  return totalReplacements;
}

function main() {
  console.log('Starting program ID update across test files');
  console.log('Program IDs from .env:');
  console.log(PROGRAM_IDS);
  
  let totalReplacements = 0;
  
  for (const dir of TEST_DIRS) {
    totalReplacements += processDirectory(dir);
  }
  
  console.log(`Completed updates with ${totalReplacements} total replacements`);
  console.log('Next steps:');
  console.log('1. Run tests to verify everything works correctly');
  console.log('2. Manually check files in tests/integration/ for complex cases');
}

main(); 