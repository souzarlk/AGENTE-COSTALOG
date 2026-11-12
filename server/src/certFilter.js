// Certificados que não interessam à TI e não são enviados ao painel:
// autoassinados (ex.: "localhost" de ferramentas de desenvolvimento) e
// certificados internos do Windows/Microsoft criados automaticamente.
const ignoredSubject=[/^CN=localhost\b/i,/^CN=127\.0\.0\.1\b/i,/Microsoft Your Phone/i,/Adobe Content Certificate/i];
const ignoredIssuer=[/MS-Organization/i,/Windows Azure CRP/i,/Microsoft Intune MDM/i];

export function certIgnored(c){
 const subject=String(c.subjectName||"").trim(),issuer=String(c.issuerName||"").trim();
 if(subject&&subject===issuer)return true;
 return ignoredSubject.some(r=>r.test(subject))||ignoredIssuer.some(r=>r.test(issuer));
}

// Mesma regra em SQL, para os dados já gravados.
export function certVisibleSql(alias){
 const a=alias?alias+".":"";
 return `NOT (${a}subject_name=${a}issuer_name) AND ${a}subject_name NOT LIKE 'CN=localhost%' AND ${a}subject_name NOT LIKE 'CN=127.0.0.1%' AND ${a}subject_name NOT LIKE '%Microsoft Your Phone%' AND ${a}subject_name NOT LIKE '%Adobe Content Certificate%' AND ${a}issuer_name NOT LIKE '%MS-Organization%' AND ${a}issuer_name NOT LIKE '%Windows Azure CRP%' AND ${a}issuer_name NOT LIKE '%Microsoft Intune MDM%'`;
}
