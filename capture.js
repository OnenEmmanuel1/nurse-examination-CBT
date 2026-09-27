const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity-ide\\brain\\aaf4d711-b430-49ca-bb85-f719cf4d3a22\\screenshots';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time);
    });
}

async function takeScreenshot(page, filename, fullPage = true) {
    await page.screenshot({ path: path.join(outDir, filename), fullPage });
    console.log(`Saved ${filename}`);
}

(async () => {
    const browser = await puppeteer.launch({ 
        headless: 'new', 
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox'] 
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    try {
        // 1. login page
        await page.goto('http://localhost:3000/login');
        await delay(1000);
        await takeScreenshot(page, '01-login-page.png');

        // 2. registration page
        await page.goto('http://localhost:3000/register');
        await delay(1000);
        await takeScreenshot(page, '02-registration-page.png');

        // Admin login
        await page.goto('http://localhost:3000/login');
        await page.type('input[name="email"]', 'admin@nurseexamprep.ng');
        await page.type('input[name="password"]', 'password123');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        // 6. admin dashboard
        await page.goto('http://localhost:3000/admin/dashboard');
        await delay(1000);
        await takeScreenshot(page, '06-admin-dashboard.png');

        // 5. Admin Question Bank Entry Screen
        await page.goto('http://localhost:3000/admin/questions/new');
        await delay(1000);
        await takeScreenshot(page, '05-admin-question-bank-entry.png');

        // Logout admin
        await page.goto('http://localhost:3000/logout');

        // Student login
        await page.goto('http://localhost:3000/login');
        await page.type('input[name="email"]', 'amaka@student.ng');
        await page.type('input[name="password"]', 'password123');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        // 3. Category Selection and Exam Setup Screen
        await page.goto('http://localhost:3000/student/dashboard');
        await delay(1000);
        await takeScreenshot(page, '03-category-selection-exam-setup.png');

        // Start exam
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.evaluate(() => {
                const form = document.querySelector('form[action="/student/exam/start"]');
                if (form) form.submit();
            })
        ]);

        // 4. Examination Interface (Main Data Entry Screen)
        await delay(1000);
        await takeScreenshot(page, '04-examination-interface.png');

        // 9. Submission Confirmation Dialog
        const submitBtn = await page.$('#nep-submit-btn');
        if (submitBtn) {
            await submitBtn.click();
            await delay(1000);
            await takeScreenshot(page, '09-submission-confirmation-dialog.png', false);
            const cancelBtn = await page.$('#nep-modal-cancel');
            if (cancelBtn) {
                await cancelBtn.click();
                await delay(500);
            }
        }

        // 10. time expire alert
        await page.evaluate(() => {
            const timerEl = document.getElementById('nep-timer-display');
            if (timerEl) {
                timerEl.classList.remove('warning');
                timerEl.classList.add('critical');
                timerEl.textContent = '00:10';
            }
        });
        await delay(500);
        await takeScreenshot(page, '10-time-expire-alert.png');

        // Submit the exam to get to results
        if (submitBtn) {
            await submitBtn.click();
            await delay(500);
            const confirmBtn = await page.$('#nep-modal-confirm');
            if (confirmBtn) {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle0' }),
                    confirmBtn.click()
                ]);
            }
        }

        // 7. Results and Feedback Screen
        await delay(1000);
        await takeScreenshot(page, '07-results-and-feedback-screen.png');

        // 8. Student Performance Analytics Dashboard
        await page.goto('http://localhost:3000/student/history');
        await delay(1000);
        await takeScreenshot(page, '08-student-performance-analytics.png');

    } catch (err) {
        console.error('Error during automation:', err);
    } finally {
        await browser.close();
    }
})();
