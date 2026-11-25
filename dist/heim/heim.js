'use strict';

// Mappa Heim-appsins, svo slóðir virki líka þegar vefurinn er hýstur í undirmöppu.
const heimRoot = new URL('./', document.currentScript.src).href;

const connections = [
  {key: 'direct', label: 'RÚV → Ásvallagata', from: 'RÚV', to: 'Koma á Ásvallagötu', legs: [
    {number: '13', signs: ['Eiðisgrandi', 'Öldugrandi'], board: '90000084', exit: '90000168'}
  ]},
  {key: 'library', label: 'RÚV → Þjóðarbókhlaðan', from: 'RÚV', to: 'Koma við Þjóðarbókhlöðuna', legs: [
    {number: '11', signs: ['Seltjarnarnes', 'Eiðistorg'], board: '90000084', exit: '90000254'}
  ]},
  {key: 'grandi', label: 'Kringlan → Mýrargata', from: 'Kringlan', to: 'Koma við Mýrargötu', legs: [
    {number: '3', signs: ['Grandi'], board: '90000013', exit: '90000061'}
  ]},
  {key: 'university', label: 'Kringlan → Ráðhúsið', from: 'Kringlan', to: 'Koma við Ráðhúsið', legs: [
    {number: '6', signs: ['HÍ', 'Háskóli Íslands'], board: '90000013', exit: '90000056'}
  ]},
  {key: 'skulagata', label: 'Kringlumýrar­braut → MR', from: 'Kringlumýrar­braut', to: 'Koma við MR', legs: [
    {number: '1', signs: ['Skúlagata'], board: '90000016', exit: '90000004'}
  ]},
  {key: 'transfer', label: 'Leiti → Skeggjagata → Ásvallagata', from: 'Leiti', to: 'Koma á Ásvallagötu', legs: [
    {number: '18', signs: ['Skúlagata'], board: '90000324', exit: '90000883'},
    {number: '13', signs: ['Eiðisgrandi', 'Öldugrandi'], board: '90000883', exit: '90000168'}
  ]}
];
const minute = 60000;
const day = 1440 * minute;
const clock = new Intl.DateTimeFormat('is-IS', {
  timeZone: 'Atlantic/Reykjavik', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const byId = id => document.getElementById(id);
const main = document.body.dataset.view === 'main';
let selected = new URLSearchParams(window.location.search).get('ferd');
const walkPreference = 'heim-limit-walking';
let limitWalking = false;
try {
  limitWalking = localStorage.getItem(walkPreference) === 'true';
} catch {
  // The setting still works when browser storage is unavailable.
}
let predictions;
let request;
let featured;
let nextRide;
let previousKringlan;
let nextKringlan;
let nextExpiry = Infinity;

function secondsOfDay(value) {
  const m = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  return m && Number(m[1]) < 48 ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0) : null;
}

function serviceTimes(leg, data, now) {
  const midnight = Math.floor(now / day) * day;
  const matches = row => String(row.routeNr) === leg.number && leg.signs.includes(row.headsign?.trim());
  const targetRows = data['s' + leg.exit]?.arrivals ?? [];
  const arrivals = new Map(targetRows.filter(row => matches(row) && row.trip?.id != null)
    .map(row => [row.trip.id, secondsOfDay(row.arrival)]));
  return (data['s' + leg.board]?.arrivals ?? []).filter(matches).flatMap(row => {
    const departure = secondsOfDay(row.arrival);
    if (departure === null) return [];
    let at = midnight + departure * 1000;
    if (departure < 86400 && at < now - 360 * minute) at += day;
    if (at > now + 1380 * minute && at - day > now - minute) at -= day;
    if (at <= now - minute) return [];
    const exit = arrivals.get(row.trip?.id);
    const offset = exit == null ? null : (exit - departure + 86400) % 86400;
    const arrival = offset !== null && offset <= 7200 ? at + offset * 1000 : null;
    return [{key: String(row.trip?.id ?? at), at, arrival, lat: row.lat, lng: row.lng}];
  }).sort((a, b) => a.at - b.at);
}

function ridesFor(connection, data, now) {
  const [first, second] = connection.legs;
  const departures = serviceTimes(first, data, now);
  const onward = second ? serviceTimes(second, data, now) : [];
  return departures.flatMap(ride => {
    const key = connection.key + ':' + ride.key;
    if (!second) return [{...ride, key, connection}];
    const missingTime = ride.arrival === null ? 'komutími 18 vantar'
      : !Array.isArray(data['s' + second.board]?.arrivals) ? 'brottfarartími 13 vantar' : '';
    if (missingTime) return [{...ride, key, connection, arrival: null, missingTime}];
    const next = onward.find(bus => bus.at >= ride.arrival + 2 * minute);
    if (!next) return [];
    return [{...ride, key, connection, arrival: next.arrival,
      transfer: next.at, wait: Math.floor((next.at - ride.arrival) / minute)}];
  });
}

function timestring(timestamp) {
  return timestamp == null ? '—' : clock.format(timestamp);
}

function countdown(timestamp, now) {
  if (timestamp == null) return '–:––';
  if (timestamp <= now) return 'Núna';
  const seconds = Math.ceil((timestamp - now) / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? minutes + ':' + String(seconds % 60).padStart(2, '0') : waitLabel(minutes);
}

function minutesLabel(minutes) {
  if (minutes < 60) return minutes + ' mín.';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours + ' klst.' + (remainder ? ' og ' + remainder + ' mín.' : '');
}

function waitLabel(minutes) {
  return minutes > 0 ? 'Eftir ' + minutesLabel(minutes) : 'Núna';
}

function durationLabel(ride) {
  return ride?.arrival == null ? '—' : minutesLabel(Math.round((ride.arrival - ride.at) / minute));
}

function renderCountdown(now) {
  const node = byId('countdown');
  const value = countdown(featured?.at, now);
  if (node.textContent !== value) node.textContent = value;
  node.classList.toggle('countdown-long', value.startsWith('Eftir '));
  const leg = featured?.connection.legs[0];
  if (main) naerkort.update(featured && {route: leg.number, board: leg.board, at: featured.at, key: featured.key,
    lat: featured.lat, lng: featured.lng});
}

function element(tag, value, classes) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (classes) node.className = classes;
  return node;
}

function routesFor(connection) {
  const group = element('span', '', 'route-group');
  for (const leg of connection.legs) {
    if (group.children.length) group.append(element('span', '→'));
    group.append(element('span', leg.number, 'route route-' + leg.number));
  }
  return group;
}

function choiceButton(ride, label, className) {
  const button = element('button', '', className);
  button.type = 'button';
  button.dataset.ride = ride.key;
  button.setAttribute('aria-pressed', String(ride.key === featured?.key));
  button.setAttribute('aria-label', label + ', brottför klukkan ' + timestring(ride.at));
  return button;
}

function transferNote(ride) {
  const wait = ride.wait + ' mín. í skipti';
  return ride.wait < 5 ? wait + ' · tæp skipti' : wait;
}

function renderRows(id, rides, showRoutes, now) {
  const rows = rides.map(ride => {
    const row = element('tr', '', ride.key === featured?.key ? 'ride-row is-chosen' : 'ride-row');
    const service = element('td', '');
    const minutes = Math.ceil((ride.at - now) / minute);
    const wait = waitLabel(minutes);
    const button = choiceButton(ride, ride.connection.label, 'board-ride-button');
    if (showRoutes) {
      button.append(routesFor(ride.connection));
      if (id === 'rides') button.append(element('span', ride.connection.from, 'meta'));
    }
    else button.textContent = wait;
    service.append(button);
    const departure = element('td', '');
    departure.append(element('span', timestring(ride.at), 'time'));
    if (showRoutes) departure.append(element('span', wait, 'meta'));
    if (ride.transfer) departure.append(element('span', 'Skipti kl. ' + timestring(ride.transfer) + ' · ' + transferNote(ride), 'meta'));
    if (ride.missingTime) departure.append(element('span', 'Skipti óviss', 'meta'));
    const arrival = element('td', '');
    arrival.append(element('span', timestring(ride?.arrival), 'time'));
    if (id === 'rides') arrival.append(element('span', ride.connection.label.split(' → ').at(-1), 'meta'));
    const duration = element('td', '', 'station-duration');
    duration.append(element('span', durationLabel(ride), 'ride-duration'));
    row.append(service, departure, duration, arrival);
    return row;
  });
  if (!rows.length) {
    const row = element('tr', '');
    const cell = element('td', predictions ? 'Engar ferðir í boði.' : 'Næ ekki sambandi við Strætó.');
    cell.colSpan = 4;
    row.append(cell);
    rows.push(row);
  }
  byId(id).replaceChildren(...rows);
}

function renderCards(choices) {
  const cards = choices.map(ride => {
    const {connection} = ride;
    const card = choiceButton(ride, connection.label, 'preview');
    if (ride.arrival != null) {
      card.setAttribute('aria-label', card.getAttribute('aria-label') +
        ', ferðatími ' + durationLabel(ride) + ', koma klukkan ' + timestring(ride.arrival));
    }
    const times = element('span', '', 'preview-times');
    const departure = element('span', '', 'preview-column');
    departure.append(element('span', 'Brottför', 'meta'), element('span', timestring(ride.at), 'preview-time'));
    const arrival = element('span', '', 'preview-column');
    arrival.append(element('span', 'Koma', 'meta'), element('span', timestring(ride.arrival), 'preview-time'));
    const duration = element('span', durationLabel(ride), 'ride-duration preview-duration');
    times.append(departure, duration, arrival);
    card.append(routesFor(connection), element('span', connection.label, 'preview-headsign'), times);
    if (ride.transfer) card.append(element('span', transferNote(ride), 'meta preview-note'));
    if (ride.missingTime) card.append(element('span', 'Skipti óviss', 'meta preview-note'));
    return card;
  });
  const message = predictions ? 'Engar ferðir í boði.' : 'Næ ekki sambandi við Strætó.';
  byId('rides').replaceChildren(...(cards.length ? cards : [element('p', message)]));
}

function rankAlternatives(rides) {
  const byDeparture = [...rides].sort((a, b) => a.at - b.at);
  if (!limitWalking) return byDeparture;
  const preferred = ['library', 'transfer'].flatMap(key => {
    const next = byDeparture.find(ride => ride.connection.key === key);
    return next ? [next] : [];
  });
  return [...preferred, ...byDeparture.filter(ride => !preferred.includes(ride))];
}

function render(now) {
  const groups = connections.map(connection => predictions ? ridesFor(connection, predictions, now) : []);
  const [direct, ...other] = groups;
  const allRides = groups.flat();
  const chosen = allRides.find(ride => ride.key === selected);
  if (predictions && !chosen) selected = null;
  featured = chosen ?? direct[0] ?? other.flat().sort((a, b) => a.at - b.at)[0];
  const connection = featured?.connection ?? connections[0];
  nextExpiry = Math.min(...groups.flatMap(rides => rides.length ? [rides[0].at + minute] : []));
  byId('chosen-route').replaceChildren(routesFor(connection));
  byId('origin').textContent = connection.from;
  renderCountdown(now);
  byId('departure').textContent = timestring(featured?.at);
  byId('arrival-label').textContent = connection.to;
  byId('duration').textContent = durationLabel(featured);
  byId('arrival').textContent = timestring(featured?.arrival);
  commuteStatus.showTime(featured);
  const fromKringlan = connection.from === 'Kringlan';
  nextRide = fromKringlan ? undefined : direct[0];
  const nextRideButton = byId('next-ride');
  nextRideButton.hidden = !nextRide || nextRide.key === featured?.key;
  // Frá Kringlunni: örvar fram og aftur milli ferða þaðan (3 og 6) í tímaröð.
  const kringlan = allRides.filter(ride => ride.connection.from === 'Kringlan')
    .sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
  const position = kringlan.findIndex(ride => ride.key === featured?.key);
  previousKringlan = fromKringlan ? kringlan[position - 1] : undefined;
  nextKringlan = fromKringlan ? kringlan[position + 1] : undefined;
  byId('kringlan-stepper').hidden = !fromKringlan;
  byId('kringlan-prev').disabled = !previousKringlan;
  byId('kringlan-next').disabled = !nextKringlan;
  const transfer = byId('transfer');
  transfer.hidden = !featured?.transfer && !featured?.missingTime;
  transfer.textContent = featured?.missingTime ? 'Skipti á Skeggjagötu óviss · ' + featured.missingTime :
    featured?.transfer ? 'Skeggjagata · 13 kl. ' + timestring(featured.transfer) + ' · ' + transferNote(featured) : '';
  const active = document.activeElement?.dataset.ride;
  const link = byId(main ? 'all-rides' : 'back-home');
  const path = main ? heimRoot + 'fleiri-ferdir/' : heimRoot;
  link.href = selected ? path + '?' + new URLSearchParams({ferd: selected}) : path;
  renderRows('next-direct', direct.slice(0, 2), true, now);
  renderRows('direct-rides', direct.slice(2, 5), false, now);
  if (main) {
    renderCards(rankAlternatives(other.flat()).slice(0, 4));
  } else {
    renderRows('rides', rankAlternatives(other.flatMap(rides => rides.slice(0, 2))), true, now);
  }
  if (active) {
    [...document.querySelectorAll('[data-ride]')].find(button => button.dataset.ride === active)?.focus({preventScroll: true});
  }
}

async function refresh() {
  request?.abort();
  const controller = new AbortController();
  request = controller;
  const stops = [...new Set(connections.flatMap(connection => connection.legs.flatMap(leg => [leg.board, leg.exit])))];
  const query = '{' + stops.map(id => 's' + id + ':BusLocationByStop(stopId:"' + id +
    '"){arrivals{arrival routeNr headsign lat lng trip{id}}}').join(' ') + '}';
  const timeout = setTimeout(() => controller.abort(), 8000);
  let data;
  try {
    const response = await fetch('https://api.straeto.is/graphql', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.signal,
      body: JSON.stringify({query})
    });
    if (response.ok) ({data} = await response.json());
  } catch {
    // The board will retry automatically.
  } finally {
    clearTimeout(timeout);
  }
  if (request !== controller) return;
  const validStops = stops.filter(id => Array.isArray(data?.['s' + id]?.arrivals));
  predictions = validStops.length ? Object.fromEntries(validStops.map(id => ['s' + id, data['s' + id]])) : undefined;
  commuteStatus.recordRefresh(validStops.length === stops.length ? 'ok' : validStops.length ? 'partial' : 'failed');
  render(Date.now());
}

for (const id of ['next-direct', 'rides', 'direct-rides']) {
  byId(id).addEventListener('click', event => {
    const button = event.target.closest('[data-ride]') ?? event.target.closest('tr')?.querySelector('[data-ride]');
    if (!button) return;
    selected = button.dataset.ride;
    render(Date.now());
  });
}
const walkButtons = document.querySelectorAll('[data-walk-mode]');
function renderWalkMode() {
  walkButtons.forEach(button => {
    button.setAttribute('aria-pressed', String((button.dataset.walkMode === 'less') === limitWalking));
  });
}

renderWalkMode();
walkButtons.forEach(button => {
  button.addEventListener('click', () => {
    const nextPreference = button.dataset.walkMode === 'less';
    if (nextPreference === limitWalking) return;
    limitWalking = nextPreference;
    renderWalkMode();
    try {
      localStorage.setItem(walkPreference, String(limitWalking));
    } catch {
      // The choice remains active for this page.
    }
    if (predictions) render(Date.now());
  });
});

byId('refresh').addEventListener('click', refresh);
byId('next-ride').addEventListener('click', () => {
  selected = nextRide?.key ?? null;
  render(Date.now());
});
for (const [id, step] of [['kringlan-prev', () => previousKringlan], ['kringlan-next', () => nextKringlan]]) {
  byId(id).addEventListener('click', () => {
    const ride = step();
    if (!ride) return;
    selected = ride.key;
    render(Date.now());
  });
}
setInterval(() => {
  const now = Date.now();
  commuteStatus.paintFeed(now);
  if (now >= nextExpiry) render(now);
  else renderCountdown(now);
}, 1000);
setInterval(() => { if (!document.hidden) refresh(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
refresh();
