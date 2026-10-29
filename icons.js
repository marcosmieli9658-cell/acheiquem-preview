(function () {
  'use strict';
  const paths = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    electric: '<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>',
    ruler: '<path d="m4 17 13-13 4 4L8 21l-4-4Zm9-9 3 3m-6 0 2 2m-5 0 3 3"/>',
    engineering: '<path d="M4 17v-4a8 8 0 0 1 16 0v4M2 17h20v4H2v-4ZM9 5V3h6v2m-3-2v9"/>',
    brick: '<path d="M3 4h18v16H3zM3 12h18M11 4v8m5 0v8M7 12v8"/>',
    paint: '<rect x="3" y="3" width="14" height="7" rx="2"/><path d="M17 6h4v7h-9v3m0 0v6m-2-6h4v6h-4z"/>',
    floor: '<path d="M3 3h18v18H3zM3 12h18M12 3v18m-9 3 9-9m0 9 9-9M3 9l6-6m6 0 6 6"/>',
    water: '<path d="M12 2S4 10 4 15a8 8 0 0 0 16 0c0-5-8-13-8-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
    wood: '<path d="M4 3h16v18H4zM9 3c6 5-4 8 2 12s0 6 0 6m5-18c-5 6 5 10 0 18M4 9h2m12 7h2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    star: '<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1 3-6Z"/>',
    heart: '<path d="M20.5 4.5a5 5 0 0 0-7 0L12 6l-1.5-1.5a5 5 0 1 0-7 7L12 20l8.5-8.5a5 5 0 0 0 0-7Z"/>',
    message: '<path d="M21 11a9 9 0 0 1-13 8L3 21l2-5a9 9 0 1 1 16-5Z"/><path d="M8 10h8m-8 4h5"/>',
    camera: '<path d="M3 6h4l2-3h6l2 3h4v15H3V6Z"/><circle cx="12" cy="13" r="4"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    shield: '<path d="m12 2 8 4v6c0 6-8 10-8 10S4 18 4 12V6l8-4Z"/><path d="m8 11 3 3 5-5"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    filter: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
    flag: '<path d="M5 22V3c5-5 9 5 15 0v11c-6 5-10-5-15 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    logout: '<path d="M9 3H3v18h6m6-15 6 6-6 6m-6-6h12"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>'
  };
  window.AQIcons = (name, size = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.user}</svg>`;
})();
