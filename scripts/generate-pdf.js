const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/resume/`, (res) => {
      resolve(true);
      res.resume();
    }).on('error', () => {
      resolve(false);
    });
    // Set a short timeout
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('Starting Hugo server...');
  const hugoPort = 13133; // Use a custom port to avoid conflict with running dev server
  const hugo = spawn('hugo', ['server', '-p', String(hugoPort), '--disableFastRender'], {
    stdio: 'ignore', // Suppress console output from the server to keep logs clean
    detached: false
  });

  // Wait for Hugo to be ready
  console.log('Waiting for Hugo server to start...');
  let ready = false;
  for (let i = 0; i < 30; i++) {
    ready = await isPortOpen(hugoPort);
    if (ready) break;
    await wait(500);
  }

  if (!ready) {
    console.error('Hugo server failed to start or resume page is not reachable.');
    hugo.kill();
    process.exit(1);
  }

  console.log('Hugo server is running. Launching Puppeteer...');
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    console.log(`Navigating to http://localhost:${hugoPort}/resume/ ...`);
    await page.goto(`http://localhost:${hugoPort}/resume/`, {
      waitUntil: 'networkidle0',
    });

    console.log('Generating PDF...');
    const pdfPath = path.join(__dirname, '..', 'static', 'resume.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0px',
        bottom: '0px',
        left: '0px',
        right: '0px'
      }
    });

    console.log(`PDF generated successfully at ${pdfPath}!`);
    await browser.close();
  } catch (err) {
    console.error('Error generating PDF:', err);
  } finally {
    console.log('Stopping Hugo server...');
    hugo.kill('SIGINT');
  }
}

main();
