'use strict';

(() => {
  const key = 'i-vinnuna-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  let buttons = [];
  let themeColor;

  try {
    preference = localStorage.getItem(key);
  } catch {
    // The toggle still works for this page when storage is unavailable.
  }

  function applyTheme() {
    const dark = preference === 'dark' || (preference !== 'light' && system.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === root.dataset.theme));
    }
    if (themeColor) themeColor.content = getComputedStyle(root).backgroundColor;
  }

  applyTheme();
  system.addEventListener('change', applyTheme);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = event.newValue;
    applyTheme();
  });

  document.addEventListener('DOMContentLoaded', () => {
    buttons = [...document.querySelectorAll('[data-theme-choice]')];
    themeColor = document.querySelector('meta[name="theme-color"]');
    for (const button of buttons) {
      button.addEventListener('click', () => {
        preference = button.dataset.themeChoice;
        try {
          localStorage.setItem(key, preference);
        } catch {
          // An unsaved preference is still applied immediately.
        }
        applyTheme();
      });
    }
    applyTheme();
  });
})();
