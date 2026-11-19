export function mountTrailer(deck) {
  const find = id => deck.querySelector('#trailer-' + id);
  const film = find('film'), controls = find('controls'), seek = find('seek');
  const play = find('play'), stop = find('stop'), mute = find('mute'), full = find('full');
  const error = find('error'), elapsed = find('time');
  const time = seconds => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');

  function syncPlayback() {
    const playing = !film.paused && !film.ended;
    deck.classList.toggle('playing', playing);
    play.lastElementChild.textContent = playing ? 'Pause' : film.ended ? 'Replay' : 'Play';
  }

  function syncPosition() {
    const hasDuration = Number.isFinite(film.duration) && film.duration > 0;
    seek.disabled = !hasDuration;
    if (hasDuration) seek.max = film.duration;
    const position = film.ended ? Math.round(film.duration) : Math.floor(film.currentTime);
    elapsed.textContent = time(position);
    seek.value = film.currentTime;
    seek.setAttribute('aria-valuetext', elapsed.textContent);
  }

  function togglePlayback() {
    if (!film.paused && !film.ended) {
      film.pause();
      return;
    }
    error.hidden = true;
    film.play().catch(reason => { if (reason.name !== 'AbortError') error.hidden = false; });
  }

  play.addEventListener('click', togglePlayback);
  film.addEventListener('click', togglePlayback);
  stop.addEventListener('click', () => {
    film.pause();
    film.currentTime = 0;
    syncPosition();
  });
  seek.addEventListener('input', () => { film.currentTime = Number(seek.value); });
  mute.addEventListener('click', () => { film.muted = !film.muted; });
  film.addEventListener('volumechange', () => mute.setAttribute('aria-pressed', String(film.muted)));
  for (const event of ['play', 'pause', 'ended']) film.addEventListener(event, syncPlayback);
  for (const event of ['durationchange', 'timeupdate', 'ended']) film.addEventListener(event, syncPosition);
  // An unsupported <source> can fail before the video element itself reports an error.
  deck.addEventListener('error', () => { error.hidden = false; }, true);

  if (document.fullscreenEnabled && deck.requestFullscreen) {
    full.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === deck) await document.exitFullscreen();
        else await deck.requestFullscreen();
      } catch { film.webkitEnterFullscreen?.(); }
    });
    document.addEventListener('fullscreenchange', () => {
      full.textContent = document.fullscreenElement === deck ? 'Exit full screen' : 'Full screen';
    });
  } else if (film.webkitEnterFullscreen) {
    full.addEventListener('click', () => film.webkitEnterFullscreen());
  } else {
    full.hidden = true;
  }
  controls.hidden = false;
  film.controls = false;
  deck.classList.add('enhanced');
  syncPlayback();
  syncPosition();
}
