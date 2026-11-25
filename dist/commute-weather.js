'use strict';

const commuteWeather = (() => {
  const hour = 3600000;
  const query = new URLSearchParams({
    latitude: '64.147',
    longitude: '-21.954',
    hourly: 'temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,precipitation_probability,precipitation,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min',
    wind_speed_unit: 'ms',
    timezone: 'GMT',
    forecast_days: '3',
    past_days: '1'
  });
  const card = document.getElementById('commute-weather');
  const period = document.getElementById('commute-weather-period');
  const values = document.getElementById('commute-weather-values');
  const temperature = document.getElementById('commute-temperature');
  const feels = document.getElementById('commute-feels');
  const low = document.getElementById('commute-low');
  const high = document.getElementById('commute-high');
  const icon = document.getElementById('commute-weather-icon');
  const condition = document.getElementById('commute-weather-condition');
  const wind = document.getElementById('commute-wind');
  const gusts = document.getElementById('commute-gusts');
  const precipitation = document.getElementById('commute-precipitation');
  const status = document.getElementById('commute-weather-status');
  const ice = document.getElementById('commute-ice');
  const decimal = new Intl.NumberFormat('is-IS', {maximumFractionDigits: 1});
  let view;
  let forecast;
  let dailyForecast;
  let updated = -Infinity;
  let attempt = -Infinity;
  let pending;

  function timeKey(timestamp) {
    return new Date(timestamp).toISOString().slice(0, 16);
  }

  function value(number, unit, digits = 0) {
    return Number.isFinite(number) ? decimal.format(digits ? number : Math.round(number) || 0) + unit : '—';
  }

  function iceHint(startIndex, endIndex) {
    const codes = [forecast.weather_code?.[startIndex], forecast.weather_code?.[endIndex]];
    if (codes.some(code => [56, 57, 66, 67].includes(code))) {
      return 'Aukin hálkuhætta · Spáð frostúrkomu';
    }

    // Hourly precipitation values cover the preceding hour. Check the travel
    // hour and up to six hours before it for moisture that might still be present.
    const wet = forecast.precipitation?.slice(Math.max(0, startIndex - 5), endIndex + 1)
      .some(amount => Number.isFinite(amount) && amount >= 0.1);
    const cold = [forecast.temperature_2m?.[startIndex], forecast.temperature_2m?.[endIndex]]
      .some(degrees => Number.isFinite(degrees) && degrees <= 1);
    return wet && cold ? 'Hálka möguleg · Bleyta og hiti nálægt frostmarki eða undir því' : '';
  }

  function sky(code, isDay) {
    if (code === 0) return isDay ? ['sun', '☀', 'Heiðskírt'] : ['night', '☾', 'Heiðskírt'];
    if (code === 1 || code === 2) return ['cloud', '☁', 'Ský á köflum'];
    if (code === 3) return ['cloud', '☁', 'Skýjað'];
    if (code === 45 || code === 48) return ['fog', '≋', 'Þoka'];
    if (code >= 95) return ['rain', 'ϟ', 'Þrumuveður'];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['snow', '❄', 'Snjókoma'];
    if ([56, 57, 66, 67].includes(code)) return ['rain', '☂', 'Frostúrkoma'];
    if (code >= 51) return ['rain', '☂', 'Rigning'];
    return ['cloud', '', ''];
  }

  function paint() {
    if (!view) return;
    const start = Math.floor(view.at / hour) * hour;
    const end = start + hour;
    const startKey = timeKey(start);
    const endKey = timeKey(end);
    period.textContent = 'Vesturbær · kl. ' + startKey.slice(11) + '–' + endKey.slice(11);
    const startIndex = forecast?.time.indexOf(startKey) ?? -1;
    const endIndex = forecast?.time.indexOf(endKey) ?? -1;
    const available = startIndex >= 0 && endIndex >= 0 && Date.now() - updated <= 90 * 60000;
    values.hidden = !available;
    status.hidden = available;
    ice.hidden = true;
    if (!available) {
      delete card.dataset.sky;
      status.textContent = pending ? 'Sæki veðurspá…' : 'Veðurspá næst ekki fyrir þennan tíma.';
      return;
    }
    const dateIndex = dailyForecast?.time?.indexOf(startKey.slice(0, 10)) ?? -1;
    const [theme, symbol, description] = sky(forecast.weather_code?.[startIndex], forecast.is_day?.[startIndex] === 1);
    card.dataset.sky = theme;
    icon.textContent = symbol;
    condition.textContent = description;
    temperature.textContent = value(forecast.temperature_2m?.[startIndex], ' °C');
    feels.textContent = value(forecast.apparent_temperature?.[startIndex], ' °C');
    low.textContent = value(dailyForecast?.temperature_2m_min?.[dateIndex], ' °C');
    high.textContent = value(dailyForecast?.temperature_2m_max?.[dateIndex], ' °C');
    wind.textContent = value(forecast.wind_speed_10m?.[startIndex], ' m/s');
    gusts.textContent = value(forecast.wind_gusts_10m?.[endIndex], ' m/s');
    const chance = forecast.precipitation_probability?.[endIndex];
    const amount = forecast.precipitation?.[endIndex];
    precipitation.textContent = [Number.isFinite(chance) ? value(chance, '% líkur') : '',
      Number.isFinite(amount) ? value(amount, ' mm', 1) : ''].filter(Boolean).join(' · ') || '—';
    const hint = iceHint(startIndex, endIndex);
    ice.textContent = hint;
    ice.hidden = !hint;
  }

  async function refresh() {
    attempt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?' + query, {signal: controller.signal});
      if (!response.ok) throw new Error('Forecast unavailable');
      const {hourly, daily} = await response.json();
      if (!Array.isArray(hourly?.time)) throw new Error('Invalid forecast');
      forecast = hourly;
      dailyForecast = daily;
      updated = Date.now();
    } catch {
      // Keep a recent forecast usable through a temporary connection failure.
    } finally {
      clearTimeout(timeout);
      pending = undefined;
      paint();
    }
  }

  function show(mode, at) {
    if (!mode || !Number.isFinite(at)) {
      view = undefined;
      card.hidden = true;
      return;
    }
    view = {at};
    const slot = document.getElementById('commute-weather-' + mode);
    if (card.parentElement !== slot) slot.append(card);
    card.hidden = false;
    const now = Date.now();
    if (!pending && now - updated >= 20 * 60000 && now - attempt >= 2 * 60000) pending = refresh();
    paint();
  }

  return {show};
})();
