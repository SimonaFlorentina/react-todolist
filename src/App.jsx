import { useState, useEffect, useRef } from 'react'
import { ref, onValue, set } from 'firebase/database'
import { db } from './firebase'

const CATEGORIES = {
  transport: { emoji: '🛫', label: 'Transport' },
  accommodation: { emoji: '🏨', label: 'Cazare' },
  food: { emoji: '🍽️', label: 'Mâncare' },
  activities: { emoji: '🎭', label: 'Activități' },
  other: { emoji: '📌', label: 'Altele' }
}

function App() {
  const defaultLocation = {
    name: 'Bucharest, RO',
    latitude: 44.4268,
    longitude: 26.1025
  }

  const [days, setDays] = useState([])
  const [history, setHistory] = useState([])
  const [currentDay, setCurrentDay] = useState(1)
  const [input, setInput] = useState('')
  const [price, setPrice] = useState('')
  const [time, setTime] = useState('')
  const [link, setLink] = useState('')
  const [category, setCategory] = useState('activities')
  const [location, setLocation] = useState(defaultLocation)
  const [locationQuery, setLocationQuery] = useState(defaultLocation.name)
  const [locationMessage, setLocationMessage] = useState('')
  const [weatherCache, setWeatherCache] = useState({})
  const [draggedItemId, setDraggedItemId] = useState(null)
  const [remoteLoaded, setRemoteLoaded] = useState(false)
  const ownSaveRef = useRef(false)
  const saveTimerRef = useRef(null)

  const itineraryRef = ref(db, 'itinerary')

  const normalizeItem = (item) => {
    if (!item || typeof item !== 'object') return null
    return {
      id: item.id ?? Date.now(),
      title: item.title ?? '',
      category: CATEGORIES[item.category] ? item.category : 'activities',
      price: item.price ? Number(item.price) : 0,
      time: item.time ?? '',
      link: item.link ?? '',
      done: Boolean(item.done)
    }
  }

  const normalizeItems = (items) => {
    if (Array.isArray(items)) {
      return items.flatMap((item) => {
        if (Array.isArray(item)) {
          return item.map(normalizeItem).filter(Boolean)
        }
        const normalized = normalizeItem(item)
        return normalized ? [normalized] : []
      })
    }
    if (items && typeof items === 'object') {
      return Object.values(items).map(normalizeItem).filter(Boolean)
    }
    return []
  }

  const normalizeDay = (day) => {
    if (!day || typeof day !== 'object' || Array.isArray(day)) {
      return { day: 1, date: new Date().toISOString().slice(0, 10), items: [] }
    }

    return {
      day: Number.isFinite(day.day) ? day.day : Number(day.day) || 1,
      date: typeof day.date === 'string' && day.date ? day.date : new Date().toISOString().slice(0, 10),
      items: normalizeItems(day.items)
    }
  }

  const canonicalizeDays = (daysList) => {
    const normalized = daysList.map(normalizeDay)
    return normalized.map((day, index) => ({
      ...day,
      day: index + 1
    }))
  }

  const normalizeLocation = (loc) => ({
    name: loc?.name || defaultLocation.name,
    latitude: typeof loc?.latitude === 'number' ? loc.latitude : defaultLocation.latitude,
    longitude: typeof loc?.longitude === 'number' ? loc.longitude : defaultLocation.longitude
  })

  const normalizeRemoteData = (remote) => {
    const isDayObject = (entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && (
      entry.day != null || entry.date != null || entry.items != null
    )

    const isLocationEntry = (entry) => entry && typeof entry === 'object' &&
      typeof entry.latitude === 'number' && typeof entry.longitude === 'number' &&
      typeof entry.name === 'string'

    const isLegacyRemoteArray = (value) =>
      Array.isArray(value) &&
      value.length === 2 &&
      Array.isArray(value[0]) &&
      isLocationEntry(value[1])

    let rawDays = []
    let locationData = defaultLocation

    if (Array.isArray(remote)) {
      if (isLegacyRemoteArray(remote)) {
        rawDays = remote[0]
        locationData = remote[1]
      } else {
        const locationEntry = remote.find(isLocationEntry)
        const dayEntries = remote.filter(isDayObject)
        if (dayEntries.length > 0) rawDays = dayEntries
        if (locationEntry) locationData = locationEntry
      }
    } else if (remote && typeof remote === 'object') {
      if (remote.days) {
        rawDays = Array.isArray(remote.days)
          ? remote.days
          : Object.keys(remote.days)
              .sort((a, b) => Number(a) - Number(b))
              .map((key) => remote.days[key])
      } else if (isDayObject(remote)) {
        rawDays = [remote]
      }

      if (remote.location && typeof remote.location === 'object') {
        locationData = remote.location
      } else if (isLocationEntry(remote)) {
        locationData = remote
      }
    }

    return {
      days: canonicalizeDays(rawDays),
      location: {
        name: locationData.name || defaultLocation.name,
        latitude: typeof locationData.latitude === 'number' ? locationData.latitude : defaultLocation.latitude,
        longitude: typeof locationData.longitude === 'number' ? locationData.longitude : defaultLocation.longitude
      }
    }
  }

  const formatDate = (value) => {
    if (!value) return ''
    try {
      return new Date(value).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
    } catch {
      return value
    }
  }

  const toFirebaseList = (array) => {
    if (!Array.isArray(array)) return {}
    return array.reduce((acc, item, index) => {
      acc[index] = item
      return acc
    }, {})
  }

  const saveItinerary = (daysToSave, locationToSave) => {
    const cleanedDays = canonicalizeDays(daysToSave).map((day) => {
      const normalized = normalizeDay(day)
      return {
        ...normalized,
        items: toFirebaseList(normalizeItems(normalized.items))
      }
    })
    const cleanedLocation = normalizeLocation(locationToSave)
    ownSaveRef.current = true
    set(itineraryRef, {
      days: toFirebaseList(cleanedDays),
      location: cleanedLocation
    })
      .catch((error) => {
        console.error('Firebase save error:', error)
      })
      .finally(() => {
        ownSaveRef.current = false
      })
  }

  const weatherCodeToDescription = (code) => {
    if (code === 0) return 'Senin'
    if ([1, 2, 3].includes(code)) return 'Parțial senin'
    if ([45, 48].includes(code)) return 'Cețos'
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Ploios'
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Ninsoare'
    if ([95, 96, 99].includes(code)) return 'Furtună'
    return 'Noros'
  }

  const getWeatherClass = (description) => {
    const value = description?.toLowerCase() || ''
    if (value.includes('senin') || value.includes('soare')) return 'sunny'
    if (value.includes('ploios') || value.includes('furtună') || value.includes('tun')) return 'rainy'
    if (value.includes('cețos') || value.includes('noros')) return 'cloudy'
    if (value.includes('ninsoare')) return 'snowy'
    return 'cloudy'
  }

  const getWeatherEmoji = (description) => {
    const value = description?.toLowerCase() || ''
    if (value.includes('senin')) return '☀️'
    if (value.includes('parțial')) return '🌤️'
    if (value.includes('ploios') || value.includes('furtună')) return '🌧️'
    if (value.includes('cețos')) return '🌫️'
    if (value.includes('ninsoare')) return '❄️'
    return '⛅'
  }

  const getHourlyWeatherIcon = (description, time) => {
    const hour = Number(time.split(':')[0])
    const isNight = hour >= 20 || hour < 6
    const value = description?.toLowerCase() || ''

    if (value.includes('senin')) return isNight ? '🌙' : '☀️'
    if (value.includes('parțial')) return isNight ? '🌙☁️' : '🌤️'
    if (value.includes('ploios')) return isNight ? '🌧️' : '🌧️'
    if (value.includes('furtună')) return isNight ? '⛈️' : '⛈️'
    if (value.includes('cețos')) return isNight ? '🌫️' : '🌥️'
    if (value.includes('ninsoare')) return isNight ? '❄️' : '🌨️'
    return isNight ? '🌙' : '⛅'
  }

  const getActivityWeatherIcon = (date, time) => {
    const dayWeather = weatherCache[date]
    if (!dayWeather) return ''
    const targetTime = time?.slice(0, 5)
    if (!targetTime) return dayWeather.summary?.icon || ''

    let best = dayWeather.intervals[0]
    let bestDiff = Math.abs(
      Number(best.time.slice(0, 2)) * 60 + Number(best.time.slice(3)) -
      (Number(targetTime.slice(0, 2)) * 60 + Number(targetTime.slice(3)))
    )

    dayWeather.intervals.forEach((slot) => {
      const slotMinutes = Number(slot.time.slice(0, 2)) * 60 + Number(slot.time.slice(3))
      const targetMinutes = Number(targetTime.slice(0, 2)) * 60 + Number(targetTime.slice(3))
      const diff = Math.abs(slotMinutes - targetMinutes)
      if (diff < bestDiff) {
        best = slot
        bestDiff = diff
      }
    })

    return best?.icon || ''
  }

  const buildHourlyForecast = (hourly) => {
    const hourlyData = {}
    hourly.time.forEach((timestamp, index) => {
      const date = timestamp.slice(0, 10)
      const time = timestamp.slice(11, 16)
      const description = weatherCodeToDescription(hourly.weathercode[index])
      const icon = getHourlyWeatherIcon(description, time)
      const temp = hourly.temperature_2m[index]

      if (!hourlyData[date]) hourlyData[date] = []
      hourlyData[date].push({ time, temp, description, icon })
    })

    const twoHourData = {}
    Object.entries(hourlyData).forEach(([date, entries]) => {
      const filtered = entries.filter((_, idx) => idx % 2 === 0).slice(0, 12)
      twoHourData[date] = {
        summary: filtered[0] || entries[0] || null,
        intervals: filtered
      }
    })
    return twoHourData
  }

  const fetchWeatherForRange = async (startDate, endDate) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&hourly=weathercode,temperature_2m&timezone=Europe/Bucharest&start_date=${startDate}&end_date=${endDate}`
      const response = await fetch(url)
      const data = await response.json()
      if (!data || !data.hourly) return

      const newCache = buildHourlyForecast(data.hourly)
      setWeatherCache((prev) => ({ ...prev, ...newCache }))
    } catch (error) {
      console.error('Weather fetch error:', error)
    }
  }

  const getForecastRange = (dates) => {
    if (!dates.length) return null
    const sorted = dates.slice().sort()
    return {
      minDate: sorted[0],
      maxDate: sorted[sorted.length - 1]
    }
  }

  const searchLocation = async () => {
    if (!locationQuery.trim()) {
      setLocationMessage('Scrie o locație înainte de a căuta.')
      return
    }
    try {
      setLocationMessage('Caut locație...')
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationQuery)}&count=1&language=ro&format=json`
      const response = await fetch(url)
      const data = await response.json()
      if (data && data.results && data.results.length > 0) {
        const result = data.results[0]
        const newLocation = {
          name: `${result.name}, ${result.country}`,
          latitude: result.latitude,
          longitude: result.longitude
        }
        setLocation(newLocation)
        setLocationQuery(newLocation.name)
        setWeatherCache({})
        setLocationMessage(`Locație setată la ${newLocation.name}`)
        return
      }
      setLocationMessage('Locație negăsită. Folosesc locația implicită.')
    } catch (error) {
      setLocationMessage('Eroare la căutarea locației.')
    }
  }

  const useBrowserLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Geolocația nu este disponibilă aici.')
      return
    }

    setLocationMessage('Determin locația...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          name: 'Locație actuală',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
        setLocation(newLocation)
        setLocationQuery(newLocation.name)
        setWeatherCache({})
        setLocationMessage('Locația actuală a fost setată.')
      },
      () => {
        setLocationMessage('Nu am putut obține locația actuală.')
      }
    )
  }

  useEffect(() => {
    const localData = localStorage.getItem('itinerary')
    const unsubscribe = onValue(itineraryRef, (snapshot) => {
      const remote = snapshot.val()
      if (ownSaveRef.current) {
        setRemoteLoaded(true)
        return
      }

      if (remote) {
        const { days: parsedDays, location: parsedLocation } = normalizeRemoteData(remote)
        const sortedDays = parsedDays.slice().sort((a, b) => a.day - b.day)
        setDays(sortedDays)
        setLocation(parsedLocation)
        setLocationQuery(parsedLocation.name)
        setCurrentDay((current) => sortedDays.some(d => d.day === current) ? current : (sortedDays[0]?.day ?? 1))
      } else if (localData) {
        try {
          const parsed = JSON.parse(localData)
          const { days: parsedDays, location: parsedLocation } = normalizeRemoteData(parsed)
          const sortedDays = parsedDays.slice().sort((a, b) => a.day - b.day)
          setDays(canonicalizeDays(sortedDays))
          setLocation(parsedLocation)
          setLocationQuery(parsedLocation.name)
          setCurrentDay(canonicalizeDays(sortedDays)[0]?.day ?? 1)
          saveItinerary(canonicalizeDays(sortedDays), parsedLocation)
        } catch (error) {
          const initial = [{ day: 1, date: new Date().toISOString().slice(0, 10), items: [] }]
          setDays(initial)
          saveItinerary(initial, defaultLocation)
        }
      } else {
        const initial = [{ day: 1, date: new Date().toISOString().slice(0, 10), items: [] }]
        setDays(initial)
        saveItinerary(initial, defaultLocation)
      }
      setRemoteLoaded(true)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (days.length === 0) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem('itinerary', JSON.stringify({ days, location }))
      } catch (error) {
        console.warn('LocalStorage save error:', error)
      }

      if (remoteLoaded) {
        saveItinerary(days, location)
      }
    }, 250)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [days, location, remoteLoaded])

  useEffect(() => {
    const dates = days.map(d => d.date).filter(Boolean)
    const range = getForecastRange(dates)
    if (!range) return
    const today = new Date().toISOString().slice(0, 10)
    const maxForecast = new Date()
    maxForecast.setDate(new Date().getDate() + 15)
    const maxForecastDate = maxForecast.toISOString().slice(0, 10)
    const startDate = today
    const endDate = range.maxDate > maxForecastDate ? maxForecastDate : range.maxDate
    fetchWeatherForRange(startDate, endDate)
  }, [days, location])

  const updateDays = (newDays) => {
    setHistory((prev) => [...prev, days])
    setDays(canonicalizeDays(newDays))
  }

  const undo = () => {
    if (history.length === 0) return
    const previousState = history[history.length - 1]
    setDays(previousState)
    setHistory(history.slice(0, -1))
  }

  const addDay = () => {
    const newDay = Math.max(...days.map(d => d.day), 0) + 1
    const lastDate = days[days.length - 1]?.date || new Date().toISOString().slice(0, 10)
    const nextDate = (() => {
      const d = new Date(lastDate)
      d.setDate(d.getDate() + 1)
      return d.toISOString().slice(0, 10)
    })()
    updateDays([...days, { day: newDay, date: nextDate, items: [] }])
    setCurrentDay(newDay)
  }

  const updateDayDate = (dayNum, date) => {
    updateDays(days.map(d => d.day === dayNum ? { ...d, date } : d))
  }

  const deleteDay = (dayNum) => {
    if (days.length === 1) {
      alert('Nu poți șterge singura zi!')
      return
    }
    
    const confirmed = window.confirm(`Ești sigur că vrei să ștergi Ziua ${dayNum}? Această acțiune nu poate fi anulată direct, dar poți folosi butonul Undo.`)
    if (!confirmed) return
    
    const updated = days.filter(d => d.day !== dayNum)
    updateDays(updated)
    const nextDay = updated.find(d => d.day > dayNum) || updated[0]
    setCurrentDay(nextDay.day)
  }

  const addItem = () => {
    if (!input.trim()) return

    const updatedDays = days.map(d => {
      if (d.day === currentDay) {
        return {
          ...d,
          items: [...d.items, {
            id: Date.now(),
            title: input,
            category,
            price: price ? parseFloat(price) : 0,
            time,
            link,
            done: false
          }]
        }
      }
      return d
    })
    updateDays(updatedDays)
    setInput('')
    setPrice('')
    setTime('')
    setLink('')
    setCategory('activities')
  }

  const deleteItem = (dayNum, itemId) => {
    const updated = days.map(d => {
      if (d.day === dayNum) {
        return {
          ...d,
          items: d.items.filter(item => item.id !== itemId)
        }
      }
      return d
    })
    updateDays(updated)
  }

  const toggleItem = (dayNum, itemId) => {
    const updated = days.map(d => {
      if (d.day === dayNum) {
        return {
          ...d,
          items: d.items.map(item =>
            item.id === itemId ? { ...item, done: !item.done } : item
          )
        }
      }
      return d
    })
    updateDays(updated)
  }

  const handleDragStart = (e, itemId) => {
    setDraggedItemId(itemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, targetItemId) => {
    e.preventDefault()
    if (draggedItemId === targetItemId) return

    const updatedDays = days.map(d => {
      if (d.day === currentDay) {
        const items = [...d.items]
        const draggedIndex = items.findIndex(item => item.id === draggedItemId)
        const targetIndex = items.findIndex(item => item.id === targetItemId)
        
        if (draggedIndex > -1 && targetIndex > -1) {
          [items[draggedIndex], items[targetIndex]] = [items[targetIndex], items[draggedIndex]]
        }
        
        return { ...d, items }
      }
      return d
    })
    updateDays(updatedDays)
    setDraggedItemId(null)
  }

  const currentDayData = days.find(d => d.day === currentDay) || { date: new Date().toISOString().slice(0, 10), items: [] }
  const currentWeather = weatherCache[currentDayData.date]
  const weatherClass = currentWeather ? getWeatherClass(currentWeather.summary?.description) : ''
  const weatherEmoji = currentWeather ? currentWeather.summary?.icon || '🌤️' : '🌤️'
  const dayTotal = (currentDayData.items || []).reduce((sum, item) => sum + (item.price || 0), 0)
  const tripTotal = days.reduce((sum, day) => 
    sum + ((day.items || []).reduce((daySum, item) => daySum + (item.price || 0), 0)), 0
  )

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') addItem()
  }

  return (
    <div className={`container ${weatherClass}`}>
      <div className="itinerary-app">
        <h1>✈️ Itinerariu Vacanță</h1>

        <div className="location-row">
          <input
            type="text"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            placeholder="Locație vacanță"
            className="input location-input"
          />
          <button onClick={searchLocation} className="btn-search-location">Caută</button>
          <button onClick={useBrowserLocation} className="btn-location-now">Locație actuală</button>
        </div>
        {locationMessage && (
          <div className="location-message">{locationMessage}</div>
        )}

        <button 
          onClick={undo} 
          disabled={history.length === 0}
          className="btn-undo"
          title="Undo last action"
        >
          ↶ Undo ({history.length})
        </button>

        {/* Days Navigation */}
        <div className="days-nav">
          {days.map(d => (
            <div key={d.day} className="day-btn-wrapper">
              <button
                onClick={() => setCurrentDay(d.day)}
                className={`day-btn ${currentDay === d.day ? 'active' : ''}`}
              >
                Ziua {d.day} ({formatDate(d.date)})
              </button>
              {days.length > 1 && (
                <button
                  onClick={() => deleteDay(d.day)}
                  className="day-delete"
                  title="Șterge ziua"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button onClick={addDay} className="btn-add-day">+ Adaugă Zi</button>
        </div>

        {/* Add Item Form */}
        <div className="form-section">
          <h2>Ziua {currentDay}</h2>
          <div className="day-date-row">
            <div className="date-field">
              <label>Data:</label>
              <input
                type="date"
                value={currentDayData.date}
                onChange={(e) => updateDayDate(currentDay, e.target.value)}
                className="input-date"
              />
            </div>
            <div className={`weather-card ${weatherClass}`}>
              {currentWeather ? (
                <>
                  <div className="weather-card-header">
                    <div className="weather-icon">{weatherEmoji}</div>
                    <div>
                      <div className="weather-label">Vremea {formatDate(currentDayData.date)}</div>
                      <div className="weather-value">{currentWeather.summary?.description}</div>
                    </div>
                    <div className="weather-temp-large">{currentWeather.summary?.temp.toFixed(0)}°</div>
                  </div>
                  <div className="weather-forecast-title">Prognoza la fiecare 2h</div>
                  <div className="weather-forecast-grid">
                    {currentWeather.intervals.map((slot) => (
                      <div key={`${currentDayData.date}-${slot.time}`} className="weather-slot">
                        <div className="weather-slot-time">{slot.time}</div>
                        <div className="weather-slot-icon">{slot.icon}</div>
                        <div className="weather-slot-temp">{slot.temp.toFixed(0)}°</div>
                        <div className="weather-slot-desc">{slot.description}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="weather-empty">Prognoza apare aici după alegerea datei.</div>
              )}
            </div>
          </div>

          <div className="form-group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ce trebuie să faci?"
              className="input"
            />
            
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input-time"
            />
            
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="select"
            >
              {Object.entries(CATEGORIES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.emoji} {val.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Preț (optional)"
              step="0.01"
              className="input-price"
            />

            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Link (optional)"
              className="input-link"
            />

            <button onClick={addItem} className="btn-add">Adaugă</button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats">
          <p><strong>Ziua {currentDay}:</strong> <span className="price">{dayTotal.toFixed(2)} €</span></p>
          <p><strong>Total trip:</strong> <span className="price total">{tripTotal.toFixed(2)} €</span></p>
        </div>

        {/* Items List */}
        <ul className="items-list">
          {currentDayData.items.map(item => (
            <li key={item.id} className={`item ${item.done ? 'done' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, item.id)}
            >
              <div className="item-header">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleItem(currentDay, item.id)}
                  className="checkbox"
                />
                <span className="category-badge">{CATEGORIES[item.category].emoji}</span>
                {item.time && <span className="item-time">⏰ {item.time}</span>}
                <span className="item-title">{item.title}</span>
                <span className="item-weather-icon">{getActivityWeatherIcon(currentDayData.date, item.time)}</span>
                {item.price > 0 && <span className="item-price">{item.price.toFixed(2)} €</span>}
              </div>
              
              <div className="item-footer">
                {item.link && (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="link-btn">
                    🔗 Link
                  </a>
                )}
                <button
                  onClick={() => deleteItem(currentDay, item.id)}
                  className="btn-delete"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>

        {currentDayData.items.length === 0 && (
          <p className="empty">Nicio activitate pentru ziua {currentDay}. Adaugă una! 🎉</p>
        )}
      </div>
    </div>
  )
}

export default App
