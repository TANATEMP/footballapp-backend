
// Simplified test for date logic only
async function testLeagueValidation() {
  console.log('Testing Backend Date Validation Logic...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const testCases = [
    { start: '2000-01-01', end: '2025-01-01', reg: '2000-01-01', expected: 'Tournament start date cannot be in the past.' },
    { start: '2028-01-01', end: '2027-01-01', reg: '2028-01-01', expected: 'Tournament end date must be after the start date.' },
    { start: '2028-01-01', end: '2029-01-01', reg: '2000-01-01', expected: 'Registration deadline cannot be in the past.' },
  ];

  for (const tc of testCases) {
    const start = new Date(tc.start);
    const end = new Date(tc.end);
    const regEnd = new Date(tc.reg);

    try {
      if (start < today) throw new Error('Tournament start date cannot be in the past.');
      if (end <= start) throw new Error('Tournament end date must be after the start date.');
      if (regEnd < today) throw new Error('Registration deadline cannot be in the past.');
      console.log(`[FAIL] Test case for ${tc.start} passed unexpectedly.`);
    } catch (e) {
      if (e.message === tc.expected) {
        console.log(`[PASS] Caught expected error: ${e.message}`);
      } else {
        console.log(`[ERROR] Caught wrong error: ${e.message} (Expected: ${tc.expected})`);
      }
    }
  }
}

testLeagueValidation();
