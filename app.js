let allMovies = [];
let currentMovie = null;
let controlsTimeout = null;

// DOM Elements
const moviesGrid = document.getElementById('moviesGrid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const refreshBtn = document.getElementById('refreshBtn');
const movieCount = document.getElementById('movieCount');

// Hero elements
const heroSection = document.getElementById('heroSection');
const heroTitle = document.getElementById('heroTitle');
const heroYear = document.getElementById('heroYear');
const heroQuality = document.getElementById('heroQuality');
const heroMeta = document.getElementById('heroMeta');
const heroPlayBtn = document.getElementById('heroPlayBtn');

// Player elements
const playerModal = document.getElementById('playerModal');
const playerWrapper = document.getElementById('playerWrapper');
const videoElement = document.getElementById('videoElement');
const playerTitle = document.getElementById('playerTitle');
const playerBadges = document.getElementById('playerBadges');
const closePlayerBtn = document.getElementById('closePlayerBtn');

// Controls elements
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const rewindBtn = document.getElementById('rewindBtn');
const forwardBtn = document.getElementById('forwardBtn');
const muteBtn = document.getElementById('muteBtn');
const volHighIcon = document.getElementById('volHighIcon');
const volMuteIcon = document.getElementById('volMuteIcon');
const volumeSlider = document.getElementById('volumeSlider');
const currentTimeEl = document.getElementById('currentTime');
const durationTimeEl = document.getElementById('durationTime');

const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const bufferedBar = document.getElementById('bufferedBar');
const progressHoverTime = document.getElementById('progressHoverTime');

const speedBtn = document.getElementById('speedBtn');
const speedMenu = document.getElementById('speedMenu');
const pipBtn = document.getElementById('pipBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fsEnterIcon = document.getElementById('fsEnterIcon');
const fsExitIcon = document.getElementById('fsExitIcon');

// Feedback & Toast
const centerFeedback = document.getElementById('centerFeedback');
const feedbackIcon = document.getElementById('feedbackIcon');
const resumeToast = document.getElementById('resumeToast');
const resumeTimeStr = document.getElementById('resumeTimeStr');
const toastResumeBtn = document.getElementById('toastResumeBtn');
const toastRestartBtn = document.getElementById('toastRestartBtn');

// Shortcuts modal
const shortcutsHintBtn = document.getElementById('shortcutsHintBtn');
const shortcutsModal = document.getElementById('shortcutsModal');
const closeShortcutsBtn = document.getElementById('closeShortcutsBtn');

// Formatter functions
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');
  if (h > 0) {
    return `${h}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

// Generate pleasing random gradient background for poster card
function getCardGradient(id) {
  const gradients = [
    'linear-gradient(135deg, #3a1c71 0%, #d76d77 50%, #ffaf7b 100%)',
    'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
    'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
    'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
    'linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)',
    'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)',
    'linear-gradient(135deg, #0b486b 0%, #f56217 100%)',
    'linear-gradient(135deg, #1a2a6c 0%, #b21f1f 50%, #fdbb2d 100%)'
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

// Fetch movies from API
async function loadMovies() {
  refreshBtn.classList.add('loading');
  try {
    const res = await fetch('/api/movies');
    allMovies = await res.json();
    renderApp(allMovies);
  } catch (err) {
    console.error('Failed to load movies:', err);
    emptyState.style.display = 'block';
    moviesGrid.innerHTML = '';
  } finally {
    refreshBtn.classList.remove('loading');
  }
}

// Render library and hero
function renderApp(movies) {
  movieCount.textContent = `${movies.length} Movie${movies.length === 1 ? '' : 's'}`;

  if (movies.length === 0) {
    heroSection.style.display = 'none';
    emptyState.style.display = 'block';
    moviesGrid.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';

  // Hero section - showcase the first/latest movie
  const featured = movies[0];
  heroSection.style.display = 'flex';
  heroTitle.textContent = featured.title;
  heroYear.textContent = featured.year || 'Movie';
  heroQuality.textContent = featured.quality || 'HD';
  heroMeta.textContent = `${featured.sizeFormatted} • ${featured.audio || 'Audio'} • ${featured.codec || 'H.264'}`;
  heroPlayBtn.onclick = () => playMovie(featured);

  // Render movie grid
  renderGrid(movies);
}

function renderGrid(movies) {
  moviesGrid.innerHTML = '';

  movies.forEach(movie => {
    const card = document.createElement('div');
    card.className = 'movie-card';

    // Check watch progress in localStorage
    const savedPos = parseFloat(localStorage.getItem(`cinelocal_pos_${movie.id}`)) || 0;
    const savedDur = parseFloat(localStorage.getItem(`cinelocal_dur_${movie.id}`)) || 0;
    const progressPercent = (savedDur > 0) ? Math.min(100, (savedPos / savedDur) * 100) : 0;

    const gradient = getCardGradient(movie.id);

    card.innerHTML = `
      <div class="card-poster" style="background: ${gradient};">
        <div class="poster-pattern">🎬</div>
        <div class="card-badges">
          ${movie.quality ? `<span class="badge badge-quality">${movie.quality}</span>` : ''}
          ${movie.audio ? `<span class="badge badge-audio">${movie.audio}</span>` : ''}
        </div>
        <div class="card-play-overlay">
          <div class="card-play-circle">
            <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
        </div>
      </div>
      <div class="card-details">
        <div>
          <h3 class="card-title" title="${movie.title}">${movie.title}</h3>
          <div class="card-meta">
            ${movie.year ? `<span class="meta-year">${movie.year}</span>` : ''}
            <span class="meta-size">${movie.sizeFormatted}</span>
          </div>
        </div>
        ${progressPercent > 2 ? `
          <div class="card-progress" title="Watched ${Math.round(progressPercent)}%">
            <div class="card-progress-bar" style="width: ${progressPercent}%;"></div>
          </div>
        ` : ''}
      </div>
    `;

    card.addEventListener('click', () => playMovie(movie));
    moviesGrid.appendChild(card);
  });
}

// Search filtering
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  clearSearch.style.display = query ? 'block' : 'none';

  const filtered = allMovies.filter(m => {
    return m.title.toLowerCase().includes(query) ||
           (m.year && m.year.toString().includes(query)) ||
           (m.quality && m.quality.toLowerCase().includes(query)) ||
           (m.audio && m.audio.toLowerCase().includes(query)) ||
           m.filename.toLowerCase().includes(query);
  });

  renderGrid(filtered);
  if (filtered.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
  }
});

clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  clearSearch.style.display = 'none';
  renderGrid(allMovies);
  emptyState.style.display = allMovies.length === 0 ? 'block' : 'none';
});

refreshBtn.addEventListener('click', loadMovies);

// Player Functionality
function playMovie(movie) {
  currentMovie = movie;
  playerTitle.textContent = movie.title;
  playerBadges.innerHTML = `
    ${movie.year ? `<span class="badge badge-quality" style="margin-left: 8px;">${movie.year}</span>` : ''}
    ${movie.quality ? `<span class="badge badge-quality" style="margin-left: 4px;">${movie.quality}</span>` : ''}
  `;

  const streamUrl = `/api/stream?file=${encodeURIComponent(movie.relativePath)}`;
  videoElement.src = streamUrl;

  // Check subtitles
  const subTrack = document.getElementById('subtitlesTrack');
  subTrack.src = `/api/subtitles?file=${encodeURIComponent(movie.relativePath)}`;

  playerModal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Check saved progress
  const savedPos = parseFloat(localStorage.getItem(`cinelocal_pos_${movie.id}`)) || 0;
  if (savedPos > 15) {
    resumeTimeStr.textContent = formatTime(savedPos);
    resumeToast.style.display = 'flex';

    toastResumeBtn.onclick = () => {
      videoElement.currentTime = savedPos;
      resumeToast.style.display = 'none';
      videoElement.play();
    };

    toastRestartBtn.onclick = () => {
      videoElement.currentTime = 0;
      resumeToast.style.display = 'none';
      videoElement.play();
    };

    // Auto-dismiss toast after 8 seconds
    setTimeout(() => {
      resumeToast.style.display = 'none';
    }, 8000);
  } else {
    resumeToast.style.display = 'none';
  }

  videoElement.play().catch(e => console.log('Autoplay deferred:', e));
  showUserActive();
}

function closePlayer() {
  if (currentMovie && videoElement.currentTime > 0) {
    localStorage.setItem(`cinelocal_pos_${currentMovie.id}`, videoElement.currentTime);
    if (videoElement.duration) {
      localStorage.setItem(`cinelocal_dur_${currentMovie.id}`, videoElement.duration);
    }
  }
  videoElement.pause();
  videoElement.removeAttribute('src');
  videoElement.load();
  playerModal.classList.remove('active');
  document.body.style.overflow = '';
  resumeToast.style.display = 'none';
  // Re-render grid to reflect updated progress bars
  renderGrid(allMovies);
}

closePlayerBtn.addEventListener('click', closePlayer);

// Play / Pause toggle
function togglePlay() {
  if (videoElement.paused || videoElement.ended) {
    videoElement.play();
    triggerFeedback('▶');
  } else {
    videoElement.pause();
    triggerFeedback('⏸');
  }
}

playPauseBtn.addEventListener('click', togglePlay);
videoElement.addEventListener('click', togglePlay);

function triggerFeedback(text) {
  feedbackIcon.textContent = text;
  centerFeedback.classList.add('show');
  setTimeout(() => centerFeedback.classList.remove('show'), 350);
}

videoElement.addEventListener('play', () => {
  playIcon.style.display = 'none';
  pauseIcon.style.display = 'block';
});

videoElement.addEventListener('pause', () => {
  playIcon.style.display = 'block';
  pauseIcon.style.display = 'none';
});

// Skip buttons
rewindBtn.addEventListener('click', () => {
  videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
  triggerFeedback('⏪ 10s');
});

forwardBtn.addEventListener('click', () => {
  videoElement.currentTime = Math.min(videoElement.duration || Infinity, videoElement.currentTime + 10);
  triggerFeedback('10s ⏩');
});

// Time & Progress Updates
videoElement.addEventListener('timeupdate', () => {
  currentTimeEl.textContent = formatTime(videoElement.currentTime);
  if (videoElement.duration) {
    const percent = (videoElement.currentTime / videoElement.duration) * 100;
    progressBar.style.width = `${percent}%`;
    const thumb = document.querySelector('.progress-thumb');
    if (thumb) thumb.style.left = `${percent}%`;

    // Save progress periodically every 5 seconds
    if (currentMovie && Math.floor(videoElement.currentTime) % 5 === 0) {
      localStorage.setItem(`cinelocal_pos_${currentMovie.id}`, videoElement.currentTime);
      localStorage.setItem(`cinelocal_dur_${currentMovie.id}`, videoElement.duration);
    }
  }
});

videoElement.addEventListener('loadedmetadata', () => {
  durationTimeEl.textContent = formatTime(videoElement.duration);
});

videoElement.addEventListener('progress', () => {
  if (videoElement.buffered.length > 0 && videoElement.duration) {
    const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
    const bufferedPercent = (bufferedEnd / videoElement.duration) * 100;
    bufferedBar.style.width = `${bufferedPercent}%`;
  }
});

// Progress Bar Seeking
progressContainer.addEventListener('click', (e) => {
  const rect = progressContainer.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const fraction = Math.max(0, Math.min(1, clickX / rect.width));
  if (videoElement.duration) {
    videoElement.currentTime = fraction * videoElement.duration;
  }
});

progressContainer.addEventListener('mousemove', (e) => {
  const rect = progressContainer.getBoundingClientRect();
  const hoverX = e.clientX - rect.left;
  const fraction = Math.max(0, Math.min(1, hoverX / rect.width));
  if (videoElement.duration) {
    const hoverSeconds = fraction * videoElement.duration;
    progressHoverTime.textContent = formatTime(hoverSeconds);
    progressHoverTime.style.left = `${hoverX}px`;
  }
});

// Volume & Mute
function updateVolume(val) {
  videoElement.volume = val;
  volumeSlider.value = val;
  if (val === 0) {
    volHighIcon.style.display = 'none';
    volMuteIcon.style.display = 'block';
  } else {
    volHighIcon.style.display = 'block';
    volMuteIcon.style.display = 'none';
  }
}

volumeSlider.addEventListener('input', (e) => {
  updateVolume(parseFloat(e.target.value));
});

muteBtn.addEventListener('click', () => {
  if (videoElement.volume > 0) {
    videoElement.dataset.lastVol = videoElement.volume;
    updateVolume(0);
  } else {
    const last = parseFloat(videoElement.dataset.lastVol) || 1;
    updateVolume(last);
  }
});

// Playback Speed
speedBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  speedMenu.classList.toggle('show');
});

document.addEventListener('click', (e) => {
  if (!speedMenu.contains(e.target) && e.target !== speedBtn) {
    speedMenu.classList.remove('show');
  }
});

document.querySelectorAll('.speed-option').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.speed-option').forEach(o => o.classList.remove('active'));
    option.classList.add('active');
    const speed = parseFloat(option.dataset.speed);
    videoElement.playbackRate = speed;
    speedBtn.textContent = `${speed}x`;
    speedMenu.classList.remove('show');
  });
});

// Picture in Picture
pipBtn.addEventListener('click', async () => {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      await videoElement.requestPictureInPicture();
    }
  } catch (err) {
    console.error('PiP error:', err);
  }
});

// Fullscreen
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    playerWrapper.requestFullscreen().catch(err => {
      console.log('Fullscreen request failed:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

fullscreenBtn.addEventListener('click', toggleFullscreen);

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    fsEnterIcon.style.display = 'none';
    fsExitIcon.style.display = 'block';
  } else {
    fsEnterIcon.style.display = 'block';
    fsExitIcon.style.display = 'none';
  }
});

// Auto-hide controls on mouse inactivity
function showUserActive() {
  playerWrapper.classList.add('user-active');
  clearTimeout(controlsTimeout);
  if (!videoElement.paused) {
    controlsTimeout = setTimeout(() => {
      playerWrapper.classList.remove('user-active');
    }, 2800);
  }
}

playerWrapper.addEventListener('mousemove', showUserActive);
playerWrapper.addEventListener('touchstart', showUserActive);

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
  // If user is typing in search input, don't trigger shortcuts
  if (document.activeElement === searchInput) {
    if (e.key === 'Escape') searchInput.blur();
    return;
  }

  // Global shortcuts
  if (e.key === '/') {
    e.preventDefault();
    searchInput.focus();
    return;
  }

  // Player active shortcuts
  if (playerModal.classList.contains('active')) {
    showUserActive();

    if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      videoElement.currentTime = Math.min(videoElement.duration || Infinity, videoElement.currentTime + 10);
      triggerFeedback('10s ⏩');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
      triggerFeedback('⏪ 10s');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateVolume(Math.min(1, videoElement.volume + 0.1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateVolume(Math.max(0, videoElement.volume - 0.1));
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      muteBtn.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        closePlayer();
      }
    }
  }
});

// Shortcuts Modal Toggle
shortcutsHintBtn.addEventListener('click', () => {
  shortcutsModal.style.display = 'flex';
});

closeShortcutsBtn.addEventListener('click', () => {
  shortcutsModal.style.display = 'none';
});

shortcutsModal.addEventListener('click', (e) => {
  if (e.target === shortcutsModal) {
    shortcutsModal.style.display = 'none';
  }
});

// Initialize on page load
loadMovies();
