const API_BASE = 'https://api.aladhan.com/v1';
const defaultSettings = {
  locationMode: 'geo',
  city: '',
  country: '',
  method: '2',
  school: '0',
  hijriAdjustment: '0'
};

const elements = {
  locationMode: document.getElementById('locationMode'),
  city: document.getElementById('city'),
  country: document.getElementById('country'),
  method: document.getElementById('method'),
  school: document.getElementById('school'),
  hijriAdjustment: document.getElementById('hijriAdjustment'),
  status: document.getElementById('status')
};

init();

async function init() {
  const methods = await loadMethods();
  populateMethods(methods);
  chrome.storage.sync.get(defaultSettings, settings => {
    elements.locationMode.value = settings.locationMode;
    elements.city.value = settings.city;
    elements.country.value = settings.country;
    elements.method.value = settings.method;
    elements.school.value = settings.school;
    elements.hijriAdjustment.value = settings.hijriAdjustment;
  });

  document.getElementById('save').addEventListener('click', saveSettings);
}

async function loadMethods() {
  try {
    const response = await fetch(`${API_BASE}/methods`);
    const data = await response.json();
    if (data.code === 200) {
      return data.data;
    }
  } catch (err) {
    // ignore
  }

  return {
    MWL: {id: 3, name: 'Muslim World League'},
    ISNA: {id: 2, name: 'Islamic Society of North America'},
    EG: {id: 5, name: 'Egyptian General Authority of Survey'},
    MK: {id: 4, name: 'Umm Al-Qura University, Makkah'}
  };
}

function populateMethods(methods) {
  elements.method.innerHTML = '';
  Object.keys(methods)
    .map(key => methods[key])
    .sort((a, b) => a.id - b.id)
    .forEach(method => {
      const option = document.createElement('option');
      option.value = String(method.id);
      option.textContent = `${method.name} (${method.id})`;
      elements.method.appendChild(option);
    });
}

function saveSettings() {
  const payload = {
    locationMode: elements.locationMode.value,
    city: elements.city.value.trim(),
    country: elements.country.value.trim(),
    method: elements.method.value,
    school: elements.school.value,
    hijriAdjustment: elements.hijriAdjustment.value
  };

  chrome.storage.sync.set(payload, () => {
    elements.status.textContent = 'Saved.';
    setTimeout(() => {
      elements.status.textContent = '';
    }, 1500);
  });
}
