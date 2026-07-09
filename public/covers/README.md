# Box cover images

Files here are served at `/covers/<name>`. To give a game real box art:

1. Drop the photo in this folder, e.g. `catan.jpg` (jpg/png/webp all fine).
2. On the Shelf, open the game → **Edit** → set **Box image URL** to `/covers/catan.jpg` → Save.

That per-game `image` field always wins. The three `*.svg` files here are temporary
placeholders wired up in `src/lib/catalog.js` (`DEMO_COVERS`) just to preview the look —
delete them and that map once real art (or BoardGameGeek auto-fill) is in.
