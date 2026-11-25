'use strict';

// Biðröð ferða, eins og „Add to queue“ í Spotify: röð í ferðalista er strokin til vinstri og sleppt
// þegar „Í biðröð“ sést. Sama hreyfing tekur ferð úr biðröð. Ferðir í biðröð fara efst í listann.
// Raðir þurfa data-ride og data-at. Geymt í localStorage.
const bidrod = (() => {
  const threshold = 80;

  function create({storageKey, list, onChange}) {
    let items = load();
    let drag = null;
    let suppressUntil = 0;

    function load() {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        return Array.isArray(saved) ? saved.filter(item => typeof item?.key === 'string' && Number.isFinite(item.at)) : [];
      } catch {
        return [];
      }
    }

    function save() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(items));
      } catch {
        // Biðröðin gildir í þessum flipa þótt ekki sé hægt að vista hana.
      }
    }

    const has = key => items.some(item => item.key === key);

    function toggle(key, at) {
      items = has(key) ? items.filter(item => item.key !== key) : [...items, {key, at}];
      save();
      onChange();
    }

    // Farnar ferðir detta úr biðröðinni.
    function prune(now) {
      const before = items.length;
      items = items.filter(item => item.at >= now - 60000);
      if (items.length !== before) save();
    }

    function reset() {
      if (!drag) return;
      const {row} = drag;
      row.style.transition = 'transform .2s ease';
      row.style.transform = '';
      row.parentElement?.classList.remove('ferd-strok', 'ferd-strok-nog');
      row.addEventListener('transitionend', () => { row.style.transition = ''; }, {once: true});
      drag = null;
    }

    list.addEventListener('pointerdown', event => {
      const row = event.target.closest('.ferd');
      if (!row || event.button > 0) return;
      drag = {row, id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, active: false};
    });
    list.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.active) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        if (dx > -10) return;
        drag.active = true;
        drag.row.setPointerCapture?.(event.pointerId);
        drag.row.parentElement.classList.add('ferd-strok');
      }
      drag.dx = Math.max(-160, Math.min(0, dx));
      drag.row.style.transform = `translateX(${drag.dx}px)`;
      drag.row.parentElement.classList.toggle('ferd-strok-nog', drag.dx <= -threshold);
    });
    list.addEventListener('pointerup', event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.active) {
        suppressUntil = performance.now() + 400;
        const {row, dx} = drag;
        reset();
        if (dx <= -threshold) toggle(row.dataset.ride, Number(row.dataset.at));
      } else {
        drag = null;
      }
    });
    list.addEventListener('pointercancel', reset);
    // Stroka á ekki líka að velja röðina.
    list.addEventListener('click', event => {
      if (performance.now() < suppressUntil) {
        suppressUntil = 0;
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    }, true);

    return {has, toggle, prune, get dragging() { return Boolean(drag?.active); }};
  }

  // Merkir röð fyrir strokuna. item er <li>, row er .ferd-hnappurinn.
  function decorate(item, row, key, at, queued) {
    row.dataset.at = at;
    item.dataset.strok = queued ? 'Úr biðröð' : 'Í biðröð';
  }

  return {create, decorate};
})();
