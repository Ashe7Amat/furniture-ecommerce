// Escapa un texto para usarlo de forma LITERAL dentro de un patrón de .ilike()/.like().
//
// En esos patrones hay caracteres especiales: '%' (cualquier secuencia), '_' (un carácter
// cualquiera), '*' (PostgREST lo convierte en '%') y '\' (el carácter de escape de Postgres).
// supabase-js pasa el patrón tal cual a PostgREST, así que un texto del usuario metido sin escapar
// se interpreta como comodines. Así nació H17 (ver docs/mejoras-tecnicas.md): "Mis pedidos"
// buscaba por el email de la cuenta, y una cuenta "j_an@x.com" veía los pedidos de "juan@x.com".
//
// Anteponer '\' a esos cuatro caracteres los vuelve literales. Comprobado contra el PostgREST real
// (24 sep 2026, solo lectura): '_', '%' y '*' escapados dejan de ser comodines, y el resto del
// texto se sigue comparando sin distinguir mayúsculas, que es lo que aporta ILIKE.
// Usarlo en TODO .ilike()/.like() que lleve texto que venga del usuario.
const escaparIlike = (texto) => String(texto).replace(/[\\%_*]/g, '\\$&');

module.exports = { escaparIlike };
