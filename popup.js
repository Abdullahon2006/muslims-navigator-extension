const API_BASE = 'https://api.aladhan.com/v1';
const defaultSettings = {
  locationMode: 'geo',
  city: '',
  country: '',
  method: '2',
  school: '0',
  hijriAdjustment: '0'
};

const hijriEl = document.getElementById('hijri-date');
const gregEl = document.getElementById('greg-date');
const prayerTimesEl = document.getElementById('prayer-times');
const holidayListEl = document.getElementById('holiday-list');
const ramadanPanel = document.getElementById('ramadan-panel');
const suhoorEl = document.getElementById('suhoor');
const iftarEl = document.getElementById('iftar');

chrome.storage.sync.get(defaultSettings, settings => {
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  loadData(settings);
});

async function loadData(settings) {
  try {
    const location = await resolveLocation(settings);
    const timings = await fetchTimings(settings, location);
    renderTimings(timings);

    const hijri = timings.date.hijri;
    const greg = timings.date.gregorian;
    hijriEl.textContent = `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
    gregEl.textContent = `${greg.date} (${location.label})`;

    const isRamadan = hijri.month.number === 9;
    applyRamadanMode(isRamadan, timings.timings);

    const holidays = await fetchHolidays(settings, location);
    renderHolidays(holidays);
  } catch (err) {
    hijriEl.textContent = 'Unable to load data';
    gregEl.textContent = 'Check settings and try again.';
  }
}

function resolveLocation(settings) {
  if (settings.locationMode !== 'geo') {
    if (!settings.city || !settings.country) {
      return Promise.reject(new Error('City/Country missing'));
    }
    return Promise.resolve({
      mode: 'city',
      city: settings.city,
      country: settings.country,
      label: `${settings.city}, ${settings.country}`
    });
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          mode: 'geo',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Current location'
        });
      },
      () => {
        if (settings.city && settings.country) {
          resolve({
            mode: 'city',
            city: settings.city,
            country: settings.country,
            label: `${settings.city}, ${settings.country}`
          });
        } else {
          reject(new Error('Geolocation denied'));
        }
      }
    );
  });
}

async function fetchTimings(settings, location) {
  const params = {
    method: settings.method,
    school: settings.school,
    adjustment: settings.hijriAdjustment
  };

  if (location.mode === 'geo') {
    params.latitude = location.latitude;
    params.longitude = location.longitude;
    return fetchJson(`${API_BASE}/timings`, params);
  }

  params.city = location.city;
  params.country = location.country;
  return fetchJson(`${API_BASE}/timingsByCity`, params);
}

async function fetchHolidays(settings, location) {
  const now = new Date();
  const params = {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    method: settings.method,
    school: settings.school,
    adjustment: settings.hijriAdjustment
  };

  let url = `${API_BASE}/calendar`;
  if (location.mode === 'geo') {
    params.latitude = location.latitude;
    params.longitude = location.longitude;
  } else {
    url = `${API_BASE}/calendarByCity`;
    params.city = location.city;
    params.country = location.country;
  }

  const response = await fetchJson(url, params);
  const items = [];
  response.data.forEach(entry => {
    const holidays = entry.date.hijri.holidays || [];
    holidays.forEach(name => {
      items.push({
        name,
        gregorian: entry.date.gregorian.date,
        hijri: `${entry.date.hijri.day} ${entry.date.hijri.month.en} ${entry.date.hijri.year} AH`
      });
    });
  });

  const today = new Date();
  return items
    .map(item => ({
      ...item,
      sortDate: new Date(item.gregorian.split('-').reverse().join('-'))
    }))
    .filter(item => item.sortDate >= today)
    .sort((a, b) => a.sortDate - b.sortDate)
    .slice(0, 4);
}

function renderTimings(data) {
  prayerTimesEl.innerHTML = '';
  const timings = data.timings;
  const order = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  order.forEach(key => {
    const card = document.createElement('div');
    card.className = 'time-card';

    const label = document.createElement('p');
    label.className = 'label';
    label.textContent = key;

    const time = document.createElement('p');
    time.className = 'time';
    time.textContent = timings[key];

    card.appendChild(label);
    card.appendChild(time);
    prayerTimesEl.appendChild(card);
  });
}

function renderHolidays(holidays) {
  holidayListEl.innerHTML = '';
  if (holidays.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No upcoming sacred days this month.';
    holidayListEl.appendChild(li);
    return;
  }

  holidays.forEach(item => {
    const li = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = item.name;
    const date = document.createElement('span');
    date.textContent = `${item.gregorian} • ${item.hijri}`;
    li.appendChild(name);
    li.appendChild(date);
    holidayListEl.appendChild(li);
  });
}

function applyRamadanMode(isRamadan, timings) {
  if (isRamadan) {
    ramadanPanel.classList.add('ramadan');
    suhoorEl.textContent = timings.Imsak || timings.Fajr;
    iftarEl.textContent = timings.Maghrib;
  } else {
    ramadanPanel.classList.remove('ramadan');
    suhoorEl.textContent = timings.Fajr;
    iftarEl.textContent = timings.Maghrib;
  }
}

async function fetchJson(url, params) {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      query.append(key, params[key]);
    }
  });

  const response = await fetch(`${url}?${query.toString()}`);
  if (!response.ok) {
    throw new Error('API error');
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error('API error');
  }

  return data.data;
}
