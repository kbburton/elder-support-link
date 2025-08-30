// Simple test runner to validate the fix
import { spawn } from 'child_process';

console.log('Running document processing error detection test...');

const testProcess = spawn('npm', ['test', 'tests/document-processing-error-detection.test.ts'], {
  stdio: 'inherit'
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Tests passed - Error fixes working correctly');
  } else {
    console.log('❌ Tests failed - Issues with the fixes');
  }
  process.exit(code);
});