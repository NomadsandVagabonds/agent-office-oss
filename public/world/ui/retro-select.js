// A select-only combobox. Keep the native select as the value/change contract,
// but draw the list ourselves: the OS popup cannot inherit either site's style.
import { h } from './dom.js';

export function retroSelect(select, label) {
  const id = select.id, options = [...select.children];
  const caption = h('span.retro-select-caption');
  const button = h('button.retro-select-button', {
    id, type: 'button', role: 'combobox', 'aria-label': label,
    'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': `${id}-list`,
    'aria-describedby': select.getAttribute('aria-describedby'),
  }, caption, h('span.retro-select-arrow', { 'aria-hidden': 'true' }, '▾'));
  const items = options.map((option, i) => h('div.retro-select-option', {
    id: `${id}-option-${i}`, role: 'option', 'aria-selected': 'false',
  }, option.textContent));
  const list = h('div.retro-select-list', { id: `${id}-list`, role: 'listbox', 'aria-label': label, hidden: true }, items);
  const el = h('div.retro-select', button, list);
  select.id = `${id}-native`; select.hidden = true;
  select.replaceWith(el); el.append(select);
  let opened = false, active = 0, search = '', typedAt = 0;
  const selected = () => Math.max(0, options.findIndex(option => option.value === select.value));
  function highlight(index) {
    active = Math.max(0, Math.min(items.length - 1, index));
    items.forEach((item, i) => {
      item.classList.toggle('is-active', i === active);
      item.setAttribute('aria-selected', String(i === selected()));
    });
    if (opened) {
      button.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView?.({ block: 'nearest' });
    }
  }
  function outside(event) { if (!el.contains(event.target)) close(); }
  function close() {
    opened = false; list.hidden = true;
    button.setAttribute('aria-expanded', 'false'); button.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('focusin', outside, true);
  }
  function open() {
    if (opened || button.disabled) return;
    opened = true; list.hidden = false; search = '';
    button.setAttribute('aria-expanded', 'true'); highlight(selected());
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside, true);
  }
  function sync() {
    caption.textContent = options[selected()].textContent;
    button.disabled = select.disabled;
    if (!opened) highlight(selected());
  }
  function choose() {
    const value = options[active].value, changed = value !== select.value;
    select.value = value; close(); sync(); button.focus({ preventScroll: true });
    if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function handleKey(event) {
    if (event.target !== button || event.ctrlKey || event.metaKey || event.altKey) return false;
    const key = event.key;
    if (key === 'Escape') { if (!opened) return false; close(); return true; }
    // Tabbing away cancels a preview. Merely browsing must not void a run's score.
    if (key === 'Tab') { close(); return false; }
    if (key === 'Enter' || key === ' ') { if (!event.repeat) { if (opened) choose(); else open(); } return true; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      const wasOpen = opened; open();
      highlight(key === 'Home' ? 0 : key === 'End' ? items.length - 1
        : active + (wasOpen ? (key === 'ArrowDown' ? 1 : -1) : 0));
      return true;
    }
    if (key.length === 1 && /\S/.test(key)) {
      const now = Date.now(); open();
      search = now - typedAt > 700 ? key.toLowerCase() : search + key.toLowerCase(); typedAt = now;
      const index = options.findIndex(option => option.textContent.toLowerCase().startsWith(search));
      if (index >= 0) highlight(index);
      return true;
    }
    return false;
  }
  button.addEventListener('click', () => { if (opened) close(); else open(); });
  button.addEventListener('keydown', event => {
    if (handleKey(event)) { event.preventDefault(); event.stopPropagation(); }
  });
  items.forEach((item, i) => {
    item.addEventListener('pointerdown', event => event.preventDefault());
    item.addEventListener('click', () => { highlight(i); choose(); });
    item.addEventListener('pointermove', () => highlight(i));
  });
  select.addEventListener('change', sync); sync();
  return { el, button, sync, close, handleKey, dispose() { close(); select.removeEventListener('change', sync); } };
}
