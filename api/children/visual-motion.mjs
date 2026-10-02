import { buildVisualMotionPrompt, normalizeVisualMotionPlan } from '../../server/visualMotionDirector.mjs';
const HF_URL='https://router.huggingface.co/v1/chat/completions';
const HF_MODEL=process.env.HF_MODEL || 'openai/gpt-oss-120b:fastest';
export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
 const token=process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN;
 if(!token) return res.status(503).json({error:'Hugging Face is not configured.'});
 try{
  const prompt=buildVisualMotionPrompt(req.body||{});
  const response=await fetch(HF_URL,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({model:HF_MODEL,messages:[{role:'system',content:'You are JARVIS Visual and Motion Director. Return structured, original, child-safe production planning. Never claim images or video have been generated.'},{role:'user',content:prompt}],max_tokens:5000,temperature:.45})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return res.status(response.status).json({error:data?.error||'Visual planning failed.'});
  const content=data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
  return res.status(200).json(normalizeVisualMotionPlan(content));
 }catch(error){return res.status(400).json({error:error?.message||'Visual planning failed.'});}
}
