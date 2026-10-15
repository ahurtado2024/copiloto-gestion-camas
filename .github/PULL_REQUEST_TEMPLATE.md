## Qué cambia

- 

## Por qué cambia

- 

## Impacto funcional

- [ ] UI solamente
- [ ] Motor de negocio
- [ ] API
- [ ] Base de datos / schema
- [ ] Integración con hoja / correo / canales
- [ ] Documentación

## Checklist antes de pedir review

- [ ] `npm run check` pasó
- [ ] Si cambié schema, probé `npm run db:push`
- [ ] Si cambié schema, probé `npm run seed`
- [ ] Si agregué o cambié una operación en `/api/ops`, actualicé `docs/API-REFERENCE.md`
- [ ] Si toqué lógica de negocio, verifiqué no romper R1–R12
- [ ] Si toqué la integración con la hoja, verifiqué no escribir en la hoja en el MVP
- [ ] Revisé `docs/RELEASE-CHECKLIST.md`

## Smoke tests ejecutados

- [ ] `/api/health`
- [ ] `/`
- [ ] `/camas/C-304`
- [ ] `/ajustes/hoja`
- [ ] R2: disponible directo debe fallar

## Capturas / notas

- 
