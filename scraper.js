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
    // 1. Login CORRETO (Promise.all pattern)
    console.log('📱 Login...');
    await page.goto('https://www.linkedin.com/login');
    
    await page.type('#username', process.env.LINKEDIN_EMAIL);
    await page.type('#password', process.env.LINKEDIN_PASSWORD);
    
    // ✅ CORRETO: waitForNavigation ANTES do click
    const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle2' });
    await page.click('button[type="submit"]');
    await navigationPromise;
    
    console.log('✅ Login OK!');
    
    // 2. URL CORRETA convites
    await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', { 
      waitUntil: 'networkidle2' 
    });
    
    console.log('📊 Página convites carregada');
    
    // 3. Extrai convites
    const data = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll(`
        [data-urn*="urn:li:fs_invitation"],
        .invitation-card,
        div[data-test-id*="invitation"],
        [role="listitem"]
      `));
      
      return {
        count: items.length,
        title: document.title,
        url: window.location.href,
        sampleText: items[0]?.innerText.substring(0, 100) || 'Nenhum item'
      };
    });
    
    console.log('📈 Dados:', data);
    
    // 4. Salva no Firebase
    const timestamp = Date.now();
    const invitations = data.count > 0 ? Array(data.count).fill().map((_, i) => ({
      name: `Pessoa ${i+1}`,
      status: 'pending',
      scrapedAt: new Date().toISOString()
    })) : [];
    
    await db.ref(`invitations/${timestamp}`).set({
      invitations,
      count: data.count,
      debug: data,
      scrapedAt: timestamp,
      success: true
    });
    
    console.log(`✅ ✅ ${data.count} convites salvos no Firebase!`);
    
  } catch (error) {
    console.error('💥 ERRO:', error.message);
    await db.ref('errors/latest').set({ 
      error: error.message, 
      timestamp: Date.now() 
    });
  } finally {
    await browser.close();
  }
}

scrapeInvitations();
