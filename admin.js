const leadsBody = document.getElementById('leadsBody');
const statusText = document.getElementById('statusText');
const refreshBtn = document.getElementById('refreshBtn');

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function setStatus(message, error = false) {
  statusText.textContent = message;
  statusText.style.color = error ? '#ff8b8b' : 'var(--teal)';
}

function renderLeads(leads) {
  if (!leads.length) {
    leadsBody.innerHTML = '<tr><td colspan="8" class="empty-state">No leads captured yet.</td></tr>';
    return;
  }

  leadsBody.innerHTML = leads.map((lead) => `
    <tr>
      <td>${lead.id}</td>
      <td>${lead.fullName}</td>
      <td><a href="mailto:${lead.email}">${lead.email}</a></td>
      <td>${lead.phone}</td>
      <td>${lead.service}</td>
      <td>${lead.requirements || '—'}</td>
      <td>${formatDate(lead.receivedAt)}</td>
      <td class="lead-actions"><button data-id="${lead.id}">Delete</button></td>
    </tr>
  `).join('');
}

function fetchLeads() {
  setStatus('Loading leads...');
  fetch('/api/leads')
    .then((response) => response.json())
    .then((data) => {
      renderLeads(data.leads || []);
      setStatus('Loaded successfully');
    })
    .catch(() => {
      setStatus('Unable to load leads', true);
      leadsBody.innerHTML = '<tr><td colspan="8" class="empty-state">Could not retrieve leads. Try again later.</td></tr>';
    });
}

function deleteLead(id) {
  fetch(`/api/leads/${id}`, { method: 'DELETE' })
    .then((response) => response.json())
    .then(() => fetchLeads())
    .catch(() => setStatus('Failed to delete lead', true));
}

leadsBody.addEventListener('click', (event) => {
  if (event.target.matches('button[data-id]')) {
    deleteLead(event.target.dataset.id);
  }
});

refreshBtn.addEventListener('click', fetchLeads);
fetchLeads();
