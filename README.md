# ProyectoSSOFrontend

Frontend React que consume la sesión SSO gestionada por el backend PHP. Se autentica mediante **SAML 2.0** a través de **Keycloak** como Identity Provider, con **PHP como Service Provider**.

> Este README asume que ya tienes el backend configurado y corriendo. Si no, lee primero el README de `ProyectoSSODemoBackend`.

---

## ¿Qué rol juega React en el flujo SSO?

React **no habla SAML directamente**. Este es un punto importante de entender.

SAML fue diseñado para aplicaciones con servidor — funciona a base de redirects HTTP y POST del navegador entre el SP y el IdP. Una SPA (Single Page Application) como React no puede ser el SP porque no tiene un servidor que reciba el POST del assertion.

Por eso el rol de React en este proyecto es:

1. **Detectar si hay sesión activa** consultando `/me` en el backend al cargar la app.
2. **Iniciar el login** redirigiendo al endpoint `/login` del backend, que a su vez redirige a Keycloak.
3. **Mostrar los datos del usuario** una vez autenticado.
4. **Iniciar el logout** redirigiendo al endpoint `/logout` del backend.

React nunca ve contraseñas, nunca procesa assertions SAML, nunca habla con Keycloak directamente. Toda esa complejidad vive en el backend PHP.

```
React ←→ PHP (SP) ←→ Keycloak (IdP)
  ↑
Solo consume la sesión
que PHP estableció
```

---

## Requisitos

- Node.js 18 o superior
- npm 9 o superior
- El backend `ProyectoSSOBackend` corriendo en `http://localhost:8000`
- Keycloak corriendo en `http://localhost:8080`

### Verificar versiones

```bash
node --version   # debe ser v18+
npm --version    # debe ser 9+
```

---

## Instalación

### 1. Crear el proyecto con Vite

Usamos **Vite** como bundler porque es significativamente más rápido que Create React App, tiene hot reload instantáneo, y es el estándar actual para proyectos React modernos.

> **Nota:** Si tienes Node 18 usa Vite 4. Vite 5+ requiere Node 20 o superior.

```bash
cd ~
npm create vite@4 ProyectoSSOFrontend -- --template react
cd ProyectoSSOFrontend
npm install
```

### 2. Levantar el servidor de desarrollo

```bash
npm run dev
```

Abre `http://localhost:5173` en el navegador.

---

## Estructura del proyecto

```
ProyectoSSOFrontend/
├── package.json          # Dependencias y scripts
├── vite.config.js        # Configuración de Vite
├── index.html            # HTML base — Vite inyecta el JS aquí
└── src/
    ├── main.jsx          # Entry point — monta React en el DOM
    └── App.jsx           # Componente principal con la lógica SSO
```

### ¿Por qué no hay más archivos?

Para una demo de SSO, toda la lógica vive en `App.jsx`. En un proyecto real separarías en componentes (`LoginButton`, `UserProfile`, `PrivateRoute`), un contexto de autenticación (`AuthContext`), y un hook personalizado (`useAuth`). Pero para entender el flujo, un solo archivo es más claro.

---

## El componente App.jsx explicado

```jsx
import { useState, useEffect } from 'react'

const BACKEND_URL = 'http://localhost:8000'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Al cargar la app verificamos si ya hay sesión activa en el backend
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
```

### ¿Por qué `credentials: 'include'`?

El backend PHP usa sesiones nativas — guarda la sesión en una cookie. Para que el navegador mande esa cookie en las peticiones `fetch` a un dominio diferente (el backend está en puerto 8000, el frontend en 5173), hay que incluir explícitamente `credentials: 'include'`. Sin esto, `fetch` no manda cookies en peticiones cross-origin y el backend siempre respondería "no autenticado".

### ¿Por qué `window.location.href` en lugar de `fetch`?

El flujo SAML requiere que el navegador haga un redirect completo hacia Keycloak. No es una petición AJAX — el navegador necesita navegar físicamente a la URL de Keycloak para que el usuario pueda ver la pantalla de login. Si usáramos `fetch`, la petición viajaría en segundo plano y el redirect hacia Keycloak nunca llegaría al navegador.

### ¿Por qué `useEffect` con array vacío `[]`?

El array vacío como segundo argumento de `useEffect` significa "ejecuta esto solo una vez, cuando el componente se monta". Es equivalente a `componentDidMount` en componentes de clase. Lo usamos para verificar la sesión solo al cargar la app, no en cada render.

---

## Flujo paso a paso desde el frontend

### Login

1. Usuario hace clic en **Iniciar sesión**
2. React hace `window.location.href = 'http://localhost:8000/login'`
3. El navegador navega al backend PHP
4. PHP construye un SAMLRequest y redirige al login de Keycloak
5. El usuario ingresa su usuario y contraseña en Keycloak
6. Keycloak valida las credenciales y hace un POST al ACS del backend (`/acs.php`) con el assertion SAML
7. PHP valida la firma del assertion, guarda los datos del usuario en la sesión PHP, y redirige al frontend (`http://localhost:5173`)
8. React carga, el `useEffect` llama a `/me`, el backend responde con los datos del usuario
9. React muestra el email del usuario autenticado

### Verificación de sesión (cada vez que React carga)

1. `useEffect` ejecuta `fetch('/me', { credentials: 'include' })`
2. El navegador manda la cookie de sesión automáticamente
3. PHP lee la sesión, encuentra los datos del usuario, responde `{ authenticated: true, user: { email: '...' } }`
4. React guarda el usuario en el estado y renderiza la pantalla de bienvenida

### Logout

1. Usuario hace clic en **Cerrar sesión**
2. React hace `window.location.href = 'http://localhost:8000/logout'`
3. PHP destruye la sesión local y redirige de vuelta al frontend
4. React carga, `useEffect` llama a `/me`, el backend responde `{ authenticated: false }`
5. React muestra la pantalla de login

---

## Levantar el proyecto completo

Para que todo funcione necesitas tres procesos corriendo simultáneamente, cada uno en su propia terminal:

**Terminal 1 — Keycloak:**
```bash
cd ~/keycloak-docker
sudo docker-compose up
```

**Terminal 2 — Backend PHP:**
```bash
cd /var/www/html/ProyectoSSOBackend
php -S localhost:8000 -t public public/index.php
```

**Terminal 3 — Frontend React:**
```bash
cd ~/ProyectoSSOFrontend
npm run dev
```

Abre `http://localhost:5173` en el navegador.

---

## Usuario de prueba

Si seguiste el README del backend, ya tienes este usuario creado en Keycloak:

| Campo | Valor |
|-------|-------|
| Username | `testuser` |
| Email | `test@demo.com` |
| Password | `test123` |

---

## Errores comunes

### "Failed to fetch" al llamar `/me`

El backend no está corriendo o hay un problema de CORS. Verifica que el servidor PHP esté activo y que el `.env` del backend tenga `FRONTEND_URL=http://localhost:5173`.

### Después del login regresa al login

La sesión no se está guardando. Verifica que estés usando `credentials: 'include'` en el fetch y que el backend tenga los headers CORS correctos con `Access-Control-Allow-Credentials: true`.

### "Invalid response" en el ACS

El assertion SAML expiró (tienen tiempo de vida corto). Vuelve a intentar el login desde cero. Si persiste, verifica que la hora del servidor esté sincronizada.

---

## Conclusión: ¿Por qué SSO?

SSO (Single Sign-On) resuelve uno de los problemas más costosos en organizaciones con múltiples sistemas: **la fragmentación de identidades**.

### Sin SSO

- Cada sistema tiene su propia base de datos de usuarios y su propio login
- Los usuarios manejan múltiples contraseñas, lo que lleva a contraseñas débiles o reutilizadas
- El equipo de IT administra N listas de usuarios en N sistemas distintos
- Cuando alguien sale de la empresa, hay que darlo de baja en cada sistema manualmente
- No hay visibilidad centralizada de quién accede a qué y cuándo

### Con SSO y SAML 2.0

- Un solo punto de autenticación (el Identity Provider, en este caso Keycloak)
- El usuario se autentica una vez y accede a todos los sistemas autorizados
- Administración centralizada: agregar o revocar accesos se hace en un solo lugar
- Seguridad mejorada: se pueden aplicar políticas globales como MFA, expiración de sesiones, bloqueo de cuentas
- Auditoría centralizada: todos los accesos quedan registrados en el IdP
- Los sistemas (SP) nunca ven contraseñas — solo reciben assertions firmados

### ¿Por qué SAML 2.0 y no OAuth/OIDC?

SAML 2.0 fue diseñado específicamente para autenticación federada entre organizaciones. Es el estándar adoptado por prácticamente todos los sistemas empresariales, servicios de gobierno, y plataformas como Google Workspace, Microsoft 365, Salesforce, y SAP. Si necesitas integrar tu aplicación con sistemas corporativos existentes, SAML es el protocolo que encontrarás.

OAuth/OIDC es más moderno y más fácil de implementar, pero fue diseñado originalmente para autorización (delegar acceso a recursos) y luego adaptado para autenticación. Para SSO entre aplicaciones propias o con servicios modernos, OIDC es una excelente opción. Para integrarse con el ecosistema empresarial establecido, SAML 2.0 es el estándar.

### Lo que construimos

En este proyecto implementamos el flujo SSO completo:

- **Keycloak** como Identity Provider — gestiona usuarios, valida credenciales, emite assertions SAML firmados
- **PHP** como Service Provider — valida los assertions, gestiona sesiones, expone una API para el frontend
- **React** como interfaz — consume la sesión del backend sin manejar ninguna credencial directamente

Este patrón es exactamente el mismo que usan aplicaciones empresariales reales. La diferencia entre esta demo y producción es principalmente configuración: certificados reales, HTTPS, un dominio real, y Keycloak con base de datos PostgreSQL en lugar del modo desarrollo con H2 embebida.
