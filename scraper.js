const puppeteer = require('puppeteer');
const db = require('./firebase-admin');

// Polyfill para waitForTimeout (removido no Puppeteer v23)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeInvitations()

  
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
  const page = await browser.newPage();
  await page.setViewport({width: 1366, height: 768});
  
  try {
    // User-Agent real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 1. Tenta login direto
    console.log('🔐 Tentativa 1: Login direto');
    await page.goto('https://www.linkedin.com/login');
    await page.waitForSelector('#username', {timeout: 5000});
    await page.type('#username', process.env.LINKEDIN_EMAIL, {delay: 50});
    await page.type('#password', process.env.LINKEDIN_PASSWORD, {delay: 50});
    
    const loginPromise = page.waitForNavigation({waitUntil: 'networkidle2', timeout: 10000});
    await Promise.any([
      page.click('button[type="submit"]'),
      page.click('.btn__primary--large'),
      page.click('button[aria-label*="Entrar"]')
    ]);
    await loginPromise.catch(() => console.log('⚠️ Login navigation timeout'));
    
    // 2. Verifica se logou
    const loggedIn = await page.evaluate(() => !document.querySelector('#username'));
    console.log('Login status:', loggedIn ? '✅ OK' : '❌ FALHOU');
    
    if (!loggedIn) {
      console.log('🔄 Tentativa 2: cookies bypass');
      await page.goto('https://www.linkedin.com/feed');
    }
    
    // 3. Vai convites
    await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', { 
      waitUntil: 'domcontentloaded' 
    });
    
    await page.waitForTimeout(3000);
    
    // 4. Debug
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      loggedIn: location.pathname.includes('feed') || !document.querySelector('#login'),
      invites: document.querySelectorAll('[data-urn*="invitation"]').length
    }));
    
    console.log('📊 Página:', pageInfo);
    
    // 5. Salva (sempre!)
    const timestamp = Date.now();
    await db.ref(`invitations/${timestamp}`).set({
      pageInfo,
      timestamp,
      status: 'scraped',
      count: pageInfo.invites || 0
    });
    
    console.log('✅ Firebase salvo!');
    
  } catch (e) {
    console.error('💥', e.message);
  } finally {
    await browser.close();
  }
}

scrapeInvitations();
