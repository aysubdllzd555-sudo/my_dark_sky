# Welcome to My Dark Sky
***

## Task
Dark Sky was a weather forecasting website and app that was acquired by Apple and has ceased operations. The task is to remake it as a web application using Python and Flask. The user interface has to look good and must be built with Tailwind or Bootstrap. The project has to be hosted in the cloud, and its URL must be written alone in the file my_dark_sky_url.txt.
The application must provide these features:
Location: the weather of the current location of the user and the weather of any location found by search.
Today's weather.
A forecast for a given date, with the ability to look into the future and to go back in time.
A cache system: when a user asks for the weather of a location, the answer is stored and served again for 5 minutes.
## Description
The backend is a small Flask application in app.py. It does not need an API key, because it uses the free Open-Meteo services: the geocoding API turns a place name into coordinates, the forecast API gives the current and daily weather, and the archive API gives the weather of past days. The server has four routes. The route / shows the page, /search finds a place by its name, /weather returns today's weather for a pair of coordinates, and /history returns the weather of one chosen day. The /history route accepts dates from one year in the past up to fourteen days in the future and uses the archive API for past days and the forecast API for today and future days. If the weather service does not answer, the server returns a clear JSON error message instead of crashing.
The cache is a simple JSON file called cache.json. Every answer is saved with the time it was stored and a key made from the type of request and the rounded coordinates. When the same request arrives again, the saved answer is returned if it is younger than 300 seconds (5 minutes). Otherwise a new request is sent to Open-Meteo and the file is updated.
The frontend is made of one HTML page, one CSS file and one JavaScript file, all kept in the templates folder. Flask serves the CSS and JavaScript files from this folder. The page is styled with Tailwind CSS (loaded from a CDN) and a few custom rules, and it follows the clean look of the original Dark Sky: a dark top bar, a grey search bar and a simple white page. The JavaScript asks the Flask routes for data with fetch, finds the current location with the browser geolocation API (and shows Baku if the permission is refused), reacts to the search form, and shows the weather icon, the temperature, the feels-like, low and high temperatures, the wind and the humidity. The Time Machine button opens a calendar (Flatpickr) where the user picks a day, and the result of that day is shown as a card marked as past or forecast. Weather codes from Open-Meteo are translated into readable names and icons.
The project is deployed on Render with Gunicorn, using the Procfile and the requirements.txt file of the repository.

## Installation
You need Python 3.9 or newer and an internet connection, because the weather data, the fonts and the calendar are loaded from the web. Download or clone the repository and open its folder in a terminal or in VS Code. Create a virtual environment inside the folder and activate it, then install the packages listed in requirements.txt with pip. These packages are Flask, Requests and Gunicorn. No database and no API key are needed. If you want the original Dark Sky style weather icons, you can also download the file skycons.js and put it in the templates folder; without it the page simply shows simple grey emoji icons.
## Usage
Start the application with the Flask command from the project folder while the virtual environment is active, and open the address http://localhost:5000 in your browser. Do not open index.html with a tool like VS Code Live Server, because the page is a Flask template and needs the Flask server to work. When the page opens, allow the browser to use your location to see the weather where you are, or type a city name in the search field and press Enter. The arrow button next to the search field brings you back to your current location. Under the weather, press the TIME MACHINE button to open the calendar and click any day from the last year or the next two weeks to see the weather of that day. If you ask for the same place again within five minutes, the answer comes from the cache file. To see the live version, open the URL written in the file my_dark_sky_url.txt; on a free Render service the first visit can take about a minute because the service has to wake up.
```
./my_project My_dark_sky
```

### The Core Team

abdullaz_a
<span><i>Made at <a href='https://qwasar.io'>Qwasar SV -- Software Engineering School</a></i></span>
<span><img alt='Qwasar SV -- Software Engineering School's Logo' src='https://storage.googleapis.com/qwasar-public/qwasar-logo_50x50.png' width='20px' /></span>
