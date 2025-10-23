// Global state
let currentSong = null
let currentSongIndex = 0
let playlist = []
let isPlaying = false
let isShuffle = false
let repeatMode = 0 // 0: off, 1: repeat all, 2: repeat one
let currentUser = null

// DOM Elements
const audioPlayer = document.getElementById("audioPlayer")
const playBtn = document.getElementById("playBtn")
const prevBtn = document.getElementById("prevBtn")
const nextBtn = document.getElementById("nextBtn")
const shuffleBtn = document.getElementById("shuffleBtn")
const repeatBtn = document.getElementById("repeatBtn")
const progressSlider = document.getElementById("progressSlider")
const progressFill = document.getElementById("progressFill")
const currentTimeEl = document.getElementById("currentTime")
const durationEl = document.getElementById("duration")
const volumeSlider = document.getElementById("volumeSlider")
const volumeBtn = document.getElementById("volumeBtn")
const adminBtn = document.getElementById("adminBtn")

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth()
  await loadSongs()
  setupEventListeners()
  setupAudioListeners()
})

// Authentication
async function checkAuth() {
  const token = localStorage.getItem("token")
  if (!token) {
    window.location.href = "/index.html"
    return
  }

  try {
    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error("Authentication failed")
    }

    const data = await response.json()
    currentUser = data.user

    // Update UI with user info
    document.getElementById("userName").textContent = currentUser.username
    document.getElementById("userRole").textContent =
      currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)

    // Show upload button for artists and admins
    if (currentUser.role === "artist" || currentUser.role === "admin") {
      document.getElementById("uploadBtn").style.display = "flex"
    }

    // Show admin button for admins
    if (currentUser.role === "admin") {
      document.getElementById("adminBtn").style.display = "flex"
    }
  } catch (error) {
    console.error("Auth error:", error)
    localStorage.removeItem("token")
    window.location.href = "/index.html"
  }
}

// Load songs
async function loadSongs() {
  try {
    const response = await fetch("/api/songs")
    const songs = await response.json()
    playlist = songs

    displaySongs(songs, "allSongs")
    displayRecentlyPlayed(songs.slice(0, 6))
  } catch (error) {
    console.error("Error loading songs:", error)
    showError("Failed to load songs")
  }
}

// Display songs in grid
function displayRecentlyPlayed(songs) {
  const container = document.getElementById("recentlyPlayed")

  if (songs.length === 0) {
    container.innerHTML = '<p class="loading">No songs available</p>'
    return
  }

  container.innerHTML = songs
    .map(
      (song, index) => `
    <div class="song-card" data-index="${index}">
      <img src="${song.artwork_path || "/placeholder.jpg"}" alt="${song.title}" class="song-card-artwork" />
      <div class="song-card-title">${song.title}</div>
      <div class="song-card-artist">${song.artist}</div>
      <button class="song-card-play" data-song-id="${song.id}">
        <i class="fas fa-play"></i>
      </button>
    </div>
  `,
    )
    .join("")

  // Add click listeners
  container.querySelectorAll(".song-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (!e.target.closest(".song-card-play")) {
        const index = Number.parseInt(card.dataset.index)
        playSong(songs[index], index)
      }
    })
  })

  container.querySelectorAll(".song-card-play").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const songId = Number.parseInt(btn.dataset.songId)
      const song = songs.find((s) => s.id === songId)
      const index = songs.findIndex((s) => s.id === songId)
      playSong(song, index)
    })
  })
}

// Display songs in list
function displaySongs(songs, containerId) {
  const container = document.getElementById(containerId)

  if (songs.length === 0) {
    container.innerHTML = '<p class="loading">No songs available</p>'
    return
  }

  container.innerHTML = songs
    .map(
      (song, index) => `
    <div class="song-item ${
      currentSong && currentSong.id === song.id ? "playing" : ""
    }" data-index="${index}" data-song-id="${song.id}">
      <div class="song-item-number">${index + 1}</div>
      <div class="song-item-info">
        <img src="${song.artwork_path || "/placeholder.jpg"}" alt="${song.title}" class="song-item-artwork" />
        <div class="song-item-details">
          <div class="song-item-title">${song.title}</div>
          <div class="song-item-artist">${song.artist}</div>
        </div>
      </div>
      <div class="song-item-album">${song.album || "-"}</div>
      <div class="song-item-duration">${formatDuration(song.duration || 0)}</div>
      <div class="song-item-actions">
        <button class="btn-song-action btn-favorite" data-song-id="${song.id}">
          <i class="far fa-heart"></i>
        </button>
      </div>
    </div>
  `,
    )
    .join("")

  // Add click listeners
  container.querySelectorAll(".song-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (!e.target.closest(".btn-song-action")) {
        const index = Number.parseInt(item.dataset.index)
        playSong(songs[index], index)
      }
    })
  })

  container.querySelectorAll(".btn-favorite").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation()
      const songId = Number.parseInt(btn.dataset.songId)
      await toggleFavorite(songId, btn)
    })
  })
}

// Play song
async function playSong(song, index) {
  currentSong = song
  currentSongIndex = index

  // Update player UI
  document.getElementById("playerTitle").textContent = song.title
  document.getElementById("playerArtist").textContent = song.artist
  document.getElementById("playerArtwork").src = song.artwork_path || "/placeholder.jpg"

  // Load and play audio
  audioPlayer.src = song.file_path
  audioPlayer.play()
  isPlaying = true
  updatePlayButton()

  // Update active song in list
  document.querySelectorAll(".song-item").forEach((item) => {
    item.classList.remove("playing")
    if (Number.parseInt(item.dataset.songId) === song.id) {
      item.classList.add("playing")
    }
  })

  // Record play
  try {
    const token = localStorage.getItem("token")
    await fetch(`/api/songs/${song.id}/play`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch (error) {
    console.error("Error recording play:", error)
  }
}

// Player controls
function togglePlay() {
  if (!currentSong) return

  if (isPlaying) {
    audioPlayer.pause()
  } else {
    audioPlayer.play()
  }
  isPlaying = !isPlaying
  updatePlayButton()
}

function updatePlayButton() {
  const icon = playBtn.querySelector("i")
  icon.className = isPlaying ? "fas fa-pause" : "fas fa-play"
}

function playNext() {
  if (playlist.length === 0) return

  if (isShuffle) {
    currentSongIndex = Math.floor(Math.random() * playlist.length)
  } else {
    currentSongIndex = (currentSongIndex + 1) % playlist.length
  }

  playSong(playlist[currentSongIndex], currentSongIndex)
}

function playPrevious() {
  if (playlist.length === 0) return

  if (audioPlayer.currentTime > 3) {
    audioPlayer.currentTime = 0
    return
  }

  currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length
  playSong(playlist[currentSongIndex], currentSongIndex)
}

function toggleShuffle() {
  isShuffle = !isShuffle
  shuffleBtn.classList.toggle("active", isShuffle)
}

function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 3
  const icon = repeatBtn.querySelector("i")

  switch (repeatMode) {
    case 0:
      repeatBtn.classList.remove("active")
      icon.className = "fas fa-redo"
      break
    case 1:
      repeatBtn.classList.add("active")
      icon.className = "fas fa-redo"
      break
    case 2:
      repeatBtn.classList.add("active")
      icon.className = "fas fa-redo-alt"
      break
  }
}

// Audio listeners
function setupAudioListeners() {
  audioPlayer.addEventListener("timeupdate", () => {
    if (audioPlayer.duration) {
      const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100
      progressFill.style.width = `${progress}%`
      progressSlider.value = progress
      currentTimeEl.textContent = formatDuration(audioPlayer.currentTime)
    }
  })

  audioPlayer.addEventListener("loadedmetadata", () => {
    durationEl.textContent = formatDuration(audioPlayer.duration)
  })

  audioPlayer.addEventListener("ended", () => {
    if (repeatMode === 2) {
      audioPlayer.currentTime = 0
      audioPlayer.play()
    } else if (repeatMode === 1 || currentSongIndex < playlist.length - 1) {
      playNext()
    } else {
      isPlaying = false
      updatePlayButton()
    }
  })

  // Volume
  volumeSlider.addEventListener("input", (e) => {
    audioPlayer.volume = e.target.value / 100
    updateVolumeIcon()
  })

  // Set initial volume
  audioPlayer.volume = 0.7
}

function updateVolumeIcon() {
  const icon = volumeBtn.querySelector("i")
  const volume = audioPlayer.volume

  if (volume === 0) {
    icon.className = "fas fa-volume-mute"
  } else if (volume < 0.5) {
    icon.className = "fas fa-volume-down"
  } else {
    icon.className = "fas fa-volume-up"
  }
}

// Progress bar
progressSlider.addEventListener("input", (e) => {
  if (audioPlayer.duration) {
    const time = (e.target.value / 100) * audioPlayer.duration
    audioPlayer.currentTime = time
  }
})

// Event listeners
function setupEventListeners() {
  // Player controls
  playBtn.addEventListener("click", togglePlay)
  nextBtn.addEventListener("click", playNext)
  prevBtn.addEventListener("click", playPrevious)
  shuffleBtn.addEventListener("click", toggleShuffle)
  repeatBtn.addEventListener("click", toggleRepeat)

  // Volume
  volumeBtn.addEventListener("click", () => {
    if (audioPlayer.volume > 0) {
      audioPlayer.dataset.prevVolume = audioPlayer.volume
      audioPlayer.volume = 0
      volumeSlider.value = 0
    } else {
      audioPlayer.volume = audioPlayer.dataset.prevVolume || 0.7
      volumeSlider.value = audioPlayer.volume * 100
    }
    updateVolumeIcon()
  })

  // Navigation
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault()
      const page = item.dataset.page
      navigateTo(page)
    })
  })

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token")
    window.location.href = "/index.html"
  })

  // Upload modal
  const uploadBtn = document.getElementById("uploadBtn")
  const uploadModal = document.getElementById("uploadModal")
  const closeUploadModal = document.getElementById("closeUploadModal")
  const cancelUpload = document.getElementById("cancelUpload")
  const uploadForm = document.getElementById("uploadForm")

  if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
      uploadModal.classList.remove("hidden")
    })
  }

  closeUploadModal.addEventListener("click", () => {
    uploadModal.classList.add("hidden")
  })

  cancelUpload.addEventListener("click", () => {
    uploadModal.classList.add("hidden")
  })

  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    await handleUpload(e.target)
  })

  // Search
  const searchInput = document.getElementById("searchInput")
  let searchTimeout
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      handleSearch(e.target.value)
    }, 300)
  })

  // Admin button
  if (adminBtn) {
    adminBtn.addEventListener("click", () => {
      window.location.href = "/admin.html"
    })
  }
}

// Navigation
function navigateTo(page) {
  // Update active nav item
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active")
    if (item.dataset.page === page) {
      item.classList.add("active")
    }
  })

  // Show corresponding view
  document.querySelectorAll(".view-container").forEach((view) => {
    view.classList.add("hidden")
  })

  switch (page) {
    case "home":
      document.getElementById("homeView").classList.remove("hidden")
      break
    case "search":
      document.getElementById("searchView").classList.remove("hidden")
      break
    case "library":
      document.getElementById("libraryView").classList.remove("hidden")
      loadLibrary()
      break
    case "favorites":
      document.getElementById("favoritesView").classList.remove("hidden")
      loadFavorites()
      break
    case "playlists":
      // TODO: Implement create playlist
      showError("Create playlist feature coming soon!")
      break
  }
}

// Search
async function handleSearch(query) {
  if (!query.trim()) {
    document.getElementById("searchResults").innerHTML = ""
    return
  }

  try {
    const response = await fetch(`/api/songs/search/${encodeURIComponent(query)}`)
    const songs = await response.json()
    displaySongs(songs, "searchResults")
  } catch (error) {
    console.error("Search error:", error)
    showError("Search failed")
  }
}

// Library
async function loadLibrary() {
  const token = localStorage.getItem("token")
  try {
    const response = await fetch("/api/playlists", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const playlists = await response.json()

    const container = document.getElementById("libraryContent")
    if (playlists.length === 0) {
      container.innerHTML = '<p class="loading">No playlists yet</p>'
    } else {
      container.innerHTML = playlists
        .map(
          (playlist) => `
        <div class="song-card">
          <img src="/placeholder.jpg" alt="${playlist.name}" class="song-card-artwork" />
          <div class="song-card-title">${playlist.name}</div>
          <div class="song-card-artist">${playlist.description || "Playlist"}</div>
        </div>
      `,
        )
        .join("")
    }
  } catch (error) {
    console.error("Error loading library:", error)
  }
}

// Favorites
async function loadFavorites() {
  const token = localStorage.getItem("token")
  try {
    const response = await fetch("/api/favorites", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const songs = await response.json()

    document.getElementById("favoritesCount").textContent = `${songs.length} song${songs.length !== 1 ? "s" : ""}`
    displaySongs(songs, "favoritesSongs")
  } catch (error) {
    console.error("Error loading favorites:", error)
  }
}

async function toggleFavorite(songId, btn) {
  const token = localStorage.getItem("token")
  const isActive = btn.classList.contains("active")

  try {
    const response = await fetch(`/api/favorites/${songId}`, {
      method: isActive ? "DELETE" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.ok) {
      btn.classList.toggle("active")
      const icon = btn.querySelector("i")
      icon.className = isActive ? "far fa-heart" : "fas fa-heart"
    }
  } catch (error) {
    console.error("Error toggling favorite:", error)
    showError("Failed to update favorites")
  }
}

// Upload
async function handleUpload(form) {
  const formData = new FormData(form)
  const token = localStorage.getItem("token")

  try {
    const response = await fetch("/api/songs/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    const data = await response.json()

    if (response.ok) {
      showSuccess("Song uploaded successfully!")
      document.getElementById("uploadModal").classList.add("hidden")
      form.reset()
      await loadSongs()
    } else {
      showError(data.error || "Upload failed")
    }
  } catch (error) {
    console.error("Upload error:", error)
    showError("Upload failed")
  }
}

// Utility functions
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function showError(message) {
  alert(message) // TODO: Replace with better notification
}

function showSuccess(message) {
  alert(message) // TODO: Replace with better notification
}
