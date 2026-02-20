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

// Na parte de extração (substitua só essa função)
const invitations = await page.evaluate(() => {
  const invites = [];
  // Selectors FLEXÍVEIS pros seus convites reais
  const nameSelectors = [
    'a.cdcea5fd._3fb3cb84',    // Kleber
    'a.de3d5865.ee709ba4',     // Carina  
    'a[class*="ee"]',          // Padrão LinkedIn nomes
    '[data-test-id*="name"] a', // Fallback
    'h3 a, .actor-name a'      // Genérico
  ];
  
  nameSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(link => {
      const name = link.textContent.trim();
      if (name && !invites.some(i => i.name === name)) {
        const profileUrl = link.href;
        const headlineEl = link.closest('div')?.querySelector('.subline-level-1, .headline');
        const statusEl = link.closest('[data-test-id*="invitation"]')?.querySelector('.status');
        
        invites.push({
          name,
          headline: headlineEl?.textContent?.trim() || 'N/A',
          profileUrl,
          status: statusEl?.textContent?.trim() || 'Pendente',
          sentAt: new Date().toLocaleString('pt-BR')
        });
      }
    });
  });
  
  return invites.slice(0, 20); // Limite pra performance
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
