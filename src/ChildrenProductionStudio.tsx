import { useEffect, useState } from 'react';
import { api } from './api';

const genres = ['rhymes', 'bedtime story', 'adventure', 'educational story', 'moral story', 'science story'];
const formats = ['16:9', '9:16', '1:1'];

export default function ChildrenProductionStudio() {
  const [idea, setIdea] = useState('');
  const [genre, setGenre] = useState('bedtime story');
  const [ageRange, setAgeRange] = useState('6-10');
  const [lesson, setLesson] = useState('');
  const [characters, setCharacters] = useState('');
  const [format, setFormat] = useState('16:9');
  const [story, setStory] = useState<any>(null);
  const [pack, setPack] = useState<any>(null);
  const [scenes, setScenes] = useState<any[]>([]);
  const [characterBible, setCharacterBible] = useState<any>(null);
  const [continuity, setContinuity] = useState<any>(null);
  const [visualPlan, setVisualPlan] = useState<any>(null);
  const [audioPlan, setAudioPlan] = useState<any>(null);
  const [lipSyncPlan, setLipSyncPlan] = useState<any>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [qa, setQa] = useState<any>(null);
  const [generationPlan, setGenerationPlan] = useState<any>(null);
  const [generationCapabilities, setGenerationCapabilities] = useState<any>(null);
  const [lipSyncBusy, setLipSyncBusy] = useState(false);
  const [timelineBusy, setTimelineBusy] = useState(false);
  const [qaBusy, setQaBusy] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [visualBusy, setVisualBusy] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sceneBusy, setSceneBusy] = useState(false);
  const [characterBusy, setCharacterBusy] = useState(false);
  const [continuityBusy, setContinuityBusy] = useState(false);
  const [error, setError] = useState('');

  const characterList = () => characters.split(',').map(x => x.trim()).filter(Boolean);

  useEffect(() => {
    let active = true;
    void api.get('/api/children/generation-capabilities')
      .then(response => { if (active) setGenerationCapabilities(response.data); })
      .catch(() => { if (active) setGenerationCapabilities(null); });
    return () => { active = false; };
  }, []);

  const createStory = async () => {
    if (!idea.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const response = await api.post('/api/children/story', {
        idea, genre, ageRange, lesson, characters: characterList(), length: 'medium',
      });
      setStory(response.data);
      setPack(null); setScenes([]); setCharacterBible(null); setContinuity(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Story creation is temporarily unavailable.');
    } finally { setBusy(false); }
  };

  const buildPack = async () => {
    if (!story?.content || busy) return;
    setBusy(true); setError('');
    try {
      const response = await api.post('/api/children/story-pack', {
        title: story.title, story: story.content, genre, ageRange,
        characters: characterList(),
        productionTypes: ['full episode', 'short clip', 'rhyme', 'educational clip'],
      });
      setPack(response.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Story Pack creation is temporarily unavailable.');
    } finally { setBusy(false); }
  };

  const buildCharacters = async () => {
    if (!story?.content || characterBusy) return;
    setCharacterBusy(true); setError('');
    try {
      const response = await api.post('/api/children/characters', {
        title: story.title, masterStory: story.content, ageRange, characters: characterList(),
      });
      setCharacterBible(response.data);
      setContinuity(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Character Bible is temporarily unavailable.');
    } finally { setCharacterBusy(false); }
  };

  const buildScenes = async () => {
    if (!story?.content || sceneBusy) return;
    setSceneBusy(true); setError('');
    try {
      const response = await api.post('/api/children/scenes', {
        title: story.title, masterStory: story.content, genre, ageRange,
        characters: characterList(), sceneCount: 6,
      });
      setScenes(Array.isArray(response.data?.scenes) ? response.data.scenes : []);
      setContinuity(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Scene Director is temporarily unavailable.');
    } finally { setSceneBusy(false); }
  };

  const buildVisualPlan = async () => {
    if (!scenes.length || visualBusy) return;
    setVisualBusy(true); setError('');
    try {
      const response = await api.post('/api/children/visual-motion', { title: story?.title, scenes, characters: characterBible?.characters || characterList(), format, ageRange });
      setVisualPlan(response.data);
    } catch (e: any) { setError(e?.response?.data?.error || 'Visual and motion planning is temporarily unavailable.'); }
    finally { setVisualBusy(false); }
  };

  const buildAudioPlan = async () => {
    if (!scenes.length || audioBusy) return;
    setAudioBusy(true); setError('');
    try {
      const response = await api.post('/api/children/voice-audio', { title: story?.title, scenes, characters: characterBible?.characters || characterList(), ageRange, language: 'en' });
      setAudioPlan(response.data);
    } catch (e: any) { setError(e?.response?.data?.error || 'Voice and audio planning is temporarily unavailable.'); }
    finally { setAudioBusy(false); }
  };

  const buildLipSync = async () => {
    if (!scenes.length || lipSyncBusy) return;
    setLipSyncBusy(true); setError('');
    try {
      const response = await api.post('/api/children/lipsync', { title: story?.title, scenes, characters: characterBible?.characters || characterList(), ageRange });
      setLipSyncPlan(response.data);
    } catch (e: any) { setError(e?.response?.data?.error || 'Lip-sync planning is temporarily unavailable.'); }
    finally { setLipSyncBusy(false); }
  };

  const buildTimeline = async () => {
    if (!scenes.length || timelineBusy) return;
    setTimelineBusy(true); setError('');
    try {
      const response = await api.post('/api/children/timeline', { title: story?.title, scenes, audioPlan, lipSyncPlan, format });
      setTimeline(response.data);
    } catch (e: any) { setError(e?.response?.data?.error || 'Timeline planning is temporarily unavailable.'); }
    finally { setTimelineBusy(false); }
  };

  const runQa = async () => {
    if (qaBusy) return;
    setQaBusy(true); setError('');
    try {
      const response = await api.post('/api/children/qa', { story, characterBible, scenes, visualPlan, audioPlan, lipSyncPlan, timeline, pack });
      setQa(response.data);
    } catch (e: any) { setError(e?.response?.data?.error || 'Production QA is temporarily unavailable.'); }
    finally { setQaBusy(false); }
  };

  const prepareGeneration = async () => {
    if (!scenes.length || generationBusy) return;
    setGenerationBusy(true); setError('');
    try {
      const response = await api.post('/api/children/generation-plan', {
        title: story?.title, ageRange, format, scenes, visualPlan, audioPlan, lipSyncPlan, qa,
      });
      setGenerationPlan(response.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Generation preparation is temporarily unavailable.');
    } finally { setGenerationBusy(false); }
  };

  const checkContinuity = async () => {
    if (!scenes.length || !characterBible?.characters?.length || continuityBusy) return;
    setContinuityBusy(true); setError('');
    try {
      const response = await api.post('/api/children/continuity', {
        scenes, characters: characterBible.characters,
      });
      setContinuity(response.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Continuity check is temporarily unavailable.');
    } finally { setContinuityBusy(false); }
  };

  return (
    <section style={{display:'grid',gap:16,padding:20}}>
      <div>
        <span className="eyebrow">JARVIS CHILDREN'S CONTENT ENGINE</span>
        <h2>Children's Production Studio</h2>
        <p>One original story can become an episode, clips, a rhyme and an educational moment.</p>
      </div>

      <div style={{display:'grid',gap:10}}>
        <textarea value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Story idea..." />
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
          <select value={genre} onChange={e=>setGenre(e.target.value)}>{genres.map(x=><option key={x}>{x}</option>)}</select>
          <input value={ageRange} onChange={e=>setAgeRange(e.target.value)} placeholder="Age range" />
          <select value={format} onChange={e=>setFormat(e.target.value)}>{formats.map(x=><option key={x}>{x}</option>)}</select>
        </div>
        <input value={lesson} onChange={e=>setLesson(e.target.value)} placeholder="Lesson or learning goal (optional)" />
        <input value={characters} onChange={e=>setCharacters(e.target.value)} placeholder="Characters, separated by commas" />
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button className="security-primary" onClick={()=>void createStory()} disabled={busy || !idea.trim()}>{busy ? 'Working...' : 'Create Story'}</button>
          <button className="security-secondary" onClick={()=>void buildPack()} disabled={busy || !story?.content}>Build Story Pack</button>
          <button className="security-secondary" onClick={()=>void buildCharacters()} disabled={characterBusy || !story?.content}>{characterBusy ? 'Building...' : 'Build Character Bible'}</button>
          <button className="security-secondary" onClick={()=>void buildScenes()} disabled={sceneBusy || !story?.content}>{sceneBusy ? 'Directing...' : 'Build Scenes'}</button>
          <button className="security-secondary" onClick={()=>void checkContinuity()} disabled={continuityBusy || !scenes.length || !characterBible?.characters?.length}>{continuityBusy ? 'Checking...' : 'Check Continuity'}</button>
          <button className="security-secondary" onClick={()=>void buildVisualPlan()} disabled={visualBusy || !scenes.length}>{visualBusy ? 'Planning Visuals...' : 'Build Visual Plan'}</button>
          <button className="security-secondary" onClick={()=>void buildAudioPlan()} disabled={audioBusy || !scenes.length}>{audioBusy ? 'Planning Audio...' : 'Build Voice / Audio Plan'}</button>
          <button className="security-secondary" onClick={()=>void buildLipSync()} disabled={lipSyncBusy || !scenes.length}>{lipSyncBusy ? 'Planning Lip-Sync...' : 'Build Lip-Sync Plan'}</button>
          <button className="security-secondary" onClick={()=>void buildTimeline()} disabled={timelineBusy || !scenes.length}>{timelineBusy ? 'Building Timeline...' : 'Build Timeline'}</button>
          <button className="security-secondary" onClick={()=>void runQa()} disabled={qaBusy}>{qaBusy ? 'Checking QA...' : 'Run Production QA'}</button>
          <button className="security-secondary" onClick={()=>void prepareGeneration()} disabled={generationBusy || !scenes.length}>{generationBusy ? 'Preparing...' : 'Prepare Media Generation'}</button>

        </div>
      </div>

      {generationCapabilities && (
        <article className="video-card">
          <span className="card-label">MEDIA PROVIDER CAPABILITIES</span>
          <h3>Generation layer connected to concrete provider models</h3>
          <p>Planning only until provider credentials are configured in JARVIS. No media job is submitted from this status check.</p>
          <div style={{display:'grid',gap:8}}>
            <div><b>Higgsfield:</b> {generationCapabilities.providers?.higgsfield?.imageModel} → {generationCapabilities.providers?.higgsfield?.motionModel} → {generationCapabilities.providers?.higgsfield?.lipSyncModel}</div>
            <div><b>ElevenLabs:</b> {generationCapabilities.providers?.elevenlabs?.speechModel}</div>
          </div>
        </article>
      )}

      {error && <div className="security-result">{error}</div>}

      {story && (
        <article className="video-card">
          <span className="card-label">MASTER STORY</span>
          <h3>{story.title}</h3>
          <p style={{whiteSpace:'pre-wrap'}}>{story.content}</p>
        </article>
      )}

      {characterBible?.characters?.length > 0 && (
        <article className="video-card">
          <span className="card-label">CHARACTER BIBLE</span>
          <h3>{characterBible.characters.length} locked character profiles</h3>
          <div style={{display:'grid',gap:10}}>
            {characterBible.characters.map((character:any) => (
              <div key={character.id} style={{padding:12,border:'1px solid #21445b',borderRadius:10}}>
                <b>{character.name}</b> <small>· {character.role}</small>
                <p><b>Personality:</b> {character.personality || 'planned'}</p>
                <p><b>Appearance:</b> {character.appearance || 'planned'}</p>
                <p><b>Clothing:</b> {character.clothing || 'planned'}</p>
                <p><b>Voice:</b> {character.voiceDirection || 'planned'}</p>
                <small>Identity lock: {character.identityLock}</small>
              </div>
            ))}
          </div>
        </article>
      )}

      {pack && (
        <article className="video-card">
          <span className="card-label">PRODUCTION PLAN</span>
          <h3>{pack.title}</h3>
          <div className="video-tags"><span>{format}</span><span>{pack.ageRange}</span><span>{pack.qa?.status || 'pending'}</span></div>
          <div className="video-pipeline">
            {[
              ['01','Story'],['02','Character Bible'],['03','Scenes'],['04','Full Episode'],
              ['05','Short Clips'],['06','Rhyme'],['07','Educational Clip'],
              ['08','Thumbnail'],['09','QA'],['10','Render / Publish']
            ].map(([n,label])=><div key={n}><b>{n}</b><span>{label}</span></div>)}
          </div>
          <p><b>Render:</b> {pack.render?.status || 'not_started'} · <b>Publish:</b> {pack.publish?.status || 'not_started'}</p>
        </article>
      )}

      {scenes.length > 0 && (
        <article className="video-card">
          <span className="card-label">SCENE DIRECTOR</span>
          <h3>{scenes.length} planned scenes</h3>
          <div style={{display:'grid',gap:10}}>
            {scenes.map(scene => (
              <div key={scene.sceneNumber} style={{padding:12,border:'1px solid #21445b',borderRadius:10}}>
                <b>Scene {scene.sceneNumber}: {scene.title}</b>
                <p>{scene.setting}</p>
                <p><b>Action:</b> {scene.action}</p>
                {scene.dialogue && <p><b>Dialogue:</b> {scene.dialogue}</p>}
                <small>Visual: {scene.visualPlan || 'planned'} · Lip-sync: {scene.lipSyncPlan?.status || 'planned'}</small>
              </div>
            ))}
          </div>
        </article>
      )}

      {visualPlan?.scenes?.length > 0 && (
        <article className="video-card">
          <span className="card-label">VISUAL + MOTION DIRECTOR</span>
          <h3>{visualPlan.scenes.length} visual plans</h3>
          <div style={{display:'grid',gap:8}}>
            {visualPlan.scenes.map((v:any) => <div key={v.sceneNumber} style={{padding:10,border:'1px solid #21445b',borderRadius:8}}><b>Scene {v.sceneNumber}</b><p>Shot: {v.shotType} · Camera: {v.cameraMovement || 'planned'}</p><p>{v.composition}</p><small>Continuity: {v.continuityLock}</small></div>)}
          </div>
        </article>
      )}

      {audioPlan?.scenes?.length > 0 && (
        <article className="video-card">
          <span className="card-label">VOICE + AUDIO DIRECTOR</span>
          <h3>{audioPlan.scenes.length} audio plans</h3>
          <div style={{display:'grid',gap:8}}>
            {audioPlan.scenes.map((a:any) => <div key={a.sceneNumber} style={{padding:10,border:'1px solid #21445b',borderRadius:8}}><b>Scene {a.sceneNumber}</b><p>Emotion: {a.emotion || 'planned'} · Pacing: {a.pacing || 'planned'}</p><p>Music: {a.musicMood || 'planned'}</p><small>Mix: {a.mixNotes || 'planned'}</small></div>)}
          </div>
        </article>
      )}

      {lipSyncPlan?.scenes?.length > 0 && (
        <article className="video-card"><span className="card-label">LIP-SYNC DIRECTOR</span><h3>{lipSyncPlan.scenes.length} lip-sync plans</h3><div style={{display:'grid',gap:8}}>{lipSyncPlan.scenes.map((s:any)=><div key={s.sceneNumber} style={{padding:10,border:'1px solid #21445b',borderRadius:8}}><b>Scene {s.sceneNumber}</b><p>{s.segments?.length || 0} dialogue segments</p><small>Status: {lipSyncPlan.status}</small></div>)}</div></article>
      )}

      {timeline?.scenes?.length > 0 && (
        <article className="video-card"><span className="card-label">EDIT / TIMELINE DIRECTOR</span><h3>{timeline.scenes.length} timeline scenes</h3><p>Sequence: {timeline.sequenceId}</p><p>Tracks: {timeline.tracks?.join(' · ')}</p><p><b>Render:</b> {timeline.render?.status} · <b>Publish:</b> {timeline.publish?.status}</p></article>
      )}

      {qa && (
        <article className="video-card"><span className="card-label">PRODUCTION QA GATE</span><h3>{qa.status === 'ready_for_generation' ? 'Ready for generation' : 'Needs review'}</h3><p>{qa.issues?.length || 0} blocking issue(s) · {qa.warnings?.length || 0} warning(s)</p>{qa.issues?.map((x:string,i:number)=><div key={i} style={{padding:8,border:'1px solid #21445b',borderRadius:8,marginTop:6}}>{x}</div>)}<small>{qa.note}</small></article>
      )}

      {generationPlan?.jobs?.length > 0 && (
        <article className="video-card">
          <span className="card-label">MEDIA GENERATION GATE</span>
          <h3>Generation prepared — not executed</h3>
          <p>Higgsfield: {generationPlan.providers?.higgsfield} · ElevenLabs: {generationPlan.providers?.elevenlabs}</p>
          <div style={{display:'grid',gap:8}}>
            {generationPlan.jobs.map((job:any) => (
              <div key={job.sceneNumber} style={{padding:10,border:'1px solid #21445b',borderRadius:8}}>
                <b>Scene {job.sceneNumber}</b>
                <p>Visual: {job.visual?.status} · Audio: {job.audio?.status} · Lip-sync: {job.lipSync?.status}</p>
                <small>Execution: {job.execution}</small>
              </div>
            ))}
          </div>
          <small>Preparation creates safe provider jobs only. No media is claimed as generated until a connected provider confirms a result.</small>
        </article>
      )}

      {continuity && (
        <article className="video-card">
          <span className="card-label">CONTINUITY GUARD</span>
          <h3>{continuity.status === 'planned_ok' ? 'No text-level continuity issues found' : 'Review continuity flags'}</h3>
          <p>Checked {continuity.checkedScenes} scenes against {continuity.checkedCharacters} character profiles.</p>
          {continuity.issues?.length > 0 && (
            <div style={{display:'grid',gap:8}}>
              {continuity.issues.map((issue:any, index:number) => (
                <div key={index} style={{padding:10,border:'1px solid #21445b',borderRadius:8}}>
                  Scene {issue.sceneNumber || '—'} · {issue.character || 'Continuity'}: {issue.issue}
                </div>
              ))}
            </div>
          )}
          <small>{continuity.note}</small>
        </article>
      )}

      <p style={{opacity:.72}}>Planning is separated from generation. JARVIS will not claim that a video, image, voice track, or audio track has been generated or published until a connected service confirms it. Visual planning, audio planning, and continuity checks are planning-layer operations until generation services are connected.</p>
    </section>
  );
}
