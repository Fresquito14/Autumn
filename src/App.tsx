function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍂</span>
            <h1 className="text-2xl font-bold text-primary">Autumn</h1>
            <span className="text-gray-500 text-sm">Gestión de Proyectos</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h2 className="text-xl font-semibold mb-4">Bienvenido a Autumn</h2>
          <p className="text-gray-600">
            Una aplicación profesional para planificación y seguimiento de proyectos con diagramas de Gantt.
          </p>
          <p className="text-gray-600 mt-2">
            Inspirada en Primavera pero moderna, accesible y gratuita.
          </p>
        </div>
      </main>
    </div>
  )
}

export default App
