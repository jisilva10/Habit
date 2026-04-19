# 🏆 Habits — Habit Tracker

A premium, mobile-first habit tracking app connected to an n8n automation backend.

## Features

- 📊 Track daily habits with visual progress cards
- 🔥 Streak tracking (current & best)
- 📅 Monthly calendar view
- 📈 Weekly progress chart
- ➕ Create new habits on the fly
- 🌙 Beautiful dark mode design

## Tech Stack

- Vanilla HTML, CSS, JavaScript
- [Chart.js](https://www.chartjs.org/) for charts
- [n8n](https://n8n.io/) backend via webhooks

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| `GET`  | `https://1.jisn8n.work/webhook/habits` | Fetch all habits and data |
| `POST` | `https://1.jisn8n.work/webhook/habits` | Mark/unmark a day |
| `POST` | `https://1.jisn8n.work/webhook/habits-new` | Create a new habit |

## Deploy

### Vercel

1. Push this repo to GitHub
2. Import at [vercel.com/new](https://vercel.com/new)
3. Select the repo — zero config needed

### Local development

```bash
npx serve .
# or
python3 -m http.server 3000
```

## Project structure

```
habits/
├── index.html        # Main entry point
├── css/
│   └── style.css     # Design system & styles
├── js/
│   └── app.js        # App logic & API calls
├── vercel.json       # Vercel routing config
└── README.md
```
