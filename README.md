# Monitor de Stock GEV

Aplicación interna para monitorizar el stock público de GEV-Online (familia de resistencias) y estimar rotación de códigos mediante cierres periódicos pegados manualmente.

## Uso
1. Entrar con las credenciales del único usuario autorizado (Supabase Auth).
2. Pegar bloques de texto de páginas de GEV-Online en "Cargar cierre".
3. Finalizar el cierre cuando se haya llegado a la página de corte acordada.
4. Consultar "Ranking", "Ficha histórica", "Listado de cierres" y "Comparador estacional".

## Desarrollo
`npm test` ejecuta las pruebas de lógica pura (parser, métricas, CSV, servicio de cierres).
