# Norwich Gigs Pixoo

Displays tonight's live music events across Norwich venues on a **Divoom Pixoo 64** pixel display. Scrapes multiple local venue websites and rotates through event cards every few seconds, refreshing the listings every 30 minutes.

## Venues covered

- UEA (University of East Anglia)
- Norwich Arts Centre
- Brickmakers (main stage + B2 stage)
- Norwich Theatre
- Ticketmaster listings for Norwich

## What each card shows

- Artist / event name
- Venue and time
- Ticket price (where available)
- Genre tag

## Stack

- **Node.js** (ES modules)
- **Cheerio** — HTML parsing and web scraping across venue sites
- **Ticketmaster API** — supplementary event listings
- **Canvas** — renders each event card as a 64×64 pixel frame
- **Divoom Pixoo 64 HTTP API** — sends frames to the display over local WiFi
- Custom **3×5 pixel font** engine

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure
Copy `config.example.json` to `config.json` and fill in your values:
```bash
cp config.example.json config.json
```

```json
{
  "pixooIp": "192.168.x.x",
  "tmApiKey": "your_ticketmaster_api_key",
  "city": "Norwich",
  "country": "GB"
}
```

Get a free Ticketmaster API key at [developer.ticketmaster.com](https://developer.ticketmaster.com).

### 3. Run
```bash
npm start
```

## Finding your Pixoo IP

Open the Divoom app → Device Settings — the local IP is listed there, or check your router's DHCP table.
