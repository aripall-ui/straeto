'use strict';

// Rót vefsins, svo slóðir virki líka þegar hann er hýstur í undirmöppu (t.d. GitHub Pages).
const appRoot = new URL('./', document.currentScript.src).href;

const routes = {
  '13': {board: '90000179', exit: '90000083', sign: 'Sléttuvegur', to: 'RÚV'},
  '1': {board: '90000296', exit: '90000015', sign: 'Hfj. Skarðshlíð', to: 'Kringlumýrar\u00adbraut'},
  '3': {board: '90000296', exit: '90000461', sign: 'Sel/Fell', to: 'Kringlan'},
  '6': {board: '90000882', exit: '90000461', sign: 'Egilshöll', to: 'Kringlan'}
};
const alternativeRoutes = ['1', '3', '6'];
const mainPage = document.body.dataset.view === 'main';
const byId = id => document.getElementById(id);

const clock = new Intl.DateTimeFormat('is-IS', {
  timeZone: 'Atlantic/Reykjavik', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const clockWithSeconds = new Intl.DateTimeFormat('is-IS', {
  timeZone: 'Atlantic/Reykjavik', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
const minute = 60000;
const day = 1440 * minute;
const sixAM = 6 * 60 * minute;
let trips = {};
let unavailable = new Set();
let request;
let selectedRide = mainPage ? null : new URLSearchParams(window.location.search).get('ferd');
let timetable;
let boardRide;
let nextBoardChange = Infinity;
let universitySteps = [];
let savedBoard;
let serviceWindows;
let planCleanupDate;
let planNoticeTimer;
const removedForSession = new Set();
const savedPredictions = new Map();
const sortKey = 'i-vinnuna-trip-sort';
const stopOrder = new Intl.Collator('is-IS');
const stepCountFormat = new Intl.NumberFormat('is-IS');
const walkingStepsPerMinute = 100;
let tripSort = 'departure';
try {
  const savedSort = localStorage.getItem(sortKey);
  if (savedSort === 'arrival' || savedSort === 'stop') tripSort = savedSort;
} catch {
  // Departure order is available without browser storage.
}

function secondsOfDay(value) {
  const parts = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  return parts && Number(parts[1]) < 48 ? Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3] ?? 0) : null;
}

function scheduledTimes(schedule, number, tripId, predicted) {
  const departures = schedule?.routes?.[number]?.[tripId];
  if (!departures) return null;
  const predictionDay = Math.floor(predicted / day);
  let best = null;
  for (const [seconds, service, exitSeconds] of departures) {
    for (let serviceDay = predictionDay - 2; serviceDay <= predictionDay + 1; serviceDay++) {
      if (!schedule.services[service]?.includes(serviceDay)) continue;
      const start = serviceDay * day;
      const departure = start + seconds * 1000;
      const difference = (predicted - departure) / 1000;
      if (Math.abs(difference) >= 21600 || (best && Math.abs(difference) >= Math.abs(best.difference))) continue;
      best = {departure, difference, arrival: exitSeconds == null ? null : start + exitSeconds * 1000};
    }
  }
  return best;
}

async function loadTimetable(signal) {
  if (timetable) return timetable;
  try {
    const response = await fetch(appRoot + 'timetable.json', {signal});
    if (response.ok) timetable = await response.json();
  } catch {
    // The board can still display predictions while the timetable is unavailable.
  }
  return timetable;
}

function buildTrips(number, boardingRows, arrivalRows, now, schedule) {
  const route = routes[number];
  const midnight = Math.floor(now / day) * day;
  const matches = row => String(row.routeNr) === number && row.headsign?.trim() === route.sign;
  const arrivals = new Map();
  for (const row of arrivalRows.filter(matches)) {
    if (row.trip?.id != null) arrivals.set(row.trip.id, secondsOfDay(row.arrival));
  }
  return boardingRows.filter(matches).flatMap(row => {
    const departureSecond = secondsOfDay(row.arrival);
    if (departureSecond === null) return [];
    let at = midnight + departureSecond * 1000;
    if (departureSecond < 86400 && at < now - 360 * minute) at += day;
    if (at > now + 1380 * minute && at - day > now - minute) at -= day;
    if (at <= now - minute) return [];
    const arrivalSecond = arrivals.get(row.trip?.id);
    const offset = arrivalSecond == null ? null : (arrivalSecond - departureSecond + 86400) % 86400;
    let arrival = offset !== null && offset <= 7200 ? at + offset * 1000 : null;
    const scheduled = scheduledTimes(schedule, number, row.trip?.id, at);
    const difference = scheduled?.difference;
    let estimatedArrival = false;
    if (scheduled?.arrival != null) {
      // The stop feed can still return the timetable time at the destination.
      const unchangedArrival = arrival !== null && Math.floor(arrival / minute) === Math.floor(scheduled.arrival / minute);
      if (arrival === null || (difference > 0 && unchangedArrival)) {
        arrival = scheduled.arrival + difference * 1000;
        estimatedArrival = true;
      }
    }
    return [{number, at, arrival, estimatedArrival, difference, plannedDeparture: scheduled?.departure,
      key: String(row.trip?.id ?? at), lat: row.lat, lng: row.lng}];
  }).sort((a, b) => a.at - b.at);
}

function countdown(delta) {
  if (delta <= 0) return 'Núna';
  const seconds = Math.ceil(delta / 1000);
  const pad = value => String(value).padStart(2, '0');
  const mins = Math.floor(seconds / 60);
  return mins < 60 ? mins + ':' + pad(seconds % 60)
    : Math.floor(mins / 60) + ':' + pad(mins % 60) + ':' + pad(seconds % 60);
}

function upcoming(number, now) {
  return (trips[number] ?? []).filter(trip => trip.at > now - minute);
}

function element(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function formatTime(time) {
  return time === null || time === undefined ? '—' : clock.format(time);
}

function arrivalLabel(trip) {
  return (trip?.estimatedArrival ? '≈' : '') + formatTime(trip?.arrival);
}

function showDeparture(container, trip) {
  const actual = formatTime(trip?.at);
  if (!(trip?.difference > 0)) {
    container.textContent = actual;
    return;
  }
  const planned = formatTime(trip.plannedDeparture);
  const exact = planned === actual;
  const times = element('span', '', 'departure-times');
  const original = element('del', exact ? clockWithSeconds.format(trip.plannedDeparture) : planned);
  original.setAttribute('aria-label', 'Samkvæmt áætlun ' + original.textContent);
  const revised = element('span', exact ? clockWithSeconds.format(trip.at) : actual);
  revised.setAttribute('aria-label', 'Nýr brottfarartími ' + revised.textContent);
  times.append(original, revised);
  container.replaceChildren(times);
}

function showDifference(container, difference) {
  if (difference) {
    const late = difference > 0;
    container.append(element('span', countdown(Math.abs(difference) * 1000) + ' mín ' + (late ? 'seinn' : 'snemma'),
      'timing ' + (late ? 'timing-late' : 'timing-early')));
  }
}

function emptyRow(message) {
  const row = document.createElement('tr');
  const cell = element('td', message);
  cell.colSpan = 3;
  row.append(cell);
  return row;
}

function routeBadge(number) {
  return element('span', number, 'route route-' + number);
}

function waitLabel(trip, now) {
  const minutes = Math.ceil((trip.at - now) / minute);
  return minutes > 0 ? 'Eftir ' + minutes + ' mín.' : 'Núna';
}

function renderFeatured(trip, now) {
  showDeparture(byId('departure'), trip);
  commuteStatus.showTime(trip, timetable);
  if (trip?.fromTimetable) {
    const source = byId('commute-time-source');
    source.textContent = 'Samkvæmt áætlun' + (trip.arrival == null ? ' · Komutími óþekktur' : '');
  }
  const timing = byId('countdown-timing');
  timing.replaceChildren();
  showDifference(timing, trip?.difference);
  byId('arrival').textContent = arrivalLabel(trip);
  byId('arrival-label').textContent = trip?.number === '1' ? 'Koma á ' + routes['1'].to
    : trip?.number === '3' || trip?.number === '6' ? 'Koma í Kringluna'
    : trip || mainPage ? 'Koma á RÚV' : 'Koma';
  updateCountdown(trip, now);
}

function serviceState(now) {
  const date = morningPlan.today(now);
  const dayNumber = Math.floor(now / day);
  const defaultMorningStart = dayNumber * day + sixAM;
  if (!timetable || (timetable.lastDay != null && dayNumber > timetable.lastDay)) {
    return {closed: false, boundary: Infinity, morningStart: defaultMorningStart};
  }
  if (serviceWindows?.day !== date) {
    const windows = [-day, 0, day].flatMap(offset => {
      const date = morningPlan.today(now + offset);
      const rides = morningPlan.timetableRides(timetable, date, true);
      if (!rides.length) return [];
      const firstDeparture = rides[0].at;
      return [{date, firstDeparture, start: firstDeparture - 30 * minute, end: rides.at(-1).at + minute}];
    });
    serviceWindows = {day: date, windows};
  }
  const windows = serviceWindows.windows;
  const firstDeparture = windows.find(window => window.date === date)?.firstDeparture ?? Infinity;
  const morningStart = Math.min(defaultMorningStart, firstDeparture);
  if (!windows.length) return {closed: false, boundary: Infinity, morningStart};
  const running = windows.find(window => now >= window.start && now < window.end);
  const next = windows.find(window => window.start > now);
  // Cover a real departure delayed beyond the published end of service.
  const nearby = Object.values(trips).flat().filter(ride => ride.at >= now && ride.at <= now + 30 * minute);
  if (running) return {closed: false, boundary: running.end, morningStart};
  if (nearby.length) return {closed: false, boundary: Math.max(...nearby.map(ride => ride.at)) + 1, morningStart};
  return {closed: true, date: next?.date ?? morningPlan.planDate(now), morningStart,
    boundary: Math.min(next?.start ?? Infinity, (dayNumber + 1) * day)};
}

function announceDeparted(count) {
  if (!count) return;
  const notice = byId('departed-trips');
  notice.textContent = count === 1 ? 'Ein ferð er farin og hefur verið tekin af listanum.'
    : count + ' ferðir eru farnar og hafa verið teknar af listanum.';
  clearTimeout(planNoticeTimer);
  planNoticeTimer = setTimeout(() => { notice.textContent = ''; }, 6500);
}

function currentSavedRides(now, service) {
  const today = morningPlan.today(now);
  let removedCount = 0;
  if (planCleanupDate !== today) {
    if (planCleanupDate) {
      savedPredictions.clear();
      removedForSession.clear();
    }
    planCleanupDate = today;
    try {
      removedCount = morningPlan.clearPast(today);
    } catch {
      // Old days are ignored even when browser storage is unavailable.
    }
  }
  const plan = morningPlan.read(today, timetable);
  const future = [];
  const departed = [];
  for (const ride of plan?.rides ?? []) {
    const key = morningPlan.tripKey(ride);
    if (removedForSession.has(key)) continue;
    const live = (trips[ride.number] ?? []).find(candidate =>
      candidate.key === ride.key && candidate.plannedDeparture === ride.at);
    if (live) savedPredictions.set(key, live);
    const displayRide = live ?? savedPredictions.get(key) ?? {...ride, fromTimetable: true};
    if (displayRide.at <= now) {
      departed.push(ride);
      savedPredictions.delete(key);
    } else {
      future.push(displayRide);
    }
  }
  if (departed.length) {
    try {
      morningPlan.removeRides(today, departed);
    } catch {
      for (const ride of departed) removedForSession.add(morningPlan.tripKey(ride));
    }
  }
  announceDeparted(removedCount + departed.length);
  if (future.length) return {date: today, plan, rides: future, morning: now >= service.morningStart};

  const nextDate = service.closed ? service.date : morningPlan.planDate(now);
  if (nextDate === today) return;
  const upcoming = morningPlan.read(nextDate, timetable);
  if (upcoming?.rides.length && (service.closed || !upcoming.recurring)) {
    const rides = upcoming.rides.map(ride => ({...ride, fromTimetable: true}));
    return {date: nextDate, plan: upcoming, rides, morning: false};
  }
}

function plannedKey(ride) {
  return morningPlan.tripKey({...ride, at: ride.plannedDeparture ?? ride.at});
}

function removeTripButton(ride) {
  const label = 'Fjarlægja leið ' + ride.number + ' klukkan ' + formatTime(ride.at);
  const button = element('button', '×', 'saved-ride-remove');
  button.type = 'button';
  button.dataset.planRemove = plannedKey(ride);
  button.setAttribute('aria-label', label);
  button.title = label;
  return button;
}

function tripMetric(label, value, detail) {
  const field = element('div', '');
  const description = element('dd', value);
  if (detail) description.append(element('small', detail));
  field.append(element('dt', label), description);
  return field;
}

function lateForWork(minutes) {
  return 'Ath. ' + minutes + ' mín. seinn í vinnu';
}

function renderSavedSummary(ride, {plan, date, morning, rides}) {
  const summary = byId('saved-morning-main');
  const route = morningPlan.routes[ride.number];
  const times = morningPlan.journeyTimes(ride, plan);
  const header = element('div', '', 'saved-ride-head');
  const title = element('h3', route.from);
  title.id = 'saved-ride-title';
  title.tabIndex = -1;
  const journey = element('div', '', 'saved-morning-main-origin');
  journey.append(routeBadge(ride.number), title);
  header.append(journey, removeTripButton(ride));

  const overview = element('dl', '', 'saved-ride-overview');
  const departureTime = formatTime(ride.at);
  const departure = tripMetric('Brottför', departureTime);
  const workArrival = tripMetric('Í vinnu', (ride.estimatedArrival ? '≈' : '') + formatTime(times.workArrival));
  overview.append(departure);
  if (morning) {
    overview.classList.add('saved-ride-overview-morning');
    const timer = element('span', '');
    timer.id = 'saved-departure-countdown';
    timer.dataset.departure = ride.at;
    timer.setAttribute('role', 'timer');
    departure.querySelector('dd').replaceChildren(timer, element('span', 'kl. ' + departureTime, 'saved-departure-time'));
  } else {
    overview.append(workArrival);
  }

  const trip = element('dl', '', 'saved-ride-details');
  if (morning) trip.classList.add('saved-ride-details-morning');
  const walkingMinutes = times.homeWalk + times.workWalk;
  const walking = tripMetric('Ganga alls', walkingMinutes + ' mín.',
    times.homeWalk + ' mín. fyrir · ' + times.workWalk + ' mín. eftir');
  const stepCount = stepCountFormat.formatToParts(walkingMinutes * walkingStepsPerMinute)
    .map(part => part.type === 'group' ? '.' : part.value).join('');
  const steps = element('small', 'Um ' + stepCount + ' skref', 'saved-ride-steps');
  walking.querySelector('dd').append(steps);
  trip.append(tripMetric('Á fætur', formatTime(times.wake), morningPlan.readyMinutes + ' mín. til að gera sig til'),
    tripMetric('Út úr húsi', formatTime(times.leave), times.homeWalk + ' mín. að stoppinu'),
    tripMetric('Í vagninum', times.onBus == null ? '—' : times.onBus + ' mín.'));
  if (morning) trip.append(workArrival);
  trip.append(walking);

  const meta = element('div', '', 'saved-ride-meta');
  const destination = element('span', route.to, 'saved-ride-destination');
  if (ride.arrival != null) destination.textContent += ' kl. ' + arrivalLabel(ride);
  const source = element('span', ride.fromTimetable ? '' : 'Rauntími', 'saved-ride-source');
  if (ride.difference) {
    const planned = ride.difference > 0 ? 'Átti að fara ' + clockWithSeconds.format(ride.plannedDeparture) : '';
    source.textContent = planned;
    showDifference(source, ride.difference);
  }
  meta.append(destination, source);
  summary.replaceChildren(header, overview, trip, meta);
  const minutesLate = trip => morningPlan.late(morningPlan.workArrival(trip, plan.walking), date, plan.deadline);
  if (rides.some(minutesLate)) {
    const late = minutesLate(ride);
    summary.append(element('p', late ? lateForWork(late) : '', 'saved-ride-work-warning'));
  }
}

function showSavedSelection(ride, now) {
  const key = plannedKey(ride);
  for (const button of byId('saved-morning-rides').querySelectorAll('[data-plan-ride]')) {
    button.setAttribute('aria-pressed', String(button.dataset.planRide === key));
  }
  renderSavedSummary(ride, savedBoard);
  updateSavedCountdown(now);
  commuteWeather.show('night', ride.at);
}

function sortTrips(rides, plan) {
  const rank = ride => morningPlan.workArrival(ride, plan.walking) ?? Infinity;
  return [...rides].sort((a, b) => {
    if (tripSort === 'arrival') return (rank(a) - rank(b)) || a.at - b.at;
    if (tripSort === 'stop') {
      const origin = ride => morningPlan.routes[ride.number].from;
      return stopOrder.compare(origin(a), origin(b)) || a.at - b.at;
    }
    return a.at - b.at;
  });
}

function renderSavedRides(now, mainRide, sortedRides) {
  const section = byId('saved-morning');
  const {date, plan} = savedBoard;
  byId('saved-morning-heading').textContent = date === morningPlan.today(now)
    ? 'Mínar ferðir í dag' : 'Mínar ferðir í fyrramálið';
  byId('edit-morning-plan').href = appRoot + 'undirbua-morguninn/?' + new URLSearchParams({dagur: date});
  byId('saved-morning-date').textContent = morningPlan.dateLabel(date) +
    (plan.recurring ? ' · Venjulega planið' : '') +
    (plan.deadline ? ' · Mæta fyrir ' + plan.deadline : '');
  const missing = byId('saved-morning-missing');
  missing.hidden = !plan.missing?.length;
  missing.textContent = (plan.missing ?? []).map(slot => 'Leið ' + slot.number + ' kl. ' +
    morningPlan.slotTime(date, slot) + ' er ekki á áætlun þann dag.').join(' ');

  const focused = document.activeElement;
  const focusKey = focused?.dataset.planRide ?? focused?.dataset.planRemove;
  const sort = byId('saved-ride-sort');
  sort.hidden = sortedRides.length < 2;
  for (const button of sort.querySelectorAll('[data-plan-sort]')) {
    button.setAttribute('aria-pressed', String(button.dataset.planSort === tripSort));
  }

  const rows = sortedRides.map(ride => {
    const row = element('div', '', 'saved-ride-row');
    const select = element('button', '', 'plan-ride');
    select.type = 'button';
    select.dataset.planRide = plannedKey(ride);
    const route = morningPlan.routes[ride.number];
    const journey = element('span', route.from, 'saved-ride-journey');
    const details = element('small', route.to, 'plan-detail');
    const mainLabel = element('span', 'Aðalferð', 'saved-ride-main-label');
    mainLabel.setAttribute('aria-hidden', 'true');
    details.append(mainLabel);
    journey.append(details);
    const departure = formatTime(ride.at);
    const timing = element('span', '', 'saved-ride-row-times');
    timing.append(element('span', departure, 'saved-ride-departure'));
    const arrival = morningPlan.workArrival(ride, plan.walking);
    let label = 'Sýna leið ' + ride.number + ' klukkan ' + departure;
    if (arrival !== null) {
      const arrivalText = 'Í vinnu ' + (ride.estimatedArrival ? '≈' : '') + formatTime(arrival);
      timing.append(element('small', arrivalText, 'plan-detail'));
      label += '. ' + arrivalText;
    }
    const late = morningPlan.late(arrival, date, plan.deadline);
    if (late) {
      const warning = lateForWork(late);
      timing.append(element('small', warning, 'plan-detail saved-ride-row-late'));
      label += '. ' + warning;
    }
    select.setAttribute('aria-label', label);
    select.append(routeBadge(ride.number), journey, timing);
    row.append(select, removeTripButton(ride));
    return row;
  });
  byId('saved-morning-rides').replaceChildren(...rows);
  showSavedSelection(mainRide, now);
  if (focused?.id === 'saved-ride-title') byId('saved-ride-title').focus({preventScroll: true});
  else if (focusKey) {
    const controls = section.querySelectorAll(focused.dataset.planRide ? '[data-plan-ride]' : '[data-plan-remove]');
    const target = [...controls].find(button => (button.dataset.planRide ?? button.dataset.planRemove) === focusKey);
    (target ?? byId('saved-ride-title')).focus({preventScroll: true});
  }
}

function renderPrimary(now) {
  const service = serviceState(now);
  savedBoard = currentSavedRides(now, service);
  for (const id of ['departures-board', 'alternatives-board', 'commute-feed']) {
    byId(id).hidden = service.closed || Boolean(savedBoard);
  }
  byId('refresh').hidden = service.closed && !savedBoard?.morning;
  byId('night-board').hidden = !service.closed || Boolean(savedBoard);
  byId('saved-morning').hidden = !savedBoard;

  if (savedBoard) {
    const {date, plan, rides} = savedBoard;
    const sorted = sortTrips(rides, plan);
    const preferred = morningPlan.preferred(date);
    const firstDeparture = rides.reduce((first, ride) => ride.at < first.at ? ride : first);
    const mainRide = rides.find(ride => plannedKey(ride) === preferred) ?? firstDeparture;
    boardRide = undefined;
    selectedRide = null;
    const morningChange = date === morningPlan.today(now) && now < service.morningStart
      ? service.morningStart : Infinity;
    nextBoardChange = Math.min(service.boundary, morningChange, (Math.floor(now / day) + 1) * day,
      ...rides.map(ride => ride.at));
    renderSavedRides(now, mainRide, sorted);
    return;
  }

  if (service.closed) {
    boardRide = undefined;
    selectedRide = null;
    nextBoardChange = service.boundary;
    commuteWeather.show();
    return;
  }

  const local = upcoming('13', now).filter(ride => ride.at >= now);
  const university = alternativeRoutes.map(number => upcoming(number, now));
  const preview = university.flatMap(rides => rides.slice(0, 1)).sort((a, b) => a.at - b.at);
  const chosen = [...local, ...university.flat()].find(trip => rideKey(trip) === selectedRide && trip.at >= now);
  boardRide = chosen ?? local[0];
  selectedRide = rideKey(chosen);
  updateBoardExpiry([local[0], boardRide, ...preview]);
  nextBoardChange = Math.min(nextBoardChange, service.boundary, (Math.floor(now / day) + 1) * day,
    boardRide ? boardRide.at + 1 : Infinity, local[0] ? local[0].at + 1 : Infinity);
  renderFeatured(boardRide, now);
  commuteWeather.show('day', boardRide?.at ?? now);

  const number = boardRide?.number ?? '13';
  const badge = byId('main-route');
  if (badge.textContent !== number) {
    badge.textContent = number;
    badge.className = 'route route-' + number;
    const origin = number === '13' ? 'Ásvallagata' : 'Háskóli Íslands';
    byId('stop').textContent = origin + ' → ' + routes[number].sign;
  }
  byId('ride-label').textContent = chosen ? 'Valin ferð' : 'Næsti vagn';
  // Frá HÍ (1 og 3 frá HÍ B, 6 frá HÍ C): örvar fram og aftur milli ferða þaðan í tímaröð.
  const fromUniversity = boardRide && boardRide.number !== '13';
  const universityRides = university.flat().sort((a, b) => a.at - b.at || rideKey(a).localeCompare(rideKey(b)));
  const position = universityRides.findIndex(trip => rideKey(trip) === selectedRide);
  universitySteps = fromUniversity ? [universityRides[position - 1], universityRides[position + 1]] : [];
  byId('hi-stepper').hidden = !fromUniversity;
  byId('next-ride').hidden = !chosen || fromUniversity;
  byId('hi-prev').disabled = !universitySteps[0];
  byId('hi-next').disabled = !universitySteps[1];
  byId('all-rides').href = chosen ? appRoot + 'a-hradferd/?' + new URLSearchParams({ferd: selectedRide}) : appRoot + 'a-hradferd/';
  renderRideRows('primary', local.slice(0, 5), now, unavailable.has('13'));
  renderPreview(preview);
}

function updateCountdown(featured, now) {
  const value = featured ? countdown(featured.at - now) : '–:––';
  const display = byId('countdown');
  if (display.textContent !== value) display.textContent = value;
  if (mainPage) naerkort.update(featured && {route: featured.number, board: routes[featured.number].board,
    at: featured.at, key: rideKey(featured), lat: featured.lat, lng: featured.lng});
}

function updateSavedCountdown(now) {
  const timer = byId('saved-departure-countdown');
  if (!timer) return;
  const text = countdown(Number(timer.dataset.departure) - now);
  if (timer.textContent !== text) timer.textContent = text;
}


function renderPreview(next) {
  const container = byId('alternatives');
  const focused = document.activeElement?.dataset.ride;
  let focusTarget;
  const message = alternativeRoutes.some(number => unavailable.has(number))
    ? 'Tímar frá Strætó liggja ekki fyrir.' : 'Engar ferðir í boði.';
  const cards = next.map(trip => {
    const card = element('button', '', 'preview');
    const key = rideKey(trip);
    card.type = 'button';
    card.dataset.ride = key;
    card.setAttribute('aria-pressed', String(key === selectedRide));
    if (key === focused) focusTarget = card;
    const times = element('span', '', 'preview-times');
    const route = routes[trip.number];
    const departure = element('span', '', 'preview-column');
    const departureTime = element('span', '', 'preview-time');
    showDeparture(departureTime, trip);
    const mini = element('strong', '', 'plan-mini');
    mini.dataset.planCountdown = trip.at;
    departure.append(mini, element('span', 'Brottför', 'meta'), departureTime);
    showDifference(departure, trip.difference);
    const arrival = element('span', '', 'preview-column');
    arrival.append(element('span', 'Koma', 'meta'), element('span', arrivalLabel(trip), 'preview-time'),
      element('span', route.to, 'preview-destination'));
    times.append(departure, arrival);
    card.append(routeBadge(trip.number), element('span', route.sign, 'preview-headsign'), times);
    return card;
  });
  container.replaceChildren(...(cards.length ? cards : [element('p', message)]));
  focusTarget?.focus({preventScroll: true});
}

function rideKey(trip) {
  return trip ? trip.number + ':' + trip.key : null;
}

function renderRideRows(id, rides, now, offline, empty = 'Engar ferðir í boði.') {
  const container = byId(id);
  const waitInFirstColumn = id === 'primary';
  const focused = document.activeElement?.dataset.ride;
  let focusTarget;
  const rows = rides.map(trip => {
    const route = routes[trip.number];
    const row = document.createElement('tr');
    const service = document.createElement('td');
    const key = rideKey(trip);
    const chosen = key === (waitInFirstColumn ? rideKey(boardRide) : selectedRide);
    row.className = chosen ? 'ride-row is-chosen' : 'ride-row';
    const button = element('button', '', 'board-ride-button');
    button.type = 'button';
    button.dataset.ride = key;
    button.setAttribute('aria-label', 'Leið ' + trip.number + ', brottför klukkan ' + formatTime(trip.at));
    button.setAttribute('aria-pressed', String(chosen));
    const wait = waitLabel(trip, now);
    if (waitInFirstColumn) button.textContent = trip === rides[0] ? 'Næsti 13 · ' + wait : wait;
    else button.append(routeBadge(trip.number), element('span', route.sign, 'meta'));
    service.append(button);
    if (key === focused) focusTarget = button;
    const departure = document.createElement('td');
    const departureTime = element('span', '', 'time');
    showDeparture(departureTime, trip);
    departure.append(departureTime);
    if (!waitInFirstColumn) departure.append(element('span', wait, 'meta'));
    showDifference(departure, trip.difference);
    const arrival = document.createElement('td');
    arrival.append(element('span', arrivalLabel(trip), 'time'), element('span', route.to, 'meta destination'));
    row.append(service, departure, arrival);
    return row;
  });
  const message = offline ? 'Tímar frá Strætó liggja ekki fyrir.' : empty;
  container.replaceChildren(...(rows.length ? rows : [emptyRow(message)]));
  focusTarget?.focus({preventScroll: true});
}

function updateBoardExpiry(rides) {
  nextBoardChange = Math.min(...rides.filter(Boolean).map(trip => trip.at + minute));
}

function renderSelectionBoard(now) {
  const local = upcoming('13', now);
  const university = alternativeRoutes.map(number => upcoming(number, now));
  const localRows = local.slice(0, 1);
  const laterLocalRows = local.slice(1, 5);
  const universityRows = university.flatMap(rides => rides.slice(0, 2)).sort((a, b) => a.at - b.at);
  const chosen = [...local, ...university.flat()].find(trip => rideKey(trip) === selectedRide);
  boardRide = chosen ?? localRows[0] ?? universityRows[0];
  selectedRide = rideKey(boardRide);
  updateBoardExpiry([...localRows, ...universityRows, ...laterLocalRows, boardRide]);
  renderFeatured(boardRide, now);
  const heading = byId('chosen-route');
  const route = boardRide && routes[boardRide.number];
  if (heading.dataset.number !== boardRide?.number) {
    heading.replaceChildren(...(route ? [routeBadge(boardRide.number), element('span', route.sign)] : []));
    heading.dataset.number = boardRide?.number ?? '';
  }
  renderRideRows('asvallagata-rides', localRows, now, unavailable.has('13'));
  renderRideRows('alternatives', universityRows, now, alternativeRoutes.some(number => unavailable.has(number)));
  renderRideRows('later-asvallagata-rides', laterLocalRows, now, unavailable.has('13'));
}

async function refresh() {
  request?.abort();
  const controller = new AbortController();
  request = controller;
  const numbers = ['13', ...alternativeRoutes];
  const stops = [...new Set(numbers.flatMap(number => [routes[number].board, routes[number].exit]))];
  const query = '{' + stops.map(id => 's' + id + ':BusLocationByStop(stopId:"' + id +
    '"){arrivals{arrival routeNr headsign lat lng trip{id}}}').join(' ') + '}';
  const timeout = setTimeout(() => controller.abort(), 8000);
  const nextTrips = {};
  const failed = new Set();
  let partial = false;
  const scheduleRequest = loadTimetable(controller.signal);
  try {
    const response = await fetch('https://api.straeto.is/graphql', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.signal,
      body: JSON.stringify({query})
    });
    if (!response.ok) throw new Error('Strætó request failed');
    const {data} = await response.json();
    const schedule = await scheduleRequest;
    for (const number of numbers) {
      const route = routes[number];
      const boarding = data?.['s' + route.board]?.arrivals;
      const arrivals = data?.['s' + route.exit]?.arrivals;
      if (!Array.isArray(arrivals)) partial = true;
      if (!Array.isArray(boarding)) failed.add(number);
      else nextTrips[number] = buildTrips(number, boarding, Array.isArray(arrivals) ? arrivals : [], Date.now(), schedule);
    }
  } catch {
    for (const number of numbers) failed.add(number);
  } finally {
    await scheduleRequest;
    clearTimeout(timeout);
  }
  if (request !== controller) return;
  trips = nextTrips;
  unavailable = failed;
  commuteStatus.recordRefresh(failed.size === numbers.length ? 'failed' : failed.size || partial ? 'partial' : 'ok');
  renderBoard(Date.now());
}

const renderBoard = mainPage ? renderPrimary : renderSelectionBoard;
const rideLists = mainPage ? ['primary', 'alternatives'] : ['asvallagata-rides', 'alternatives', 'later-asvallagata-rides'];
for (const id of rideLists) {
  byId(id).addEventListener('click', event => {
    const button = event.target.closest('[data-ride]') ?? event.target.closest('tr')?.querySelector('[data-ride]');
    if (!button) return;
    button.focus({preventScroll: true});
    selectedRide = button.dataset.ride;
    renderBoard(Date.now());
  });
}

byId('refresh').addEventListener('click', refresh);
if (mainPage) {
  byId('saved-ride-sort').addEventListener('click', event => {
    const button = event.target.closest('[data-plan-sort]');
    if (!button || !savedBoard) return;
    tripSort = button.dataset.planSort;
    try {
      localStorage.setItem(sortKey, tripSort);
    } catch {
      // Apply the sort for the current session when storage is unavailable.
    }
    renderBoard(Date.now());
  });
  byId('saved-morning').addEventListener('click', event => {
    const button = event.target.closest('[data-plan-ride], [data-plan-remove]');
    if (!button || !savedBoard) return;
    const key = button.dataset.planRide ?? button.dataset.planRemove;
    const ride = savedBoard.rides.find(trip => plannedKey(trip) === key);
    if (!ride) return;
    const date = savedBoard.date;
    const error = byId('saved-morning-error');
    try {
      if (button.dataset.planRemove) {
        morningPlan.removeRides(date, [{...ride, at: ride.plannedDeparture ?? ride.at}]);
        savedPredictions.delete(key);
      } else {
        morningPlan.setPreferred(date, key);
      }
      error.hidden = true;
    } catch {
      error.hidden = false;
      return;
    }
    const now = Date.now();
    if (button.dataset.planRide) {
      showSavedSelection(ride, now);
      return;
    }
    renderBoard(now);
    morgundagur.paint();
    const focus = savedBoard ? byId('saved-ride-title')
      : [byId('morgun-kort'), byId('morgun-flis')].find(link => !link.hidden) ?? document.querySelector('.att-val [aria-current]');
    focus.focus({preventScroll: true});
  });
  byId('next-ride').addEventListener('click', () => {
    selectedRide = null;
    renderBoard(Date.now());
    byId('primary').querySelector('button')?.focus({preventScroll: true});
  });
  ['hi-prev', 'hi-next'].forEach((id, step) => byId(id).addEventListener('click', () => {
    const trip = universitySteps[step];
    if (!trip) return;
    selectedRide = rideKey(trip);
    renderBoard(Date.now());
  }));
}
setInterval(() => {
  if (document.hidden) return;
  const now = Date.now();
  commuteStatus.paintFeed(now);
  if (now >= nextBoardChange) renderBoard(now);
  else if (savedBoard) updateSavedCountdown(now);
  else updateCountdown(boardRide, now);
}, 1000);
setInterval(() => { if (!document.hidden) refresh(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
refresh();
