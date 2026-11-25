'use strict';

const commuteStatus = (() => {
  const minute = 60000;
  const day = 1440 * minute;
  const clock = new Intl.DateTimeFormat('is-IS', {
    timeZone: 'Atlantic/Reykjavik', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const feed = document.getElementById('commute-feed');
  const source = document.getElementById('commute-time-source');
  let updated;
  let health = 'loading';

  function paintFeed(now) {
    const age = updated == null ? 0 : now - updated;
    const message = {
      loading: 'Sæki tíma frá Strætó…',
      partial: 'Sumir tímar bárust ekki frá Strætó.',
      failed: 'Uppfærsla frá Strætó mistókst.',
      ok: age >= 2 * minute ? 'Tímar kunna að vera úreltir.' : ''
    }[health];
    const stamp = updated == null ? '' : 'Uppfært ' + clock.format(updated);
    const text = [message, stamp].filter(Boolean).join(' ');
    if (feed.textContent !== text) feed.textContent = text;
  }

  function recordRefresh(nextHealth) {
    health = nextHealth;
    const now = Date.now();
    if (health === 'ok' || health === 'partial') updated = now;
    paintFeed(now);
  }

  function showTime(ride, schedule) {
    const labels = [];
    if (ride) {
      if (ride.plannedDeparture != null &&
          Math.floor(ride.at / minute) === Math.floor(ride.plannedDeparture / minute)) {
        labels.push('Brottför á áætlun');
      }
      if (ride.estimatedArrival) labels.push('Áætluð koma');
      if (ride.arrival == null) labels.push('Komutími óþekktur');
    }
    if (schedule?.lastDay != null && Math.floor(Date.now() / day) > schedule.lastDay) {
      labels.push('Bundin tímaáætlun útrunnin');
    }
    source.textContent = labels.join(' · ');
  }

  return {paintFeed, recordRefresh, showTime};
})();
