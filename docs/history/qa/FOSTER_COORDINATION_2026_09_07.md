# Foster Coordination — implementare și verificare locală

Data: 7 septembrie 2026. Înlocuiește concluziile despre implementarea veche din `FOSTER_AUDIT_2026-09-07.md`; auditul inițial rămâne document istoric.

## Stare

Implementarea și verificarea locală sunt încheiate. Blocajul Docker a fost rezolvat cu acordul utilizatorului; datele sintetice au fost curățate. Nu este o certificare pentru producție. Nu au fost făcute commit, push, deployment sau migrări remote.

Migrațiile 0020–0023 au fost aplicate bazei locale existente și înregistrate în `supabase_migrations.schema_migrations`. Nu s-a resetat baza. Datele istorice au fost păstrate.

## Livrat

- Interfață Foster mobile-first, directoare de cazuri/case, formulare conectate, salvări, cereri și invitații, conversație din momentul cererii.
- Publicare de către persoane sau membri ai organizațiilor, fără avizarea animalelor, caselor ori capacității de către PetPal.
- Acceptare cu rezervare; doar titularul casei declară primirea. Capacitatea declarată generează avertizare și cere confirmarea depășirii, nu o interdicție absolută.
- Registru paginat și căutabil, identificatori distinctivi, înregistrarea animalelor deja în grijă, transfer, responsabil/spațiu, sarcini, jurnal, discrepanțe și încheiere.
- Echipă OWNER/CARER/READER, controlul accesului pe server, verificarea versiunii la modificări și protecție împotriva rezervărilor concurente.
- Moderare mobilă pentru platformă, selecție explicită a articolului, motiv obligatoriu și audit. Adminul desktop existent a fost aliniat, fără redesign desktop.
- VerifiedMate suspendat pentru operațiuni noi; datele istorice păstrate. Play/Social nu au fost eliminate.
- Context, ADR și documentele de produs/politici aliniate modelului aprobat. Documentele juridice rămân drafturi care necesită revizie juridică.

## Verificări executate

Nu au fost create fișiere de teste, fixtures sau helpers de test. Au fost folosite suitele existente și verificări directe în runtime.

| Verificare | Rezultat și limită |
|---|---|
| Frontend production build final | PASS, `Compiled successfully`, JS principal 193,05 kB gzip |
| Admin production build | PASS |
| Suite Jest existente | PASS, 4 suite / 11 teste |
| Audit copy/a11y existent | PASS, 824 chei, paritate RO/EN; nu înlocuiește un audit complet de accesibilitate |
| `git diff --check` final | PASS; doar avertizări Git privind normalizarea LF/CRLF |
| SQL cu rol `authenticated`, tranzacții rollback | 100 înregistrări; identități distincte; READER poate citi, nu scrie; revocare imediată; publicare individuală; chat înainte de acceptare; retry idempotent; avertizare de capacitate și override; primire exclusiv de către foster; clarificare bilaterală; încheiere, blocarea mesajelor noi pe server și review după încheiere |
| Moderare SQL, rollback | Cont obișnuit respins; ascundere/restaurare de către admin; versiune stale respinsă; autorul nu poate republica articolul ținut de moderare; privilegii directe de escaladare/modificare retrase |
| Transfer SQL, rollback | Aceeași identitate a animalului; sursa rămâne ocupată până la primirea la destinație; apoi sursa COMPLETED și destinația IN_CARE |
| Concurență reală, sesiuni DB paralele | Două cereri pentru aceeași pereche au întors aceeași cerere; două acceptări concurente pentru același animal au produs exact o rezervare activă și o respingere a duplicatului |
| Browser mobil 390 × 844, Supabase local | 100 animale, 25 rânduri/pagină, 4 pagini, căutarea celui de-al 100-lea animal și deschiderea detaliului; creare/finalizare sarcină |
| Browser, două conturi | Publicare caz → cerere → chat înainte de acceptare → avertizare capacitate și confirmare explicită → acceptare → primire doar din contul foster → încheiere → compozitor chat dezactivat |
| Browser admin mobil | PASS după recuperarea Docker: selectarea celui de-al patrulea articol, motiv și confirmare din UI; DB confirmă `PAUSED`, `moderation_hold=true` și audit `LISTING_PAUSE` cu motivul introdus. Doar cazul sintetic a fost moderat |
| Recuperare și curățare | Docker restabilit fără reset/ștergere de volume; toate cele cinci servicii PetPal cu health-check healthy, REST funcțional; cold reload în două conturi și date QA eliminate |

Verificările SQL au avut și ajustări ale scenariilor: contul seeded suspendat a fost înlocuit cu unul activ, iar verificarea sursei transferului a fost făcută cu identitatea care are acces. În browser, conversația încheiată păstrează compozitorul dezactivat, nu îl ascunde. Rezultatele PASS de mai sus sunt după aceste corecții ale așteptărilor.

## Dovezi vizuale locale

- `output/playwright/foster-home-implemented.png`
- `output/playwright/foster-100-registry-page1.png`
- `output/playwright/foster-100-search.png`
- `output/playwright/foster-care-detail.png`
- `output/playwright/foster-pending-chat.png`
- `output/playwright/foster-capacity-warning.png`
- `output/playwright/foster-closed-chat.png`
- `output/playwright/foster-100-registry-rows.png` — rânduri reale, viewport 390 × 844, după recuperarea Docker
- `output/playwright/foster-mobile-moderation.png` — formularul real, viewport 390 × 844

Machetele ImageGen existente sunt referințe de design, nu dovezi de execuție. Captura registrului de pe prima pagină nu arată toate rândurile; paginarea și căutarea au fost verificate în browser.

## Recuperare Docker și curățare QA — încheiate

Backendul local a devenit indisponibil în timpul verificării. Pornirea Docker Desktop eșua la redenumirea `sailor-ingest.sock` (`The file cannot be accessed by the system`). După acordul utilizatorului, procesele Docker blocate au fost oprite, conținutul celor două directoare runtime a fost verificat (numai socketuri/reparse points de zero bytes), iar directoarele au fost mutate recuperabil în:

- `C:/Users/razva/AppData/Local/Docker/run.stale-petpal-20260907-2050`
- `C:/Users/razva/AppData/Local/docker-secrets-engine.stale-petpal-20260907-2050`

Docker a pornit fără reboot, reset sau modificarea volumelor. DB, Auth, Kong, Realtime și Storage PetPal au devenit healthy; REST a încărcat schema și servește cererile. Migrațiile 0020–0023 sunt păstrate. Nu s-au pornit manual containerele oprite ale altor proiecte.

Următoarele date sintetice au fost reverificate și eliminate, fără resetarea bazei. Inventarul de mai jos este istoric, nu o listă de șters din nou:

- Casa `71000000-0000-4000-8000-000000000100`, nume `QA local · 100 animals`, nepublicată, aparținând contului Ana seeded.
- 100 plasamente manuale cu ID-uri `72000000-0000-4000-8000-000000000001` până la `72000000-0000-4000-8000-000000000100`, plus animalele sintetice asociate. Proveniență: `Synthetic local verification only`.
- Cazul `7f706f78-434a-4179-992a-5f67bba07fda`, titlu `QA browser handover`, descriere `Synthetic local browser verification. Not a real animal.`, animal `afc230ea-beea-4099-b194-fbf0acaeb05d`.
- Trei cereri pentru acest caz, trei conversații asociate, mesajele și notificările lor. Cererile includ `73000000-0000-4000-8000-000000000002` și `73000000-0000-4000-8000-000000000003`.
- Două plasamente pentru acest caz, unul încheiat prin browser și rezervarea concurentă `fed7082d-3a47-4c76-9107-1e918dafa2c5`. Ultimul inventar al casei QA: 102 plasamente, 101 animale distincte în total.
- O sarcină finalizată și jurnalele/evenimentele aferente acestor înregistrări.

Tranzacția de curățare a validat ID-urile, proprietarii, proveniența, numărul de înregistrări și absența referințelor externe neașteptate. A eliminat 101 animale, 102 plasamente, o casă, un caz, 3 cereri, 3 conversații/4 mesaje, 15 notificări, o sarcină, 106 intrări de jurnal și 7 evenimente de cerere. Singura intrare de audit a probei UI a fost eliminată separat după verificarea ID-ului și a motivului exact; zero intrări QA rămase pentru acel caz.

Comparație JSON înainte/după, în aceeași tranzacție: toate cele 1.134 înregistrări originale din animals, listings, homes, profiles, requests, placements, conversations, messages și reports au rămas neschimbate. Inventar final: 3 animale, 3 listări, o casă, 5 profiluri, 8 conversații, 1.113 mesaje, un raport; zero cereri/plasamente/sarcini/jurnale Foster sintetice. Nu există backup SQL separat al datelor QA șterse; acestea erau exclusiv sintetice și pot fi recreate pentru verificări viitoare.

## Limite înainte de producție

Validare pe telefon/Android real și staging înainte de orice afirmație de pregătire pentru producție. Nu s-au testat APK/emulator/dispozitiv fizic, push în producție sau un test de încărcare multiutilizator. Verificarea celor 100 animale a fost funcțională, nu benchmark de performanță.

Textele generate de server pentru unele evenimente din jurnal rămân în engleză. Nu s-a adăugat traducerea dinamică a jurnalului istoric.
