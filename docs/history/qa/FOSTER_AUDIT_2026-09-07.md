# Audit Foster Network — 7 septembrie 2026

## Verdict
NO-GO pentru operare reală completă. Descoperirea are bază funcțională, dar avizarea caselor, gestionarea cererilor și registrul animalelor nu sunt un circuit complet. Audit numai; codul aplicației și aprobările persistente nu au fost modificate.

## Metodă și limite
- Revizie a frontendului, adaptorului Supabase, migrațiilor și adminului.
- Trei sesiuni Playwright separate: organizație rescue, voluntar Ana, admin PetPal; frontend localhost:3000 și admin 127.0.0.1:5173, Supabase local.
- Verificări SQL cu rol authenticated și identitatea contului seeded; toate în BEGIN/ROLLBACK. Nici avizările temporare, nici invitația sintetică nu au rămas în DB.
- Nu am creat fișiere de teste, helpers sau fixtures. Au fost verificări directe în runtime.
- Nu este validare de producție, dispozitiv fizic sau test de încărcare cu 100 de animale. Capacitatea 19/100 a fost verificată contra constrângerii reale; machetele nu sunt dovadă de funcționare.
- Nu am executat aprobări reale de organizații, trimiteri externe sau remedieri.

## Probleme, ordonate după impact
| Prioritate | Problemă | Dovadă | Efect |
|---|---|---|---|
| P0 | Fosterul se poate autoaviza | SQL authenticated: PENDING → VERIFIED, UPDATE 1, apoi ROLLBACK; migrarea 0015 liniile 151–159 | Badge-ul nu dovedește decizia adminului |
| P1 | Profilul altui utilizator apare drept „al meu” | Browser rescue afișează Ana Popescu; FosterTab.js:866 folosește primul profil public, nu profil_id | Identitate și date personale asociate greșit în UI |
| P1 | Avizarea caselor lipsește din admin | Admin live are organizații/listări/documente/rapoarte/suspendări, fără coadă foster-home | Verificarea organizației nu verifică automat casa foster |
| P1 | Adminul nu poate selecta arbitrar dosarul | App.tsx:120 selectedItem = activeItems[0]; articolele de la 289 nu au handler de selecție | Într-o coadă mare poate lucra numai cu primul element; constatare de cod, nu coadă live cu 100 |
| P1 | Cererile nu se pot revizui din dashboard | Browser: Review applications lasă pagina neschimbată; FosterTab.js:1024 onClick undefined | Circuitul cerere → decizie se oprește în UI |
| P1 | Editare/publicare neconectate | Browser edit: „Foster profile editing is not connected yet”; FosterTab.js:1485–1494 afișează numai notificări | Utilizatorul nu își poate administra profilul/cazurile din aceste butoane |
| P1 | Invitații fără răspuns în frontend | InviteCard la 818 oferă doar Open messages pentru ACCEPTED; respond_to_foster_invite există SQL, fără legătură în frontend | Destinatarul nu poate accepta/refuza prin acest circuit |
| P1 | Destinatarii sunt tratați ca expeditori / nu au inbox dedicat | sentInvites la 868 include SENT/ACCEPTED indiferent de expeditor; secțiunea este sub rolul de rescuer | Încurcă rolurile și ascunde acțiunile necesare voluntarului |
| P1 | Acceptarea ignoră disponibilitatea/avizarea | SQL: casa PENDING + UNAVAILABLE a putut accepta invitația | Nu există protecția pe care o sugerează disponibilitatea; regulile dorite trebuie stabilite explicit |
| P1 | Tranziții contradictorii ale invitației | SQL: ACCEPTED → DECLINED permis, conversația rămâne 1 | Starea invitației și existența conversației se pot contrazice; accesul ulterior la chat nu a fost testat complet |
| P1 | 19/100 animale respinse ca și capacitate | SQL throws_ok confirmă 23514 pentru ambele; 0015:37 permite 1..10 | Nu este suport pentru case mari/centre |
| P1 | Nu există registru operațional de plasamente | În schema/fluxul revizuit sunt cereri/invitații, fără predare, intrare/ieșire și ocupare pe animal | ACCEPTED nu dovedește că animalul se află efectiv în casă |
| P2 | Salvarea este numai mesaj | FosterTab.js:1391 și 1438: setFosterNotice, fără persistență | „Salvat” nu produce o colecție reală |
| P2 | Completare profil fictivă | FosterTab.js:869 constantă 78 și checklist fix | Feedback de încredere înșelător |
| P2 | Eroarea la cerere aruncă formularul | FosterTab.js:1299–1304 închide applyCase/viewCase în catch | Utilizatorul pierde progresul la eroare; verificat în cod |
| P2 | Butonul conversației nu selectează conversația | AppContext.js:366 și următoarele schimbă tabul Messages | Utilizatorul trebuie să identifice manual firul; asocierea după caseId este prea largă |
| P2 | Rating nefuncțional live | SQL rate_foster_home respins cu 42501; lipsesc politici INSERT pentru reviews | Interfața oferă rating pe care backendul nu îl acceptă |
| P2 | Dashboardul utilizează catalogul ca portofoliu propriu | FosterTab.js:998–1000 numără fosterCases; adaptorul încarcă discovery_listings_view | Numărul public de cazuri nu este numărul cazurilor administrate de organizația curentă |
| P2 | Căutare/volum insuficiente | Filtre locale, fără căutare nume/ID și fără paginare Foster | Cardurile de descoperire nu sunt registru pentru 19/100 animale |

## Ce există și merită păstrat
- Separarea spațiului Foster de Animal Match.
- Catalog de cazuri și case, filtre Dogs/Cats, urgență și detalii.
- Roluri și bază SQL pentru cereri/invitații; conversații asociate acceptării.
- Admin live pentru organizații și alte cozi, cu notă și acțiuni de moderare.
Acestea nu constituie însă validarea end-to-end a întregului Foster.

## Împărțirea recomandată a acțiunilor
1. Explorează: animale care au nevoie de casă / case disponibile. Doar descoperire.
2. Casa mea: profilul casei proprii, verificare, capacitate, animale realmente în grijă.
3. Cereri: Primite și Trimise separat; fiecare cu animal, casă, solicitant, stare și următoarea acțiune.
4. Mesaje: deschidere exactă a conversației asociate cererii/invitației.
5. Operator centru: portofoliul organizației, animale, spații, responsabili, plasamente; distinct de admin PetPal.
6. Admin PetPal: verificare și moderare, dosar selectabil explicit, motiv, actor și istoric.

## Verificat / neverificat — propunere, nu regulă existentă
„Verificat PetPal” trebuie să însemne o evaluare internă definită, nu autorizare legală implicită.
- Draft: proprietarul completează și salvează.
- În verificare / completări cerute: vede dosarul, corectează, poate explora. Propun ca preluările noi să aștepte avizarea; rămâne decizie de produs.
- Verificat: poate primi plasamente în limitele evaluate; nu înseamnă disponibil automat sau competență pentru orice caz.
- Respins: motiv explicat și mecanism de retrimitere.
- Suspendat: blocare preluări noi, fără a șterge evidența animalelor deja în grijă.
Adminul: alege dosarul → verifică dovezile/spațiul/capacitatea → cere completări sau decide cu motiv → decizie în istoric → proprietarul este notificat.
Schimbările de capacitate/adresă importante trebuie tratate explicit, nu să moștenească orbește badge-ul.

## 19 și 100 animale
Nu propun doar ridicarea limitei la 100. Numărul de locuri și ocuparea sunt lucruri diferite.
- 19: listă compactă mobilă, fotografie + nume + ID stabil + specie, căutare, filtre, stare de îngrijire, responsabil.
- 100: același registru, tabel paginat pe desktop, filtre după specie/spațiu/responsabil/stare; acces al echipei limitat la organizația ei.
- Per animal: proprietar/organizație responsabilă, casă actuală, predare confirmată, date de intrare/ieșire, istoric, conversația corectă.
- Locuri pe specie și spații de izolare; nu deduce ocuparea din cereri ACCEPTED.
- Mutarea/încheierea unui plasament trebuie confirmată și păstrată în istoric. Fără butoane de aprobare în masă care decid transferuri.
- Tratamentul din UI se referă la fișa veterinară existentă; aplicația nu inventează prescripții.
Numerele 19/24 și 100 din imagini sunt scenarii de design, nu recomandări privind capacitatea sigură a unei locuințe.

## Concepte și capturi
Concepte generate cu ImageGen integrat; neimplementate, cu date fictive și texte care necesită QA înainte de cod.
- ../../output/imagegen/foster-mobile-concept.png — casa cu 19 animale, fișă animal, verificare pending.
- ../../output/imagegen/foster-operator-admin-concept.png — registru centru 100 și admin avizare.
- ../../output/imagegen/foster-prompts.md — prompturile exacte.
Capturi reale locale:
- ../../output/playwright/foster-audit-wrong-profile.png
- ../../output/playwright/foster-audit-volunteer.png
- ../../output/playwright/foster-audit-admin.png
În macheta desktop, tabelul arată doar câteva rânduri reprezentative deși footerul indică pagina de 25: este compoziție vizuală, nu rezultat de paginare testat.

## Ordine de remediere propusă
1. Proprietatea profilului și avizarea protejată în backend.
2. Cereri/invitații complete, tranziții valide, administrare selectabilă și chat exact.
3. Registru de plasamente și capacitate reală.
4. UI din conceptele aprobate; salvări, erori, accesibilitate, căutare/paginare.
5. Verificare directă multi-cont și apoi scenarii de concurență (ultima capacitate, două acceptări simultane, dosar modificat în două taburi).
Aceste teste de concurență și managementul efectiv a 100 de animale NU au fost validate în acest audit.
