import { useState, useEffect } from 'react'

const BACKEND_URL = 'http://localhost:8000'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Al cargar la app verificamos si ya hay sesión activa
    fetch(`${BACKEND_URL}/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleLogin = () => {
    window.location.href = `${BACKEND_URL}/login`
  }

  const handleLogout = () => {
    window.location.href = `${BACKEND_URL}/logout`
  }

  if (loading) return <p>Cargando...</p>

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
      {user ? (
        <>
          <h2>Bienvenido</h2>
          <p><strong>Email:</strong> {user.email}</p>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </>
      ) : (
        <>
          <h2>Demo SSO con Keycloak</h2>
          <button onClick={handleLogin}>Iniciar sesión</button>
        </>
      )}
    </div>
  )
}

export default App