import { calculatorTool } from '../src/tools/calculator.js';
import { datetimeTool } from '../src/tools/datetime.js';
import { rulesClassifier } from '../src/orchestrator/rulesClassifier.js';
import { verificationEngine } from '../src/verification/verificationEngine.js';
import { circuitBreaker } from '../src/models/circuitBreaker.js';
import { permissionEngine } from '../src/permissions/permissionEngine.js';
import { isPrivateOrRestrictedIp } from '../src/tools/webSearch.js';
import { githubReadTool } from '../src/tools/githubRead.js';

let passed = 0;
let failed = 0;

function assert(condition: any, testName: string) {
  if (Boolean(condition)) {
    console.log(`  ✓ PASS: ${testName}`);
    passed += 1;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed += 1;
  }
}

async function runTests() {
  console.log('\n==========================================');
  console.log('JEXA BACKEND TEST SUITE - PRODUCTION READY');
  console.log('==========================================\n');

  // 1. Test Local Calculator Tool (0 Tokens)
  console.log('1. Testing Local Calculator (0 Tokens):');
  const calc1 = await calculatorTool.run('45 * 12');
  assert(calc1.success && calc1.output.includes('540'), '45 * 12 equals 540');

  const calc2 = await calculatorTool.run('sqrt(144) + 8');
  assert(calc2.success && calc2.output.includes('20'), 'sqrt(144) + 8 equals 20');

  const calcInvalid = await calculatorTool.run('process.exit()');
  assert(!calcInvalid.success, 'Rejects dangerous code injection');

  // 2. Test Local Datetime Tool (0 Tokens)
  console.log('\n2. Testing Local Datetime Tool (0 Tokens):');
  const timeRes = await datetimeTool.run('');
  assert(timeRes.success && timeRes.output.includes('Current date and time'), 'Returns real ISO/formatted datetime');

  // 3. Test Rules Classifier (Zero-Token Rules Pre-Check)
  console.log('\n3. Testing Rules Classifier:');
  const ruleMath = await rulesClassifier.evaluate('what is 100 / 4');
  assert(ruleMath.handledLocally && ruleMath.reply?.includes('25'), 'Math directive handled locally with 0 tokens');

  const ruleTime = await rulesClassifier.evaluate('what time is it');
  assert(ruleTime.handledLocally && ruleTime.intent === 'datetime', 'Time query handled locally with 0 tokens');

  const ruleSearch = await rulesClassifier.evaluate('search for latest quantum computing news');
  assert(!ruleSearch.handledLocally && ruleSearch.toolNamesToProvide.includes('web_search'), 'Web search query pruned to web_search tool');

  // 4. Test Verification Engine
  console.log('\n4. Testing Verification Engine:');
  const validCheck = verificationEngine.verify('web_search', { success: true, output: 'Found facts on quantum computing.' });
  assert(validCheck.valid, 'Accepts non-empty sensible output');

  const emptyCheck = verificationEngine.verify('web_search', { success: true, output: '   ' });
  assert(!emptyCheck.valid, 'Rejects empty tool output');

  const htmlErrCheck = verificationEngine.verify('web_search', { success: true, output: '<html><title>502 Bad Gateway</title></html>' });
  assert(!htmlErrCheck.valid, 'Detects and flags raw HTML error pages');

  // 5. Test Circuit Breaker & Fallback Chain
  console.log('\n5. Testing Circuit Breaker & Fallback Chain:');
  circuitBreaker.init('MockProvider', 10);
  assert(circuitBreaker.canExecute('MockProvider').allowed, 'Circuit allows requests initially');

  circuitBreaker.recordFailure('MockProvider', 'Connection timeout');
  assert(!circuitBreaker.canExecute('MockProvider').allowed, 'Circuit pauses provider on failure with exponential backoff');

  circuitBreaker.recordSuccess('MockProvider');
  assert(circuitBreaker.canExecute('MockProvider').allowed, 'Circuit resets on success');

  // 6. Test Daily Request Cap
  console.log('\n6. Testing Daily Request Cap:');
  circuitBreaker.setDailyCap('CapProvider', 2);
  circuitBreaker.recordSuccess('CapProvider');
  circuitBreaker.recordSuccess('CapProvider');
  const capCheck = circuitBreaker.canExecute('CapProvider');
  assert(!capCheck.allowed && capCheck.reason?.includes('Daily request cap'), 'Enforces daily request cap strictly');

  // 7. Test SSRF Blocker on Private and Metadata IP Ranges
  console.log('\n7. Testing SSRF Protection:');
  assert(isPrivateOrRestrictedIp('127.0.0.1'), 'Blocks 127.0.0.1 loopback');
  assert(isPrivateOrRestrictedIp('10.0.0.1'), 'Blocks 10.0.0.0/8 private range');
  assert(isPrivateOrRestrictedIp('172.16.0.1'), 'Blocks 172.16.0.0/12 private range');
  assert(isPrivateOrRestrictedIp('192.168.1.1'), 'Blocks 192.168.0.0/16 private range');
  assert(isPrivateOrRestrictedIp('169.254.169.254'), 'Blocks AWS/GCP cloud metadata IP (169.254.169.254)');
  assert(isPrivateOrRestrictedIp('::1'), 'Blocks IPv6 loopback ::1');
  assert(!isPrivateOrRestrictedIp('8.8.8.8'), 'Allows public IP 8.8.8.8');
  assert(!isPrivateOrRestrictedIp('1.1.1.1'), 'Allows public IP 1.1.1.1');

  // 8. Test GitHub Tool Regex and Directory Traversal Protection
  console.log('\n8. Testing GitHub Read Security:');
  const traversalCheck = await githubReadTool.run({ repo: 'owner/repo', path: '../secret.env', action: 'file' });
  assert(!traversalCheck.success && traversalCheck.error?.includes('traversal'), 'Blocks path traversal with ".."');

  const invalidRepoCheck = await githubReadTool.run({ repo: 'invalid;rm -rf /', action: 'info' });
  assert(!invalidRepoCheck.success, 'Rejects invalid repo names not matching owner/repo');

  // 9. Test Sensitive Action Confirmation Engine (/confirm/:id)
  console.log('\n9. Testing Permission Engine & /confirm/:id:');
  const unknownConfirm = permissionEngine.confirm('non_existent_id', true);
  assert(!unknownConfirm.success, 'Returns 404/failure for unknown confirm action ID');

  const requested = permissionEngine.registerPending(
    'system_action',
    'Delete Resource',
    'Delete user resource',
    { resourceId: '123' }
  );
  assert(requested.id && requested.status === 'pending', 'Registers pending action needing approval');

  const approved = permissionEngine.confirm(requested.id, true);
  assert(approved.success && approved.action?.status === 'approved', 'Successfully confirms pending action');

  console.log('\n==========================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('==========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Test runner encountered error:', e);
  process.exit(1);
});
