/**
 * USVA Alumni Membership Management System
 * Core Business Logic Test Suite
 */

const crypto = require('crypto');

// 1. Sanad Layout Verification Helper (matching backend pdfService and frontend CardPreview)
function formatSanadDisplay(sand) {
  if (!sand || sand.length === 0) {
    return { display: '', hidden: true };
  }
  
  let text = '';
  if (sand.includes('umari') && sand.includes('faizy')) {
    text = 'Umari Faizy';
  } else if (sand.includes('umari')) {
    text = 'Umari';
  } else if (sand.includes('faizy')) {
    text = 'Faizy';
  }

  return { display: text.toUpperCase(), hidden: false };
}

// 2. File Upload Validation Helper
function validateUploadedPhoto(filename, mimeType, sizeInBytes) {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10 MB

  const extIndex = filename.lastIndexOf('.');
  const ext = extIndex !== -1 ? filename.slice(extIndex).toLowerCase() : '';

  if (!allowedExtensions.includes(ext)) {
    return { valid: false, message: `Extension ${ext} is not allowed.` };
  }
  if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
    return { valid: false, message: `MIME type ${mimeType} is not supported.` };
  }
  if (sizeInBytes > maxSize) {
    return { valid: false, message: `File size exceeds the 10 MB limit.` };
  }

  return { valid: true };
}

// 3. Payment Signature Verification Helper
function verifyRazorpayHash(orderId, paymentId, signature, secret) {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body.toString())
    .digest('hex');
  return expectedSignature === signature;
}

// Run Test Cases
function runTests() {
  console.log('============================================================');
  console.log('RUNNING BUSINESS LOGIC TESTS FOR USVA MEMBERSHIP SYSTEM');
  console.log('============================================================');

  let passed = 0;
  let failed = 0;

  const assert = (testName, condition) => {
    if (condition) {
      console.log(`[PASS] - ${testName}`);
      passed++;
    } else {
      console.log(`[FAIL] - ${testName}`);
      failed++;
    }
  };

  // --- SECTION A: SANAD LAYOUTS ---
  console.log('\n--- TESTING SECTION A: SANAD DISPLAY LOGIC ---');
  
  // Test 1: Both Umari + Faizy
  const t1 = formatSanadDisplay(['umari', 'faizy']);
  assert('Test 1: Umari + Faizy display output equals "UMARI FAIZY"', t1.display === 'UMARI FAIZY' && !t1.hidden);

  // Test 2: Umari Only
  const t2 = formatSanadDisplay(['umari']);
  assert('Test 2: Umari Only display output equals "UMARI"', t2.display === 'UMARI' && !t2.hidden);

  // Test 3: Faizy Only
  const t3 = formatSanadDisplay(['faizy']);
  assert('Test 3: Faizy Only display output equals "FAIZY"', t3.display === 'FAIZY' && !t3.hidden);

  // Test 4: Neither (empty array)
  const t4 = formatSanadDisplay([]);
  assert('Test 4: Empty Sanad hides line completely', t4.display === '' && t4.hidden);

  // --- SECTION B: PHOTO UPLOADS ---
  console.log('\n--- TESTING SECTION B: PHOTO VALIDATIONS ---');
  
  assert('Test 5: Valid JPG under 10MB passes', validateUploadedPhoto('my_photo.jpg', 'image/jpeg', 5 * 1024 * 1024).valid);
  assert('Test 6: Valid PNG under 10MB passes', validateUploadedPhoto('avatar.png', 'image/png', 2 * 1024 * 1024).valid);
  assert('Test 7: Valid WebP under 10MB passes', validateUploadedPhoto('face.webp', 'image/webp', 1 * 1024 * 1024).valid);
  assert('Test 8: Image over 10MB is rejected', !validateUploadedPhoto('large_pic.jpg', 'image/jpeg', 12 * 1024 * 1024).valid);
  assert('Test 9: Invalid GIF extension is rejected', !validateUploadedPhoto('anim.gif', 'image/gif', 2 * 1024 * 1024).valid);
  assert('Test 10: PDF document masquerading as image is rejected', !validateUploadedPhoto('fake.jpg', 'application/pdf', 2 * 1024 * 1024).valid);

  // --- SECTION C: PAYMENT SECURITY ---
  console.log('\n--- TESTING SECTION C: CRYPTO SIGNATURE VERIFICATION ---');
  
  const dummySecret = 'secretKey123';
  const orderId = 'order_A1B2C3D4';
  const paymentId = 'pay_Z9Y8X7W6';
  
  // Calculate a correct mock signature
  const correctSignature = crypto
    .createHmac('sha256', dummySecret)
    .update(orderId + '|' + paymentId)
    .digest('hex');

  assert('Test 11: Valid Razorpay signature passes check', verifyRazorpayHash(orderId, paymentId, correctSignature, dummySecret));
  assert('Test 12: Tempered Razorpay signature fails check', !verifyRazorpayHash(orderId, paymentId, correctSignature + 'tempered', dummySecret));
  assert('Test 13: Correct signature with incorrect order ID fails', !verifyRazorpayHash(orderId + 'mod', paymentId, correctSignature, dummySecret));

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================');
}

runTests();
