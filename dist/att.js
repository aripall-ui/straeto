'use strict';

// Velur hvort appið sýnir „Í vinnuna“ eða „Heim“.
//
// Sjálfgefið: Heim frá kl. 14:30 til miðnættis, annars Í vinnuna (íslenskur tími).
// Handvirkt val (flipi, hlekkur á milli átta eða undirsíða) gildir þar til næsti
// skiptitími rennur upp, þ.e. kl. 14:30 eða miðnætti.
//
// Hver síða merkir script-taggið með data-att="<átt>". Forsíður áttanna bæta við
// data-forsida; aðeins þær flytja notandann sjálfkrafa. Ný átt (t.d. þriðja leið)
// bætist við í `directions` og fær sinn flipa í .att-val.
(() => {
  const script = document.currentScript;
  const root = new URL('./', script.src).href;
  const here = script.dataset.att;
  const isFront = 'forsida' in script.dataset;
  const key = 'straeto-att-val';
  const switchMinute = 14 * 60 + 30;
  const directions = {vinna: '', heim: 'heim/'};

  const clock = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Atlantic/Reykjavik', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  function period(now = new Date()) {
    const parts = Object.fromEntries(clock.formatToParts(now).map(part => [part.type, part.value]));
    const afternoon = Number(parts.hour) * 60 + Number(parts.minute) >= switchMinute;
    return {
      id: `${parts.year}-${parts.month}-${parts.day}-${afternoon ? 'sd' : 'fh'}`,
      auto: afternoon ? 'heim' : 'vinna'
    };
  }

  function read() {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch {
      return {};
    }
  }

  function remember(att) {
    if (!(att in directions)) return;
    try {
      localStorage.setItem(key, JSON.stringify({att, period: period().id}));
    } catch {
      // Án geymslu gildir sjálfgefna áttin.
    }
  }

  function wanted() {
    const now = period();
    const choice = read();
    return choice.period === now.id && choice.att in directions ? choice.att : now.auto;
  }

  function check() {
    if (!isFront) return;
    const att = wanted();
    if (att !== here) location.replace(root + directions[att] + location.hash);
  }

  if (isFront) {
    check();
  } else {
    // Undirsíða tilheyrir sinni átt: sá sem er þar hefur valið hana.
    remember(here);
  }

  // Smellur á hlekk að forsíðu áttar telst handvirkt val.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const target = link.href.split(/[?#]/)[0];
    for (const [att, path] of Object.entries(directions)) {
      if (target === root + path) remember(att);
    }
  });

  // Appið getur legið opið í bakgrunni yfir skiptitímann.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) check();
  });
})();
