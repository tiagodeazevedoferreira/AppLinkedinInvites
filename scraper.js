const puppeteer = require('puppeteer');
const db = require('./firebase-admin');

async function scrapeInvitations() {
  console.log('🚀 Iniciando scrape...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Login
    await page.goto('https://www.linkedin.com/login');
    await page.type('#username', process.env.LINKEDIN_EMAIL);
    await page.type('#password', process.env.LINKEDIN_PASSWORD);
    await page.click('[data-litms-control="sign-in"]');
    await page.waitForURL('https://www.linkedin.com/feed/*', { waitUntil: 'networkidle2' });
    
    // Convites enviados
    await page.goto('https://www.linkedin.com/mynetwork/invites/sent/', { waitUntil: 'networkidle2' });
    
    // Extrai dados (AJUSTE seletores inspecionando DOM)
    const invitations = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[data-test-invitation-card]'));
      return items.map((item, index) => ({
        name: item.querySelector('[data-field="memberName"]')?.textContent?.trim() || `Pessoa ${index}`,
        headline: item.querySelector('[data-field="headline"]')?.textContent?.trim() || 'N/A',
        status: item.querySelector('.invitation-status')?.textContent?.trim() || 'pending',
        profileUrl: item.querySelector('a.app-aware-link')?.href || '',
        scrapedAt: new Date().toISOString()
      })).slice(0, 50);
    });
    
    const timestamp = Date.now();
    await db.ref(`invitations/${timestamp}`).set({ 
      invitations, 
      scrapedAt: timestamp,
      count: invitations.length 
    });
    
    console.log(`✅ Scraped ${invitations.length} invitations`);
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await browser.close();
  }
}

scrapeInvitations();
