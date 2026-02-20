// app.js - Dashboard Completo Convites LinkedIn
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, orderByChild, limitToLast } from 'firebase/database';
import { getFirebaseConfig } from './firebase-client.js';  // Seu config

// Config Firebase (client-side)
const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM Elements
const listEl = document.getElementById('invites-list');
const countEl = document.getElementById('total-count');
const lastUpdateEl = document.getElementById('last-update');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refresh-btn');
const loaderEl = document.getElementById('loader');

// Estado
let allInvites = [];
let unsubscribe = null;

// Utils
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function updateUI() {
  const recent = allInvites.slice(-20).reverse();  // Últimos 20
  countEl.textContent = allInvites.length.toLocaleString();
  
  if (allInvites.length === 0) {
    listEl.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500">Nenhum convite enviado ainda. Aguardando scrape...</td></tr>';
    statusEl.textContent = 'Aguardando primeiro scrape';
    return;
  }

  // Tabela dinâmica
  listEl.innerHTML = recent.map(invite => `
    <tr class="hover:bg-gray-50 border-b">
      <td class="p-4 font-medium">${invite.name}</td>
      <td class="p-4">${invite.headline || 'N/A'}</td>
      <td class="p-4">
        <span class="inline-block px-3 py-1 text-xs font-semibold rounded-full ${
          invite.status === 'Sent' ? 'bg-blue-100 text-blue-800' : 
          invite.status === 'Accepted' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }">
          ${invite.status || 'Pendente'}
        </span>
      </td>
      <td class="p-4 text-sm text-gray-500">${formatDate(invite.sentAt)}</td>
      <td class="p-4">
        <a href="${invite.profileUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 font-medium text-sm">
          Ver Perfil →
        </a>
      </td>
    </tr>
  `).join('');

  lastUpdateEl.textContent = formatDate(Date.now());
  statusEl.textContent = `${allInvites.length} convites no total`;
}

// Listener Firebase Realtime
function startListening() {
  if (unsubscribe) unsubscribe();
  
  const statusRef = ref(db, 'status');
  const invitesRef = ref(db, 'invitations');
  
  // Status geral primeiro
  onValue(statusRef, (snap) => {
    const status = snap.val();
    if (status) {
      statusEl.textContent = status.status === 'success' 
        ? `Sucesso! ${status.count || 0} convites (${formatDate(status.scrapedAt)})`
        : 'Erro no scrape';
    }
  });

  // Todos timestamps de scrapes
  onValue(invitesRef, (snap) => {
    allInvites = [];
    snap.forEach((childSnap) => {
      const data = childSnap.val();
      if (data.invitations) {
        data.invitations.forEach(inv => {
          allInvites.push({ ...inv, scrapedAt: data.scrapedAt });
        });
      }
    });
    updateUI();
  }, { orderByChild: 'scrapedAt' });
}

// Refresh manual
refreshBtn.addEventListener('click', () => {
  loaderEl.classList.remove('hidden');
  statusEl.textContent = 'Forçando refresh...';
  
  setTimeout(() => {
    loaderEl.classList.add('hidden');
    statusEl.textContent = 'Atualizado!';
  }, 1500);
  
  // Trigger scrape via GitHub API (opcional, precisa token)
  // fetch('https://api.github.com/repos/tiagodeazevedoferreira/AppLinkedinInvites/actions/workflows/scrape.yml/dispatches', {
  //   method: 'POST',
  //   headers: { Authorization: 'token GITHUB_TOKEN' }
  // });
});

// Stats avançados (gráfico simples)
function updateStats() {
  const daily = {};
  allInvites.forEach(inv => {
    const day = new Date(inv.scrapedAt).toLocaleDateString('pt-BR');
    daily[day] = (daily[day] || 0) + 1;
  });

  const ctx = document.getElementById('stats-chart')?.getContext('2d');
  if (ctx && window.Chart) {
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(daily).slice(-7),
        datasets: [{ label: 'Convites/Dia', data: Object.values(daily).slice(-7), backgroundColor: '#3B82F6' }]
      },
      options: { scales: { y: { beginAtZero: true } } }
    });
  }
}

// Inicializa
document.addEventListener('DOMContentLoaded', () => {
  loaderEl.classList.remove('hidden');
  startListening();
  
  setTimeout(() => {
    loaderEl.classList.add('hidden');
    updateStats();
  }, 1000);

  // PWA offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
});

// Export pra testes
window.app = { allInvites, updateUI };
