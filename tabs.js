const tabs = [...document.querySelectorAll('[data-booking-tab]')];

function activate(name, { updateAddress = true, focus = false } = {}) {
  for (const tab of tabs) {
    const active = tab.dataset.bookingTab === name;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    if (active && focus) tab.focus();
  }
  document.querySelector('.skip-link').href = name === 'vehicles' ? '#vehicle-form' : '#booking-form';
  if (updateAddress) history.replaceState(null, '', `${location.pathname}${location.search}${name === 'vehicles' ? '#vehicles' : '#rooms'}`);
  document.dispatchEvent(new CustomEvent('booking-tab-change', { detail: name }));
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activate(tab.dataset.bookingTab));
  tab.addEventListener('keydown', event => {
    let target;
    if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
    if (event.key === 'ArrowLeft') target = tabs[(index + tabs.length - 1) % tabs.length];
    if (event.key === 'Home') target = tabs[0];
    if (event.key === 'End') target = tabs.at(-1);
    if (target) { event.preventDefault(); activate(target.dataset.bookingTab, { focus: true }); }
  });
});

function fromAddress() {
  activate(location.hash === '#vehicles' || location.hash === '#vehicle-form' || location.hash.startsWith('#vehicle-cancel=') ? 'vehicles' : 'rooms', { updateAddress: false });
}
window.addEventListener('hashchange', fromAddress);
fromAddress();
