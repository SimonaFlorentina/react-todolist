import { useState, useEffect } from 'react'
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
  const [days, setDays] = useState([])
  const [history, setHistory] = useState([])
  const [currentDay, setCurrentDay] = useState(1)
  const [input, setInput] = useState('')
  const [price, setPrice] = useState('')
  const [time, setTime] = useState('')
  const [link, setLink] = useState('')
  const [category, setCategory] = useState('activities')
  const [draggedItemId, setDraggedItemId] = useState(null)

  const itineraryRef = ref(db, 'itinerary')

  const normalizeRemoteData = (remote) => {
    if (Array.isArray(remote)) return remote
    if (remote && typeof remote === 'object') return Object.values(remote)
    return []
  }

  useEffect(() => {
    const localData = localStorage.getItem('itinerary')
    const unsubscribe = onValue(itineraryRef, (snapshot) => {
      const remote = snapshot.val()
      if (remote) {
        const parsedRemote = normalizeRemoteData(remote)
        setDays(parsedRemote)
        if (parsedRemote.length > 0) setCurrentDay(parsedRemote[0].day)
      } else if (localData) {
        const parsed = JSON.parse(localData)
        setDays(parsed)
        if (parsed.length > 0) setCurrentDay(parsed[0].day)
        set(itineraryRef, parsed)
      } else {
        const initial = [{ day: 1, items: [] }]
        setDays(initial)
        set(itineraryRef, initial)
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (days.length === 0) return
    localStorage.setItem('itinerary', JSON.stringify(days))
    set(itineraryRef, days)
  }, [days])

  const updateDays = (newDays) => {
    setHistory((prev) => [...prev, days])
    setDays(newDays)
  }

  const undo = () => {
    if (history.length === 0) return
    const previousState = history[history.length - 1]
    setDays(previousState)
    setHistory(history.slice(0, -1))
  }

  const addDay = () => {
    const newDay = Math.max(...days.map(d => d.day), 0) + 1
    updateDays([...days, { day: newDay, items: [] }])
    setCurrentDay(newDay)
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
    setCurrentDay(updated[0].day)
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

  const currentDayData = days.find(d => d.day === currentDay) || { items: [] }
  const dayTotal = currentDayData.items.reduce((sum, item) => sum + (item.price || 0), 0)
  const tripTotal = days.reduce((sum, day) => 
    sum + day.items.reduce((daySum, item) => daySum + (item.price || 0), 0), 0
  )

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') addItem()
  }

  return (
    <div className="container">
      <div className="itinerary-app">
        <h1>✈️ Itinerariu Vacanță</h1>

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
                Ziua {d.day}
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
