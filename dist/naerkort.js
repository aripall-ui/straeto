'use strict';

// Nándarkort: leiðarlína að brottfararstoppi og rauntímastaðsetning vagnsins.
// Opnast sjálft þegar 5 mín. eða minna eru í brottför; „Kort“-hnappurinn opnar það og lokar hvenær sem er.
// Gögnin (dist/kort.json) eru búin til úr GTFS með tools/update-map.py.
const naerkort = (() => {
  const root = new URL('./', document.currentScript.src).href;
  const svgNS = 'http://www.w3.org/2000/svg';
  const autoWindow = 5 * 60000;
  const width = 320;
  const preview = new URLSearchParams(location.search).get('kort') === 'prufa';
  const figure = document.getElementById('naerkort');
  const toggle = document.getElementById('kort-takki');
  const caption = document.getElementById('naerkort-texti');
  if (!figure || !toggle) return {update() {}};

  let data;
  let loading;
  let ride;
  let segment;
  let project;
  let pathPoints = [];
  let manual = null; // 'open', eða lykill ferðar sem notandinn lokaði
  const node = (tag, attributes = {}) => {
    const element = document.createElementNS(svgNS, tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    return element;
  };

  function load() {
    loading ??= fetch(root + 'kort.json?v=1').then(response => response.ok ? response.json() : {})
      .catch(() => ({})).then(result => { data = result; paint(); });
  }

  function draw(key) {
    segment = data[key];
    const [south, west, north, east] = segment.box;
    const scale = width / ((east - west) * Math.cos((south + north) / 2 * Math.PI / 180));
    const cos = Math.cos((south + north) / 2 * Math.PI / 180);
    const height = Math.round((north - south) * scale);
    project = ([lat, lon]) => [(lon - west) * cos * scale, (north - lat) * scale];
    const pathOf = points => points.map((point, i) => (i ? 'L' : 'M') + project(point).map(v => v.toFixed(1)).join(' ')).join('');
    pathPoints = segment.line.map(project);

    const svg = node('svg', {viewBox: `0 0 ${width} ${height}`, role: 'img',
      'aria-label': 'Kort af leiðinni að ' + segment.stop.name});
    svg.append(node('path', {class: 'naerkort-gotur', d: segment.streets.map(pathOf).join('')}));
    svg.append(node('path', {class: 'naerkort-leid', d: pathOf(segment.line)}));
    const labelled = [project(segment.stop.at)];
    const stops = node('g', {class: 'naerkort-stopp'});
    for (const stop of [...segment.stops].reverse()) {
      const [x, y] = project(stop.at);
      stops.append(node('circle', {cx: x, cy: y, r: 3.5}));
      if (labelled.every(([lx, ly]) => Math.hypot(lx - x, ly - y) > 60) && y > 12 && y < height - 6) {
        labelled.push([x, y]);
        const text = node('text', {x: x + (x > width - 90 ? -8 : 8), y: y + 4,
          'text-anchor': x > width - 90 ? 'end' : 'start', class: 'naerkort-nafn'});
        text.textContent = stop.name;
        stops.append(text);
      }
    }
    const [sx, sy] = project(segment.stop.at);
    stops.append(node('circle', {cx: sx, cy: sy, r: 6, class: 'naerkort-mitt'}));
    const name = node('text', {x: sx + (sx > width - 110 ? -11 : 11), y: sy + 5,
      'text-anchor': sx > width - 110 ? 'end' : 'start', class: 'naerkort-nafn naerkort-mitt-nafn'});
    name.textContent = segment.stop.name;
    stops.append(name);
    svg.append(stops);
    const bus = node('g', {class: 'naerkort-vagn', 'aria-hidden': 'true'});
    bus.append(node('rect', {x: -14, y: -27, width: 28, height: 21, rx: 6}), node('circle', {r: 4}));
    const number = node('text', {'text-anchor': 'middle', y: -12});
    bus.append(number);
    svg.append(bus);
    figure.querySelector('svg')?.remove();
    figure.prepend(svg);
  }

  // Fjarlægð (metrar) eftir leiðinni frá vagni að stoppi, eða null ef vagninn er ekki á leiðinni.
  function remaining(point) {
    const [x, y] = point;
    let best = {distance: Infinity};
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const [ax, ay] = pathPoints[i];
      const [bx, by] = pathPoints[i + 1];
      const length = Math.hypot(bx - ax, by - ay) || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length ** 2));
      const distance = Math.hypot(ax + t * (bx - ax) - x, ay + t * (by - ay) - y);
      if (distance < best.distance) best = {distance, i, t, length};
    }
    const metresPerUnit = (segment.box[2] - segment.box[0]) * 111320 / Number(figure.querySelector('svg').viewBox.baseVal.height);
    if (best.distance * metresPerUnit > 80) return null;
    const stop = project(segment.stop.at);
    const stopIndex = pathPoints.findIndex(([px, py]) => Math.abs(px - stop[0]) < .01 && Math.abs(py - stop[1]) < .01);
    let along = (1 - best.t) * best.length;
    for (let i = best.i + 1; i < stopIndex; i++) along += Math.hypot(pathPoints[i + 1][0] - pathPoints[i][0], pathPoints[i + 1][1] - pathPoints[i][1]);
    return best.i >= stopIndex ? 0 : along * metresPerUnit;
  }

  function paint() {
    const key = ride && ride.route + '|' + ride.board;
    const available = Boolean(key && data?.[key]);
    toggle.hidden = !available && !(key && !data);
    if (!available) {
      figure.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      return;
    }
    const left = ride.at - Date.now();
    const auto = preview || (left >= 0 && left <= autoWindow);
    const open = manual === 'open' || (auto && manual !== ride.key);
    toggle.setAttribute('aria-expanded', String(open));
    figure.hidden = !open;
    if (!open) return;
    if (segment !== data[key]) draw(key);
    const bus = figure.querySelector('.naerkort-vagn');
    bus.querySelector('text').textContent = ride.route;
    let position = Number.isFinite(ride.lat) && Number.isFinite(ride.lng) ? [ride.lat, ride.lng] : null;
    if (preview) position = segment.line[Math.floor(segment.line.length * .4)];
    const [south, west, north, east] = segment.box;
    const inside = position && position[0] >= south && position[0] <= north && position[1] >= west && position[1] <= east;
    bus.style.display = inside ? '' : 'none';
    let text;
    if (!position) {
      text = 'Staðsetning vagnsins liggur ekki fyrir.';
    } else if (!inside) {
      text = 'Vagninn er ekki kominn inn á kortið.';
    } else {
      const point = project(position);
      bus.style.transform = `translate(${point[0].toFixed(1)}px, ${point[1].toFixed(1)}px)`;
      const distance = remaining(point);
      text = distance === null ? 'Vagninn er nálægt leiðinni.'
        : distance < 60 ? 'Vagninn er við stoppið.'
        : 'Vagninn er um ' + (distance < 1000 ? Math.round(distance / 50) * 50 + ' m'
          : (Math.round(distance / 100) / 10).toLocaleString('is-IS') + ' km') + ' frá stoppinu.';
    }
    caption.textContent = preview ? 'Sýnidæmi · ' + text : text;
  }

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    manual = open ? 'open' : ride?.key ?? null;
    paint();
  });

  // ride: {route, board, at, key, lat, lng} eða null. Kallað á hverri sekúndu; teiknar aðeins upp á nýtt ef leiðin breytist.
  function update(next) {
    if (next?.key !== ride?.key && manual !== 'open') manual = null;
    ride = next;
    if (ride && !data) load();
    paint();
  }

  return {update};
})();
