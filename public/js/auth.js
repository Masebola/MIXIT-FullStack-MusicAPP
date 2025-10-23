// Authentication utility functions

function getToken() {
  return localStorage.getItem("token")
}

function getUser() {
  const userStr = localStorage.getItem("user")
  return userStr ? JSON.parse(userStr) : null
}

function isAuthenticated() {
  return !!getToken()
}

function logout() {
  localStorage.removeItem("token")
  localStorage.removeItem("user")
  window.location.href = "/index.html"
}

function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = "/index.html"
  }
}

function requireRole(...roles) {
  const user = getUser()
  if (!user || !roles.includes(user.role)) {
    window.location.href = "/index.html"
  }
}

// API request helper with authentication
async function apiRequest(url, options = {}) {
  const token = getToken()

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (response.status === 401 || response.status === 403) {
    logout()
    throw new Error("Authentication required")
  }

  return response
}
