const db = firebase.database();
db.ref('invitations').on('value', snapshot => {
  const data = snapshot.val();
  const list = document.getElementById('invites-list');
  list.innerHTML = '';
  
  Object.entries(data || {}).forEach(([key, entry]) => {
    const div = document.createElement('div');
    div.innerHTML = `
      <h3>${entry.scrapedAt}</h3>
      <ul>${entry.invitations.map(inv => `<li>${inv.name} - ${inv.status} <a href="${inv.profileUrl}">Perfil</a></li>`).join('')}</ul>
    `;
    list.appendChild(div);
  });
});
