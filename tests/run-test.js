// Simple test runner to validate the fix
import { spawn } from 'child_process';

console.log('Running document processing vision API fix test...');

const testProcess = spawn('npm', ['test', 'tests/document-processing-vision-api-fix.test.ts'], {
  stdio: 'inherit'
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Tests passed - Vision API fix working correctly');
  } else {
    console.log('❌ Tests failed - Issues with the fix');
  }
  process.exit(code);
});