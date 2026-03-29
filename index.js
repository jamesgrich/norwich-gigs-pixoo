import fs from 'fs';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createCanvas } from 'canvas';

// ── Config ─────────────────────────────────────────────────────────────────────
const cfg        = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const PIXOO_IP   = cfg.pixooIp || '192.168.0.72';
const SIZE       = 64;
const FRAME_MS   = 5000;          // ms per gig card
const REFRESH_MS = 30 * 60_000;   // re-fetch every 30 min
const LOCK_FILE  = './gigs.lock';
const UA         = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';

// ── Material Design colours ────────────────────────────────────────────────────
const C = {
  bg:      '#121212',
  hdrBg:   '#1A237E',   // Indigo 900
  hdrLine: '#536DFE',   // Indigo A200
  hdrTxt:  '#E8EAF6',   // Indigo 50
  band:    '#FFFFFF',
  venue:   '#26C6DA',   // Cyan 400
  genre:   '#FFA726',   // Orange 400
  price:   '#66BB6A',   // Green 400
  soldOut: '#EF5350',   // Red 400
  time:    '#90A4AE',   // Blue Grey 300
  dot:     '#283593',   // Indigo 800
  dotOn:   '#C5CAE9',   // Indigo 100
  noGigs:  '#546E7A',   // Blue Grey 600
};

// ── 3×5 pixel font ─────────────────────────────────────────────────────────────
const PF = {
  "0":[[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
  "1":[[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
  "2":[[1,1,1],[0,0,1],[0,1,1],[1,0,0],[1,1,1]],
  "3":[[1,1,1],[0,0,1],[0,1,1],[0,0,1],[1,1,1]],
  "4":[[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
  "5":[[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
  "6":[[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
  "7":[[1,1,1],[0,0,1],[0,1,0],[0,1,0],[0,1,0]],
  "8":[[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
  "9":[[1,1,1],[1,0,1],[1,1,1],[0,0,1],[0,1,1]],
  ".":[[0],[0],[0],[0],[1]],
  ":":[[0],[1],[0],[1],[0]],
  "/":[[0,0,1],[0,1,0],[0,1,0],[1,0,0],[1,0,0]],
  "-":[[0,0,0],[0,0,0],[1,1,1],[0,0,0],[0,0,0]],
  "'":[[1],[1],[0],[0],[0]],
  "!":[[0,1],[0,1],[0,1],[0,0],[0,1]],
  "£":[[0,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
  "a":[[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  "b":[[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
  "c":[[0,1,1],[1,0,0],[1,0,0],[1,0,0],[0,1,1]],
  "d":[[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
  "e":[[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
  "f":[[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,0,0]],
  "g":[[0,1,1],[1,0,0],[1,0,1],[1,0,1],[0,1,1]],
  "h":[[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  "i":[[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
  "j":[[0,0,1],[0,0,1],[0,0,1],[1,0,1],[0,1,0]],
  "k":[[1,0,1],[1,1,0],[1,0,0],[1,1,0],[1,0,1]],
  "l":[[1,0],[1,0],[1,0],[1,0],[1,1]],
  "m":[[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  "n":[[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1]],
  "o":[[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
  "p":[[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
  "q":[[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,1]],
  "r":[[1,1,0],[1,0,1],[1,1,0],[1,1,0],[1,0,1]],
  "s":[[0,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0]],
  "t":[[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,1]],
  "u":[[1,0,1],[1,0,1],[1,0,1],[1,0,1],[0,1,1]],
  "v":[[1,0,1],[1,0,1],[1,0,1],[0,1,0],[0,1,0]],
  "w":[[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1]],
  "x":[[1,0,1],[0,1,0],[0,1,0],[0,1,0],[1,0,1]],
  "y":[[1,0,1],[1,0,1],[0,1,0],[0,1,0],[0,1,0]],
  "z":[[1,1,1],[0,0,1],[0,1,0],[1,0,0],[1,1,1]],
  " ":[[0],[0],[0],[0],[0]],
};

const pfCharW = (ch, S) => ((PF[ch]?.[0]?.length ?? 3) + 1) * S;
const pfWidth  = (str, S) => str.length === 0 ? 0 : [...str].reduce((w,c) => w + pfCharW(c, S), 0) - S;

function pfDraw(ctx, str, x, y, col, S) {
  ctx.fillStyle = col;
  let cx = x;
  for (const ch of str) {
    const g = PF[ch];
    if (g) for (let r = 0; r < g.length; r++)
      for (let c = 0; c < g[r].length; c++)
        if (g[r][c]) ctx.fillRect(cx + c*S, y + r*S, S, S);
    cx += pfCharW(ch, S);
  }
}

const pfCenter = (ctx, str, y, col, S) =>
  pfDraw(ctx, str, Math.round((SIZE - pfWidth(str, S)) / 2), y, col, S);

// Wrap string into lines that fit within maxW at scale S
function pfWrap(str, maxW, S) {
  const safe = str.toLowerCase().split('').map(c => PF[c] ? c : ' ').join('').replace(/  +/g, ' ').trim();
  const words = safe.split(' ');
  const lines = []; let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (pfWidth(test, S) <= maxW) { line = test; }
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

function pfFit(str, maxW, S) {
  const safe = str.toLowerCase()
    .replace(/[^a-z0-9 \-'!£.:/]/g, '')
    .replace(/  +/g, ' ').trim();
  if (!safe || pfWidth(safe, S) <= maxW) return safe;
  const ell = '...';
  const ellW = pfWidth(ell, S);
  let out = '';
  for (const ch of safe) {
    if (pfWidth(out + ch, S) + ellW + S > maxW) break;
    out += ch;
  }
  return out.trimEnd() + ell;
}

// ── Canvas helpers ─────────────────────────────────────────────────────────────
function mk() {
  const cv = createCanvas(SIZE, SIZE);
  const cx = cv.getContext('2d');
  cx.antialias = 'none';
  cx.fillStyle = C.bg; cx.fillRect(0, 0, SIZE, SIZE);
  return { cv, cx };
}

function toData(cv) {
  const cx = cv.getContext('2d');
  const { data } = cx.getImageData(0, 0, SIZE, SIZE);
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  for (let i = 0; i < SIZE * SIZE; i++) {
    buf[i*3] = data[i*4]; buf[i*3+1] = data[i*4+1]; buf[i*3+2] = data[i*4+2];
  }
  return buf.toString('base64');
}

// ── Send GIF to Pixoo ──────────────────────────────────────────────────────────
let picId = 200;
async function send(frames, ms) {
  picId = (picId % 9999) + 1;
  const id = picId;
  await Promise.all(frames.map((frame, i) =>
    fetch(`http://${PIXOO_IP}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Command: 'Draw/SendHttpGif',
        PicNum: frames.length,
        PicWidth: SIZE,
        PicOffset: i,
        PicID: id,
        PicSpeed: ms,
        PicData: frame,
      }),
    })
  ));
}

// ── Shared header ─────────────────────────────────────────────────────────────
function drawHeader(cx) {
  cx.fillStyle = C.hdrBg; cx.fillRect(0, 0, SIZE, 12);
  pfCenter(cx, "tonight's gigs", 3, C.hdrTxt, 1);
  cx.fillStyle = C.hdrLine; cx.fillRect(0, 11, SIZE, 1);
}

function drawDots(cx, idx, total) {
  if (total <= 1) return;
  const dotSz = 2, gap = 2;
  const totalW = total * dotSz + (total - 1) * gap;
  let x = Math.round((SIZE - totalW) / 2);
  const y = 59;
  for (let i = 0; i < total; i++) {
    cx.fillStyle = i === idx ? C.dotOn : C.dot;
    cx.fillRect(x, y, dotSz, dotSz);
    x += dotSz + gap;
  }
}

// ── Gig card frame ────────────────────────────────────────────────────────────
// Dynamic layout: items flow top-down from y=14, leaving room for dots at y=59
function frameGig(gig, idx, total) {
  const { cv, cx } = mk();
  drawHeader(cx);
  const maxW = SIZE - 4;
  let y = 14;

  // Band name — scale 2 if fits in one line, else wrap at scale 1
  const safeName = gig.name.toLowerCase().replace(/[^a-z0-9 \-'!£.:/]/g, '').replace(/  +/g, ' ').trim();
  if (pfWidth(safeName, 2) <= maxW) {
    pfCenter(cx, safeName, y, C.band, 2);
    y += 13; // 10px text + 3px gap
  } else {
    const lines = pfWrap(safeName, maxW, 1);
    for (const line of lines.slice(0, 3)) {
      pfCenter(cx, line, y, C.band, 1);
      y += 7;
    }
    y += 1;
  }

  // Venue — wrap up to 2 lines
  const venueLines = pfWrap(gig.venue.toLowerCase().replace(/[^a-z0-9 \-']/g, ''), maxW, 1);
  for (const line of venueLines.slice(0, 2)) {
    pfCenter(cx, line, y, C.venue, 1);
    y += 7;
  }
  y += 1;

  // Genre
  if (gig.genre && !/^undefined$/i.test(gig.genre)) {
    const g = pfFit(gig.genre, maxW, 1);
    if (g) { pfCenter(cx, g, y, C.genre, 1); y += 7; }
  }
  y += 1;

  // Time (left) + price / sold-out / tix (right)
  if (gig.time) pfDraw(cx, gig.time, 2, y, C.time, 1);
  if (gig.soldOut) {
    const sw = pfWidth('sold out', 1);
    pfDraw(cx, 'sold out', SIZE - 2 - sw, y, C.soldOut, 1);
  } else if (gig.price) {
    const pw = pfWidth(gig.price, 1);
    pfDraw(cx, gig.price, SIZE - 2 - pw, y, C.price, 1);
  } else if (gig.ticketed) {
    const tw = pfWidth('tix', 1);
    pfDraw(cx, 'tix', SIZE - 2 - tw, y, C.time, 1);
  }

  drawDots(cx, idx, total);
  return toData(cv);
}

function frameNoGigs() {
  const { cv, cx } = mk();
  drawHeader(cx);
  pfCenter(cx, 'no gigs', 27, C.noGigs, 2);
  pfCenter(cx, 'tonight', 39, C.noGigs, 2);
  return toData(cv);
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }

const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

function parseDisplayDate(str) {
  // "Sat 14 Mar 2026" or "14 March 2026"
  const m = str.match(/(\d{1,2})\s+(\w{3,})\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase().slice(0, 3)];
  if (month === undefined) return null;
  const d = new Date(parseInt(m[3]), month, parseInt(m[1]));
  return d.toISOString().slice(0, 10);
}

function to24h(str) {
  const m = str.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return '';
  let h = parseInt(m[1]);
  const mins = m[2] || '00';
  const ampm = (m[3] || '').toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${mins}`;
}

// ── Scraper: UEA Ticket Bookings (Waterfront + UEA LCR + more) ────────────────
const UEA_NAV_SKIP = new Set(['this week','this month','all events','next week','today','tomorrow','this weekend','featured']);

// Parse a date that may or may not include the year (e.g. "14 March" or "14 March 2026")
function parseUEADate(text) {
  // Full date with year
  const full = text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i);
  if (full) return parseDisplayDate(full[0]);
  // Partial date without year — assume current year
  const partial = text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*/i);
  if (partial) {
    const m = MONTHS[partial[2].toLowerCase().slice(0, 3)];
    if (m !== undefined) {
      const d = new Date(new Date().getFullYear(), m, parseInt(partial[1]));
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

// Genre keyword groups — first match wins, display name = first element
const GENRE_GROUPS = [
  ['drum and bass', 'drum & bass', 'dnb'],
  ['hip hop', 'hip-hop', 'hiphop', 'rap'],
  ['r&b', "r'n'b", 'rnb', 'rhythm and blues'],
  ['metal'],
  ['punk'],
  ['jazz'],
  ['classical', 'orchestra', 'symphon', 'choral'],
  ['soul'],
  ['blues'],
  ['reggae'],
  ['country'],
  ['electronic', 'electro', 'techno', 'edm'],
  ['folk'],
  ['indie'],
  ['alternative', 'alt-rock'],
  ['rock'],
  ['pop'],
  ['tribute', 'impressions', 'stars in their eyes', 'cover band', 'covers band'],
];

function extractGenreFromText(text) {
  const lower = text.toLowerCase();
  for (const group of GENRE_GROUPS) {
    for (const kw of group) {
      if (lower.includes(kw)) return group[0];
    }
  }
  return '';
}

async function fetchUEAEventDetails(url) {
  try {
    const html = await fetch(url, { headers: { 'User-Agent': UA } }).then(r => r.text());
    const $ = cheerio.load(html);

    // Time: "Sat 14 March 2026 6:30pm"
    const timeM = html.match(/\d{1,2}\s+\w+\s+\d{4}\s+(\d{1,2}:\d{2}(?:am|pm))/i);
    const time = timeM ? to24h(timeM[1]) : '';

    // Genre: scan About Event section text for known keywords
    const aboutText = $('[class*="about"], [id*="about"], .event-description, .event-content, .description, article').text();
    const genre = extractGenreFromText(aboutText || html);

    return { time, genre };
  } catch { return { time: '', genre: '' }; }
}

async function fetchUEAGigs() {
  const date = todayStr();
  const url = `https://www.ueaticketbookings.co.uk/whats-on/?_sfm_start_date=${date}&_sfm_end_date=${date}`;
  try {
    const html = await fetch(url, { headers: { 'User-Agent': UA } }).then(r => r.text());
    const $ = cheerio.load(html);
    const gigs = [];
    const seen = new Set();

    $('h4').each((_, el) => {
      const name = $(el).text().trim();
      if (!name || name.length < 3) return;
      if (UEA_NAV_SKIP.has(name.toLowerCase())) return;

      const $card = $(el).parents().filter((_, p) => $(p).find('h4').length === 1).first();
      const cardText = $card.text();

      // Parse start date — handle ranges like "14 March - 9 May 2026"
      let cardDate = null;
      $card.find('img').each((_, img) => {
        if (/calendar/i.test($(img).attr('src') || '')) {
          const dateText = $(img).parent().text().trim();
          cardDate = parseUEADate(dateText);
        }
      });
      if (!cardDate) cardDate = parseUEADate(cardText);
      if (!cardDate || cardDate !== date) return;

      // Venue
      let venue = '';
      $card.find('img').each((_, img) => {
        if (/location|pin/i.test($(img).attr('src') || ''))
          venue = $(img).parent().clone().children('img').remove().end().text().trim();
      });
      if (!venue) {
        if (/waterfront studio/i.test(cardText))    venue = 'Waterfront Studio';
        else if (/waterfront/i.test(cardText))      venue = 'Waterfront';
        else if (/lcr|nick rayns/i.test(cardText))  venue = 'UEA LCR';
        else if (/arts centre/i.test(cardText))     venue = 'Arts Centre';
        else if (/voodoo/i.test(cardText))          venue = "Voodoo Daddy's";
        else if (/brickmakers/i.test(cardText))     venue = 'Brickmakers';
        else if (/epic/i.test(cardText))            venue = 'Epic Studios';
        else venue = 'Norwich';
      }

      const soldOut = /sold out|cancelled/i.test(cardText);
      const eventUrl = $card.find('a[href*="/event/"]').attr('href') || '';
      const key = name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 16);
      if (!seen.has(key)) {
        seen.add(key);
        gigs.push({ name, venue, price: '', soldOut, time: '', genre: '', ticketed: true, _url: eventUrl });
      }
    });

    // Fetch individual pages in parallel to get times + genres
    await Promise.all(gigs.map(async g => {
      if (g._url) {
        const details = await fetchUEAEventDetails(g._url);
        g.time = details.time;
        g.genre = details.genre;
      }
      delete g._url;
    }));

    return gigs;
  } catch (e) {
    console.error('UEA scrape error:', e.message);
    return [];
  }
}

// ── Scraper: Norwich Arts Centre ───────────────────────────────────────────────
async function fetchNACGigs() {
  const today = todayStr();
  try {
    const html = await fetch('https://www.norwichartscentre.co.uk/whats-on/', {
      headers: { 'User-Agent': UA },
    }).then(r => r.text());
    const $ = cheerio.load(html);
    const gigs = [];

    $('div.event-item').each((_, el) => {
      const $card = $(el);
      const name = $card.find('h3').text().trim();
      if (!name || /CANCELLED/i.test(name)) return;

      // Date + time from div.event-date: "Sat 14 Mar 2026 @ 8:30 PM"
      const dateText = $card.find('.event-date').text().trim();
      const dateMatch = dateText.match(/(\d{1,2})\s+(\w{3,})\s+(\d{4})/);
      if (!dateMatch || parseDisplayDate(dateMatch[0]) !== today) return;

      const timeMatch = dateText.match(/@\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
      const time = timeMatch ? to24h(timeMatch[1]) : '';

      // Price from div.event-price: "Price From: £18.50 adv | £17.50 conc..."
      const priceText = $card.find('.event-price').text().trim();
      const priceMatch = priceText.match(/£([\d.]+)/);
      const price = priceMatch ? `£${priceMatch[1]}` : '';

      // Genre from nav-categories, skip generic ones
      const genres = [];
      $card.find('.nav-categories a').each((_, a) => {
        const cat = $(a).text().trim();
        if (cat && !/^(music|tickets under)/i.test(cat)) genres.push(cat);
      });
      const genre = genres[0] || '';

      gigs.push({ name, venue: 'Arts Centre', price, soldOut: false, time, genre, ticketed: !!price });
    });

    return gigs;
  } catch (e) {
    console.error('NAC scrape error:', e.message);
    return [];
  }
}

// ── Scraper: Brickmakers (main stage + B2) ─────────────────────────────────────
async function fetchBrickmakers(pageUrl, venueName) {
  const today = todayStr();
  try {
    const html = await fetch(pageUrl, { headers: { 'User-Agent': UA } }).then(r => r.text());
    const $ = cheerio.load(html);
    const gigs = [];

    $('div.wp-block-media-text__content').each((_, el) => {
      const $el = $(el);
      // Convert <br> to newlines before stripping tags
      const firstPHtml = $el.find('p.wp-block-paragraph').first().html() || '';
      const firstPText = firstPHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&[a-z]+;/gi, '')
        .trim();
      const lines = firstPText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return;

      // lines[0] = "Friday 13th March:" — parse date
      const dateM = lines[0].match(/(\d{1,2})(?:st|nd|rd|th)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*/i);
      if (!dateM) return;
      const month = MONTHS[dateM[2].toLowerCase().slice(0, 3)];
      if (month === undefined) return;
      const eventDate = new Date(new Date().getFullYear(), month, parseInt(dateM[1])).toISOString().slice(0, 10);
      if (eventDate !== today) return;

      // lines[1] = band name (skip if it looks like "Doors 7pm")
      if (/^[Dd]oors/i.test(lines[1])) return;
      const name = lines[1];
      if (!name || name.length < 2) return;
      // Skip non-gig events (competitions, quizzes, etc.)
      if (/competition|quiz|poker|cribbage|bingo|tournament|trivia/i.test(name)) return;

      // Time — try "Doors X" first, then any HH:MMam/pm or Hpm pattern
      const allText = $el.text();
      const timeM = allText.match(/[Dd]oors\s+(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)/i)
                 || allText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
      const time = timeM ? to24h(timeM[1].replace('.', ':')) : '';

      // Price
      const priceM = allText.match(/£([\d.]+)/);
      const isFree = /free\s+entry|free\s+but|free\s+admission|free\s+show/i.test(allText);
      const price = priceM ? `£${priceM[1]}` : (isFree ? 'free' : '');
      const ticketed = !isFree && !!$el.find('a[href]').length;
      const soldOut = /sold\s+out|cancelled/i.test(allText);

      const genre = extractGenreFromText(allText);

      gigs.push({ name, venue: venueName, price, soldOut, time, genre, ticketed });
    });

    return gigs;
  } catch (e) {
    console.error(`Brickmakers scrape error (${venueName}):`, e.message);
    return [];
  }
}

// ── Scraper: Norwich Theatre ───────────────────────────────────────────────────
const NT_VENUE_MAP = {
  'norwich-theatre-royal':    'Theatre Royal',
  'norwich-theatre-playhouse':'NT Playhouse',
  'norwich-theatre-stage-two':'NT Stage Two',
  'norwich-theatre-beyond':   'NT Beyond',
};

async function fetchNorwichTheatre() {
  const today = todayStr();
  const url = `https://norwichtheatre.org/whats-on/?genre[]=music&date=${today}`;
  try {
    const html = await fetch(url, { headers: { 'User-Agent': UA } }).then(r => r.text());
    const $ = cheerio.load(html);
    const gigs = [];

    $('div.o-grid__cell.production').each((_, el) => {
      const $card = $(el);
      const name = $card.find('h4.c-col-title').text().trim();
      if (!name) return;

      const dateText = $card.find('p.c-event-card__date').text().replace(/\s+/g, ' ').trim();
      const cardDate = parseDisplayDate(dateText);
      if (!cardDate || cardDate !== today) return;

      const venueClass = $card.find('[class*="c-venue-logo--norwich-theatre-"]').attr('class') || '';
      const venueKey = (venueClass.match(/c-venue-logo--(norwich-theatre-[\w-]+)/) || [])[1] || '';
      const venue = NT_VENUE_MAP[venueKey] || 'Norwich Theatre';

      const soldOut = /sold\s+out|unavailable/i.test($card.text());
      gigs.push({ name, venue, price: '', soldOut, time: '', genre: 'music', ticketed: true });
    });

    return gigs;
  } catch (e) {
    console.error('Norwich Theatre scrape error:', e.message);
    return [];
  }
}

// ── Combined fetch + merge ────────────────────────────────────────────────────
async function fetchGigs() {
  const [uea, nac, bm, bmB2, nt] = await Promise.all([
    fetchUEAGigs(),
    fetchNACGigs(),
    fetchBrickmakers('https://www.brickmakersnorwich.co.uk/home/brickmakers/brickmakers-gigs', 'Brickmakers'),
    fetchBrickmakers('https://www.brickmakersnorwich.co.uk/b2/gig-guide', 'Brickmakers B2'),
    fetchNorwichTheatre(),
  ]);
  // Merge entries for same gig — combine fields from both sources
  const map = new Map();
  for (const g of [...uea, ...nac, ...bm, ...bmB2, ...nt]) {
    const key = g.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 16);
    const ex = map.get(key);
    if (!ex) { map.set(key, { ...g }); continue; }
    // Fill in missing fields from the other source
    if (!ex.price  && g.price)  ex.price  = g.price;
    if (!ex.time   && g.time)   ex.time   = g.time;
    if (!ex.genre  && g.genre)  ex.genre  = g.genre;
    if (!ex.venue  || ex.venue === 'Norwich') ex.venue = g.venue;
    if (g.soldOut) ex.soldOut = true;
  }
  return [...map.values()]
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

// ── Lock file ─────────────────────────────────────────────────────────────────
function acquireLock() {
  try {
    const existing = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'));
    if (!isNaN(existing)) {
      try { process.kill(existing, 0); console.log(`Killing stale instance ${existing}`); process.kill(existing); } catch {}
    }
  } catch {}
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  process.on('exit', () => { try { fs.unlinkSync(LOCK_FILE); } catch {} });
}

function startWatchdog() {
  setInterval(async () => {
    try {
      const r = await fetch(`http://${PIXOO_IP}/post`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Command: 'Channel/GetIndex' }),
      });
      const j = await r.json();
      if (j.SelectIndex !== 0)
        await fetch(`http://${PIXOO_IP}/post`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Command: 'Channel/SetIndex', SelectIndex: 0 }),
        });
    } catch {}
  }, 60_000);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  acquireLock();
  console.log(`🎸 Norwich Gigs Pixoo  •  ${PIXOO_IP}  •  refresh ${REFRESH_MS/60000}min`);
  await fetch(`http://${PIXOO_IP}/post`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Command: 'Draw/ResetHttpGifId' }),
  }).catch(() => {});
  startWatchdog();
  while (true) {
    try {
      const gigs = await fetchGigs();
      console.log(`✅ ${gigs.length} gig${gigs.length !== 1 ? 's' : ''} tonight`);
      gigs.forEach(g => console.log(`   ${g.time || '--:--'}  ${g.name}  @${g.venue}  ${g.price || (g.ticketed ? 'tix' : 'free')}${g.soldOut ? ' [SOLD OUT]' : ''}`));
      const frames = gigs.length > 0
        ? gigs.map((g, i) => frameGig(g, i, gigs.length))
        : [frameNoGigs()];
      await send(frames, FRAME_MS);
    } catch (e) {
      console.error('Error:', e.message);
    }
    await new Promise(r => setTimeout(r, REFRESH_MS));
  }
}
main();
