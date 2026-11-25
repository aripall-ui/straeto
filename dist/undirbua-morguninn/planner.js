'use strict';

const byId = id => document.getElementById(id);
const date = byId('plan-date');
const deadline = byId('plan-deadline');
const chosen = new Set();
const walking = {};
const homeWalking = {};
const walkInputs = [];
const allRows = new Map();
let rides = [];
let schedule;
let existingPlan;
const groups = [
  {primary: true, title: '13 frá Ásvallagötu', before: 3, after: 1},
  {primary: false, title: 'Aðrir kostir · Háskóli Íslands', before: 1, after: 1}
];

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

date.min = morningPlan.today(Date.now());
const requestedDate = new URLSearchParams(location.search).get('dagur');
date.value = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? '') && requestedDate >= date.min
  ? requestedDate : morningPlan.planDate(Date.now());

function addWalkInputs(id, stops, values, defaults = {}) {
  for (const stop of stops) {
    const label = element('label', stop + ' · mín.');
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '120';
    input.step = '1';
    input.inputMode = 'numeric';
    if (defaults[stop] != null) input.placeholder = defaults[stop];
    input.addEventListener('input', () => {
      if (input.validity.valid) {
        if (input.value === '') delete values[stop];
        else values[stop] = Number(input.value);
      }
      updateOptions();
    });
    walkInputs.push({stop, input, values});
    label.append(input);
    byId(id).append(label);
  }
}

addWalkInputs('plan-home-walk-fields', Object.keys(morningPlan.homeWalkDefaults), homeWalking, morningPlan.homeWalkDefaults);
addWalkInputs('plan-walk-fields', new Set(Object.values(morningPlan.routes).map(route => route.to)), walking);

function stepControl(group, word, property) {
  const body = element('div', '', 'plan-controls');
  const show = element('button', 'Sjá ' + word + ' ferðir', 'text-button');
  const hide = element('button', 'Fela', 'text-button');
  show.type = hide.type = 'button';
  show.setAttribute('aria-controls', group.list.id);
  hide.setAttribute('aria-controls', group.list.id);
  hide.setAttribute('aria-label', 'Fela ' + word + ' ferðir · ' + group.title);
  show.addEventListener('click', () => {
    group[property] += 1;
    updateOptions();
    if (show.hidden) hide.focus({preventScroll: true});
  });
  hide.addEventListener('click', () => {
    group[property] = 0;
    updateOptions();
    if (!show.hidden) show.focus({preventScroll: true});
  });
  body.append(show, hide);
  return {body, show, hide, word};
}

for (const [index, group] of groups.entries()) {
  const section = element('section', '', 'plan-group');
  const title = element('h3', group.title);
  group.list = element('div', '', 'plan-list');
  group.list.id = 'group-' + index;
  group.earlier = stepControl(group, 'fyrri', 'earlierStep');
  group.later = stepControl(group, 'seinni', 'laterStep');
  const tools = element('div', '', 'plan-group-tools');
  tools.append(title, group.earlier.body, group.later.body);
  section.append(tools, group.list);
  byId('plan-groups').append(section);
}

function late(ride) {
  return morningPlan.late(morningPlan.workArrival(ride, walking), date.value, deadline.value);
}

function updateSelection() {
  const count = chosen.size;
  byId('plan-count').textContent = count + (count % 10 === 1 && count % 100 !== 11 ? ' valin' : ' valdar');
  byId('plan-clear').disabled = count === 0;
  const invalid = !schedule || !date.validity.valid ||
    walkInputs.some(({input}) => !input.validity.valid);
  byId('plan-save').disabled = invalid || (!count && !existingPlan);
  byId('plan-save-weekday').disabled = invalid || !count;
}

function makeRow(ride) {
  const key = morningPlan.tripKey(ride);
  const route = morningPlan.routes[ride.number];
  const label = element('label', '', 'plan-option');
  const routeLabel = element('span', ride.number, 'route route-' + ride.number);
  const direction = element('span', route.from);
  direction.append(element('small', route.to, 'plan-detail'));
  const times = element('span', morningPlan.time(ride.at), 'plan-time');
  const work = element('small', '');
  const timingWarning = element('small', '', 'plan-option-late');
  timingWarning.hidden = true;
  times.append(element('small', 'Koma ' + morningPlan.time(ride.arrival)), work, timingWarning);
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = chosen.has(key);
  checkbox.setAttribute('aria-label', 'Leið ' + ride.number + ' · ' + route.fromLabel + ' kl. ' + morningPlan.time(ride.at));
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) chosen.add(key);
    else chosen.delete(key);
    updateSelection();
  });
  label.append(routeLabel, direction, times, checkbox);
  return {label, work, timingWarning, checkbox};
}

function resetDate() {
  existingPlan = morningPlan.read(date.value, schedule);
  const weekly = morningPlan.weekdayPlan();
  const override = morningPlan.hasOverride(date.value);
  const weekday = new Date(date.value).getUTCDay();
  byId('plan-use-weekday').hidden = !weekly || !override || !(weekday >= 1 && weekday <= 5);
  byId('plan-remove-weekday').hidden = !weekly;
  const source = byId('plan-source');
  source.hidden = !existingPlan && !weekly;
  source.textContent = existingPlan?.recurring && override ? 'Venjulega planið með breytingum fyrir þennan dag.' :
    existingPlan?.recurring ? 'Venjulega planið þitt fyrir virka daga.' :
    override ? 'Sérstakt val fyrir þennan dag.' : 'Venjulega planið gildir á virkum dögum.';
  const missing = byId('plan-missing');
  missing.hidden = !existingPlan?.missing?.length;
  missing.textContent = existingPlan?.timetableAvailable === false ? 'Tímaskrá fyrir þennan dag liggur ekki fyrir.' :
    (existingPlan?.missing ?? []).map(slot =>
      'Leið ' + slot.number + ' kl. ' + morningPlan.slotTime(date.value, slot) + ' er ekki á áætlun.').join(' ');
  deadline.value = existingPlan?.deadline ?? '09:45';
  chosen.clear();
  for (const ride of existingPlan?.rides ?? []) chosen.add(morningPlan.tripKey(ride));
  for (const {stop, input, values} of walkInputs) {
    const field = values === homeWalking ? 'homeWalking' : 'walking';
    const value = (existingPlan ?? weekly)?.[field]?.[stop];
    input.value = value ?? '';
    if (value == null) delete values[stop];
    else values[stop] = value;
  }
  rides = schedule ? morningPlan.timetableRides(schedule, date.value) : [];
  if (date.value === morningPlan.today(Date.now())) {
    rides = rides.filter(ride => ride.at >= Date.now() || chosen.has(morningPlan.tripKey(ride)));
  }
  const available = new Set(rides.map(morningPlan.tripKey));
  for (const key of [...chosen]) if (!available.has(key)) chosen.delete(key);
  allRows.clear();
  for (const group of groups) {
    group.earlierStep = group.laterStep = 0;
    group.rides = rides.filter(ride => (ride.number === '13') === group.primary);
    group.list.replaceChildren();
    for (const ride of group.rides) {
      const row = makeRow(ride);
      allRows.set(morningPlan.tripKey(ride), row);
      group.list.append(row.label);
    }
  }
  updateOptions();
}

function nearestPerRoute(rides, count, fromEnd) {
  const ordered = fromEnd ? [...rides].reverse() : rides;
  const totals = {};
  return ordered.filter(ride => {
    totals[ride.number] = (totals[ride.number] ?? 0) + 1;
    return totals[ride.number] <= count;
  });
}

function drawDisclosure(control, total, count, step, group) {
  control.show.hidden = total === 0 || count >= total;
  control.hide.hidden = step === 0 || total === 0;
  control.show.textContent = (step ? 'Sjá fleiri ' : 'Sjá ') + control.word + ' ferðir';
  control.show.setAttribute('aria-label', control.show.textContent + ' · ' + group.title);
}

function draftShortlist() {
  const limit = 36;
  const perRoute = limit / Object.keys(morningPlan.routes).length;
  const target = Date.parse(date.value + 'T' + (deadline.value || '09:45') + ':00Z');
  const arrival = ride => morningPlan.workArrival(ride, walking) ?? ride.at;
  const kept = rides.filter(ride => chosen.has(morningPlan.tripKey(ride)));
  const candidates = [];
  for (const number of Object.keys(morningPlan.routes)) {
    const routeRides = rides.filter(ride => ride.number === number && !chosen.has(morningPlan.tripKey(ride)));
    const selectedOnRoute = kept.filter(ride => ride.number === number).length;
    const slots = Math.max(0, perRoute - selectedOnRoute);
    const before = routeRides.filter(ride => arrival(ride) <= target)
      .sort((a, b) => arrival(b) - arrival(a));
    const after = routeRides.filter(ride => arrival(ride) > target)
      .sort((a, b) => arrival(a) - arrival(b));
    const beforeCount = Math.min(before.length, Math.max(0, slots - 3, slots - after.length));
    const nearby = [...before.slice(0, beforeCount), ...after.slice(0, slots - beforeCount)];
    const remaining = [...before, ...after].filter(ride => !nearby.includes(ride));
    candidates.push(...nearby, ...remaining.slice(0, Math.max(0, slots - nearby.length)));
  }
  candidates.sort((a, b) => Math.abs(arrival(a) - target) - Math.abs(arrival(b) - target));
  return new Set([...kept, ...candidates.slice(0, Math.max(0, limit - kept.length))]);
}

function updateOptions() {
  const excludeChosen = ride => !chosen.has(morningPlan.tripKey(ride));
  const shortlist = draftShortlist();
  let count = 0;
  for (const group of groups) {
    const candidates = group.rides.filter(ride => shortlist.has(ride));
    const earlyAlternatives = new Set(group.primary ? [] : ['1', '3', '6'].flatMap(number =>
      candidates.filter(ride => ride.number === number).slice(0, 2)));
    const viable = candidates.filter(ride => ride.arrival !== null && late(ride) === 0);
    if (deadline.value) count += viable.length;
    const preferred = viable.filter(ride => !earlyAlternatives.has(ride));
    const firstOptions = new Set(nearestPerRoute(preferred, group.before, true));
    const remaining = candidates.filter(ride => !viable.includes(ride) && !earlyAlternatives.has(ride));
    const lastOptions = new Set(nearestPerRoute(remaining, group.after, false));
    const earlier = candidates.filter(ride => earlyAlternatives.has(ride) ||
      (preferred.includes(ride) && !firstOptions.has(ride))).filter(excludeChosen);
    const later = remaining.filter(ride => !lastOptions.has(ride)).filter(excludeChosen);
    const extraEarlier = nearestPerRoute(earlier, group.earlierStep * (group.primary ? 2 : 1), true);
    const extraLater = nearestPerRoute(later, group.laterStep * (group.primary ? 2 : 1), false);
    const visible = new Set([...firstOptions, ...lastOptions, ...extraEarlier, ...extraLater]);
    for (const ride of group.rides) {
      const key = morningPlan.tripKey(ride);
      const row = allRows.get(key);
      const delay = late(ride);
      row.label.hidden = !visible.has(ride) && !chosen.has(key);
      row.work.textContent = 'Í vinnu ' + morningPlan.time(morningPlan.workArrival(ride, walking));
      row.timingWarning.hidden = delay === 0;
      row.timingWarning.textContent = delay ? 'Ath. ' + delay + ' mín. seinn í vinnu' : '';
    }
    drawDisclosure(group.earlier, earlier.length, extraEarlier.length, group.earlierStep, group);
    drawDisclosure(group.later, later.length, extraLater.length, group.laterStep, group);
  }
  if (schedule) {
    const one = count % 10 === 1 && count % 100 !== 11;
    byId('plan-status').textContent = !rides.length ? 'Engar brottfarir fundust fyrir þennan dag.' :
      !deadline.value ? shortlist.size + ' brottfarir í listanum.' :
      count ? count + (one ? ' ferð gæti hentað.' : ' ferðir gætu hentað.') : 'Engin ferð gæti hentað.';
  }
  updateSelection();
}

date.addEventListener('change', resetDate);
deadline.addEventListener('input', () => {
  for (const group of groups) group.earlierStep = group.laterStep = 0;
  updateOptions();
});
byId('plan-clear').addEventListener('click', () => {
  chosen.clear();
  for (const row of allRows.values()) row.checkbox.checked = false;
  updateOptions();
});
function persist(change) {
  try {
    change();
    location.href = '/';
  } catch {
    const error = byId('plan-error');
    error.hidden = false;
    error.textContent = 'Ekki tókst að vista í þessum vafra. Athugaðu hvort vafrinn leyfi vistun.';
  }
}

byId('plan-form').addEventListener('submit', event => {
  event.preventDefault();
  const plan = {
    rides: rides.filter(ride => chosen.has(morningPlan.tripKey(ride))),
    walking,
    homeWalking,
    deadline: deadline.value
  };
  if (event.submitter?.id === 'plan-save-weekday') {
    if (!plan.rides.length) return;
    persist(() => {
      morningPlan.saveWeekday(plan);
      const weekday = new Date(date.value).getUTCDay();
      if (weekday >= 1 && weekday <= 5) morningPlan.useWeekday(date.value);
    });
  } else {
    persist(() => morningPlan.save(date.value, plan));
  }
});
byId('plan-use-weekday').addEventListener('click', () => persist(() => morningPlan.useWeekday(date.value)));
byId('plan-remove-weekday').addEventListener('click', () => persist(morningPlan.removeWeekday));

(async () => {
  try {
    const response = await fetch('/timetable.json');
    if (!response.ok) throw new Error('Timetable unavailable');
    schedule = await response.json();
    resetDate();
  } catch {
    byId('plan-status').textContent = 'Tímaskráin náðist ekki. Prófaðu að endurhlaða síðuna.';
  }
})();
