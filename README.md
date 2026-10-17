# Small Win stock dashboard

Public dashboard assets and exported Multi-Strategy stock scans only.
Scanner source, credentials, logs, and automation remain in a separate private
repository. No backend or AI calls are required to view the dashboard.

Dashboard: https://iijiang.github.io/stock-dashboard/stock-trading/

GitHub Pages source: `main`, `/ (root)`.
The root URL redirects to the dashboard. Daily JSON is under
`stock-trading/data/YYYY/MM/YYYY-MM-DD.json`; `latest.json` is the latest scan.
Historical snapshots are preserved. Scan time and market-bar date are separate.
Updates are published from the scanner's host after successful scans.
