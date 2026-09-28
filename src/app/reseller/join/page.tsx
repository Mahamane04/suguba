import { redirect } from 'next/navigation';

/** REQ-PROFIL-002 : ancienne entrée revendeur, même parcours guidé et parrain conservé. */
export default async function ResellerJoinPage({searchParams}:{searchParams:Promise<{ref?:string|string[]}>}) {
  const {ref}=await searchParams;
  const params=new URLSearchParams({role:'reseller'});
  if(typeof ref==='string')params.set('ref',ref);
  redirect(`/register?${params}`);
}
