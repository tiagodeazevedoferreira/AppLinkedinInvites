const puppeteer = require('puppeteer');
const db = require('./firebase-admin');

async function scrapeInvitations() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Login
  await page.goto('https://www.linkedin.com/login');
  await page.type('#username', process.env.LINKEDIN_EMAIL);
  await page.type('#password', process.env.LINKEDIN_PASSWORD);
  await page.click('[data-litms-control="sign-in"]');
  await page.waitForURL('https://www.linkedin.com/feed/*', { waitUntil: 'networkidle2' });
  
  // Vai para convites enviados (URL exata - teste manualmente primeiro)
  await page.goto('https://www.linkedin.com/mynetwork/invites/sent/', { waitUntil: 'networkidle2' });
  
  // Extrai convites (ajuste seletores depois de inspecionar DOM)
  const invitations = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('div[data-occludable-section-legacy="true"]'));
    return items.map(item => ({
      name: item.querySelector('[data-field="invitation_entity_name"]')?.textContent?.trim() || 'N/A',
      headline: item.querySelector('[data-field="invitation_entity_subtitle"]')?.textContent?.trim() || 'N/A',
      status: item.querySelector('.invitation-status')?.textContent?.trim() || 'pending',  // ajuste
      sentDate: new Date().toISOString(),  // ou extraia do DOM
      profileUrl: item.querySelector('a')?.href || ''
    })).slice(0, 20);  // limita pra não sobrecarregar
  });
  
  await browser.close();
  
  // Salva no Firebase (path: /invitations/{timestamp})
  const timestamp = Date.now();
  await db.ref(`invitations/${timestamp}`).set({ invitations, scrapedAt: timestamp });
  
  console.log(`Scraped ${invitations.length} invitations`);
}

scrapeInvitations().catch(console.error);
