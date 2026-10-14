const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.ts']);
const SUBTITLE_EXTENSIONS = new Set(['.srt', '.vtt']);

// Format bytes to human readable string
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Clean messy scene/torrent release names into beautiful movie titles
function parseMovieMetadata(filename) {
  const ext = path.extname(filename);
  let base = path.basename(filename, ext);

  // Match 4-digit year (1900-2099)
  const yearMatch = base.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : null;

  // Match common resolutions and sources
  const qualityMatch = base.match(/\b(2160p|4k|1080p|720p|480p|360p|HDTC|HDCAM|HDRip|WEBRip|BluRay|BRRip|DVD|DVDRip)\b/i);
  const quality = qualityMatch ? qualityMatch[1].toUpperCase() : 'HD';

  // Match audio / codecs / language tags
  const audioMatch = base.match(/\b(Hindi|English|Tamil|Telugu|Dual Audio|Multi|Clean)\b/i);
  const audio = audioMatch ? audioMatch[1] : null;

  const codecMatch = base.match(/\b(x264|x265|hevc|h264|avc|aac)\b/i);
  const codec = codecMatch ? codecMatch[1].toUpperCase() : null;

  // Extract clean title (part before year or quality)
  let titlePart = base;
  if (yearMatch) {
    titlePart = base.substring(0, yearMatch.index);
  } else if (qualityMatch) {
    titlePart = base.substring(0, qualityMatch.index);
  }

  // Replace dots, underscores, dashes with spaces
  let cleanTitle = titlePart
    .replace(/[._\-+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize title properly
  if (!cleanTitle) cleanTitle = base;
  cleanTitle = cleanTitle
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return {
    title: cleanTitle,
    year: year || '',
    quality,
    audio: audio || '',
    codec: codec || ''
  };
}

// Recursively find all video files
function scanMovies(dir, fileList = [], baseDir = ROOT_DIR) {
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item.startsWith('.') || item === 'public' || item === 'node_modules') continue;
      const fullPath = path.join(dir, item);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          scanMovies(fullPath, fileList, baseDir);
        } else if (stats.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (VIDEO_EXTENSIONS.has(ext)) {
            const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            const meta = parseMovieMetadata(item);
            fileList.push({
              id: Buffer.from(relPath).toString('base64url'),
              filename: item,
              relativePath: relPath,
              title: meta.title,
              year: meta.year,
              quality: meta.quality,
              audio: meta.audio,
              codec: meta.codec,
              sizeBytes: stats.size,
              sizeFormatted: formatBytes(stats.size),
              mtime: stats.mtime
            });
          }
        }
      } catch (err) {
        // Skip inaccessible items
      }
    }
  } catch (err) {
    console.error('Error scanning dir:', dir, err);
  }
  return fileList;
}

// Find subtitle file for video if exists
function findSubtitle(videoFullPath) {
  const dir = path.dirname(videoFullPath);
  const baseName = path.basename(videoFullPath, path.extname(videoFullPath));
  for (const ext of ['.vtt', '.srt']) {
    const subPath = path.join(dir, baseName + ext);
    if (fs.existsSync(subPath)) {
      return { path: subPath, ext };
    }
  }
  return null;
}

// Convert SRT content to WebVTT
function srtToVtt(srtText) {
  let vtt = 'WEBVTT\n\n' + srtText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Replace commas in timestamps with periods (00:01:23,456 -> 00:01:23.456)
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return vtt;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.mkv': 'video/mp4', // MKV with H264/AAC is natively accepted as video/mp4 by Chromium
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.vtt': 'text/vtt; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');

  // API: Get movie list
  if (pathname === '/api/movies') {
    const movies = scanMovies(ROOT_DIR);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(movies));
  }

  // API: Stream video with HTTP 206 Range requests
  if (pathname === '/api/stream') {
    const relFile = parsedUrl.query.file;
    if (!relFile) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Missing file parameter');
    }

    const safePath = path.normalize(relFile).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(ROOT_DIR, safePath);

    if (!fs.existsSync(fullPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Movie file not found');
    }

    const stats = fs.statSync(fullPath);
    const fileSize = stats.size;
    const range = req.headers.range;
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'video/mp4';

    if (range) {
      // Range: bytes=start-end
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 5 * 1024 * 1024, fileSize - 1); // 5MB chunks for ultra snappy seek

      if (start >= fileSize) {
        res.writeHead(416, {
          'Content-Range': `bytes */${fileSize}`
        });
        return res.end();
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(fullPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });

      fileStream.pipe(res);
      fileStream.on('error', (err) => {
        console.error('Stream read error:', err.message);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end();
        }
      });
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType
      });
      fs.createReadStream(fullPath).pipe(res);
    }
    return;
  }

  // API: Subtitles
  if (pathname === '/api/subtitles') {
    const relFile = parsedUrl.query.file;
    if (!relFile) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Missing file parameter');
    }
    const safePath = path.normalize(relFile).replace(/^(\.\.[\/\\])+/, '');
    const videoFullPath = path.join(ROOT_DIR, safePath);
    const sub = findSubtitle(videoFullPath);

    if (!sub) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('No subtitles found');
    }

    try {
      const content = fs.readFileSync(sub.path, 'utf8');
      const vtt = sub.ext === '.srt' ? srtToVtt(content) : content;
      res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8' });
      return res.end(vtt);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Error loading subtitles');
    }
  }

  // Serve static files from public/ directory
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  const staticPath = path.join(PUBLIC_DIR, reqPath);

  // Security check: ensure path is within PUBLIC_DIR
  if (!staticPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    const ext = path.extname(staticPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    return fs.createReadStream(staticPath).pipe(res);
  }

  // Fallback to index.html for SPA
  const fallbackIndex = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(fallbackIndex)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(fallbackIndex).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🍿 CineLocal Movie Server running!`);
  console.log(`👉 Open in browser: http://localhost:${PORT}`);
  console.log(`📁 Scanning directory: ${ROOT_DIR}`);
  console.log(`=======================================================`);
});
