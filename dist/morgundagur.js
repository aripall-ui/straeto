'use strict';

// Plan fyrir næsta vinnudag: lítil flís neðst ef plan er til, spjald ef það vantar.
// Ekkert sést á morgnana (frá 05:00 þar til 45 mín. eftir síðustu planaða brottför,
// eða til 10:00 ef ekkert plan er í dag) eða á meðan Mínar ferðir eru sýndar.
const morgundagur = (() => {
  const root = new URL('./', document.currentScript.src).href;
  const minute = 60000;
  const day = 1440 * minute;
  const card = document.getElementById('morgun-kort');
  const chip = document.getElementById('morgun-flis');
  const cardTitle = document.getElementById('morgun-kort-titill');
  const chipLabel = document.getElementById('morgun-flis-dagur');
  const chipTime = document.getElementById('morgun-flis-timi');
  const savedBoard = document.getElementById('saved-morning');
  const weekdays = ['Sun.', 'Mán.', 'Þri.', 'Mið.', 'Fim.', 'Fös.', 'Lau.'];
  const iso = timestamp => new Date(timestamp).toISOString().slice(0, 10);

  // Brottfarir dagsins: tímar (ms), [] ef enginn ferð er planaða þann dag, null ef virkan dag vantar plan.
  function departures(date, plans, weekly) {
    const override = plans[date];
    if (Array.isArray(override?.rides)) return override.rides.map(ride => ride.at).filter(Number.isFinite);
    const weekday = new Date(date).getUTCDay();
    if (weekday < 1 || weekday > 5) return [];
    if (!weekly) return null;
    const excluded = new Set(override?.excluded ?? []);
    return weekly.departures.filter(slot => !excluded.has(slot.number + ':' + slot.minuteOfDay))
      .map(slot => Date.parse(date) + slot.minuteOfDay * minute);
  }

  function state(now) {
    const plans = morningPlan.readAll();
    const weekly = morningPlan.weekdayPlan();
    const today = iso(now);
    if (now % day >= 5 * 60 * minute) {
      const todays = departures(today, plans, weekly);
      const quietEnd = todays?.length ? Math.max(...todays) + 45 * minute : Date.parse(today) + 10 * 60 * minute;
      if (now < quietEnd) return {};
    }
    const start = Date.parse(morningPlan.planDate(now));
    for (let offset = 0; offset < 4; offset++) {
      const date = iso(start + offset * day);
      const rides = departures(date, plans, weekly);
      if (rides === null) return offset === 0 ? {date, missing: true} : {};
      if (rides.length) return {date, at: Math.min(...rides)};
    }
    return {};
  }

  function dayLabel(date, now) {
    if (date === iso(now)) return 'Í dag';
    if (date === iso(now + day)) return 'Á morgun';
    return weekdays[new Date(date).getUTCDay()];
  }

  function paint() {
    const now = Date.now();
    const plan = savedBoard && !savedBoard.hidden ? {} : state(now);
    const href = plan.date ? root + 'undirbua-morguninn/?' + new URLSearchParams({dagur: plan.date}) : root + 'undirbua-morguninn/';
    if (card) {
      card.hidden = !plan.missing;
      card.href = href;
      if (plan.missing) cardTitle.textContent = plan.date === iso(now) ? 'Ekkert plan fyrir daginn' : 'Ekkert plan fyrir morgundaginn';
    }
    if (chip) {
      chip.hidden = plan.at == null;
      chip.href = href;
      if (plan.at != null) {
        chipLabel.textContent = dayLabel(plan.date, now);
        chipTime.textContent = morningPlan.time(plan.at);
      }
    }
  }

  if (savedBoard) new MutationObserver(paint).observe(savedBoard, {attributes: true, attributeFilter: ['hidden']});
  addEventListener('storage', paint);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paint(); });
  setInterval(paint, minute);
  paint();
  return {paint};
})();
