import { runProductionQa } from '../../server/productionQa.mjs';
export default async function handler(req,res){if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});try{return res.status(200).json(runProductionQa(req.body||{}));}catch(error){return res.status(400).json({error:error?.message||'Production QA is temporarily unavailable.'});}}
