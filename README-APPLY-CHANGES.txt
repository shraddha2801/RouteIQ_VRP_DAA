RouteIQ updated frontend files
================================

Files:
- index.html
- style.css
- script.js

How to apply:
1. Make a backup copy of your current .vscode/Frontend folder.
2. Copy these three files into your actual .vscode/Frontend folder and overwrite the existing files.
3. Keep Backend/server.cpp, main.cpp and baseline.cpp unchanged.
4. Keep the C++ server running with:
   .\Backend\server.exe
5. Open .vscode/Frontend/index.html with Live Server.

Changes:
- Professional off-white / charcoal / muted green theme.
- More natural delivery terminology.
- Driver name, phone and vehicle registration fields.
- Depot and customer address fields.
- Google Maps location preview and per-route driving-direction links when real addresses are entered.
- Existing coordinate/demand optimization payload is unchanged.

Important:
- Existing X/Y values are algorithm coordinates, not latitude/longitude.
- Enter real addresses or place names to use Google Maps. Do not interpret the sample X/Y values as GPS coordinates.
- This uses Google Maps web/embed URLs and does not require a Maps JavaScript API key. For a fully customized embedded map with route overlays, a Google Maps Platform API key and billing-enabled project may be required.
- Google Maps driving routes may differ from the algorithm's coordinate-based distance results.
