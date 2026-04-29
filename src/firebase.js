import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyClIyzXqmxcdMp4aM6ris2APmHTlZfKXVU',
  authDomain: 'react-todolist-f53d4.firebaseapp.com',
  databaseURL: 'https://react-todolist-f53d4-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'react-todolist-f53d4',
  storageBucket: 'react-todolist-f53d4.firebasestorage.app',
  messagingSenderId: '742744218192',
  appId: '1:742744218192:web:10acf181208f0fe5720f55'
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
