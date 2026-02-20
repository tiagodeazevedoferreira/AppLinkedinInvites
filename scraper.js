const puppeteer = require('puppeteer');
const fs = require('fs');
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
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log('🔐 Iniciando login...');
    await page.goto('https://www.linkedin.com/login/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.type('#username', process.env.LINKEDIN_EMAIL || '', { delay: 100 });
    await page.type('#password', process.env.LINKEDIN_PASSWORD || '', { delay: 100 });

    await Promise.any([
      page.click('button[type="submit"]'),
      page.click('.btn__primary--large'),
      page.click('button[aria-label*="Entrar"]')
    ]);

    // DEBUG screenshots
    await page.screenshot({ path: 'debug-login.png' });

    // Sent invitations
    await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', { waitUntil: 'domcontentloaded' });
    await sleep(5000);

    // DEBUG página
    await page.screenshot({ path: 'debug-sent.png', fullPage: true });
    const html = await page.content();
    fs.writeFileSync('debug.html', html);
    console.log('🌐 Title:', await page.title());
    console.log('🌐 Cards potenciais:', await page.evaluate(() => document.querySelectorAll('[data-test-id*="invitation"], li[data-id]').length));

    // Scroll agressivo + espera carregamento dinâmico
    console.log('📜 Iniciando scroll infinito...');
    let previousHeight = 0;
    let maxTentativas = 20; // segurança contra loop infinito
    let tentativas = 0;

    while (tentativas < maxTentativas) {
      previousHeight = await page.evaluate(() => document.body.scrollHeight);

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(4000 + Math.random() * 2000); // 4–6s humanizado

      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) {
        console.log('→ Chegou ao final da lista');
        break;
      }
      tentativas++;
      console.log(`Scroll ${tentativas}/${maxTentativas} concluído`);
    }

    // Screenshot final para debug
    await page.screenshot({ path: 'debug-pos-scroll.png', fullPage: true });

    // Extração robusta (prioriza seletores mais recentes)
    const invitations = await page.evaluate(() => {
      // Tenta vários seletores comuns em 2025/2026
      const selectors = [
        '.invitation-card',
        'li.artdeco-list__item',
        'div[data-control-name*="invitation"]',
        '.reusable-invitation-card',
        'div.invitation-card__container'
      ];

      let cards = [];
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) {
          cards = found;
          console.log(`Usando selector: ${sel} (${found.length} cartões)`);
          break;
        }
      }

      if (cards.length === 0) return [];

      return Array.from(cards).map(card => {
        // Nome - várias formas comuns
        const nameSelectors = [
          '.invitation-card__tvm-title a strong',
          '.invitation-card__name',
          'strong', // fallback
          'span[dir="ltr"] strong'
        ];
        let name = 'Nome não encontrado';
        for (const s of nameSelectors) {
          const el = card.querySelector(s);
          if (el) {
            name = el.innerText.trim();
            break;
          }
        }

        // Headline
        const headlineEl = card.querySelector(
          '.invitation-card__subtitle, .invitation-card__headline, .entity-result__primary-subtitle'
        );
        const headline = headlineEl ? headlineEl.innerText.trim() : null;

        // URL do perfil (limpa tracking)
        const linkEl = card.querySelector('a[href*="/in/"]');
        const profileUrl = linkEl ? linkEl.href.split('?')[0] : null;

        // Mensagem (opcional)
        const msgEl = card.querySelector('.lt-line-clamp__raw-line, .invitation-card__message');
        const message = msgEl ? msgEl.innerText.trim() : null;

        return {
          name,
          headline,
          profileUrl,
          message,
          status: 'Sent',
          // Pode adicionar sentAt aproximado depois, ex: via timestamp do scrape
        };
      }).filter(item => item.name !== 'Nome não encontrado' && item.profileUrl);
    });

    console.log(`🔍 Encontrados ${invitations.length} convites pendentes`);

    if (invitations.length > 0) {
      const scrapedAt = Date.now();

      // Salva no Firebase - estrutura por timestamp para histórico
      await db.ref(`invitations/${scrapedAt}`).set({
        scrapedAt,
        count: invitations.length,
        invitations
      });

      // Atualiza status global (seu app.js já escuta isso)
      await db.ref('status').set({
        status: 'success',
        count: invitations.length,
        scrapedAt,
        message: `Scraped ${invitations.length} convites em ${new Date(scrapedAt).toLocaleString('pt-BR')}`
      });

      console.log('💾 Dados salvos com sucesso!');
    } else {
      console.warn('⚠️ Nenhum convite encontrado. Possíveis causas:');
      console.warn('- Login falhou ou checkpoint');
      console.warn('- Página não carregou tudo');
      console.warn('- Seletores mudaram novamente');
      
      // Salva HTML completo para debug
      const html = await page.content();
      require('fs').writeFileSync('debug-falha-sent.html', html);
      await page.screenshot({ path: 'debug-falha-final.png', fullPage: true });
    }

  } catch (err) {
    console.error('❌ Erro crítico:', err.message);
    if (page) await page.screenshot({ path: 'debug-erro-final.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

scrapeInvitations();