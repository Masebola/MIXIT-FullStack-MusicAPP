// Global state
let currentUser = null
let deleteCallback = null

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth()
  await loadOverview()
  setupEventListeners()
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

    // Check if user is admin
    if (currentUser.role !== "admin") {
      alert("Access denied. Admin privileges required.")
      window.location.href = "/home.html"
      return
    }

    // Update UI with user info
    document.getElementById("adminName").textContent = currentUser.username
  } catch (error) {
    console.error("Auth error:", error)
    localStorage.removeItem("token")
    window.location.href = "/index.html"
  }
}

// Load Overview
async function loadOverview() {
  const token = localStorage.getItem("token")

  try {
    // Load stats
    const statsResponse = await fetch("/api/admin/stats", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const stats = await statsResponse.json()

    document.getElementById("totalUsers").textContent = stats.totalUsers || 0
    document.getElementById("totalSongs").textContent = stats.totalSongs || 0
    document.getElementById("totalPlaylists").textContent = stats.totalPlaylists || 0
    document.getElementById("totalPlays").textContent = stats.totalPlays || 0

    // Load top songs
    const songsResponse = await fetch("/api/songs")
    const songs = await songsResponse.json()
    const topSongs = songs.sort((a, b) => (b.play_count || 0) - (a.play_count || 0)).slice(0, 5)

    displayTopSongs(topSongs)

    // Display recent activity
    displayRecentActivity(songs.slice(0, 5))
  } catch (error) {
    console.error("Error loading overview:", error)
    showError("Failed to load dashboard data")
  }
}

// Display top songs
function displayTopSongs(songs) {
  const tbody = document.getElementById("topSongs")

  if (songs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading">No songs yet</td></tr>'
    return
  }

  tbody.innerHTML = songs
    .map(
      (song, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${song.title}</td>
      <td>${song.artist}</td>
      <td>${song.play_count || 0}</td>
    </tr>
  `,
    )
    .join("")
}

// Display recent activity
function displayRecentActivity(songs) {
  const container = document.getElementById("recentActivity")

  if (songs.length === 0) {
    container.innerHTML = '<div class="loading">No recent activity</div>'
    return
  }

  container.innerHTML = songs
    .map(
      (song) => `
    <div class="activity-item">
      <div class="activity-icon" style="background-color: #1db954;">
        <i class="fas fa-music"></i>
      </div>
      <div class="activity-info">
        <div class="activity-text">New song uploaded: <strong>${song.title}</strong> by ${song.artist}</div>
        <div class="activity-time">Recently</div>
      </div>
    </div>
  `,
    )
    .join("")
}

// Load Users
async function loadUsers() {
  const token = localStorage.getItem("token")

  try {
    const response = await fetch("/api/admin/users", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const users = await response.json()

    displayUsers(users)
  } catch (error) {
    console.error("Error loading users:", error)
    showError("Failed to load users")
  }
}

// Display users
function displayUsers(users) {
  const tbody = document.getElementById("usersTable")

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">No users found</td></tr>'
    return
  }

  tbody.innerHTML = users
    .map(
      (user) => `
    <tr>
      <td>${user.id}</td>
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td><span class="role-badge ${user.role}">${user.role}</span></td>
      <td>${new Date(user.created_at).toLocaleDateString()}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-action edit" onclick="editUser(${user.id})">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="btn-action delete" onclick="deleteUser(${user.id}, '${user.username}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("")
}

// Load Songs
async function loadSongs() {
  try {
    const response = await fetch("/api/songs")
    const songs = await response.json()

    displaySongsTable(songs)
  } catch (error) {
    console.error("Error loading songs:", error)
    showError("Failed to load songs")
  }
}

// Display songs table
function displaySongsTable(songs) {
  const tbody = document.getElementById("songsTable")

  if (songs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">No songs found</td></tr>'
    return
  }

  tbody.innerHTML = songs
    .map(
      (song) => `
    <tr>
      <td>${song.id}</td>
      <td>${song.title}</td>
      <td>${song.artist}</td>
      <td>${song.album || "-"}</td>
      <td>${song.genre || "-"}</td>
      <td>${song.play_count || 0}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-action delete" onclick="deleteSong(${song.id}, '${song.title}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("")
}

// Load Playlists
async function loadPlaylists() {
  const token = localStorage.getItem("token")

  try {
    // Note: This endpoint would need to be created to get all playlists
    // For now, we'll show a placeholder
    const container = document.getElementById("playlistsGrid")
    container.innerHTML = '<div class="loading">Playlist management coming soon</div>'
  } catch (error) {
    console.error("Error loading playlists:", error)
  }
}

// Delete User
function deleteUser(userId, username) {
  showDeleteModal(`Are you sure you want to delete user "${username}"? This action cannot be undone.`, async () => {
    const token = localStorage.getItem("token")
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        showSuccess("User deleted successfully")
        await loadUsers()
      } else {
        showError("Failed to delete user")
      }
    } catch (error) {
      console.error("Error deleting user:", error)
      showError("Failed to delete user")
    }
  })
}

// Delete Song
function deleteSong(songId, title) {
  showDeleteModal(`Are you sure you want to delete "${title}"? This action cannot be undone.`, async () => {
    const token = localStorage.getItem("token")
    try {
      const response = await fetch(`/api/songs/${songId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        showSuccess("Song deleted successfully")
        await loadSongs()
      } else {
        showError("Failed to delete song")
      }
    } catch (error) {
      console.error("Error deleting song:", error)
      showError("Failed to delete song")
    }
  })
}

// Edit User (placeholder)
function editUser(userId) {
  showError("Edit user feature coming soon!")
}

// Show delete modal
function showDeleteModal(message, callback) {
  const modal = document.getElementById("deleteModal")
  const messageEl = document.getElementById("deleteMessage")

  messageEl.textContent = message
  deleteCallback = callback
  modal.classList.remove("hidden")
}

// Event Listeners
function setupEventListeners() {
  // Navigation
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (item.dataset.page) {
        e.preventDefault()
        navigateTo(item.dataset.page)
      }
    })
  })

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token")
    window.location.href = "/index.html"
  })

  // Refresh
  document.getElementById("refreshBtn").addEventListener("click", async () => {
    const activeNav = document.querySelector(".nav-item.active")
    const page = activeNav ? activeNav.dataset.page : "overview"
    await navigateTo(page)
  })

  // Delete modal
  document.getElementById("closeDeleteModal").addEventListener("click", () => {
    document.getElementById("deleteModal").classList.add("hidden")
    deleteCallback = null
  })

  document.getElementById("cancelDelete").addEventListener("click", () => {
    document.getElementById("deleteModal").classList.add("hidden")
    deleteCallback = null
  })

  document.getElementById("confirmDelete").addEventListener("click", () => {
    if (deleteCallback) {
      deleteCallback()
    }
    document.getElementById("deleteModal").classList.add("hidden")
    deleteCallback = null
  })

  // Search functionality
  let searchTimeout

  document.getElementById("userSearch")?.addEventListener("input", (e) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      filterTable("usersTable", e.target.value)
    }, 300)
  })

  document.getElementById("songSearch")?.addEventListener("input", (e) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      filterTable("songsTable", e.target.value)
    }, 300)
  })
}

// Navigation
async function navigateTo(page) {
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

  // Update page title and load data
  switch (page) {
    case "overview":
      document.getElementById("pageTitle").textContent = "Dashboard Overview"
      document.getElementById("overviewView").classList.remove("hidden")
      await loadOverview()
      break
    case "users":
      document.getElementById("pageTitle").textContent = "User Management"
      document.getElementById("usersView").classList.remove("hidden")
      await loadUsers()
      break
    case "songs":
      document.getElementById("pageTitle").textContent = "Song Management"
      document.getElementById("songsView").classList.remove("hidden")
      await loadSongs()
      break
    case "playlists":
      document.getElementById("pageTitle").textContent = "Playlist Management"
      document.getElementById("playlistsView").classList.remove("hidden")
      await loadPlaylists()
      break
  }
}

// Filter table
function filterTable(tableId, query) {
  const table = document.getElementById(tableId)
  const rows = table.querySelectorAll("tr")

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase()
    if (text.includes(query.toLowerCase())) {
      row.style.display = ""
    } else {
      row.style.display = "none"
    }
  })
}

// Utility functions
function showError(message) {
  alert(message) // TODO: Replace with better notification
}

function showSuccess(message) {
  alert(message) // TODO: Replace with better notification
}
