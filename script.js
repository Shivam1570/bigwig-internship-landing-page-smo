// ===================== MOBILE NAV TOGGLE =====================
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');

if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

// Allow tapping dropdown parent to expand on mobile
document.querySelectorAll('.has-dropdown > a').forEach((link) => {
  link.addEventListener('click', (e) => {
    if (window.innerWidth <= 720) {
      e.preventDefault();
      link.parentElement.classList.toggle('open');
    }
  });
});

// ===================== HERO CAROUSEL =====================
const heroSlides = Array.from(document.querySelectorAll('.hero-slide'));
const heroDots = Array.from(document.querySelectorAll('.hero-dot'));
let activeSlideIndex = 0;

function showHeroSlide(index) {
  if (!heroSlides.length) return;

  activeSlideIndex = (index + heroSlides.length) % heroSlides.length;

  heroSlides.forEach((slide, slideIndex) => {
    slide.classList.toggle('is-active', slideIndex === activeSlideIndex);
  });

  heroDots.forEach((dot, dotIndex) => {
    const isActive = dotIndex === activeSlideIndex;
    dot.classList.toggle('is-active', isActive);
    dot.setAttribute('aria-pressed', String(isActive));
  });
}

// ===================== INTRO CAROUSEL =====================
const introSlides = Array.from(document.querySelectorAll('.intro-slide'));
const introDots = Array.from(document.querySelectorAll('.intro-dot'));
let activeIntroSlideIndex = 0;

function showIntroSlide(index) {
  if (!introSlides.length) return;

  activeIntroSlideIndex = (index + introSlides.length) % introSlides.length;

  introSlides.forEach((slide, slideIndex) => {
    slide.classList.toggle('is-active', slideIndex === activeIntroSlideIndex);
  });

  introDots.forEach((dot, dotIndex) => {
    const isActive = dotIndex === activeIntroSlideIndex;
    dot.classList.toggle('is-active', isActive);
    dot.setAttribute('aria-pressed', String(isActive));
  });
}

if (introSlides.length) {
  introDots.forEach((dot, dotIndex) => {
    dot.addEventListener('click', () => showIntroSlide(dotIndex));
  });

  setInterval(() => showIntroSlide(activeIntroSlideIndex + 1), 5000);
}

if (heroSlides.length) {
  heroDots.forEach((dot, dotIndex) => {
    dot.addEventListener('click', () => showHeroSlide(dotIndex));
  });

  setInterval(() => showHeroSlide(activeSlideIndex + 1), 5000);

  // Choose a starting slide that changes on each visit.
  // We store the last shown index in localStorage and advance it on the next visit.
  let startIndex = 0;
  try {
    const last = parseInt(localStorage.getItem('heroLastIndex'));
    if (!Number.isNaN(last)) {
      startIndex = (last + 1) % heroSlides.length;
    } else {
      startIndex = Math.floor(Math.random() * heroSlides.length);
    }
    localStorage.setItem('heroLastIndex', String(startIndex));
  } catch (e) {
    startIndex = Math.floor(Math.random() * heroSlides.length);
  }

  showHeroSlide(startIndex);
}

// ===================== FAQ ACCORDION =====================
const accordionItems = document.querySelectorAll('.accordion-item');

accordionItems.forEach((item) => {
  const trigger = item.querySelector('.accordion-trigger');
  const panel = item.querySelector('.accordion-panel');

  trigger.addEventListener('click', () => {
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';

    // Close all other items (single-open accordion)
    accordionItems.forEach((other) => {
      if (other !== item) {
        other.querySelector('.accordion-trigger').setAttribute('aria-expanded', 'false');
        other.querySelector('.accordion-panel').style.maxHeight = null;
      }
    });

    trigger.setAttribute('aria-expanded', String(!isOpen));
    panel.style.maxHeight = isOpen ? null : panel.scrollHeight + 'px';
  });
});

// ===================== FORM VALIDATION =====================
const leadForm = document.getElementById('leadForm');
const formSuccess = document.getElementById('formSuccess');

function showError(fieldId, message) {
  const errorEl = leadForm.querySelector(`.field-error[data-for="${fieldId}"]`);
  if (errorEl) errorEl.textContent = message;
}

function clearErrors() {
  leadForm.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
}

leadForm.addEventListener('submit', (e) => {
  e.preventDefault();
  clearErrors();
  formSuccess.hidden = true;

  const fullName = leadForm.fullName.value.trim();
  const email = leadForm.email.value.trim();
  const phone = leadForm.phone.value.trim();

  let valid = true;

  if (fullName.length < 2) {
    showError('fullName', 'Please enter your full name.');
    valid = false;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    showError('email', 'Please enter a valid email address.');
    valid = false;
  }

  const phonePattern = /^[0-9+\-\s]{7,15}$/;
  if (!phonePattern.test(phone)) {
    showError('phone', 'Please enter a valid phone number.');
    valid = false;
  }

  if (!valid) return;

  const leadData = {
    fullName,
    email,
    phone,
    service: leadForm.service ? leadForm.service.value : 'Social Media Optimization',
    requirements: leadForm.requirements.value.trim(),
  };

  const apiHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? (window.location.origin.includes(':3000') ? '' : 'http://localhost:3000')
    : '';
  fetch(`${apiHost}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leadData),
  })
    .then((response) => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(() => {
      formSuccess.hidden = false;
      leadForm.reset();
    })
    .catch(() => {
      showError('fullName', 'Unable to submit at this time. Please try again later.');
    });
});

// ===================== SCROLL REVEAL =====================
const revealTargets = document.querySelectorAll('.card, .stat-card, .platform-icons a');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealTargets.forEach((el) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(16px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// ===================== SIDE DRAWER OVERLAY =====================
const menuToggleBtn = document.getElementById('menuToggleBtn');
const drawerCloseBtn = document.getElementById('drawerCloseBtn');
const drawerBackdrop = document.getElementById('drawerBackdrop');

if (menuToggleBtn && drawerBackdrop) {
  menuToggleBtn.addEventListener('click', () => {
    drawerBackdrop.classList.add('is-active');
  });
}

if (drawerCloseBtn && drawerBackdrop) {
  drawerCloseBtn.addEventListener('click', () => {
    drawerBackdrop.classList.remove('is-active');
  });
}

if (drawerBackdrop) {
  drawerBackdrop.addEventListener('click', (e) => {
    // Only close if the click was directly on the backdrop, not inside the drawer panel itself
    if (e.target === drawerBackdrop) {
      drawerBackdrop.classList.remove('is-active');
    }
  });
}
