# GaraMaster — PRD

## Original Problem Statement
App di gestione presenza ufficiali di gara a gare in programma (contesto arti marziali / FIJLKAM).
Accesso con utenza master; ufficiali con utenza standard (username = iniziale nome.cognome).
Anagrafiche utenti e gare (data inizio, data fine, indirizzo, note) conservate in tabella.
L'app notifica agli ufficiali, X giorni prima (configurabile dal master), la richiesta di
disponibilità; il master verifica le disponibilità e conferma la presenza; alla conferma l'utente
è avvisato di presentarsi all'indirizzo indicato. L'app registra le presenze.
Tema blu e bianco, sfondo arti marziali senza volti.

## User Choices
- Auth: classic username/password (JWT).
- Notifications: in-app (bell + lista avvisi), working in preview.
- Username format: m.rossi (initial of first name + surname).
- Attendance: master confirms which available officials attend, then records presence.
- Background: martial arts silhouettes/textures (no faces). FIJLKAM logo on login.

## Architecture
- Backend: FastAPI + MongoDB (motor). JWT auth (PyJWT + bcrypt). UUID string ids. Soft deletes.
  Lazy scheduler: availability requests auto-dispatched when today >= start_date - days_before.
- Frontend: Expo Router (React Native), @tanstack/react-query, blue/white theme (src/theme.ts),
  role-based tab navigation (master: Dashboard/Gare/Ufficiali/Avvisi; official: Home/Gare/Avvisi).

## User Personas
- Master (admin): manages officials, competitions, availability confirmation, attendance, settings.
- Official (ufficiale di gara): responds to availability requests, sees confirmed competitions.

## Core Requirements (static)
- Role-based auth; master creates officials with auto username m.cognome.
- Competitions CRUD (name, start/end date, address, notes).
- Configurable days-before availability request (Settings).
- Official availability response; master confirmation with venue notification.
- Attendance register (present/absent) for confirmed officials.
- In-app notifications.

## Implemented (2026-06)
- [x] JWT auth, master seeding, /auth/login, /auth/me
- [x] Officials CRUD + auto username + activate/deactivate (master only)
- [x] Competitions CRUD + send-request + summary counts
- [x] Availability request auto-dispatch + manual send
- [x] Official respond available/unavailable + master notification
- [x] Confirm presence + confirmation notification with address
- [x] Attendance recording
- [x] Notifications (list/unread-count/read/read-all)
- [x] Settings days_before (stepper + presets)
- [x] Full UI: login (FIJLKAM logo, martial-arts bg), master dashboard/gare/ufficiali/detail,
      official home/gare/avvisi, forms, settings
- [x] Tested end-to-end (backend 31/32 pytest, frontend flows pass)

## Backlog
- P1: Native date picker for competition dates (currently masked YYYY-MM-DD text).
- P1: Attendance history / export report per competition.
- P2: Search/filter officials; bulk availability request across multiple competitions.
- P2: Push notifications (requires deploy + native build).

## Next Tasks
- Await user feedback / acceptance.
