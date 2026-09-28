/** REQ-AUD-010 : merge only edited fields; reject conflicting edits. */
export function fusionnerBrouillon<T extends Record<string, any>>(actuel: T, base: T, propose: T): T {
  const resultat = { ...actuel };
  for (const cle of Object.keys(propose) as (keyof T)[]) {
    if (JSON.stringify(base[cle]) === JSON.stringify(propose[cle])) continue;
    if (JSON.stringify(actuel[cle]) !== JSON.stringify(base[cle]) && JSON.stringify(actuel[cle]) !== JSON.stringify(propose[cle])) {
      throw new Error('Ces réglages ont été modifiés par un autre membre. Rechargez la page avant de reprendre votre modification.');
    }
    resultat[cle] = propose[cle];
  }
  return resultat;
}
