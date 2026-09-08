    </div>`;
  document.body.appendChild(banner);
  document.getElementById('cookie-accept').addEventListener('click', () => {
    localStorage.setItem('cookieConsent', 'all');
    banner.remove();
  });
  document.getElementById('cookie-reject').addEventListener('click', () => {
