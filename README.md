# SaveFile

A clean white-theme, password-protected workspace for saving and viewing text files and code snippets.

## Included
- Password login (initial password configured in `.env`)
- Shared workspace: multiple people can sign in at the same time from separate devices/browsers
- Save entries as **Code** or **Text / File**, with title, description, filename, language/format and content
- Navbar: Overview, Save a file, View files & code
- Search, filter, open, copy, edit and delete saved entries
- SQLite database stored in `data/savefile.db`

## Run on Windows
1. Install Node.js 18 or newer from https://nodejs.org/
2. Open this `savefile` folder.
3. Open Command Prompt in this folder.
4. Run:
   ```bash
   npm install
   npm start
   ```
5. Open http://localhost:3000 in your browser.
6. Initial password: `adyp@2026`

## Allow multiple people on the same Wi-Fi
- Start the server on one computer.
- Find that computer's local IPv4 address (`ipconfig` on Windows).
- Other devices on the same network open `http://COMPUTER-IP:3000`.
- Allow Node.js through the computer firewall on a private network if prompted.
- Keep the server computer running. All users see the same shared database.

## Before putting it on the public internet
- Change `APP_PASSWORD` in `.env` to a strong, unique password.
- Replace `SESSION_SECRET` with a long random secret.
- Use HTTPS and a persistent server/database volume.
- Do not upload `.env` or the `data` folder to a public Git repository.
- This starter uses one shared workspace password, not separate user accounts. Anyone with the password can view, edit and delete shared entries.
- For a production deployment with many users, use a managed database and individual user accounts/roles.

## Data and backup
Your saved items are stored in `data/savefile.db`. Back up that file regularly. Do not delete it if you want to keep saved content.
