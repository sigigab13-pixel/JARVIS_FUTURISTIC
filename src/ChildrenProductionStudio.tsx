import { useState } from 'react';
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
  const [busy, setBusy] = useState(false);
  const [sceneBusy, setSceneBusy] = useState(false);
  const [characterBusy, setCharacterBusy] = useState(false);
  const [continuityBusy, setContinuityBusy] = useState(false);
  const [error, setError] = useState('');

  const characterList = () => characters.split(',').map(x => x.trim()).filter(Boolean);

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
        </div>
      </div>

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

      <p style={{opacity:.72}}>Planning is separated from generation. JARVIS will not claim that a video has been rendered or published until a connected service confirms it. Continuity checks are text-level until a visual generation service is connected.</p>
    </section>
  );
}
