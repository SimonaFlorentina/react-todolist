import { useState, useEffect } from 'react'

function App() {
  const [todos, setTodos] = useState([])
  const [input, setInput] = useState('')

  // Load todos from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('todos')
    if (saved) {
      setTodos(JSON.parse(saved))
    }
  }, [])

  // Save todos to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { id: Date.now(), text: input, done: false }])
      setInput('')
    }
  }

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, done: !todo.done } : todo
    ))
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addTodo()
    }
  }

  return (
    <div className="container">
      <div className="todo-app">
        <h1>📝 My Todo List</h1>
        
        <div className="input-group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Add a new task..."
            className="input"
          />
          <button onClick={addTodo} className="btn-add">Add</button>
        </div>

        <div className="stats">
          <p>Total: <strong>{todos.length}</strong> | Done: <strong>{todos.filter(t => t.done).length}</strong></p>
        </div>

        <ul className="todo-list">
          {todos.map(todo => (
            <li key={todo.id} className={`todo-item ${todo.done ? 'done' : ''}`}>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => toggleTodo(todo.id)}
                className="checkbox"
              />
              <span className="todo-text">{todo.text}</span>
              <button 
                onClick={() => deleteTodo(todo.id)} 
                className="btn-delete"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        {todos.length === 0 && <p className="empty">No tasks yet. Add one to get started! 🚀</p>}
      </div>
    </div>
  )
}

export default App
