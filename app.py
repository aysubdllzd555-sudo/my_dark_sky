from flask import Flask, jsonify, request, render_template
import requests
import json
import os
import time
from datetime import date, datetime

app = Flask(__name__, static_folder="templates", static_url_path="/assets")

CACHE_FILE = "cache.json"
CACHE_SECONDS = 300  


def read_cache():
    
    if not os.path.exists(CACHE_FILE):
        return {}
    try:
        with open(CACHE_FILE) as f:
            return json.load(f)
    except ValueError:
        return {}


def write_cache(cache):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f)


def get_data(key, url, params):
    # 1. Look in the cache first
    cache = read_cache()
    item = cache.get(key)
    if item and time.time() - item["time"] < CACHE_SECONDS:
        data = item["data"]
        data["cached"] = True
        return data

    response = requests.get(url, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()

    
    cache[key] = {"time": time.time(), "data": data}
    write_cache(cache)

    data["cached"] = False
    return data


def get_coordinates():
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
    except (TypeError, ValueError):
        return None, None
    if lat < -90 or lat > 90 or lon < -180 or lon > 180:
        return None, None
    return lat, lon


@app.errorhandler(requests.RequestException)
def api_error(error):
    detail = str(error)
    if error.response is not None:
        detail = str(error.response.status_code) + " " + error.response.text[:200]
    print("Weather API error:", detail)
    return jsonify({"error": "Weather service is not available. Try again later. (" + detail[:80] + ")"}), 502


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/search")
def search():
    name = request.args.get("q", "").strip().lower()
    if len(name) < 2:
        return jsonify({"error": "Type at least 2 letters"}), 400

    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": name, "count": 5, "language": "en"}
    data = get_data("search:" + name, url, params)
    return jsonify(data)


@app.route("/weather")
def weather():
    lat, lon = get_coordinates()
    if lat is None:
        return jsonify({"error": "Wrong or missing coordinates"}), 400

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min",
        "forecast_days": 1,
        "timezone": "auto",
    }
    key = "weather:" + str(round(lat, 2)) + ":" + str(round(lon, 2))
    return jsonify(get_data(key, url, params))


@app.route("/history")
def history():
    lat, lon = get_coordinates()
    if lat is None:
        return jsonify({"error": "Wrong or missing coordinates"}), 400

    day_text = request.args.get("date", "")
    try:
        day = datetime.strptime(day_text, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Date must look like 2026-10-21"}), 400

    difference = (day - date.today()).days
    if difference < -365:
        return jsonify({"error": "You can go back only 1 year"}), 400
    if difference > 14:
        return jsonify({"error": "You can look only 14 days ahead"}), 400

    if difference < 0:
        url = "https://archive-api.open-meteo.com/v1/archive"
    else:
        url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": day_text,
        "end_date": day_text,
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
        "timezone": "auto",
    }
    key = "history:" + str(round(lat, 2)) + ":" + str(round(lon, 2)) + ":" + day_text
    data = get_data(key, url, params)
    data["is_past"] = difference < 0
    return jsonify(data)


if __name__ == "__main__":
    app.run(debug=True)