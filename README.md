# Otakuya Deal Dashboard

Statische GitHub-Pages-Oberfläche für die verschlüsselten Otakuya-Scraperdaten.

## Dateien

- `index.html`
- `styles.css`
- `app.js`
- `data/products.enc.json`

Die JSON-Datei ist verschlüsselt. Das Passwort wird nicht ins Repo geschrieben.

## VPS Ablauf

1. Otakuya scrapen
2. `scripts/export_dashboard_data.py` ausführen
3. Inhalt des Ordners `dashboard` ins GitHub-Repo pushen

## Sicherheit

GitHub Pages ist statisch. Der Schutz entsteht dadurch, dass nur verschlüsselte Produktdaten veröffentlicht werden. Nutze kein kurzes PIN, sondern ein starkes Passwort.
