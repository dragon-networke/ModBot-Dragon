// ===== TOGGLE SWITCHES =====
document.addEventListener('DOMContentLoaded', () => {

  // Alle Toggles initialisieren
  document.querySelectorAll('.toggle-wrap input[type="checkbox"]').forEach(checkbox => {
    updateToggle(checkbox);
    checkbox.addEventListener('change', () => updateToggle(checkbox));
  });

  // Auto-hide Alerts nach 3 Sekunden
  document.querySelectorAll('.alert-success, .alert-error').forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s';
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 500);
    }, 3000);
  });

  // Aktiven Nav-Link hervorheben
  highlightActiveNav();

  // Formular Speichern-Button Ladeanimation
  document.querySelectorAll('.config-form').forEach(form => {
    form.addEventListener('submit', (e) => {
      const btn = form.querySelector('.btn-save');
      if (btn) {
        btn.textContent = 'Wird gespeichert...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
      }
    });
  });

});

function updateToggle(checkbox) {
  const label = checkbox.nextElementSibling;
  if (!label) return;
  if (checkbox.checked) {
    label.style.background = 'var(--accent)';
  } else {
    label.style.background = 'var(--border)';
  }
}

function highlightActiveNav() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href');
    if (href && currentPath === href) {
      item.classList.add('active');
    }
  });
}

// ===== GUILD KARTEN HOVER EFFEKT =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.guild-card, .module-card, .feature-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transition = 'all 0.2s ease';
    });
  });
});