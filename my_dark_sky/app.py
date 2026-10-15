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
    def __init__(self,message,status=502):
        super().__init__(message)
        self.message=message
        self.status=status


def http_get(url, params):
    try:
        r = requests.get(url, params=params, timeout=8)
        r.raise_for_status()
        return r.json()
    except requests.Timeout:
        raise WeatherServiceError("Hava xidmeti cavab vermir",504)
    except requests.HTTPError as e:
        if e.response.status_code == 429:
            raise WeatherServiceError("Sorgu limiti asildi", 429)
        raise WeatherServiceError("Hava xidmetinden xeta",502)
    except requests.RequestException:
        raise WeatherServiceError("Sebeke xetasi",502)
        
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
    99:("Thunderstorm with heavy hail", "⛈️"),
}

def describe(code):
    return WEATHER_CODES.get(code,("Unknown", "❓"))




with app.app_context():
    db.create_all()