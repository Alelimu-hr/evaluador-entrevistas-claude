import { redirect } from "next/navigation";

// Esta ruta quedó como un experimento incompleto (solo generaba preguntas
// y no continuaba con la grabación/evaluación). El simulador completo vive
// en la página principal ("/"), así que redirigimos para no confundir a
// quien entre acá.
export default function SimuladorPage() {
  redirect("/");
}
