// Set this to the Formspree form id (the part after /f/) to turn the contact form on.
const FORMSPREE_ID = '';

(function () {
  var menu = document.getElementById('menu');
  var menuBtn = document.getElementById('menuBtn');
  if (menu && menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        menu.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.focus();
      }
    });
  }

  var form = document.getElementById('contactForm');
  var msg = document.getElementById('formMsg');
  if (!form || !msg) return;
  var btn = form.querySelector('button[type=submit]');
  var label = btn ? btn.textContent : 'Send';

  function say(text) { msg.hidden = false; msg.textContent = text; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      say('Please add your name, email and a short message.');
      return;
    }
    if (!FORMSPREE_ID) {
      say('The contact form is being connected. Please write to us at the address on this page.');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Sending...';
    fetch('https://formspree.io/f/' + FORMSPREE_ID, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    }).then(function (resp) {
      if (resp.ok) {
        form.reset();
        say('Thank you. Your message has been sent. We reply within two working days.');
      } else {
        say('Sorry, that did not send. Please try again or write to us at the address on this page.');
      }
    }).catch(function (err) {
      console.error('contact form send failed', err);
      say('Sorry, that did not send. Please try again or write to us at the address on this page.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = label;
    });
  });
})();
