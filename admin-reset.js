const resultEl = document.getElementById('result');
const tokenEl = document.getElementById('token');
const passEl = document.getElementById('newPass');
const resetBtn = document.getElementById('resetBtn');

resetBtn.addEventListener('click', () => {
  const token = tokenEl.value.trim();
  const password = passEl.value;
  resultEl.textContent = '';
  if (!token || !password || password.length < 6) { resultEl.textContent = 'Provide valid token and password (min 6 chars).'; return; }
  fetch('/admin/reset', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ token, password }) })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        resultEl.textContent = 'Password reset successfully. You can now login.';
      } else {
        resultEl.textContent = data.error || 'Reset failed.';
      }
    }).catch(() => { resultEl.textContent = 'Server error'; });
});
