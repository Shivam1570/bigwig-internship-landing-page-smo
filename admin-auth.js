const $ = (id) => document.getElementById(id);

const tabLogin = $('tab-login');
const tabRegister = $('tab-register');
const tabForgot = $('tab-forgot');
const loginForm = $('loginForm');
const registerForm = $('registerForm');
const forgotForm = $('forgotForm');
const toggleLoginPass = $('toggleLoginPass');

function showTab(tab) {
  [tabLogin, tabRegister, tabForgot].forEach(t => t.classList.remove('active'));
  [loginForm, registerForm, forgotForm].forEach(f => f.classList.remove('active'));
  if (tab === 'login') { tabLogin.classList.add('active'); loginForm.classList.add('active'); }
  if (tab === 'register') { tabRegister.classList.add('active'); registerForm.classList.add('active'); }
  if (tab === 'forgot') { tabForgot.classList.add('active'); forgotForm.classList.add('active'); }
}

tabLogin.addEventListener('click', () => showTab('login'));
tabRegister.addEventListener('click', () => showTab('register'));
tabForgot.addEventListener('click', () => showTab('forgot'));

// Login
$('loginBtn').addEventListener('click', () => {
  const user = $('loginUser').value.trim();
  const pass = $('loginPass').value;
  $('loginMsg').textContent = '';
  fetch('/admin/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: user, password: pass }) })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        window.location = '/admin';
      } else {
        $('loginMsg').textContent = data.error || 'Login failed';
      }
    }).catch(() => { $('loginMsg').textContent = 'Server error'; });
});

// Show / hide password
if (toggleLoginPass) {
  toggleLoginPass.addEventListener('change', (e) => {
    const pass = $('loginPass');
    if (!pass) return;
    pass.type = e.target.checked ? 'text' : 'password';
  });
}

// Submit on Enter inside login form
const loginInputs = ['loginUser','loginPass'];
loginInputs.forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); $('loginBtn').click(); }
  });
});

// Register
$('regBtn').addEventListener('click', () => {
  const user = $('regUser').value.trim();
  const pass = $('regPass').value;
  $('regMsg').textContent = '';
  fetch('/admin/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: user, password: pass }) })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        $('regMsg').textContent = 'Registered — you can login now.';
        showTab('login');
      } else {
        $('regMsg').textContent = data.error || 'Registration failed';
      }
    }).catch(() => { $('regMsg').textContent = 'Server error'; });
});

// Forgot
$('forgotBtn').addEventListener('click', () => {
  const user = $('forgotUser').value.trim();
  $('forgotMsg').textContent = '';
  fetch('/admin/forgot', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: user }) })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        const preview = data.previewUrl ? (' Preview: ' + data.previewUrl) : '';
        $('forgotMsg').textContent = 'Reset token generated.' + preview + ' Use /admin-reset.html to reset.';
      } else {
        $('forgotMsg').textContent = data.error || 'Request failed';
      }
    }).catch(() => { $('forgotMsg').textContent = 'Server error'; });
});
