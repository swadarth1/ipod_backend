console.log('Server script started');

require('dotenv').config(); // Load environment variables
const express = require('express'); // Web framework
const axios = require('axios'); // HTTP client
const { transliterate } = require('transliteration'); // Transliteration for non-Latin characters

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables or fallback
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || '2dd71574bea806df5e58657c7aa1b0c1';
const LASTFM_USERNAME = process.env.LASTFM_USERNAME || 'swaddi';

// Utility function to truncate and sanitize text
const truncateText = (text, maxLength = 50) => {
  const sanitizedText = transliterate(text || 'Unknown'); // Handle null/undefined input
  return sanitizedText.length > maxLength
    ? sanitizedText.slice(0, maxLength) + '...' // Truncate with ellipsis
    : sanitizedText;
};

// Fetch track details from Last.fm
const fetchTrackDetails = async (page = 1) => {
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USERNAME}&api_key=${LASTFM_API_KEY}&format=json&page=${page}`;

  try {
    const response = await axios.get(url);
    const recentTracks = response.data.recenttracks?.track || [];
    const user = response.data.recenttracks?.['@attr']?.user || 'Unknown User';

    if (recentTracks.length === 0) {
      console.warn('No recent tracks found.');
      return null;
    }

    // Get the currently playing track or the most recent one
    const nowPlayingTrack = recentTracks.find(track => track['@attr']?.nowplaying === 'true') || recentTracks[0];

    // Now fetch additional information (like userplaycount) for the track
    const trackInfoUrl = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(nowPlayingTrack.artist['#text'])}&track=${encodeURIComponent(nowPlayingTrack.name)}&username=${LASTFM_USERNAME}&api_key=${LASTFM_API_KEY}&format=json`;
    
    const trackInfoResponse = await axios.get(trackInfoUrl);
    const trackInfo = trackInfoResponse.data.track || {};

    // Format the track details, now including userplaycount
    const trackDetails = {
      title: truncateText(nowPlayingTrack.name, 43),
      artist: truncateText(nowPlayingTrack.artist?.['#text'], 41),
      album: truncateText(nowPlayingTrack.album?.['#text'], 41),
      artwork: nowPlayingTrack.image?.find(img => img.size === 'extralarge')?.['#text'] ||
               'https://via.placeholder.com/300',
      url: nowPlayingTrack.url || 'https://www.last.fm',
      nowPlaying: !!nowPlayingTrack['@attr']?.nowplaying,
      userplaycount: trackInfo.userplaycount || 0,  // Add userplaycount to the details
      totalplaycount: nowPlayingTrack,
      user: user,
    };

    console.log('Formatted Track Details:', trackDetails);
    return trackDetails;
  } catch (error) {
    console.error('Error fetching track details:', error.message);
    return null;
  }
};

// API endpoint to serve track details
app.get('/current-track', async (req, res) => {
  try {
    const trackDetails = await fetchTrackDetails();
    if (trackDetails) {
      res.json(trackDetails); // Explicitly return the track details as JSON
    } else {
      res.status(404).json({ error: 'No track information available.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error fetching track details.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Code updated and running!');
});