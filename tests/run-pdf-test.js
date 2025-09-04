import { execSync } from 'child_process';

try {
  console.log('Running PDF text extraction tests...');
  const result = execSync('npm test tests/pdf-ocr-fix.test.ts', { 
    encoding: 'utf8',
    stdio: 'pipe' 
  });
  console.log('Test Results:');
  console.log(result);
} catch (error) {
  console.error('Test failed with error:', error.message);
  console.log('Test output:', error.stdout);
  console.log('Test errors:', error.stderr);
  process.exit(1);
}