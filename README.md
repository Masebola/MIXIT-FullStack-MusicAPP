# MIXIT - Music Streaming Application

A full-stack music streaming web application built with vanilla HTML, CSS, JavaScript, Node.js, Express, and SQLite.

## Features

- **User Authentication**: Login, Signup, and Admin Login
- **Role-Based Access Control**: 
  - **Listeners**: Play music, create playlists, add favorites
  - **Artists**: All listener features + upload songs
  - **Admin**: Full access including user management and statistics
- **Music Player**: Play, pause, skip, volume control, progress bar
- **Library Management**: Browse songs, search, filter by genre
- **Playlists**: Create and manage custom playlists
- **Favorites**: Save favorite songs
- **Upload System**: Artists and admins can upload songs with metadata and artwork

## Installation

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Start the server:
\`\`\`bash
npm start
\`\`\`

3. Open your browser and navigate to `http://localhost:3000`

## Default Admin Credentials

- Username: `admin`
- Password: `admin123`

**Important**: Change the admin password after first login!

## Project Structure

\`\`\`
mixit/
├── server.js              # Express server and API routes
├── package.json           # Dependencies
├── mixit.db              # SQLite database (auto-created)
├── uploads/              # Uploaded files
│   ├── songs/           # Audio files
│   └── artwork/         # Album artwork
└── public/              # Frontend files
    ├── index.html       # Landing/Login page
    ├── signup.html      # Registration page
    ├── home.html        # Main app interface
    ├── admin.html       # Admin dashboard
    ├── css/            # Stylesheets
    └── js/             # JavaScript files
\`\`\`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/admin-login` - Admin login
- `GET /api/auth/me` - Get current user

### Songs
- `GET /api/songs` - Get all songs
- `GET /api/songs/:id` - Get song by ID
- `POST /api/songs/upload` - Upload song (artist/admin)
- `DELETE /api/songs/:id` - Delete song (admin/uploader)
- `GET /api/songs/search/:query` - Search songs
- `POST /api/songs/:id/play` - Record play

### Favorites
- `GET /api/favorites` - Get user favorites
- `POST /api/favorites/:songId` - Add to favorites
- `DELETE /api/favorites/:songId` - Remove from favorites

### Playlists
- `GET /api/playlists` - Get user playlists
- `POST /api/playlists` - Create playlist
- `GET /api/playlists/:id/songs` - Get playlist songs
- `POST /api/playlists/:id/songs/:songId` - Add song to playlist
- `DELETE /api/playlists/:id` - Delete playlist

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `GET /api/admin/stats` - Get statistics (admin only)

## Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Password Hashing**: bcrypt

## User Roles

1. **Listener**: Can play music, create playlists, and add favorites
2. **Artist**: All listener features + ability to upload songs
3. **Admin**: Full system access including user management and statistics
