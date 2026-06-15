-- Sprint 15: Eliminar campo RFC de la tabla rdc.
-- El campo no se utiliza en la aplicación.
-- Ejecutar manualmente cuando se confirme que no hay dependencias externas.

ALTER TABLE rdc DROP COLUMN IF EXISTS rfc;
