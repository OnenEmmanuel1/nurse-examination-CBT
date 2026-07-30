'use strict';

process.env.PORT = '3005';
process.env.NODE_ENV = 'test';

const http = require('http');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Helper to make HTTP requests and handle response, cookies, redirect, etc.
function request(method, path, body = '', cookie = '') {
  return new Promise((resolve, reject) => {
    const postData = typeof body === 'object' ? new URLSearchParams(body).toString() : body;
    const options = {
      hostname: 'localhost',
      port: 3005,
      path: path,
      method: method,
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('=== STARTING AUTOMATED SMOKE TEST ===');
  
  // Start server
  const server = require('./app.js');
  
  // Wait for server to bind
  await new Promise(r => setTimeout(r, 1000));
  
  let cookie = '';
  
  try {
    // 1. Register student
    console.log('\n[Step 1] Registering a new student...');
    const regRes = await request('POST', '/register', {
      name: 'Smoke Test Student',
      email: 'smoke_test@student.ng',
      password: 'Student@1234',
      confirm_password: 'Student@1234'
    });
    
    console.log('Status Code:', regRes.statusCode);
    if (regRes.statusCode !== 302) {
      throw new Error(`Registration failed with status ${regRes.statusCode}`);
    }
    
    // Auto-login sets cookie
    if (regRes.headers['set-cookie']) {
      cookie = regRes.headers['set-cookie'][0].split(';')[0];
      console.log('Registration Cookie captured:', cookie);
    }
    
    // 2. Access dashboard
    console.log('\n[Step 2] Fetching student dashboard...');
    const dashRes = await request('GET', '/student/dashboard', '', cookie);
    console.log('Status Code:', dashRes.statusCode);
    if (dashRes.statusCode !== 200) {
      throw new Error(`Failed to load dashboard: ${dashRes.statusCode}`);
    }
    console.log('Dashboard content verified.');

    // 3. Start Exam
    console.log('\n[Step 3] Starting exam session for category 1 (Adult Health)...');
    const startRes = await request('POST', '/student/exam/start', { category_id: 1 }, cookie);
    console.log('Status Code:', startRes.statusCode);
    if (startRes.statusCode !== 302) {
      throw new Error(`Failed to start exam: ${startRes.statusCode}`);
    }
    if (startRes.headers['set-cookie']) {
      cookie = startRes.headers['set-cookie'][0].split(';')[0];
    }
    
    // 4. View Exam Page
    console.log('\n[Step 4] Accessing exam session page...');
    const sessionRes = await request('GET', '/student/exam/session', '', cookie);
    console.log('Status Code:', sessionRes.statusCode);
    if (sessionRes.statusCode !== 200) {
      throw new Error(`Failed to load exam session: ${sessionRes.statusCode}`);
    }
    
    // Verify is_correct flag is NOT leaked in HTML
    if (sessionRes.body.includes('is_correct')) {
      throw new Error('SECURITY VIOLATION: is_correct found in exam page HTML!');
    }
    console.log('Exam page verified: correct answers are secure (not leaked).');
    
    // 5. Submit Exam
    console.log('\n[Step 5] Submitting exam answers...');
    // We submit empty answers
    const submitRes = await request('POST', '/student/exam/submit', { answers: '{}' }, cookie);
    console.log('Status Code:', submitRes.statusCode);
    if (submitRes.statusCode !== 302) {
      throw new Error(`Submission failed with status ${submitRes.statusCode}`);
    }
    console.log('Redirect Location:', submitRes.headers.location);
    const resultId = submitRes.headers.location.split('/').pop();
    console.log('Generated Result ID:', resultId);
    
    // 6. Verify result in DB
    console.log('\n[Step 6] Verifying database persistence...');
    const db = await mysql.createConnection({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '3306', 10),
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'nursing_exam_preparation_system'
    });
    
    const [rows] = await db.execute('SELECT * FROM results WHERE id = ?', [resultId]);
    if (rows.length === 0) {
      throw new Error('Result not found in the database results table!');
    }
    console.log('Result found in DB:', rows[0]);
    
    // 7. Security check: Student accessing Admin Dashboard
    console.log('\n[Step 7] Access control check: Student accessing admin dashboard...');
    const adminDashRes = await request('GET', '/admin/dashboard', '', cookie);
    console.log('Status Code:', adminDashRes.statusCode);
    // Standard express auth middleware redirects to login on auth failure
    if (adminDashRes.statusCode !== 302) {
      throw new Error('Access control violation: Student was not redirected/rejected from admin dashboard.');
    }
    console.log('Redirected as expected (Access rejected).');

    // 8. Access control check: Student accessing Admin API route directly
    console.log('\n[Step 8] Access control check: Student accessing admin API directly...');
    const adminApiRes = await request('GET', '/api/questions', '', cookie);
    console.log('Status Code:', adminApiRes.statusCode);
    if (adminApiRes.statusCode !== 302 && adminApiRes.statusCode !== 403) {
      throw new Error('Access control violation: Student was not rejected from admin API route.');
    }
    console.log('Access rejected as expected.');
    
    // Cleanup test student data
    console.log('\nCleaning up test student records...');
    await db.execute('DELETE FROM users WHERE email = ?', ['smoke_test@student.ng']);
    console.log('Cleanup completed.');
    await db.end();
    
    console.log('\n=== SMOKE TEST: PASSED ===');
    process.exit(0);
  } catch (err) {
    console.error('\n=== SMOKE TEST: FAILED ===');
    console.error(err.message);
    process.exit(1);
  }
}

run();
