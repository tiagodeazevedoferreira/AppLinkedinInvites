const puppeteer = require('puppeteer');
const db = require('./firebase-admin');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeInvitations() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    // ... login igual anterior ...
    console.log('🔐 Iniciando login...');
    await page.goto('https://www.linkedin.com/login/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.type('#username', process.env.LINKEDIN_EMAIL || '', { delay: 100 });
    await page.type('#password', process.env.LINKEDIN_PASSWORD || '', { delay: 100 });
    
    const loginPromise = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    await Promise.any([
      page.click('button[type="submit"]'),
      page.click('.btn__primary--large'),
      page.click('button[aria-label*="Entrar"]')
    ]);
    await loginPromise.catch(() => {});

    // Vai para convites
    await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', { waitUntil: 'domcontentloaded' });
    await sleep(5000);
    
    // Scroll pra mais convites
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, 1000);
        await new Promise(r => setTimeout(r, 1000));
      }
    });

    // **SEUS SELECTORS REAIS**
    const invitations = await page.evaluate(() => {
      const invites = [];
      // Encontra TODOS os links de nome como o seu exemplo
      const nameLinks = document.querySelectorAll('a.cdcea5fd._3fb3cb84');
      
      nameLinks.forEach(link => {
        const name = link.textContent.trim();
        const profileUrl = link.href;
        
        // Próximo headline/cargo (irmão ou próximo elemento)
        const headlineEl = link.closest('div')?.nextElementSibling || 
                         link.parentElement?.nextElementSibling?.querySelector('.subline-level-1, .entity-result__summary');
        const headline = headlineEl?.textContent?.trim() || 'N/A';
        
        // Status próximo
        const statusEl = link.closest('[data-test-id*="invitation"]')?.querySelector('[data-test-id*="status"]');
        const status = statusEl?.textContent?.trim() || 'Pendente';
        
        invites.push({ 
          name, 
          headline, 
          profileUrl, 
          status,
          sentAt: new Date().toLocaleString('pt-BR')
        });
      });
      
      return invites;
    });

    console.log(`📊 ${invitations.length} convites:`, invitations.slice(0, 2));

    // Salva
    const timestamp = Date.now();
    await db.ref(`invitations/${timestamp}`).set({
      invitations,
      scrapedAt: timestamp,
      count: invitations.length,
      status: 'success'
    });
    console.log('✅ Salvo!');

  } catch (e) {
    console.error('💥', e.message);
  } finally {
    await browser.close();
  }
}

if (require.main === module) scrapeInvitations();
module.exports = { scrapeInvitations };
