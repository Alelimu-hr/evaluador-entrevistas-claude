// Mini instructivo de los 3 pasos para conseguir la API Key de Gemini.
// Nace en el simulador de entrevistas y se comparte acá para que las 5
// herramientas lo muestren igual (y se actualice en un solo lugar).
export function PasosApiKey() {
  return (
    <ol className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
      {[
        'Entrá con tu cuenta de Google.',
        'Arriba de la página, hacé clic en "Crear clave de API".',
        'Esperá unos segundos: se abre tu clave, lista para copiar.',
      ].map((paso, i) => (
        <li key={i} className="flex items-start gap-1.5 text-slate-500">
          <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          {paso}
        </li>
      ))}
    </ol>
  );
}
