// ======================================
// SIGA - SharePoint
// ======================================

const sitio = "https://emovasa.sharepoint.com/sites/Pruebas313";

async function leerCursos() {

    try {

        const respuesta = await fetch(
            sitio + "/_api/web/lists/GetByTitle('Siga_Cursos')/items",
            {
                headers: {
                    "Accept": "application/json;odata=nometadata"
                }
            }
        );

        console.log("Estado:", respuesta.status);

        const datos = await respuesta.json();

        console.log("Datos:", datos);

    } catch (error) {

        console.error("ERROR:", error);

    }

}