/* Formulaire de contact : fenêtre popup, présente sur toutes les pages.
   S'ouvre depuis n'importe quel lien/bouton de contact du site, sans changer de page.
   Le message peut être pré-rempli selon le contexte du lien cliqué (voir CTX_MESSAGES),
   mais reste toujours librement modifiable par le visiteur. */
(function () {
  'use strict';
  var dialog = document.getElementById('contact-dialog');
  var form = document.getElementById('contact-form');
  if (!dialog || !form) return;
  var note = form.querySelector('[data-contact-note]');
  var submitBtn = form.querySelector('button[type="submit"]');
  var messageField = form.querySelector('[name="message"]');
  var defaultNote = note.textContent;
  var defaultClass = note.className;
  var openedAt = 0; // anti-spam : mesuré depuis l'ouverture de la fenêtre, pas le chargement de la page.

  // Contexte lu dans le lien cliqué (?ctx=…) : début de message proposé au visiteur.
  var CTX_MESSAGES = {
    contact: "Bonjour, ",
    devis: "Bonjour, je souhaite un devis pour : ",
    recherche: "Bonjour, je recherche : ",
    rdv: "Bonjour, je souhaite prendre rendez-vous. "
  };

  // Objet présélectionné selon le contexte (doit faire partie de contact.objets dans la configuration).
  var CTX_OBJET = {};

  var selectObjet = form.querySelector('select[name="objet"]');
  var pendingSuggestion = ''; // message contextuel : affiché en gris, Tab pour le reprendre et l'éditer

  function reset() {
    form.reset();
    Array.prototype.slice.call(form.elements).forEach(function (el) { el.disabled = false; });
    note.textContent = defaultNote;
    note.className = defaultClass;
    submitBtn.disabled = false;
    pendingSuggestion = '';
    messageField.placeholder = '';
  }

  function setSuggestion(text) {
    pendingSuggestion = text || '';
    messageField.value = '';
    messageField.placeholder = pendingSuggestion;
  }

  messageField.addEventListener('keydown', function (event) {
    if (event.key !== 'Tab' || event.shiftKey || !pendingSuggestion || messageField.value) return;
    event.preventDefault();
    messageField.value = pendingSuggestion;
    pendingSuggestion = '';
    messageField.placeholder = '';
    messageField.setSelectionRange(messageField.value.length, messageField.value.length);
  });

  function openDialog(ctx, custom) {
    reset();
    var objet = custom ? custom.objet : CTX_OBJET[ctx];
    if (custom) setSuggestion(custom.message || '');
    else if (ctx && CTX_MESSAGES[ctx]) setSuggestion(CTX_MESSAGES[ctx]);
    if (objet && selectObjet) {
      var known = Array.prototype.some.call(selectObjet.options, function (o) { return o.textContent.replace(/’/g, "'") === objet.replace(/’/g, "'"); });
      if (!known) selectObjet.add(new Option(objet), 1);
      for (var i = 0; i < selectObjet.options.length; i++) {
        if (selectObjet.options[i].textContent.replace(/’/g, "'") === objet.replace(/’/g, "'")) {
          selectObjet.value = selectObjet.options[i].value;
          break;
        }
      }
    }
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    openedAt = Date.now();
    var firstField = form.querySelector('input[name="nom"]');
    if (firstField) firstField.focus();
  }

  /* Déclencheurs : tout lien historique vers #contact-form (menu, CTA, pages secondaires…)
     et tout bouton marqué .js-contact-open. Le contexte (?ctx=…) est lu depuis le lien lui-même. */
  var triggers = document.querySelectorAll('a[href*="#contact-form"], .js-contact-open');
  Array.prototype.forEach.call(triggers, function (trigger) {
    trigger.addEventListener('click', function (event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      var ctx = null;
      var avec = null; // « Réserver avec … » : prénom de la personne choisie
      if (trigger.href) {
        try {
          var params = new URL(trigger.href, location.href).searchParams;
          ctx = params.get('ctx');
          avec = params.get('avec');
        } catch (e) {}
      }
      if (avec) openDialog(null, { objet: '', message: 'Bonjour, je souhaite prendre rendez-vous avec ' + avec + ' pour ' });
      else openDialog(ctx);
    });
  });

  window.ouvrirContact = function (custom) { openDialog(null, custom); };

  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });
  var closeBtn = dialog.querySelector('.editeur-dialog-close');
  if (closeBtn) closeBtn.addEventListener('click', function () { dialog.close(); });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = new FormData(form);
    submitBtn.disabled = true;
    note.textContent = 'Envoi en cours…'; note.className = defaultClass;
    fetch('api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: data.get('nom'), email: data.get('email'), objet: data.get('objet'),
        message: data.get('message'), site: data.get('site'), elapsed: Date.now() - openedAt
      })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.body && res.body.error ? res.body.error : 'Envoi impossible.');
        note.textContent = "Message envoyé — nous vous répondons sous la journée.";
        note.className = defaultClass + ' form-note--ok';
        Array.prototype.slice.call(form.elements).forEach(function (el) { el.disabled = true; });
        // Fermer la fenêtre après confirmation, pour ne pas laisser un formulaire figé ouvert.
        setTimeout(function () { if (dialog.open) dialog.close(); }, 2500);
      })
      .catch(function (err) {
        note.textContent = err.message + ' Vous pouvez aussi appeler ou écrire par WhatsApp.';
        note.className = defaultClass + ' form-note--warn';
        submitBtn.disabled = false;
      });
  });

  // Accès direct par URL (ex. lien partagé index.html?ctx=…#contact-form) : ouvre aussi la fenêtre.
  if (location.hash === '#contact-form') {
    openDialog(new URLSearchParams(location.search).get('ctx'));
  }
})();
