function $(id) {
  return document.getElementById(id);
}

function showMessage(text, isError) {
  var box = $("message");
  box.textContent = text;
  box.className = "message" + (isError ? "" : " info");
}

function hideMessage() {
  $("message").className = "hidden";
}

async function getJson(url) {
  var response = await fetch(url);
  var data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

function temp(c) {
  return Math.round(c) + "°";
}

function speed(kmh) {
  return Math.round(kmh) + " km/h";
}


function weatherInfo(code) {
  if (code === 0) return ["Clear", "CLEAR_DAY", "☀️", "#f6c445"];
  if (code === 1) return ["Mostly Clear", "CLEAR_DAY", "🌤️", "#f6c445"];
  if (code === 2) return ["Partly Cloudy", "PARTLY_CLOUDY_DAY", "⛅", "#9db7cf"];
  if (code === 3) return ["Overcast", "CLOUDY", "☁️", "#8f9aa5"];
  if (code === 45 || code === 48) return ["Foggy", "FOG", "🌫️", "#b5bcc2"];
  if (code >= 51 && code <= 57) return ["Drizzle", "RAIN", "🌦️", "#5b9bd5"];
  if (code >= 61 && code <= 67) return ["Rain", "RAIN", "🌧️", "#3f7fc4"];
  if (code >= 71 && code <= 77) return ["Snow", "SNOW", "❄️", "#cfe3f5"];
  if (code >= 80 && code <= 82) return ["Showers", "RAIN", "🌧️", "#3f7fc4"];
  if (code === 85 || code === 86) return ["Snow Showers", "SNOW", "🌨️", "#cfe3f5"];
  if (code >= 95) return ["Thunderstorm", "RAIN", "⛈️", "#6a5fa8"];
  return ["Unknown", "CLOUDY", "❓", "#aaaaaa"];
}

var skycons = null;
function drawIcon(canvasId, iconName) {
  if (typeof Skycons === "undefined") return false;
  if (skycons === null) skycons = new Skycons({ color: "#333" });
  skycons.add(canvasId, Skycons[iconName]);
  skycons.play();
  return true;
}


var currentLat = null;
var currentLon = null;

function showToday(data, placeName) {
  var c = data.current;
  var d = data.daily;
  var info = weatherInfo(c.weather_code);

  $("today-title").textContent = temp(c.temperature_2m) + " " + info[0] + ". — " + placeName;
  $("today-range").innerHTML =
    "<b>Feels Like:</b> " + temp(c.apparent_temperature) +
    " &nbsp; <b>Low:</b> " + temp(d.temperature_2m_min[0]) +
    " &nbsp; <b>High:</b> " + temp(d.temperature_2m_max[0]);
  $("today-extra").innerHTML =
    "<b>Wind:</b> " + speed(c.wind_speed_10m) +
    " &nbsp; <b>Humidity:</b> " + Math.round(c.relative_humidity_2m) + "%";

  var canvas = $("today-icon");
  if (!drawIcon("today-icon", info[1])) {
    canvas.outerHTML = "<span id='today-icon' style='font-size:48px;filter:grayscale(1)'>" + info[2] + "</span>";
  }
  $("today").classList.remove("hidden");
}

async function loadWeather(lat, lon, placeName) {
  showMessage("Loading...", false);
  try {
    var data = await getJson("/weather?lat=" + lat + "&lon=" + lon);
    currentLat = lat;
    currentLon = lon;
    showToday(data, placeName);
    $("time-box").classList.remove("hidden");
    $("time-result").innerHTML = "";
    hideMessage();
  } catch (error) {
    showMessage(error.message, true);
  }
}

$("search-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  var text = $("search-input").value.trim();
  if (text.length < 2) {
    showMessage("Type at least 2 letters", true);
    return;
  }
  try {
    var data = await getJson("/search?q=" + encodeURIComponent(text));
    if (!data.results) {
      showMessage("Place not found", true);
      return;
    }
    var place = data.results[0];
    var name = place.name + ", " + place.country;
    $("search-input").value = name;
    loadWeather(place.latitude, place.longitude, name);
  } catch (error) {
    showMessage(error.message, true);
  }
});


function useMyLocation() {
  if (!navigator.geolocation) {
    loadWeather(40.41, 49.87, "Baku, Azerbaijan");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function (position) {
      loadWeather(position.coords.latitude, position.coords.longitude, "Your location");
    },
    function () {
      showMessage("Location is blocked. Showing Baku. Search for another city.", false);
      loadWeather(40.41, 49.87, "Baku, Azerbaijan");
    }
  );
}
$("location-button").addEventListener("click", useMyLocation);


function dateText(daysFromToday) {
  var d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

var calendar = null;
if (window.flatpickr) {
  calendar = flatpickr("#date-input", {
    inline: true,
    minDate: dateText(-365),
    maxDate: dateText(14),
    defaultDate: dateText(0),
    onChange: function (selected, text) {
      showTimeMachine(text);
    }
  });
} else {
  $("date-input").type = "date";
  $("date-input").min = dateText(-365);
  $("date-input").max = dateText(14);
  $("date-input").addEventListener("change", function () {
    showTimeMachine($("date-input").value);
  });
}

$("time-button").addEventListener("click", function () {
  $("calendar-box").classList.toggle("hidden");
});

async function showTimeMachine(chosen) {
  if (!chosen) return;
  try {
    var data = await getJson("/history?lat=" + currentLat + "&lon=" + currentLon + "&date=" + chosen);
    var day = data.daily;
    var info = weatherInfo(day.weather_code[0]);
    var label = data.is_past ? "Past" : "Forecast";
    $("time-result").innerHTML =
      "<div class='time-result-card'>" +
        "<span class='tag'>" + label + "</span>" +
        "<b>" + chosen + "</b>" +
        "<p style='font-size:20px;margin:8px 0'>" + info[2] + " " + info[0] + "</p>" +
        "<p>Low " + temp(day.temperature_2m_min[0]) + " · High " + temp(day.temperature_2m_max[0]) + "</p>" +
        "<p>Precipitation " + day.precipitation_sum[0] + " mm · Wind up to " + speed(day.wind_speed_10m_max[0]) + "</p>" +
      "</div>";
  } catch (error) {
    showMessage(error.message, true);
  }
}

useMyLocation();