# Getting Started app for Discord

## Project structure

Below is a basic overview of the project structure:

```
├── auth    -> implementation of OAuth2 for connection access
│   ├── server.js -> responsible for OAuth2 flow and discord token creation
├── commands    -> implementation of all commands
│   ├── history.js -> obtain users last 10 ARAM KDA
│   ├── ping.js -> check bot is active command
├── utils    -> place for helper functions/reducing that code
│   ├── api.js -> basic and simple fetch function
├── .env.sample -> sample .env file
├── index.js      -> main entrypoint for app
├── package.json
├── README.md
└── .gitignore
```

## Setup

```
npm install
```

### Run the app

After your credentials are added, go ahead and run the app:

```
npm run start
```

OR

```
npm run dev
```

# TODO:

### Store match data

| Key        | Metrics                 |
| ---------- | ----------------------- |
| Pentakills | earned, stolen, against |
| Snowballs  | hit, missed, not taken  |

Empty table to start - figure out logic for all above

### Commands

- [ ] user history filter by no. games, champion
- [ ] throw a snowball
- [ ] compare stats vs users
