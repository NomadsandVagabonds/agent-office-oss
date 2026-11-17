// The camcorder's menu. It owns only its controls: pausing time, applying the
// settings and ending a visit belong to index.js, not to this view.
import { DIFFICULTIES, difficultyOf } from '/core/difficulty.mjs';
import { h } from '../ui/dom.js';
import { retroSelect } from '../ui/retro-select.js';
import { MENU_CSS } from './menu-style.js';
import { BACKROOMS_DEFAULTS as DEFAULTS } from '/core/backrooms-settings.mjs';

let instance = 0;
const CONTROLS = [
  ['Walk', 'W A S D'], ['Look', 'Mouse / drag'], ['Run', 'Shift'], ['Crouch / jump', 'C / Space'],
  ['Interact', 'E / Enter'], ['Shove', 'Click'], ['Select / stow pocket', '1 – 6'], ['Inventory', 'I / Tab'], ['Use item', 'Q'],
  ['Drop item', 'G'], ['Flashlight', 'F'], ['VHS picture', 'V'], ['Mute sound', 'M'], ['Pause menu', 'Esc'],
];

/**
 * Camcorder controls over the frozen picture. onChange(key, value) is immediate;
 * the caller applies and saves it. setOpen never invokes pause/resume callbacks.
 */
export function createMenu({ host, settings = {}, furniture = false, onRequestOpen, onResume, onGiveUp, onChange, onArchive } = {}) {
  const id = ++instance, prefix = `br-menu-${id}`;
  let opened = false, disposed = false, page = 'main', previousFocus = null;
  let values = { ...DEFAULTS, ...settings };
  const style = h('style', { id: `${prefix}-css` }, MENU_CSS);
  document.head.append(style);
  const launcher = h('button.br-menu-launcher', { type: 'button', 'aria-label': 'Open pause menu', 'aria-expanded': 'false' }, h('span', { 'aria-hidden': 'true' }, 'Ⅱ'));
  const title = h('h2.br-menu-title', { id: `${prefix}-title` }, 'Paused');
  const close = h('button.br-menu-close', { type: 'button', 'aria-label': 'Resume recording', title: 'Resume' }, '×');
  const header = h('div.br-menu-header', h('div', h('span.br-menu-eyebrow', 'Ⅱ  RECORDING PAUSED'), title), close);
  const main = h('div.br-menu-main');
  const controls = h('div.br-menu-controls-page', { hidden: true },
    h('dl.br-menu-controls', CONTROLS.map(([action, keys]) => h('div.br-menu-control', h('dt', action), h('dd', keys)))),
    furniture ? h('p.br-menu-note', h('strong', 'Move furniture'), ' — look at a chair, desk, trolley or loose scenery panel and press E (or tap the hand) to grab it. Walk to push or pull; press again to release. While holding a timber-backed panel, R (or its on-screen prompt) lowers or raises it. Both ends need solid support. Raise bridges from their hinged end, with nobody on them. For a desk with a working computer, aim below the tabletop. Bolted, braced, buried and suspended furniture stays fixed.') : null,
    h('p.br-menu-note', h('strong', 'On a phone'), ' — the ring walks; push past it to run. Drag anywhere else to look. The arrows jump and crouch, the hand interacts (and shoves, with nothing in front of it to use), the torch switches your light; tap a pocket to inspect it.'),
    h('p.br-menu-note', h('strong', 'Recharge the camcorder'), ' — select a battery and press Q. On a phone, tap its pocket, then Recharge camera. Use Combine to fit a battery to a flashlight instead.'));
  const settingsPage = h('div.br-menu-settings', { hidden: true });
  const confirm = h('div.br-menu-confirm', { hidden: true }, h('p', 'End this recording and see your score?'));
  const content = h('div.br-menu-content', main, controls, settingsPage, confirm);
  const back = h('button.br-menu-back', { type: 'button', hidden: true }, '‹ Back');
  const hint = h('small', 'Esc · resume recording');
  const footer = h('div.br-menu-footer', back, hint, h('small', 'TAPE STOPPED'));
  const panel = h('section.br-menu-panel', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': `${prefix}-title`, tabIndex: -1 }, header, content, footer);
  const overlay = h('div.br-menu-overlay', { hidden: true }, panel);
  const el = h('div.br-menu', h('div.br-menu-picture', launcher), overlay);
  (host || document.body).append(el);
  const fields = new Map();
  const button = (text, small, action, className = '') => {
    const item = h(`button.br-menu-choice${className}`, { type: 'button' }, text, small ? h('small', small) : null);
    item.addEventListener('click', action); main.append(item); return item;
  };
  const resume = button('Resume', '▶', () => onResume?.());
  const controlsButton = button('Controls', '01', () => show('controls'));
  const settingsButton = button('Settings', '02', () => show('settings'));
  if (onArchive) button('Your archive', 'Opens in a new tab', onArchive);
  const giveUpButton = button('Give up', '■', () => show('giveup'), '.br-menu-giveup');
  const stay = h('button', { type: 'button' }, 'Keep recording');
  const giveUp = h('button.br-menu-confirm-end', { type: 'button' }, 'Give up');
  confirm.append(h('div.br-menu-confirm-actions', stay, giveUp));
  stay.addEventListener('click', () => onResume?.());
  giveUp.addEventListener('click', () => { if (opened && page === 'giveup') onGiveUp?.(); });
  launcher.addEventListener('click', () => onRequestOpen?.());
  close.addEventListener('click', () => onResume?.());
  back.addEventListener('click', () => show('main'));

  function change(key, value) {
    values[key] = value;
    update();
    onChange?.(key, value);
  }
  function slider(key, label, min, max, step, format) {
    const input = h('input', { id: `${prefix}-${key}`, type: 'range', min, max, step });
    const output = h('output', { htmlFor: input.id });
    fields.set(key, { input, output, format });
    input.addEventListener('input', () => change(key, Number(input.value)));
    settingsPage.append(h('div.br-menu-setting', h('label', { htmlFor: input.id }, label), output, input));
  }
  function checkbox(key, label) {
    const input = h('input', { id: `${prefix}-${key}`, type: 'checkbox' });
    fields.set(key, { input });
    input.addEventListener('change', () => change(key, input.checked));
    settingsPage.append(h('div.br-menu-setting', h('label', { htmlFor: input.id }, label), input));
  }
  slider('musicVolume', 'Music', 0, 1, .05, n => `${Math.round(n * 100)}%`);
  slider('sfxVolume', 'Sound effects', 0, 1, .05, n => `${Math.round(n * 100)}%`);
  checkbox('mute', 'Mute all audio');
  slider('sensitivity', 'Look sensitivity', .25, 2, .05, n => `${Number(n).toFixed(2)}×`);
  checkbox('invertY', 'Invert vertical look');
  checkbox('steadyLighting', 'Steady ambient lights');
  const picture = h('select', { id: `${prefix}-vhs` },
    h('option', { value: '0' }, 'Clean'), h('option', { value: '1' }, 'Light VHS'), h('option', { value: '2' }, 'Full VHS'));
  fields.set('vhs', { input: picture });
  picture.addEventListener('change', () => change('vhs', Number(picture.value)));
  settingsPage.append(h('div.br-menu-setting', h('label', { htmlFor: picture.id }, 'Picture'), picture));
  const difficulty = h('select', { id: `${prefix}-difficulty`, 'aria-describedby': `${prefix}-difficulty-note` },
    DIFFICULTIES.map(d => h('option', { value: d.id }, d.label + (d.id === 'easy' ? ' (recommended)' : ''))));
  const difficultyNote = h('small', { id: `${prefix}-difficulty-note` });
  fields.set('difficulty', { input: difficulty });
  difficulty.addEventListener('change', () => change('difficulty', difficulty.value));
  const difficultyWarning = h('small');
  settingsPage.append(h('div.br-menu-setting', h('label', { htmlFor: difficulty.id }, 'Difficulty'), difficulty, difficultyNote, difficultyWarning));
  const difficultyPicker = retroSelect(difficulty, 'Difficulty');

  function syncField(key) {
    const field = fields.get(key); if (!field) return;
    if (field.input.type === 'checkbox') field.input.checked = !!values[key];
    else if (field.input.value !== String(values[key])) field.input.value = String(values[key]);
    if (key === 'difficulty') difficultyPicker.sync();
    if (field.output) field.output.textContent = field.format(Number(values[key]));
    if (field.format) field.input.setAttribute('aria-valuetext', field.format(Number(values[key])));
  }
  function update(next = {}) {
    values = { ...values, ...next };
    for (const key of fields.keys()) syncField(key);
    difficultyNote.textContent = difficultyOf(values.difficulty).note;
    difficultyWarning.textContent = values.scoreEligible === false
      ? 'UNSCORED RECORDING'
      : 'Changing difficulty permanently voids this run’s score.';
  }
  const pages = { main, controls, settings: settingsPage, giveup: confirm };
  function show(next) {
    if (!pages[next]) return;
    difficultyPicker.close();
    const was = page; page = next;
    for (const [name, section] of Object.entries(pages)) section.hidden = name !== page;
    title.textContent = { main: 'Paused', controls: 'Controls', settings: 'Settings', giveup: 'Give up?' }[page];
    back.hidden = page === 'main';
    hint.textContent = page === 'main' ? 'Esc · resume recording' : 'Esc · back';
    content.scrollTop = 0;
    if (opened) {
      const target = page === 'main' ? ({ controls: controlsButton, settings: settingsButton, giveup: giveUpButton }[was] || resume)
        : page === 'settings' ? fields.get('musicVolume').input : page === 'giveup' ? stay : back;
      target.focus({ preventScroll: true });
    }
  }
  function setOpen(on) {
    if (disposed || opened === !!on) return;
    difficultyPicker.close();
    opened = !!on;
    el.classList.toggle('is-open', opened); overlay.hidden = !opened;
    launcher.setAttribute('aria-expanded', String(opened));
    if (opened) {
      previousFocus = document.activeElement;
      show('main');
    } else {
      const target = previousFocus; previousFocus = null;
      if (target?.isConnected && !target.closest?.('[hidden]')) target.focus?.({ preventScroll: true });
      else document.activeElement?.blur?.();
    }
  }
  const focusable = () => [...panel.querySelectorAll('button, input, select, [tabindex="0"]')].filter(item => !item.disabled && !item.closest('[hidden]'));
  function handleKey(event) {
    if (!opened || disposed || event.ctrlKey || event.metaKey || event.altKey) return false;
    if (difficultyPicker.handleKey(event)) return true;
    const key = event.key.toLowerCase();
    if (key === 'escape') {
      if (!event.repeat) { if (page === 'main') onResume?.(); else show('main'); }
      return true;
    }
    if (key === 'tab') {
      const items = focusable();
      if (!items.length) { panel.focus(); return true; }
      const at = items.indexOf(document.activeElement);
      const next = at < 0 ? (event.shiftKey ? items.length - 1 : 0) : (at + (event.shiftKey ? -1 : 1) + items.length) % items.length;
      items[next].focus(); return true;
    }
    // Native buttons, sliders and select menus keep Enter, Space and arrows.
    // Only keys aimed outside the dialog must be consumed before the world.
    return !panel.contains(event.target);
  }
  const stopBubble = event => event.stopPropagation();
  const localKey = event => { if (handleKey(event)) event.preventDefault(); event.stopPropagation(); };
  const events = ['keyup', 'keypress', 'pointerdown', 'pointerup', 'pointercancel', 'pointermove', 'mousedown', 'mouseup', 'mousemove',
    'wheel', 'click', 'dblclick', 'contextmenu', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];
  for (const name of events) el.addEventListener(name, stopBubble);
  el.addEventListener('keydown', localKey);
  update();
  return {
    el, setOpen, update, handleKey,
    get isOpen() { return opened; },
    owns(target) { return !!target && (launcher.contains(target) || (opened && overlay.contains(target))); },
    dispose() {
      if (disposed) return;
      setOpen(false); disposed = true;
      for (const name of events) el.removeEventListener(name, stopBubble);
      el.removeEventListener('keydown', localKey);
      difficultyPicker.dispose();
      el.remove(); style.remove();
    },
  };
}
