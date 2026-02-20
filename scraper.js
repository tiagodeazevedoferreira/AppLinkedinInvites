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
    // 1. Login (múltiplos seletores)
    await page.goto('https://www.linkedin.com/login');
    await page.type('#username', process.env.LINKEDIN_EMAIL);
    await page.type('#password', process.env.LINKEDIN_PASSWORD);
    
    const signInSelectors = [
      'button[type="submit"]',
      '.login__form_action_container button',
      'button[aria-label*="Entrar"]',
      '.btn__primary--large',
      '[role="button"]:has-text("Entrar")'
    ];
    
    let clicked = false;
    for (const selector of signInSelectors) {
      try {
        await page.waitForSelector(selector, {timeout: 2000});
        await page.click(selector);
        clicked = true;
        console.log(`✅ Login: ${selector}`);
        break;
      } catch {}
    }
    
    if (!clicked) throw new Error('Botão login não encontrado');
    
    await page.waitForURL(/feed|mypage/, {timeout: 10000});
    
    // 2. URL CORRETA dos convites enviados
    console.log('📱 Indo para convites...');
    await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', { 
      waitUntil: 'networkidle2' 
    });
    
    // 3. Debug da página
    const debug = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      hasInvites: !!document.querySelector('[data-urn*="invitation"], .invitation-card, [role="listitem"]')
    }));
    console.log('📊 Debug página:', debug);
    
    // 4. Extrai convites (seletores genéricos primeiro)
    const invitations = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll(`
        [data-urn*="invitation"],
        .invitation-card,
        [role="listitem"],
        div[data-test-id*="invitation"]
      `));
      
      return items.slice(0, 20).map((item, i) => ({
        name: item.innerText.split('\n')[0]?.trim() || `Pessoa ${i+1}`,
        status: 'pending',
        profileUrl: item.querySelector('a')?.href || '',
        scrapedAt: new Date().toISOString()
      }));
    });
    
    console.log(`📈 ${invitations.length} convites encontrados`);
    
    // 5. Salva no Firebase
    const timestamp = Date.now();
    await db.ref(`invitations/${timestamp}`).set({
      invitations,
      count: invitations.length,
      debug,
      scrapedAt: timestamp
    });
    
    console.log('✅ ✅ SALVOU NO FIREBASE!');
    
  } catch (error) {
    console.error('💥 ERRO:', error.message);
  } finally {
    await browser.close();
  }
}

scrapeInvitations();
