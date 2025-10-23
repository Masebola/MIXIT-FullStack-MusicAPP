const express = require("express")
const sqlite3 = require("sqlite3").verbose()
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const cors = require("cors")

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || "mixit-secret-key-change-in-production"

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static("public"))
app.use("/uploads", express.static("uploads"))

// Create uploads directories
const dirs = ["uploads/songs", "uploads/artwork"]
dirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// Database setup
const db = new sqlite3.Database("./mixit.db", (err) => {
  if (err) {
    console.error("Error opening database:", err)
  } else {
    console.log("Connected to SQLite database")
    initializeDatabase()
  }
})

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Users table with role field
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('listener', 'artist', 'admin')),
      display_name TEXT,
      bio TEXT,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)

    // Songs table
    db.run(`CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT,
      genre TEXT,
      duration INTEGER,
      file_path TEXT NOT NULL,
      artwork_path TEXT,
      uploaded_by INTEGER,
      play_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )`)

    // Favorites table
    db.run(`CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (song_id) REFERENCES songs(id),
      UNIQUE(user_id, song_id)
    )`)

    // Playlists table
    db.run(`CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      cover_image TEXT,
      is_public BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`)

    // Playlist items table
    db.run(`CREATE TABLE IF NOT EXISTS playlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      position INTEGER,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id) REFERENCES songs(id)
    )`)

    // Recently played table
    db.run(`CREATE TABLE IF NOT EXISTS recently_played (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (song_id) REFERENCES songs(id)
    )`)

    // Create default admin account
    const adminPassword = bcrypt.hashSync("admin123", 10)
    db.run(
      `INSERT OR IGNORE INTO users (username, email, password, role, display_name) 
            VALUES ('admin', 'admin@mixit.com', ?, 'admin', 'Admin')`,
      [adminPassword],
    )

    console.log("Database initialized successfully")
  })
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "song") {
      cb(null, "uploads/songs")
    } else if (file.fieldname === "artwork") {
      cb(null, "uploads/artwork")
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "song") {
      if (file.mimetype.startsWith("audio/")) {
        cb(null, true)
      } else {
        cb(new Error("Only audio files are allowed"))
      }
    } else if (file.fieldname === "artwork") {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true)
      } else {
        cb(new Error("Only image files are allowed"))
      }
    }
  },
})

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" })
    }
    req.user = user
    next()
  })
}

// Role-based authorization middleware
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied. Insufficient permissions." })
    }
    next()
  }
}

// ============ AUTH ROUTES ============

// Register new user
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password, role, display_name } = req.body

  // Validate role
  if (!["listener", "artist"].includes(role)) {
    return res.status(400).json({ error: "Invalid role. Must be listener or artist." })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    db.run(
      `INSERT INTO users (username, email, password, role, display_name) VALUES (?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, role, display_name || username],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(400).json({ error: "Username or email already exists" })
          }
          return res.status(500).json({ error: "Registration failed" })
        }

        const token = jwt.sign({ id: this.lastID, username, role }, JWT_SECRET, { expiresIn: "7d" })

        res.status(201).json({
          message: "User registered successfully",
          token,
          user: { id: this.lastID, username, email, role, display_name: display_name || username },
        })
      },
    )
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body

  db.get(`SELECT * FROM users WHERE username = ? OR email = ?`, [username, username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Server error" })
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" })

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
      },
    })
  })
})

// Admin login (same as regular login but validates admin role)
app.post("/api/auth/admin-login", (req, res) => {
  const { username, password } = req.body

  db.get(
    `SELECT * FROM users WHERE (username = ? OR email = ?) AND role = 'admin'`,
    [username, username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: "Server error" })
      }

      if (!user) {
        return res.status(401).json({ error: "Invalid admin credentials" })
      }

      const validPassword = await bcrypt.compare(password, user.password)
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid admin credentials" })
      }

      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" })

      res.json({
        message: "Admin login successful",
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          display_name: user.display_name,
        },
      })
    },
  )
})

// Get current user
app.get("/api/auth/me", authenticateToken, (req, res) => {
  db.get(
    `SELECT id, username, email, role, display_name, bio, avatar_url FROM users WHERE id = ?`,
    [req.user.id],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: "User not found" })
      }
      res.json({ user: user })
    },
  )
})

// ============ SONG ROUTES ============

// Get all songs
app.get("/api/songs", (req, res) => {
  db.all(`SELECT * FROM songs ORDER BY created_at DESC`, [], (err, songs) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch songs" })
    }
    res.json(songs)
  })
})

// Get song by ID
app.get("/api/songs/:id", (req, res) => {
  db.get(`SELECT * FROM songs WHERE id = ?`, [req.params.id], (err, song) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch song" })
    }
    if (!song) {
      return res.status(404).json({ error: "Song not found" })
    }
    res.json(song)
  })
})

// Upload song (artists and admin only)
app.post(
  "/api/songs/upload",
  authenticateToken,
  authorizeRoles("artist", "admin"),
  upload.fields([
    { name: "song", maxCount: 1 },
    { name: "artwork", maxCount: 1 },
  ]),
  (req, res) => {
    const { title, artist, album, genre, duration } = req.body
    const songFile = req.files["song"] ? req.files["song"][0] : null
    const artworkFile = req.files["artwork"] ? req.files["artwork"][0] : null

    if (!songFile) {
      return res.status(400).json({ error: "Song file is required" })
    }

    const songPath = `/uploads/songs/${songFile.filename}`
    const artworkPath = artworkFile ? `/uploads/artwork/${artworkFile.filename}` : null

    db.run(
      `INSERT INTO songs (title, artist, album, genre, duration, file_path, artwork_path, uploaded_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, artist, album, genre, duration, songPath, artworkPath, req.user.id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: "Failed to upload song" })
        }

        res.status(201).json({
          message: "Song uploaded successfully",
          song: {
            id: this.lastID,
            title,
            artist,
            album,
            genre,
            duration,
            file_path: songPath,
            artwork_path: artworkPath,
          },
        })
      },
    )
  },
)

// Delete song (admin and uploader only)
app.delete("/api/songs/:id", authenticateToken, (req, res) => {
  db.get(`SELECT * FROM songs WHERE id = ?`, [req.params.id], (err, song) => {
    if (err || !song) {
      return res.status(404).json({ error: "Song not found" })
    }

    // Check if user is admin or the uploader
    if (req.user.role !== "admin" && song.uploaded_by !== req.user.id) {
      return res.status(403).json({ error: "Access denied" })
    }

    db.run(`DELETE FROM songs WHERE id = ?`, [req.params.id], (err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to delete song" })
      }

      // Delete files
      if (song.file_path) {
        fs.unlink(path.join(__dirname, song.file_path), () => {})
      }
      if (song.artwork_path) {
        fs.unlink(path.join(__dirname, song.artwork_path), () => {})
      }

      res.json({ message: "Song deleted successfully" })
    })
  })
})

// Search songs
app.get("/api/songs/search/:query", (req, res) => {
  const query = `%${req.params.query}%`
  db.all(
    `SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR genre LIKE ?`,
    [query, query, query, query],
    (err, songs) => {
      if (err) {
        return res.status(500).json({ error: "Search failed" })
      }
      res.json(songs)
    },
  )
})

// Increment play count
app.post("/api/songs/:id/play", authenticateToken, (req, res) => {
  db.run(`UPDATE songs SET play_count = play_count + 1 WHERE id = ?`, [req.params.id])
  db.run(`INSERT INTO recently_played (user_id, song_id) VALUES (?, ?)`, [req.user.id, req.params.id])
  res.json({ message: "Play recorded" })
})

// ============ FAVORITES ROUTES ============

// Get user favorites
app.get("/api/favorites", authenticateToken, (req, res) => {
  db.all(
    `SELECT s.* FROM songs s 
     INNER JOIN favorites f ON s.id = f.song_id 
     WHERE f.user_id = ? 
     ORDER BY f.created_at DESC`,
    [req.user.id],
    (err, songs) => {
      if (err) {
        return res.status(500).json({ error: "Failed to fetch favorites" })
      }
      res.json(songs)
    },
  )
})

// Add to favorites
app.post("/api/favorites/:songId", authenticateToken, (req, res) => {
  db.run(`INSERT INTO favorites (user_id, song_id) VALUES (?, ?)`, [req.user.id, req.params.songId], (err) => {
    if (err) {
      if (err.message.includes("UNIQUE")) {
        return res.status(400).json({ error: "Song already in favorites" })
      }
      return res.status(500).json({ error: "Failed to add favorite" })
    }
    res.json({ message: "Added to favorites" })
  })
})

// Remove from favorites
app.delete("/api/favorites/:songId", authenticateToken, (req, res) => {
  db.run(`DELETE FROM favorites WHERE user_id = ? AND song_id = ?`, [req.user.id, req.params.songId], (err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to remove favorite" })
    }
    res.json({ message: "Removed from favorites" })
  })
})

// ============ PLAYLIST ROUTES ============

// Get user playlists
app.get("/api/playlists", authenticateToken, (req, res) => {
  db.all(`SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id], (err, playlists) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch playlists" })
    }
    res.json(playlists)
  })
})

// Create playlist
app.post("/api/playlists", authenticateToken, (req, res) => {
  const { name, description, is_public } = req.body

  db.run(
    `INSERT INTO playlists (user_id, name, description, is_public) VALUES (?, ?, ?, ?)`,
    [req.user.id, name, description, is_public ? 1 : 0],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Failed to create playlist" })
      }
      res.status(201).json({
        message: "Playlist created",
        playlist: { id: this.lastID, name, description, is_public },
      })
    },
  )
})

// Get playlist songs
app.get("/api/playlists/:id/songs", authenticateToken, (req, res) => {
  db.all(
    `SELECT s.*, pi.position FROM songs s
     INNER JOIN playlist_items pi ON s.id = pi.song_id
     WHERE pi.playlist_id = ?
     ORDER BY pi.position`,
    [req.params.id],
    (err, songs) => {
      if (err) {
        return res.status(500).json({ error: "Failed to fetch playlist songs" })
      }
      res.json(songs)
    },
  )
})

// Add song to playlist
app.post("/api/playlists/:id/songs/:songId", authenticateToken, (req, res) => {
  db.get(
    `SELECT MAX(position) as max_pos FROM playlist_items WHERE playlist_id = ?`,
    [req.params.id],
    (err, result) => {
      const position = (result?.max_pos || 0) + 1

      db.run(
        `INSERT INTO playlist_items (playlist_id, song_id, position) VALUES (?, ?, ?)`,
        [req.params.id, req.params.songId, position],
        (err) => {
          if (err) {
            return res.status(500).json({ error: "Failed to add song to playlist" })
          }
          res.json({ message: "Song added to playlist" })
        },
      )
    },
  )
})

// Delete playlist
app.delete("/api/playlists/:id", authenticateToken, (req, res) => {
  db.run(`DELETE FROM playlists WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], (err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to delete playlist" })
    }
    res.json({ message: "Playlist deleted" })
  })
})

// ============ ADMIN ROUTES ============

// Get all users (admin only)
app.get("/api/admin/users", authenticateToken, authorizeRoles("admin"), (req, res) => {
  db.all(
    `SELECT id, username, email, role, display_name, created_at FROM users ORDER BY created_at DESC`,
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: "Failed to fetch users" })
      }
      res.json(users)
    },
  )
})

// Get statistics (admin only)
app.get("/api/admin/stats", authenticateToken, authorizeRoles("admin"), (req, res) => {
  const stats = {}

  db.get(`SELECT COUNT(*) as count FROM users`, [], (err, result) => {
    stats.totalUsers = result?.count || 0

    db.get(`SELECT COUNT(*) as count FROM songs`, [], (err, result) => {
      stats.totalSongs = result?.count || 0

      db.get(`SELECT COUNT(*) as count FROM playlists`, [], (err, result) => {
        stats.totalPlaylists = result?.count || 0

        db.get(`SELECT SUM(play_count) as total FROM songs`, [], (err, result) => {
          stats.totalPlays = result?.total || 0
          res.json(stats)
        })
      })
    })
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`MIXIT server running on http://localhost:${PORT}`)
})
