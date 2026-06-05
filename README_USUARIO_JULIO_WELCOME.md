# Usuario de prueba para Julio + mensaje de bienvenida

## Qué significa lo que pidió Julio

Julio está pidiendo una URL pública para entrar desde su equipo y probar el portal sin depender de tu sesión local.

URL actual:
https://klap-dora.vercel.app/login?next=%2F

## Crear usuario en Supabase Auth

No se recomienda insertar usuarios directo en auth.users por SQL.
Hazlo desde Supabase:

1. Supabase Dashboard
2. Authentication
3. Users
4. Add user
5. Correo: [correo de Julio]
6. Password temporal: crear una clave temporal
7. Marcar email confirmed si aparece la opción
8. Guardar

## Dar rol Release Manager

Luego ejecutar en Supabase SQL Editor:

update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object('role', 'rm')
where email = '[correo de Julio]';

notify pgrst, 'reload schema';

## Configurar bienvenida solo para Julio

En Vercel > Environment Variables agregar:

NEXT_PUBLIC_WELCOME_EMAILS=[correo de Julio]

Ejemplo:
NEXT_PUBLIC_WELCOME_EMAILS=julio.quiroz@klap.cl

Si no configuras esa variable, el mensaje se mostrará una vez para cualquier usuario nuevo que entre al home.

## Mensaje de bienvenida incluido

Al entrar al portal se muestra una sola vez por usuario:

"Hola [nombre], bienvenido a Klap DORA.
Este portal centraliza el proceso de Release Management: creación de RDC, aprobación CAB, evidencia digital, generación de PAP Jira, cierre y métricas DORA."

## Respuesta sugerida para Julio por Teams

Hola Julio, sí, te comparto la URL pública para que puedas entrar y probar el portal:

https://klap-dora.vercel.app/login?next=%2F

Te crearé un usuario de prueba y dejaré activo un mensaje de bienvenida inicial para guiarte en el flujo. La idea es que puedas revisar el portal como usuario final: crear RDC, ver mis cambios y entender cómo se conecta con CAB, PAP Jira y DORA.
