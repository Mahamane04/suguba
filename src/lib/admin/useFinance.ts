'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import type { Finance } from './finance';
export function useFinance(debut='',fin=''){
  const requete=useRef(0);
  const [data,setData]=useState<(Finance & {misAJourLe:string})|null>(null);const [error,setError]=useState('');
  const refresh=useCallback(async()=>{const id=++requete.current;setData(null);setError('');try{const r=await fetch(`/api/admin/finance?debut=${debut}&fin=${fin}`,{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Finance indisponible.');if(id===requete.current)setData(j);}catch(e){if(id===requete.current)setError((e as Error).message);}},[debut,fin]);
  useEffect(()=>{void refresh();},[refresh]);return {data,error,refresh};
}
