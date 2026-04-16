// ── Scroll nav class ──────────────────────────────────────────────────────────
const siteNav = document.getElementById('site-nav');
if (siteNav) {
  window.addEventListener('scroll', () => {
    siteNav.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}

// ── Mobile hamburger ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const hamburger = document.getElementById('navHamburger');
  const navMobile = document.getElementById('navMobile');
  if (hamburger && navMobile) {
    hamburger.onclick = () => navMobile.classList.toggle('hidden');
    // Close mobile nav when a link is clicked
    navMobile.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navMobile.classList.add('hidden'));
    });
  }

  // Mark active nav link
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (href !== '/' && path.startsWith(href))) {
      a.classList.add('active');
    }
  });

  // Flash message auto-dismiss after 4s
  document.querySelectorAll('.flash').forEach(el => {
    setTimeout(() => {
      el.style.transition = 'opacity .5s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 500);
    }, 4000);
  });
});

// ── Fade-in on scroll (IntersectionObserver) ──────────────────────────────────
(function () {
  if (!('IntersectionObserver' in window)) {
    // Fallback: make everything visible immediately
    document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  });
})();

// ── Lightbox ─────────────────────────────────────────────────────────────────
(function () {
  let photos = [];
  let currentIdx = 0;

  function openLightbox(idx) {
    currentIdx = idx;
    const overlay = document.getElementById('lightbox');
    if (!overlay) return;
    const img = overlay.querySelector('.lightbox-img');
    const cap = overlay.querySelector('.lightbox-caption');
    img.src = photos[idx].src;
    cap.textContent = photos[idx].caption || '';
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    const overlay = document.getElementById('lightbox');
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function navigate(delta) {
    currentIdx = (currentIdx + delta + photos.length) % photos.length;
    openLightbox(currentIdx);
  }

  window.initGallery = function (items) {
    photos = items;
    document.querySelectorAll('.photo-item').forEach((el, i) => {
      el.addEventListener('click', () => openLightbox(i));
    });
    // Also support gallery-item (home page masonry grid)
    document.querySelectorAll('.gallery-item[data-src]').forEach((el, i) => {
      el.addEventListener('click', () => openLightbox(i));
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    const overlay = document.getElementById('lightbox');
    if (!overlay) return;
    overlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    overlay.querySelector('.lightbox-nav.prev').addEventListener('click', () => navigate(-1));
    overlay.querySelector('.lightbox-nav.next').addEventListener('click', () => navigate(1));
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (overlay.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    });
  });
})();

// ── Live search ───────────────────────────────────────────────────────────────
(function () {
  let debounceTimer;

  document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('live-search');
    const results = document.getElementById('live-results');
    if (!input || !results) return;

    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      const q = this.value.trim();
      if (q.length < 2) { results.innerHTML = ''; results.classList.add('hidden'); return; }

      debounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          renderResults(data, q);
        } catch (e) {
          console.error(e);
        }
      }, 280);
    });

    document.addEventListener('click', function (e) {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.classList.add('hidden');
      }
    });

    function renderResults(items, q) {
      if (!items.length) {
        results.innerHTML = '<div style="padding:.75rem 1rem;color:var(--stone);font-size:.88rem">Nav rezultātu</div>';
        results.classList.remove('hidden');
        return;
      }
      results.innerHTML = items.map(item => {
        const type = item.type === 'event' ? 'Pasākums' : 'Foto';
        const href = item.type === 'event' ? `/events/${item.slug}` : `/gallery`;
        const sub = item.type === 'event'
          ? [item.event_date, item.location].filter(Boolean).join(' · ')
          : item.album || '';
        return `<a href="${href}" class="search-result-item">
          <span class="search-type-badge">${type}</span>
          <span><span class="result-title">${escHtml(item.title || '')}</span>${sub ? `<br><span class="result-sub">${escHtml(sub)}</span>` : ''}</span>
        </a>`;
      }).join('');
      results.classList.remove('hidden');
    }

    function escHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
  });
})();
