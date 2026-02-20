document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('invites-list');
  list.innerHTML = '<div class="loading">🔄 Carregando convites...</div>';

  try {
    const db = firebase.database();
    db.ref('invitations').on('value', snapshot => {
      const data = snapshot.val();
      list.innerHTML = '';

      if (!data) {
        list.innerHTML = '<div class="error">Nenhum dado encontrado. Rode o workflow primeiro!</div>';
        return;
      }

      let totalInvites = 0;
      Object.entries(data).forEach(([key, entry]) => {
        if (entry.invitations) {
          totalInvites += entry.invitations.length;
          
          const div = document.createElement('div');
          div.className = 'invite-section';
          div.innerHTML = `
            <h3>📅 ${new Date(entry.scrapedAt).toLocaleString('pt-BR')}</h3>
            <div class="invites-grid">
              ${entry.invitations.map(inv => `
                <div class="invite-card">
                  <div class="invite-name">${inv.name}</div>
                  <div class="invite-headline">${inv.headline}</div>
                  <span class="status status-${inv.status}">${inv.status}</span>
                  ${inv.profileUrl ? `<a href="${inv.profileUrl}" class="profile-link" target="_blank">Ver Perfil</a>` : ''}
                </div>
              `).join('')}
            </div>
          `;
          list.appendChild(div);
        }
      });

      if (totalInvites === 0) {
        list.innerHTML = '<div class="error">Nenhum convite encontrado. Envie alguns convites no LinkedIn!</div>';
      }
    });
  } catch (error) {
    list.innerHTML = `<div class="error">Erro Firebase: ${error.message}</div>`;
  }
});
