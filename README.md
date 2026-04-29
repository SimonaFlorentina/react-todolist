# React Todo List

Un todo list simplu și frumos făcut cu React, deployat pe Vercel.

## Features
✅ Adaugă și șterge tasks  
✅ Marcheaza task-uri ca done  
✅ Salvare automată cu localStorage  
✅ Interfață moderna și responsivă  

## Setup local

```bash
cd Desktop/todolist
npm install
npm run dev
```

Merge pe `http://localhost:5173`

## Deploy pe Vercel

1. **Inițializează git:**
```bash
git init
git add .
git commit -m "Initial commit"
```

2. **Creează repo pe GitHub**
   - Du-te la github.com/new
   - Numește-l "react-todolist"
   - Nu adauga README, .gitignore etc
   - Creează repo

3. **Pushai codul:**
```bash
git remote add origin https://github.com/USERNAME/react-todolist.git
git branch -M main
git push -u origin main
```

4. **Deploy pe Vercel**
   - Du-te la vercel.com/dashboard
   - Click "Add New..." → "Project"
   - Selectează "react-todolist" repo
   - Click "Import"
   - Vercel va detecta automat Vite
   - Click "Deploy"
   - Gata! 🚀

Aplicația va fi live în ~1 minut la un link pe vercel.app
