from flask import Flask, jsonify, request, render_template
from flask_sqlalchemy import SQLAlchemy
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
import requests
load_dotenv()

app = Flask(__name__)

CACHE_TTL_SECONDS = 300  # 5 dəqiqə

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///cache.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class WeatherCache(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cache_key = db.Column(db.String(200), unique=True, index=True, nullable=False)
    data = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


def get_cached(key):
    row = WeatherCache.query.filter_by(cache_key=key).first()

    if row is None:
        return None

    age = datetime.utcnow() - row.created_at
    if age.total_seconds() > CACHE_TTL_SECONDS:
        return None

    return json.loads(row.data)


def set_cached(key, data):
    row = WeatherCache.query.filter_by(cache_key=key).first()
    payload = json.dumps(data)

    if row:
        row.data = payload
        row.created_at = datetime.utcnow()
    else:
        db.session.add(WeatherCache(cache_key=key, data=payload))

    db.session.commit()

class WeatherServiceError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.message = message
        self.status = status


def http_get(url, params):
    try:
        r = requests.get(url, params=params, timeout=20)
        r.raise_for_status()
        return r.json()
    except requests.Timeout:
        raise WeatherServiceError("Hava xidmeti cavab vermir", 504)
    except requests.HTTPError as e:
        if e.response.status_code == 429:
            raise WeatherServiceError("Sorgu limiti asildi", 429)
        raise WeatherServiceError("Hava xidmetinden xeta", 502)
    except requests.RequestException:
        raise WeatherServiceError("Sebeke xetasi", 502)


WEATHER_CODES = {
    0: ("Clear", "☀️"),
    1: ("Mainly clear", "🌤️"),
    2: ("Partly cloudy", "⛅"),
    3: ("Overcast", "☁️"),
    45: ("Fog", "🌫️"),
    48: ("Rime fog", "🌫️"),
    51: ("Light drizzle", "🌦️"),
    53: ("Drizzle", "🌦️"),
    55: ("Heavy drizzle", "🌦️"),
    56: ("Freezing drizzle", "🌧️"),
    57: ("Freezing drizzle", "🌧️"),
    61: ("Light rain", "🌧️"),
    63: ("Rain", "🌧️"),
    65: ("Heavy rain", "🌧️"),
    66: ("Freezing rain", "🌧️"),
    67: ("Freezing rain", "🌧️"),
    71: ("Light snow", "🌨️"),
    73: ("Snow", "❄️"),
    75: ("Heavy snow", "❄️"),
    77: ("Snow grains", "❄️"),
    80: ("Light showers", "🌦️"),
    81: ("Showers", "🌧️"),
    82: ("Violent showers", "⛈️"),
    85: ("Snow showers", "🌨️"),
    86: ("Heavy snow showers", "🌨️"),
    95: ("Thunderstorm", "⛈️"),
    96: ("Thunderstorm with hail", "⛈️"),
    99: ("Thunderstorm with heavy hail", "⛈️"),
}


def describe(code):
    return WEATHER_CODES.get(code, ("Unknown", "❓"))


def geocode(query):
    key = "search:" + query.strip().lower()
    cached = get_cached(key)
    if cached is not None:
        return cached

    data = http_get("https://geocoding-api.open-meteo.com/v1/search",
                    {"name": query, "count": 5, "language": "en"})

    places = []
    for r in data.get("results", []):
        places.append({
            "name": r.get("name"),
            "country": r.get("country"),
            "admin1": r.get("admin1"),
            "lat": r.get("latitude"),
            "lon": r.get("longitude"),
        })

    set_cached(key, places)
    return places


def fetch_forecast(lat, lon):
    key = f"forecast:{round(lat, 2)}:{round(lon, 2)}"
    cached = get_cached(key)
    if cached is not None:
        cached["cached"] = True
        return cached

    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code",
        "hourly": "temperature_2m,precipitation_probability,weather_code",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max",
        "forecast_days": 8,
        "timezone": "auto",
    }
    data = http_get("https://api.open-meteo.com/v1/forecast", params)

    c = data["current"]
    text, icon = describe(c["weather_code"])
    current = {
        "temp": c["temperature_2m"],
        "feels_like": c["apparent_temperature"],
        "humidity": c["relative_humidity_2m"],
        "dew_point": c["dew_point_2m"],
        "pressure": c["surface_pressure"],
        "wind_speed": c["wind_speed_10m"],
        "wind_dir": c["wind_direction_10m"],
        "summary": text,
        "icon": icon,
    }

    d = data["daily"]
    daily = []
    for i in range(len(d["time"])):
        text, icon = describe(d["weather_code"][i])
        daily.append({
            "date": d["time"][i],
            "min": d["temperature_2m_min"][i],
            "max": d["temperature_2m_max"][i],
            "summary": text,
            "icon": icon,
            "rain_chance": d["precipitation_probability_max"][i],
            "wind_max": d["wind_speed_10m_max"][i],
            "uv": d["uv_index_max"][i],
        })
    h=data["hourly"]
    hourly=[]
    for i in range(48):
        text,icon=describe(h["weather_code"][i])
        hourly.append({
            "time":h["time"][i],
            "temp":h["temperature_2m"][i],
            "rain_chance":h["precipitation_probability"][i],
            "summary":text,
            "icon":icon,
        })

    result = {
        "location": {"lat": lat, "lon": lon},
        "current":current,
        "hourly":hourly,
        "daily": daily,
    }
    set_cached(key, result)
    result["cached"] = False
    return result




with app.app_context():
    db.create_all()