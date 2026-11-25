'use strict';

const morningPlan = (() => {
  const minute = 60000;
  const day = 1440 * minute;
  const morningHour = 5;
  const readyMinutes = 40;
  const key = 'i-vinnuna-morning-plans';
  const weeklyKey = 'i-vinnuna-weekday-plan';
  const preferredKey = 'i-vinnuna-preferred-trip';
  const routes = {
    '13': {from: 'Ásvallagata', fromLabel: 'Frá Ásvallagötu', to: 'RÚV'},
    '1': {from: 'Háskóli Íslands B', fromLabel: 'Frá Háskóla Íslands B', to: 'Kringlumýrarbraut'},
    '3': {from: 'Háskóli Íslands B', fromLabel: 'Frá Háskóla Íslands B', to: 'Kringlan'},
    '6': {from: 'Háskóli Íslands C', fromLabel: 'Frá Háskóla Íslands C', to: 'Kringlan'}
  };
  const homeWalkDefaults = {'Ásvallagata': 5, 'Háskóli Íslands B': 15, 'Háskóli Íslands C': 15};
  const timeFormat = new Intl.DateTimeFormat('is-IS', {
    timeZone: 'Atlantic/Reykjavik', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const weekdays = ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur',
    'fimmtudagur', 'föstudagur', 'laugardagur'];
  const months = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní',
    'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
  const iso = timestamp => new Date(timestamp).toISOString().slice(0, 10);
  const today = now => iso(now);
  const planDate = now => iso(now + (now % day < morningHour * 60 * minute ? 0 : day));
  const time = timestamp => timestamp == null ? '—' : timeFormat.format(timestamp);
  function dateLabel(date) {
    const value = new Date(date);
    return weekdays[value.getUTCDay()] + ' ' + value.getUTCDate() + '. ' + months[value.getUTCMonth()];
  }

  function preferred(date) {
    try {
      const saved = JSON.parse(localStorage.getItem(preferredKey));
      return saved?.date === date ? saved.ride : undefined;
    } catch {
      return undefined;
    }
  }

  function setPreferred(date, ride) {
    localStorage.setItem(preferredKey, JSON.stringify({date, ride}));
  }
  const tripKey = trip => [trip.number, trip.key, trip.at].join(':');

  function readAll() {
    try {
      const plans = JSON.parse(localStorage.getItem(key));
      return plans && typeof plans === 'object' && !Array.isArray(plans) ? plans : {};
    } catch {
      return {};
    }
  }

  function weekdayPlan() {
    try {
      const weekly = JSON.parse(localStorage.getItem(weeklyKey));
      return Array.isArray(weekly?.departures) && weekly.departures.length ? weekly : undefined;
    } catch {
      return undefined;
    }
  }

  function hasOverride(date) {
    return Object.hasOwn(readAll(), date);
  }

  function pattern(ride) {
    return {number: ride.number, minuteOfDay: Math.floor(ride.at % day / minute)};
  }

  const slotKey = slot => slot.number + ':' + slot.minuteOfDay;

  function saveWeekday(plan) {
    const departures = [...new Map(plan.rides.map(ride => {
      const slot = pattern(ride);
      return [slotKey(slot), slot];
    })).values()];
    if (!departures.length) return;
    localStorage.setItem(weeklyKey, JSON.stringify({
      departures, walking: plan.walking, homeWalking: plan.homeWalking, deadline: plan.deadline
    }));
  }

  function read(date, schedule) {
    const override = readAll()[date];
    if (Array.isArray(override?.rides)) return override;
    const weekday = new Date(date).getUTCDay();
    const weekly = weekday >= 1 && weekday <= 5 ? weekdayPlan() : undefined;
    if (!weekly || !schedule) return;
    const timetableAvailable = schedule.lastDay == null || Date.parse(date) / day <= schedule.lastDay;
    const scheduleRides = timetableAvailable ? timetableRides(schedule, date) : [];
    const rides = [];
    const missing = [];
    const excluded = new Set(override?.excluded ?? []);
    for (const departure of weekly.departures) {
      if (excluded.has(slotKey(departure))) continue;
      const ride = scheduleRides.find(item =>
        item.number === departure.number && pattern(item).minuteOfDay === departure.minuteOfDay);
      if (ride) rides.push(ride);
      else missing.push(departure);
    }
    return {
      rides, missing, recurring: true, timetableAvailable,
      walking: weekly.walking, homeWalking: weekly.homeWalking, deadline: weekly.deadline
    };
  }

  function save(date, plan, now = Date.now()) {
    const plans = readAll();
    for (const past of Object.keys(plans)) if (past < today(now)) delete plans[past];
    plans[date] = plan;
    localStorage.setItem(key, JSON.stringify(plans));
  }

  function useWeekday(date) {
    const plans = readAll();
    delete plans[date];
    localStorage.setItem(key, JSON.stringify(plans));
  }

  function removeWeekday() {
    localStorage.removeItem(weeklyKey);
  }

  const slotTime = (date, slot) => time(Date.parse(date) + slot.minuteOfDay * minute);

  function removeRides(date, rides) {
    const plans = readAll();
    const plan = plans[date];
    if (Array.isArray(plan?.rides)) {
      const removed = new Set(rides.map(tripKey));
      plans[date] = {...plan, rides: plan.rides.filter(ride => !removed.has(tripKey(ride)))};
    } else {
      const excluded = new Set(plan?.excluded ?? []);
      for (const ride of rides) excluded.add(slotKey(pattern(ride)));
      plans[date] = {excluded: [...excluded]};
    }
    localStorage.setItem(key, JSON.stringify(plans));
  }

  function clearPast(date) {
    const plans = readAll();
    const past = Object.keys(plans).filter(day => day < date);
    if (!past.length) return 0;
    let removed = 0;
    for (const day of past) {
      removed += plans[day]?.rides?.length ?? 0;
      delete plans[day];
    }
    localStorage.setItem(key, JSON.stringify(plans));
    return removed;
  }

  function timetableRides(schedule, date, overnight = false) {
    const start = Date.parse(date);
    if (!Number.isFinite(start)) return [];
    const serviceDay = start / day;
    const rides = [];
    for (const number of Object.keys(routes)) {
      for (const [id, entries] of Object.entries(schedule.routes?.[number] ?? {})) {
        for (const [at, service, arrival] of entries) {
          if ((!overnight && at >= 86400) || !schedule.services?.[service]?.includes(serviceDay)) continue;
          rides.push({number, key: id, at: start + at * 1000,
            arrival: arrival == null ? null : start + arrival * 1000});
        }
      }
    }
    return [...new Map(rides.map(ride => [tripKey(ride), ride])).values()].sort((a, b) => a.at - b.at);
  }

  function destinationWalk(ride, walking) {
    return walking?.[routes[ride.number].to] ?? 0;
  }

  function workArrival(ride, walking) {
    if (ride.arrival == null) return null;
    return ride.arrival + destinationWalk(ride, walking) * minute;
  }

  function journeyTimes(ride, plan) {
    const stop = routes[ride.number].from;
    const homeWalk = plan.homeWalking?.[stop] ?? homeWalkDefaults[stop];
    const workWalk = destinationWalk(ride, plan.walking);
    const leave = ride.at - homeWalk * minute;
    return {
      homeWalk, workWalk, leave, wake: leave - readyMinutes * minute,
      onBus: ride.arrival == null ? null : Math.max(0, Math.round((ride.arrival - ride.at) / minute)),
      workArrival: workArrival(ride, plan.walking)
    };
  }

  function late(arrival, date, deadline) {
    if (arrival === null || !deadline) return 0;
    const target = Date.parse(date + 'T' + deadline + ':00Z');
    return Math.max(0, Math.ceil((arrival - target) / minute)) || 0;
  }

  return {
    minute, routes, readyMinutes, readAll, homeWalkDefaults, today, planDate, time, dateLabel, tripKey, read,
    save, removeRides, clearPast, timetableRides, destinationWalk, workArrival, journeyTimes, late, weekdayPlan,
    hasOverride, saveWeekday, useWeekday, removeWeekday, slotTime, preferred, setPreferred
  };
})();
