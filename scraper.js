const puppeteer = require('puppeteer');
const db = require('./firebase-admin');

// Função helper para delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeInvitations() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    console.log('🔐 Iniciando login...');
    await page.goto('https://www.linkedin.com/login/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#username', { timeout: 10000 });

    // Login com env vars corrigidas
    await page.type('#username', process.env.LINKEDIN_EMAIL || '', { delay: 100 });
    await page.type('#password', process.env.LINKEDIN_PASSWORD || '', { delay: 100 });

    const loginPromise = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    await Promise.any([
      page.click('button[type="submit"]'),
      page.click('.btn__primary--large'),
      page.click('button[aria-label*="Entrar"]')
    ]);
    await loginPromise.catch(() => console.log('⚠️ Timeout na navegação pós-login'));

    // Verifica login (melhorado: checa feed ou global nav)
    await sleep(2000);
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('#username') && (window.location.pathname === '/feed/' || document.querySelector('.global-nav__primary-link'));
    });
    console.log('Login status:', isLoggedIn ? '✅ OK' : '❌ FALHOU');

    if (!isLoggedIn) {
      console.log('🔄 Tentativa bypass via feed');
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2' });
    }

    // Vai para gerenciador de convites enviados/recebidos
    console.log('📨 Navegando para convites...');
    await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', { waitUntil: 'domcontentloaded' });
    await sleep(5000);

    // Scroll pra carregar mais convites (LinkedIn lazy load)
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, 1000);
        await new Promise(r => setTimeout(r, 1000));
      }
    });

    // Extrai convites reais com selectors atualizados
    const invitations = await page.evaluate(() => {
      const invites = [];
      // Selectors para cards de convite (ajustados para 2026)
      const cards = document.querySelectorAll('[data-urn*="fs_invitation"], .invitation-card, [data-test-id*="invitation"]');
      cards.forEach(card => {
        const name = card.querySelector('[data-test-id="inviter-name"], .actor-name, h3 a')?.textContent?.trim() || 'N/A';
        const headline = card.querySelector('.subline-level-1, .headline, .entity-result__summary')?.textContent?.trim() || 'N/A';
        const profileUrl = card.querySelector('a[href*="/in/"]')?.href || '';
        const status = card.querySelector('[data-test-id*="status"], .invitation-status')?.textContent?.trim() || 'Pendente';
        const sentAt = card.querySelector('time')?.textContent?.trim() || 'N/A';
        if (name !== 'N/A') {
          invites.push({ name, headline, profileUrl, status, sentAt });
        }
      });
      return invites;
    });

    console.log(`📊 Encontrados ${invitations.length} convites`);

    // Salva no Firebase (formato compatível com app.js)
    const timestamp = Date.now();
    const data = {
      invitations,
      scrapedAt: timestamp,
      count: invitations.length,
      pageUrl: page.url(),
      status: 'success'
    };
    await db.ref(`invitations/${timestamp}`).set(data);
    console.log(`✅ Salvo no Firebase: ${invitations.length} convites`);

  } catch (e) {
    console.error('💥 Erro:', e.message);
    // Salva erro no Firebase
    await db.ref(`invitations/error_${Date.now()}`).set({
      error: e.message,
      timestamp: Date.now(),
      status: 'error'
    });
  } finally {
    await browser.close();
  }
}

// Executa
if (require.main === module) {
  scrapeInvitations();
}

module.exports = { scrapeInvitations };
