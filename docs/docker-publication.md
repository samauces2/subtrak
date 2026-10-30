# Imagen Docker y publicación en Docker Hub

Destino: `samauces/subtrak`. Este flujo publica una imagen; no despliega en Azure ni en otro host.

## Flujo diario

1. Trabaja en una rama y abre un pull request hacia `main`.
2. `Docker image / Validate application and image` instala las dependencias bloqueadas, ejecuta las pruebas, compila TypeScript/Vite, construye la imagen y comprueba el contenedor en ejecución. No recibe credenciales de Docker Hub ni publica imágenes desde los PR.
3. Fusiona el PR cuando las validaciones pasen. La rama `main` debe exigir PR y este check; no exige la revisión formal de otra persona, porque el propietario trabaja solo.
4. El push generado por el merge vuelve a validar el commit. Un paso comprueba mediante la API de GitHub que pertenece a un PR fusionado en `main`; los pushes directos no publican.
5. El job `Publish to Docker Hub` espera aprobación del entorno `dockerhub`. En Actions, abre la ejecución → **Review deployments** → selecciona `dockerhub` → **Approve and deploy**. Aunque GitHub diga “deploy”, este job solamente publica en Docker Hub.
6. Después de tu aprobación, construye y publica las variantes `linux/amd64` y `linux/arm64`:
   - `samauces/subtrak:sha-<commit-completo>`: versión identificada por el commit.
   - `samauces/subtrak:latest`: alias de la última publicación aprobada.
7. El resumen de la ejecución muestra las etiquetas y el digest del manifiesto publicado.

El entorno permite la aprobación del propio usuario que inició la ejecución (necesario para trabajar solo), exige al revisor `samauces2` y admite exclusivamente la rama `main`. La configuración de aprobación está en GitHub, no se crea por declarar `environment:` en el YAML. Debe mantenerse al reutilizar este workflow en otros repositorios.

## Configuración inicial que requiere el propietario

### Docker Hub

1. Crea el repositorio `samauces/subtrak` con la visibilidad que prefieras.
2. Genera un **personal access token** de Docker Hub con permisos **Read & Write**. No hace falta permiso Delete.
3. En GitHub → Settings → Environments → `dockerhub` → Environment secrets, crea **`DOCKERHUB_TOKEN`** con ese token.
4. No lo pegues en el chat, archivos del proyecto, Dockerfile ni argumentos de construcción.

El usuario de autenticación por defecto es `samauces`. Si el token pertenece a otro usuario autorizado a publicar en ese namespace, configura la variable de entorno GitHub **`DOCKERHUB_USERNAME`** con ese usuario. La imagen seguirá llamándose `samauces/subtrak`.

Enlaces del repositorio:

- [Configurar entorno y secreto](https://github.com/samauces2/subtrak/settings/environments)
- [Ver ejecuciones y aprobar publicación](https://github.com/samauces2/subtrak/actions)
- [Reglas de main](https://github.com/samauces2/subtrak/settings/branches)
- [Repositorio en Docker Hub](https://hub.docker.com/r/samauces/subtrak)

El secreto no es necesario para las validaciones de los PR. Solo se usa en el job de publicación, después de la aprobación. Si falta, la publicación falla con un mensaje explícito y puede reintentarse desde Actions tras configurarlo.

### GitHub

El entorno debe tener:

- Required reviewer: `samauces2`.
- Prevent self-review: desactivado.
- Bypass de administradores: desactivado.
- Deployment branch rule: `main`, tipo branch.

La protección de `main` debe exigir un pull request y el check **`Validate application and image`**, con la rama actualizada. No configurar una aprobación de PR obligatoria de otra persona si se trabaja solo. La aprobación manual requerida está en el entorno de publicación.

Si se quieren nuevas versiones después de rechazar o cancelar una publicación, se puede reejecutar el workflow original del merge desde Actions. No hay publicación manual desde ramas de trabajo ni disparador `workflow_dispatch`.

## Construcción local

Requiere Docker Desktop o Docker Engine con BuildKit.

```sh
docker build -t subtrak:local .
bash scripts/smoke-container.sh subtrak:local
```

El script crea un contenedor temporal, comprueba salud, HTML, JS, CSS, políticas de caché, fallback de la SPA y usuario no root, y elimina únicamente ese contenedor al terminar. Usa el puerto local `18080` por defecto; puedes pasar otro como segundo argumento.

Para abrir la aplicación:

```sh
docker run --rm --name subtrak-preview \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1:8080:8080 subtrak:local
```

Abre `http://127.0.0.1:8080/`. Detén el contenedor con Ctrl+C. Los datos del navegador en `:5173` no aparecerán automáticamente en `:8080` porque LocalStorage depende del origen. Usa exportación/importación para trasladarlos si lo necesitas.

Cuando la imagen esté publicada:

```sh
docker pull samauces/subtrak:latest
docker run --rm -p 127.0.0.1:8080:8080 samauces/subtrak:latest
```

Para seleccionar una versión concreta, usa su etiqueta `sha-...` o su digest del resumen de Actions. Un repositorio Docker Hub privado requiere autenticación para descargar la imagen.

## Diseño de la imagen

- Etapa Node 24 sobre Alpine: `npm ci`, pruebas y compilación. No se usa el servidor de desarrollo Vite en producción.
- Etapa Nginx: contiene solo archivos compilados y configuración HTTP; no incluye Node, fuentes, dependencias de desarrollo ni datos de LocalStorage.
- Bases oficiales fijadas por digest. Las actualizaciones de esas bases se revisan mediante PR.
- Puerto `8080`, usuario `nginx`, compatible con filesystem de solo lectura y `/tmp` temporal.
- `GET /healthz` devuelve `ok`; incluye Docker HEALTHCHECK.
- HTML sin caché persistente; assets de Vite con huella y caché de un año; assets inexistentes responden 404 y las rutas SPA reciben index.html.
- Las acciones de GitHub están fijadas por SHA, con el mínimo permiso de lectura necesario; el token de Docker Hub no se pasa al build.

## Referencias oficiales

- [Docker con GitHub Actions](https://docs.docker.com/build/ci/github-actions/)
- [Publicación de imágenes en registros](https://docs.docker.com/build/ci/github-actions/push-multi-registries/)
- [Aprobar jobs protegidos por entornos de GitHub](https://docs.github.com/en/actions/how-tos/managing-workflow-runs-and-deployments/managing-deployments/reviewing-deployments)
