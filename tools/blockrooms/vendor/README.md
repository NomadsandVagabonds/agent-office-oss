# Supabase browser SDK

Pinned, unmodified `dist/umd/supabase.js` from the official npm package
`@supabase/supabase-js@2.119.0`. Its MIT license and bundled dependency notices
are beside it (`LICENSE-supabase.txt`, `NOTICES-supabase.txt`).

SHA-256:
`a867edbcfb029370aeec7223dd6180b560b621fbe3bc64c6584fb0369d1b7bce`

This is the optional account flow's browser-only dependency, vendored like
Three. It avoids writing our own OAuth, PKCE, OTP, session refresh and
cross-tab auth implementation. No npm install/build service or CDN is needed
at runtime. Guest Play does not load it. Do not edit the minified bundle;
replace it from a reviewed pinned upstream release and update its checksum.
