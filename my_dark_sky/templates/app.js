function $(id) {
    return document.getElementById(id);
  }
  
  
  function showMessage(text, isError) {
    const box = $("message"); 
    box.textContent = text;
    box.className = "mt-6 rounded-lg px-4 py-3 " +
      (isError ? "bg-red-50 text-red-700" : "bg-sky-50 text-sky-700");
  }
  
  function hideMessage() {
    $("message").className = "hidden";
  }
  
  
  async function getJson(url) {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Something went wrong");
    }
    return data;
  }
  
  
  function deg(value) {
    return Math.round(value) + "°";
  }
  
  
  function dayName(dateText, index) {
    if (index === 0) return "Today";
    const date = new Date(dateText + "T12:00:00");
    return date.toLocaleDateString("en", { weekday: "short" });
  }
  
  
  function hourName(timeText) {
    const hour = parseInt(timeText.slice(11, 13));
    const suffix = hour >= 12 ? "pm" : "am";
    return ((hour + 11) % 12 + 1) + suffix;
  }
  
  
  let currentLat = null;
  let currentLon = null;
  
  function showToday(data, placeName) {
    const now = data.current;
    const today = data.daily[0];
  
    $("placeName").textContent = placeName;
    $("todayIcon").textContent = now.icon;
    $("todayTemp").textContent = deg(now.temp);
    $("todaySummary").textContent = now.summary;
    $("todayRange").textContent =
      "Feels like " + deg(now.feels_like) + " · Low " + deg(today.min) + " · High " + deg(today.max);
    $("cacheInfo").textContent = data.cached ? "Loaded from cache" : "Fresh data";
  
    
    const items = [
      ["Wind", Math.round(now.wind_speed) + " km/h"],
      ["Humidity", Math.round(now.humidity) + "%"],
      ["Dew point", deg(now.dew_point)],
      ["UV index", today.uv],
      ["Rain chance", today.rain_chance + "%"],
      ["Pressure", Math.round(now.pressure) + " mb"]
    ];
    let html = "";
    for (const item of items) {
      html += `
        <div class="card px-4 py-3">
          <div class="text-xs text-slate-500">${item[0]}</div>
          <div class="font-bold text-lg">${item[1]}</div>
        </div>`;
    }
    $("details").innerHTML = html;
  
    $("today").classList.remove("hidden");
  }
  
 
  
  function showHourly(data) {
    
    let start = 0;
    if (data.current.time) {
      const nowHour = data.current.time.slice(0, 13);
      for (let i = 0; i < data.hourly.length; i++) {
        if (data.hourly[i].time.slice(0, 13) >= nowHour) {
          start = i;
          break;
        }
      }
    }
  
    let html = "";
    const hours = data.hourly.slice(start, start + 24);
    for (const h of hours) {
      html += `
        <div class="card shrink-0 w-16 py-3 text-center">
          <div class="text-xs text-slate-500">${hourName(h.time)}</div>
          <div class="text-2xl my-1">${h.icon}</div>
          <div class="font-bold">${deg(h.temp)}</div>
          <div class="text-xs text-sky-600">${h.rain_chance}%</div>
        </div>`;
    }
    $("hourly").innerHTML = html;
    $("hourlySection").classList.remove("hidden");
  }
  

  
  function showDaily(data) {
    const days = data.daily;
  
    
    let weekMin = days[0].min;
    let weekMax = days[0].max;
    for (const d of days) {
      if (d.min < weekMin) weekMin = d.min;
      if (d.max > weekMax) weekMax = d.max;
    }
    const range = (weekMax - weekMin) || 1;
  
    let html = "";
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
  
      
      const left = (d.min - weekMin) / range * 100;
      const width = Math.max((d.max - d.min) / range * 100, 4);
  
      html += `
        <div class="day-row">
          <div class="flex items-center gap-3">
            <span class="text-xl">${d.icon}</span>
            <span class="w-12 font-bold text-sm">${dayName(d.date, i)}</span>
            <span class="w-8 text-right text-sm text-slate-500">${deg(d.min)}</span>
            <div class="bar-track">
              <div class="bar-fill" style="left:${left}%; width:${width}%"></div>
            </div>
            <span class="w-8 text-sm">${deg(d.max)}</span>
            <button class="plus-btn" onclick="toggleDetails(${i})">+</button>
          </div>
          <div class="day-details" id="day${i}">
            ${d.summary} · Rain chance ${d.rain_chance}% ·
            Wind up to ${Math.round(d.wind_max)} km/h · UV ${d.uv}
          </div>
        </div>`;
    }
    $("daily").innerHTML = html;
    $("dailySection").classList.remove("hidden");
  }
  

  function toggleDetails(index) {
    $("day" + index).classList.toggle("open");
  }
  
  
  
  async function loadWeather(lat, lon, placeName) {
    hideMessage();
    showMessage("Loading...", false);
    try {
      const data = await getJson("/api/weather?lat=" + lat + "&lon=" + lon);
      currentLat = lat;
      currentLon = lon;
  
      showToday(data, placeName);
      showHourly(data);
      showDaily(data);
  
      $("timeSection").classList.remove("hidden");
      $("dateResult").innerHTML = "";
      hideMessage();
    } catch (error) {
      showMessage(error.message, true);
    }
  }
  
  // ===============================
  // 6. Search (press Enter)
  // ===============================
  
  $("searchForm").addEventListener("submit", async function (event) {
    event.preventDefault();               
    const text = $("searchInput").value.trim();
    if (text.length < 2) {
      showMessage("Type at least 2 letters", true);
      return;
    }
    try {
      const places = await getJson("/api/search?q=" + encodeURIComponent(text));
      if (places.length === 0) {
        showMessage("Place not found. Try another spelling.", true);
        return;
      }
      const place = places[0];            
      const name = place.name + (place.country ? ", " + place.country : "");
      $("searchInput").value = name;
      loadWeather(place.lat, place.lon, name);
    } catch (error) {
      showMessage(error.message, true);
    }
  });
  

  function useMyLocation() {
    if (!navigator.geolocation) {
      showMessage("Your browser does not support location", true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (position) {
        loadWeather(position.coords.latitude, position.coords.longitude, "Your location");
      },
      function () {
        showMessage("Location was blocked. Search for a city instead.", true);
        loadWeather(40.41, 49.87, "Baku, Azerbaijan");   
      }
    );
  }
  
  $("locateBtn").addEventListener("click", useMyLocation);
  

  function dateText(daysFromToday) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    return d.toISOString().slice(0, 10);
  }
  $("dateInput").min = dateText(-365);
  $("dateInput").max = dateText(14);
  $("dateInput").value = dateText(0);
  
  $("dateBtn").addEventListener("click", async function () {
    const chosen = $("dateInput").value;
    if (!chosen) {
      showMessage("Choose a date first", true);
      return;
    }
    hideMessage();
    try {
      const r = await getJson(
        "/api/weather/date?lat=" + currentLat + "&lon=" + currentLon + "&date=" + chosen
      );
      const label = r.type === "historical" ? "Historical" : "Forecast";
      $("dateResult").innerHTML = `
        <div class="card p-5 max-w-sm mx-auto text-left">
          <div class="flex justify-between mb-2">
            <b>${r.date}</b>
            <span class="text-xs bg-slate-100 rounded-full px-3 py-1">${label}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-5xl">${r.icon}</span>
            <div>
              <div class="font-bold text-lg">${r.summary}</div>
              <div class="text-slate-600">Low ${deg(r.min)} · High ${deg(r.max)}</div>
            </div>
          </div>
          <div class="text-sm text-slate-600 mt-3">
            Precipitation: ${r.precipitation} mm · Wind up to ${Math.round(r.wind_max)} km/h
          </div>
        </div>`;
    } catch (error) {
      showMessage(error.message, true);
    }
  });
  
  useMyLocation();