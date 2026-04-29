import { useState, useEffect } from 'react'

const CATEGORIES = {
  transport: { emoji: '🛫', label: 'Transport' },
  accommodation: { emoji: '🏨', label: 'Cazare' },
  food: { emoji: '🍽️', label: 'Mâncare' },
  activities: { emoji: '🎭', label: 'Activități' },
  other: { emoji: '📌', label: 'Altele' }
}

function App() {
  const [days, setDays] = useState([])
  const [currentDay, setCurrentDay] = useState(1)
  const [input, setInput] = useState('')
  const [price, setPrice] = useState('')
  const [link, setLink] = useState('')
  const [category, setCategory] = useState('activities')

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('itinerary')
    if (saved) {
      const parsed = JSON.parse(saved)
      setDays(parsed)
      if (parsed.length > 0) setCurrentDay(1)
    } else {
      // Create first day
      setDays([{ day: 1, items: [] }])
    }
  }, [])

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('itinerary', JSON.stringify(days))
  }, [days])

  const addDay = () => {
    const newDay = Math.max(...days.map(d => d.day), 0) + 1
    setDays([...days, { day: newDay, items: [] }])
    setCurrentDay(newDay)
  }

  const deleteDay = (dayNum) => {
    if (days.length === 1) return
    const updated = days.filter(d => d.day !== dayNum)
    setDays(updated)
    setCurrentDay(updated[0].day)
  }

  const addItem = () => {
    if (!input.trim() || !price.trim()) return

    const updatedDays = days.map(d => {
      if (d.day === currentDay) {
        return {
          ...d,
          items: [...d.items, {
            id: Date.now(),
            title: input,
            category,
            price: parseFloat(price),
            link,
            done: false
          }]
        }
      }
      return d
    })
    setDays(updatedDays)
    setInput('')
    setPrice('')
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
    setDays(updated)
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
    setDays(updated)
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
              placeholder="Preț"
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
            <li key={item.id} className={`item ${item.done ? 'done' : ''}`}>
              <div className="item-header">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleItem(currentDay, item.id)}
                  className="checkbox"
                />
                <span className="category-badge">{CATEGORIES[item.category].emoji}</span>
                <span className="item-title">{item.title}</span>
                <span className="item-price">{item.price.toFixed(2)} €</span>
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
